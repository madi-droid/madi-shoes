-- The catalogue supports these customer-facing categories.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products ADD CONSTRAINT products_category_check CHECK (
  category IN ('кроссовки', 'туфли', 'ботинки', 'сапоги', 'сандалии', 'лоферы',
               'кеды', 'аксессуары', 'кроксы', 'мокасины', 'босоножки')
);
