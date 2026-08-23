-- Migration 000003: Stored Procedures sell_product_item, login_staff_pin, and create_or_update_seller

-- 1. SECURITY DEFINER Staff Login RPC (Phone + 4-digit PIN hash verification)
CREATE OR REPLACE FUNCTION public.login_staff_pin(
    p_phone TEXT,
    p_pin_hash TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT * INTO v_profile 
    FROM public.profiles 
    WHERE phone = p_phone AND is_active = true;

    IF v_profile.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Профиль сотрудника не найден или деактивирован'
        );
    END IF;

    IF v_profile.pin_hash <> p_pin_hash THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Неверный ПИН-код'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'profile', jsonb_build_object(
            'id', v_profile.id,
            'full_name', v_profile.full_name,
            'phone', v_profile.phone,
            'role', v_profile.role,
            'location', v_profile.location
        )
    );
END;
$$;

-- 2. SECURITY DEFINER Staff Management RPC (Admin create/update seller profiles)
CREATE OR REPLACE FUNCTION public.create_or_update_seller(
    p_phone TEXT,
    p_full_name TEXT,
    p_pin_hash TEXT,
    p_role TEXT,
    p_location TEXT,
    p_is_active BOOLEAN DEFAULT true
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    INSERT INTO public.profiles (phone, full_name, pin_hash, role, location, is_active)
    VALUES (p_phone, p_full_name, p_pin_hash, p_role, p_location, p_is_active)
    ON CONFLICT (phone) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        pin_hash = CASE WHEN p_pin_hash IS NOT NULL AND p_pin_hash <> '' THEN EXCLUDED.pin_hash ELSE public.profiles.pin_hash END,
        role = EXCLUDED.role,
        location = EXCLUDED.location,
        is_active = EXCLUDED.is_active
    RETURNING id INTO v_profile_id;

    RETURN jsonb_build_object(
        'success', true,
        'profile_id', v_profile_id
    );
END;
$$;

-- 3. SECURITY DEFINER sell_product_item with FOR UPDATE locking
CREATE OR REPLACE FUNCTION public.sell_product_item(
    p_client_sale_id UUID,
    p_product_id UUID,
    p_location TEXT,
    p_size INTEGER,
    p_payment_method TEXT,
    p_is_offline BOOLEAN DEFAULT false
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_seller_id UUID := auth.uid();
    v_seller_name TEXT;
    v_product RECORD;
    v_stock RECORD;
    v_new_qty INTEGER;
    v_overdraft BOOLEAN := false;
    v_existing_sale_id UUID;
    v_sale_id UUID;
BEGIN
    -- Idempotency Check: prevent duplicate sales from offline retries
    IF p_client_sale_id IS NOT NULL THEN
        SELECT id INTO v_existing_sale_id FROM public.sales WHERE client_sale_id = p_client_sale_id;
        IF v_existing_sale_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true, 
                'message', 'Sale already processed', 
                'sale_id', v_existing_sale_id,
                'already_processed', true
            );
        END IF;
    END IF;

    -- Fetch seller profile info
    IF v_seller_id IS NOT NULL THEN
        SELECT full_name INTO v_seller_name FROM public.profiles WHERE id = v_seller_id;
    END IF;
    IF v_seller_name IS NULL THEN 
        v_seller_name := 'Продавец'; 
    END IF;

    -- Verify product
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND is_active = true;
    IF v_product.id IS NULL THEN
        RAISE EXCEPTION 'Товар не найден или деактивирован';
    END IF;

    -- Row locking FOR UPDATE on product_stock
    SELECT * INTO v_stock FROM public.product_stock 
    WHERE product_id = p_product_id AND location = p_location AND size = p_size 
    FOR UPDATE;

    -- If stock row doesn't exist yet, insert row with 0 quantity
    IF v_stock.id IS NULL THEN
        INSERT INTO public.product_stock (product_id, location, size, quantity)
        VALUES (p_product_id, p_location, p_size, 0)
        RETURNING * INTO v_stock;
    END IF;

    -- Handle stock quantity & offline overdraft
    IF v_stock.quantity <= 0 THEN
        IF p_is_offline THEN
            v_overdraft := true;
        ELSE
            RAISE EXCEPTION 'Размер % отсутствует в точке %', p_size, p_location;
        END IF;
    END IF;

    v_new_qty := v_stock.quantity - 1;

    -- Update stock
    UPDATE public.product_stock 
    SET quantity = v_new_qty, updated_at = now() 
    WHERE id = v_stock.id;

    -- Record sale
    INSERT INTO public.sales (
        client_sale_id, product_id, article, brand, name, price, location, size,
        payment_method, seller_id, seller_name, status, is_offline_synced, overdraft_warning
    ) VALUES (
        p_client_sale_id, p_product_id, v_product.article, v_product.brand, v_product.name,
        v_product.price, p_location, p_size, p_payment_method, v_seller_id, v_seller_name,
        'completed', p_is_offline, v_overdraft
    ) RETURNING id INTO v_sale_id;

    -- Record stock movement
    INSERT INTO public.stock_movements (
        product_id, location, size, change, quantity_after, reason, sale_id, actor_id
    ) VALUES (
        p_product_id, p_location, p_size, -1, v_new_qty, 
        CASE WHEN v_overdraft THEN 'offline_sync_overdraft' ELSE 'sale' END,
        v_sale_id, v_seller_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'new_quantity', v_new_qty,
        'overdraft_warning', v_overdraft
    );
END;
$$;
