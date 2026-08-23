-- Security hardening. Apply after 000001–000003 on an existing project.
-- Existing SHA-256 PIN hashes cannot be safely upgraded; reset every staff PIN
-- in the SQL editor with: UPDATE profiles SET pin_hash = crypt('NEW_6+_PIN', gen_salt('bf', 12)) WHERE phone = '+7...';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store Kazakhstan numbers in the same digits-only format produced by the
-- browser normalizer, so legacy values such as +7 700 ... continue to work.
UPDATE public.profiles SET phone = regexp_replace(phone, '\\D', '', 'g')
WHERE phone <> regexp_replace(phone, '\\D', '', 'g');

CREATE TABLE IF NOT EXISTS public.staff_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_login_attempts (
  phone TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_staff_sessions_token_hash ON public.staff_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_reservations_expires_at ON public.reservations(expires_at) WHERE status = 'new';

-- Browser clients only receive the public catalogue. All staff data goes
-- through guarded RPCs below; direct access must not expose customer PII.
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow public insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated manage products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated manage product_stock" ON public.product_stock;
DROP POLICY IF EXISTS "Allow authenticated read sales" ON public.sales;
DROP POLICY IF EXISTS "Allow authenticated insert sales" ON public.sales;
DROP POLICY IF EXISTS "Allow authenticated update sales" ON public.sales;
DROP POLICY IF EXISTS "Allow authenticated read stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Allow authenticated insert stock_movements" ON public.stock_movements;

REVOKE ALL ON public.profiles, public.reservations, public.sales, public.stock_movements, public.staff_sessions, public.staff_login_attempts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products, public.product_stock FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_staff_session(p_session_token TEXT, p_required_role TEXT DEFAULT NULL)
RETURNS TABLE(profile_id UUID, staff_role TEXT, staff_location TEXT, staff_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) < 32 THEN
    RAISE EXCEPTION 'Требуется действующая сессия сотрудника';
  END IF;

  RETURN QUERY
  SELECT p.id, p.role, p.location, p.full_name
  FROM public.staff_sessions s
  JOIN public.profiles p ON p.id = s.profile_id
  WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL AND s.expires_at > now() AND p.is_active
    AND (p_required_role IS NULL OR p.role = p_required_role);

  IF NOT FOUND THEN RAISE EXCEPTION 'Сессия истекла или недостаточно прав'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_staff_session(TEXT, TEXT) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.login_staff_pin(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.login_staff_pin(p_phone TEXT, p_pin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_attempt public.staff_login_attempts%ROWTYPE;
  v_token TEXT;
BEGIN
  IF p_phone !~ '^7[0-9]{10}$' OR p_pin !~ '^[0-9]{6,12}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Неверные учётные данные');
  END IF;
  SELECT * INTO v_attempt FROM public.staff_login_attempts WHERE phone = p_phone FOR UPDATE;
  IF v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Слишком много попыток. Повторите позже');
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE phone = p_phone AND is_active;
  IF NOT FOUND OR v_profile.pin_hash !~ '^\$2[aby]\$' OR crypt(p_pin, v_profile.pin_hash) <> v_profile.pin_hash THEN
    INSERT INTO public.staff_login_attempts(phone, failed_count, locked_until, updated_at)
    VALUES (p_phone, 1, NULL, now())
    ON CONFLICT (phone) DO UPDATE SET
      failed_count = CASE WHEN public.staff_login_attempts.failed_count >= 4 THEN 0 ELSE public.staff_login_attempts.failed_count + 1 END,
      locked_until = CASE WHEN public.staff_login_attempts.failed_count >= 4 THEN now() + interval '15 minutes' ELSE NULL END,
      updated_at = now();
    RETURN jsonb_build_object('success', false, 'message', 'Неверные учётные данные');
  END IF;
  DELETE FROM public.staff_login_attempts WHERE phone = p_phone;
  DELETE FROM public.staff_sessions WHERE profile_id = v_profile.id OR expires_at <= now();
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.staff_sessions(profile_id, token_hash, expires_at)
  VALUES (v_profile.id, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '2 hours');
  RETURN jsonb_build_object('success', true, 'session_token', v_token,
    'profile', jsonb_build_object('id', v_profile.id, 'full_name', v_profile.full_name, 'role', v_profile.role, 'location', v_profile.location));
END;
$$;

DROP FUNCTION IF EXISTS public.create_or_update_seller(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.create_or_update_seller(p_phone TEXT, p_full_name TEXT, p_pin TEXT, p_role TEXT, p_location TEXT, p_is_active BOOLEAN, p_session_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM 1 FROM public.require_staff_session(p_session_token, 'admin');
  IF p_phone !~ '^7[0-9]{10}$' OR length(trim(p_full_name)) < 3 OR p_role NOT IN ('admin','seller') OR p_location NOT IN ('bazaar','mall') THEN RAISE EXCEPTION 'Некорректные данные сотрудника'; END IF;
  IF p_pin IS NOT NULL AND p_pin !~ '^[0-9]{6,12}$' THEN RAISE EXCEPTION 'ПИН должен состоять из 6–12 цифр'; END IF;
  IF p_pin IS NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE phone = p_phone) THEN RAISE EXCEPTION 'Для нового сотрудника обязателен ПИН'; END IF;
  INSERT INTO public.profiles(phone, full_name, pin_hash, role, location, is_active)
  VALUES (p_phone, trim(p_full_name), crypt(p_pin, gen_salt('bf', 12)), p_role, p_location, p_is_active)
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, location = EXCLUDED.location,
    is_active = EXCLUDED.is_active, pin_hash = CASE WHEN p_pin IS NULL THEN public.profiles.pin_hash ELSE crypt(p_pin, gen_salt('bf', 12)) END
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'profile_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_staff_active(p_phone TEXT, p_is_active BOOLEAN, p_session_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.require_staff_session(p_session_token, 'admin');
  UPDATE public.profiles SET is_active = p_is_active WHERE phone = p_phone;
  IF NOT FOUND THEN RAISE EXCEPTION 'Сотрудник не найден'; END IF;
  IF NOT p_is_active THEN UPDATE public.staff_sessions SET revoked_at = now() WHERE profile_id = (SELECT id FROM public.profiles WHERE phone = p_phone); END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_staff_profiles(p_session_token TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.require_staff_session(p_session_token, 'admin');
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(p) - 'pin_hash' ORDER BY p.created_at DESC) FROM public.profiles p), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_expired_reservations() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_res public.reservations%ROWTYPE; v_qty INTEGER; v_count INTEGER := 0;
BEGIN
  FOR v_res IN SELECT * FROM public.reservations
    WHERE status IN ('new','contacted','waiting_payment') AND expires_at IS NOT NULL AND expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.reservations SET status='cancelled', updated_at=now() WHERE id=v_res.id;
    UPDATE public.product_stock SET quantity=quantity+1, updated_at=now()
      WHERE product_id=v_res.product_id AND location=v_res.preferred_location AND size=v_res.size RETURNING quantity INTO v_qty;
    INSERT INTO public.stock_movements(product_id,location,size,change,quantity_after,reason,reservation_id)
      VALUES(v_res.product_id,v_res.preferred_location,v_res.size,1,v_qty,'reservation_expired',v_res.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.release_expired_reservations() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_reservation(p_product_id UUID, p_size INTEGER, p_location TEXT, p_customer_name TEXT, p_customer_phone TEXT, p_request_type TEXT, p_comment TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_product public.products%ROWTYPE; v_stock public.product_stock%ROWTYPE; v_id UUID;
BEGIN
  IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 3 OR p_customer_phone !~ '^7[0-9]{10}$' OR p_request_type NOT IN ('fitting','kaspi_manual_payment') THEN RAISE EXCEPTION 'Некорректные данные бронирования'; END IF;
  PERFORM public.release_expired_reservations();
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Товар недоступен'; END IF;
  SELECT * INTO v_stock FROM public.product_stock WHERE product_id=p_product_id AND location=p_location AND size=p_size FOR UPDATE;
  IF NOT FOUND OR v_stock.quantity <= 0 THEN RAISE EXCEPTION 'Выбранный размер закончился'; END IF;
  UPDATE public.product_stock SET quantity = quantity - 1, updated_at = now() WHERE id = v_stock.id;
  INSERT INTO public.reservations(product_id, article, brand, name, size, preferred_location, customer_name, customer_phone, request_type, comment, expires_at)
  VALUES (p_product_id, v_product.article, v_product.brand, v_product.name, p_size, p_location, trim(p_customer_name), p_customer_phone, p_request_type, left(coalesce(p_comment,''), 100), now() + interval '24 hours') RETURNING id INTO v_id;
  INSERT INTO public.stock_movements(product_id,location,size,change,quantity_after,reason,reservation_id) VALUES(p_product_id,p_location,p_size,-1,v_stock.quantity-1,'reservation',v_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_staff_reservations(p_session_token TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor RECORD;
BEGIN
  SELECT * INTO v_actor FROM public.require_staff_session(p_session_token, NULL);
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM public.reservations r WHERE v_actor.staff_role='admin' OR r.preferred_location=v_actor.staff_location), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_reservation_status(p_reservation_id UUID, p_status TEXT, p_session_token TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor RECORD; v_res public.reservations%ROWTYPE; v_new_qty INTEGER;
BEGIN
  SELECT * INTO v_actor FROM public.require_staff_session(p_session_token, NULL);
  IF p_status NOT IN ('new','contacted','waiting_payment','paid','completed','cancelled') THEN RAISE EXCEPTION 'Некорректный статус'; END IF;
  SELECT * INTO v_res FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR (v_actor.staff_role <> 'admin' AND v_res.preferred_location <> v_actor.staff_location) THEN RAISE EXCEPTION 'Заявка недоступна'; END IF;
  UPDATE public.reservations SET status=p_status, updated_at=now() WHERE id=p_reservation_id;
  IF p_status='cancelled' AND v_res.status <> 'cancelled' THEN
    UPDATE public.product_stock SET quantity=quantity+1, updated_at=now() WHERE product_id=v_res.product_id AND location=v_res.preferred_location AND size=v_res.size RETURNING quantity INTO v_new_qty;
    INSERT INTO public.stock_movements(product_id,location,size,change,quantity_after,reason,reservation_id,actor_id) VALUES(v_res.product_id,v_res.preferred_location,v_res.size,1,v_new_qty,'reservation_cancelled',v_res.id,v_actor.profile_id);
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.sell_product_item(UUID, UUID, TEXT, INTEGER, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.sell_product_item(p_client_sale_id UUID, p_product_id UUID, p_location TEXT, p_size INTEGER, p_payment_method TEXT, p_is_offline BOOLEAN DEFAULT false, p_session_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor RECORD; v_product public.products%ROWTYPE; v_stock public.product_stock%ROWTYPE; v_sale_id UUID; v_existing UUID;
BEGIN
  SELECT * INTO v_actor FROM public.require_staff_session(p_session_token, NULL);
  IF v_actor.staff_role <> 'admin' AND v_actor.staff_location <> p_location THEN RAISE EXCEPTION 'Продажа разрешена только в назначенной точке'; END IF;
  IF p_payment_method NOT IN ('kaspi_qr','kaspi_red','cash','kaspi_transfer') THEN RAISE EXCEPTION 'Некорректный способ оплаты'; END IF;
  SELECT id INTO v_existing FROM public.sales WHERE client_sale_id=p_client_sale_id;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('success',true,'sale_id',v_existing,'already_processed',true); END IF;
  SELECT * INTO v_product FROM public.products WHERE id=p_product_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Товар недоступен'; END IF;
  SELECT * INTO v_stock FROM public.product_stock WHERE product_id=p_product_id AND location=p_location AND size=p_size FOR UPDATE;
  IF NOT FOUND OR v_stock.quantity <= 0 THEN RAISE EXCEPTION 'Размер отсутствует в наличии'; END IF;
  UPDATE public.product_stock SET quantity=quantity-1, updated_at=now() WHERE id=v_stock.id;
  INSERT INTO public.sales(client_sale_id,product_id,article,brand,name,price,location,size,payment_method,seller_id,seller_name,status,is_offline_synced,overdraft_warning)
  VALUES(p_client_sale_id,p_product_id,v_product.article,v_product.brand,v_product.name,v_product.price,p_location,p_size,p_payment_method,v_actor.profile_id,v_actor.staff_name,'completed',p_is_offline,false) RETURNING id INTO v_sale_id;
  INSERT INTO public.stock_movements(product_id,location,size,change,quantity_after,reason,sale_id,actor_id) VALUES(p_product_id,p_location,p_size,-1,v_stock.quantity-1,'sale',v_sale_id,v_actor.profile_id);
  RETURN jsonb_build_object('success',true,'sale_id',v_sale_id,'new_quantity',v_stock.quantity-1,'overdraft_warning',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_staff_sales(p_session_token TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor RECORD;
BEGIN
  SELECT * INTO v_actor FROM public.require_staff_session(p_session_token, NULL);
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC) FROM public.sales s WHERE v_actor.staff_role='admin' OR s.seller_id=v_actor.profile_id), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_product(p_product JSONB, p_stock JSONB, p_session_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID; v_row JSONB; v_existing UUID;
BEGIN
  PERFORM 1 FROM public.require_staff_session(p_session_token, 'admin');
  IF coalesce(trim(p_product->>'article'),'') = '' OR coalesce(trim(p_product->>'brand'),'') = '' OR coalesce(trim(p_product->>'name'),'') = '' OR coalesce((p_product->>'price')::INTEGER, -1) < 0 THEN
    RAISE EXCEPTION 'Некорректные данные товара';
  END IF;
  BEGIN v_existing := NULLIF(p_product->>'id','')::UUID; EXCEPTION WHEN invalid_text_representation THEN v_existing := NULL; END;
  v_id := coalesce(v_existing, gen_random_uuid());
  INSERT INTO public.products(id,article,brand,name,description,price,image_url,gender,season,category,is_active)
  VALUES (v_id,trim(p_product->>'article'),trim(p_product->>'brand'),trim(p_product->>'name'),nullif(p_product->>'description',''),(p_product->>'price')::INTEGER,nullif(p_product->>'image',''),p_product->>'gender',p_product->>'season',p_product->>'category',coalesce((p_product->>'is_active')::BOOLEAN,true))
  ON CONFLICT (id) DO UPDATE SET article=EXCLUDED.article,brand=EXCLUDED.brand,name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,image_url=EXCLUDED.image_url,gender=EXCLUDED.gender,season=EXCLUDED.season,category=EXCLUDED.category,is_active=EXCLUDED.is_active,updated_at=now();
  FOR v_row IN SELECT value FROM jsonb_array_elements(coalesce(p_stock, '[]'::jsonb)) LOOP
    INSERT INTO public.product_stock(product_id,location,size,quantity) VALUES(v_id,v_row->>'location',(v_row->>'size')::INTEGER,greatest(0,(v_row->>'quantity')::INTEGER))
    ON CONFLICT (product_id,location,size) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=now();
  END LOOP;
  RETURN jsonb_build_object('success',true,'id',v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_product(p_product_id UUID, p_session_token TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.require_staff_session(p_session_token, 'admin');
  UPDATE public.products SET is_active=false,updated_at=now() WHERE id=p_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Товар не найден'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.login_staff_pin(TEXT, TEXT), public.create_reservation(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_staff_pin(TEXT, TEXT), public.create_reservation(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_or_update_seller(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT), public.set_staff_active(TEXT, BOOLEAN, TEXT), public.list_staff_profiles(TEXT), public.list_staff_reservations(TEXT), public.update_reservation_status(UUID, TEXT, TEXT), public.sell_product_item(UUID, UUID, TEXT, INTEGER, TEXT, BOOLEAN, TEXT), public.list_staff_sales(TEXT), public.save_product(JSONB, JSONB, TEXT), public.deactivate_product(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_update_seller(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT), public.set_staff_active(TEXT, BOOLEAN, TEXT), public.list_staff_profiles(TEXT), public.list_staff_reservations(TEXT), public.update_reservation_status(UUID, TEXT, TEXT), public.sell_product_item(UUID, UUID, TEXT, INTEGER, TEXT, BOOLEAN, TEXT), public.list_staff_sales(TEXT), public.save_product(JSONB, JSONB, TEXT), public.deactivate_product(UUID, TEXT) TO anon, authenticated;
