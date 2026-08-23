-- Временные остатки только для демонстрационных моделей без единой записи на складе.
-- Реальные товары и уже заполненные остатки этот скрипт не изменяет.
with demo_products as (
  select p.id, p.article, lower(coalesce(p.gender, '')) as gender
  from public.products p
  where p.is_active = true
    and not exists (
      select 1 from public.product_stock ps where ps.product_id = p.id
    )
), expanded as (
  select
    p.id as product_id,
    location_data.location,
    size_data.size_value,
    1 + (abs(hashtext(p.article || location_data.location || size_data.size_value::text)::bigint) % 4)::int as quantity
  from demo_products p
  cross join lateral generate_series(
    case when p.gender like '%жен%' then 35 when p.gender like '%муж%' then 40 else 37 end,
    case when p.gender like '%жен%' then 40 when p.gender like '%муж%' then 45 else 43 end
  ) as size_data(size_value)
  cross join (values ('bazaar'), ('mall')) as location_data(location)
)
insert into public.product_stock (product_id, location, size, quantity)
select product_id, location, size_value, quantity
from expanded
on conflict (product_id, location, size) do nothing;
