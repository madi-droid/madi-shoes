-- Migration 000002: Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Products policies
DROP POLICY IF EXISTS "Allow public read access on products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated manage products" ON public.products;
CREATE POLICY "Allow public read access on products"
    ON public.products FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated manage products"
    ON public.products FOR ALL
    USING (auth.role() = 'authenticated');

-- Product Stock policies
DROP POLICY IF EXISTS "Allow public read access on product_stock" ON public.product_stock;
DROP POLICY IF EXISTS "Allow authenticated manage product_stock" ON public.product_stock;
CREATE POLICY "Allow public read access on product_stock"
    ON public.product_stock FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated manage product_stock"
    ON public.product_stock FOR ALL
    USING (auth.role() = 'authenticated');

-- Profiles policies
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated manage profiles" ON public.profiles;
CREATE POLICY "Allow read profiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated manage profiles"
    ON public.profiles FOR ALL
    USING (auth.role() = 'authenticated');

-- Sales policies
DROP POLICY IF EXISTS "Allow authenticated read sales" ON public.sales;
DROP POLICY IF EXISTS "Allow authenticated insert sales" ON public.sales;
DROP POLICY IF EXISTS "Allow authenticated update sales" ON public.sales;
CREATE POLICY "Allow authenticated read sales"
    ON public.sales FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert sales"
    ON public.sales FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update sales"
    ON public.sales FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Reservations policies
DROP POLICY IF EXISTS "Allow read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow public insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated update reservations" ON public.reservations;
CREATE POLICY "Allow read reservations"
    ON public.reservations FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert reservations"
    ON public.reservations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update reservations"
    ON public.reservations FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Stock Movements policies
DROP POLICY IF EXISTS "Allow authenticated read stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Allow authenticated insert stock_movements" ON public.stock_movements;
CREATE POLICY "Allow authenticated read stock_movements"
    ON public.stock_movements FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert stock_movements"
    ON public.stock_movements FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
