-- Migration 000001: Initial Database Schema for MADIYAR SHOES

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article TEXT UNIQUE NOT NULL,
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL CHECK (price >= 0),
    image_url TEXT,
    gender TEXT NOT NULL CHECK (gender IN ('мужской', 'женский', 'унисекс')),
    season TEXT NOT NULL CHECK (season IN ('зима', 'весна', 'лето', 'осень', 'демисезон', 'всесезон')),
    category TEXT NOT NULL CHECK (category IN ('кроссовки', 'туфли', 'ботинки', 'сапоги', 'сандалии', 'лоферы', 'кеды', 'аксессуары', 'кроксы')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    location TEXT NOT NULL CHECK (location IN ('bazaar', 'mall')),
    size INTEGER NOT NULL CHECK (size BETWEEN 35 AND 46),
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unq_product_location_size UNIQUE (product_id, location, size)
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'seller')),
    location TEXT CHECK (location IN ('bazaar', 'mall')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_sale_id UUID UNIQUE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    article TEXT NOT NULL,
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    location TEXT NOT NULL CHECK (location IN ('bazaar', 'mall')),
    size INTEGER NOT NULL CHECK (size BETWEEN 35 AND 46),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('kaspi_qr', 'kaspi_red', 'cash', 'kaspi_transfer')),
    seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    seller_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    is_offline_synced BOOLEAN NOT NULL DEFAULT false,
    overdraft_warning BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancel_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    article TEXT NOT NULL,
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL CHECK (size BETWEEN 35 AND 46),
    preferred_location TEXT NOT NULL CHECK (preferred_location IN ('bazaar', 'mall')),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('fitting', 'kaspi_manual_payment')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'waiting_payment', 'paid', 'completed', 'cancelled')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    location TEXT NOT NULL CHECK (location IN ('bazaar', 'mall')),
    size INTEGER NOT NULL CHECK (size BETWEEN 35 AND 46),
    change INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_stock_product_id ON public.product_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_location ON public.sales(location);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
