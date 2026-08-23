-- Совместимость со старыми локальными номерами заявок вида RES-... .
-- Новые заявки используют UUID сервера, а старые находятся по безопасному набору полей.
create or replace function public.update_reservation_status_compat(
  p_reservation_id text,
  p_status text,
  p_product_id text,
  p_article text,
  p_size integer,
  p_location text,
  p_customer_phone text,
  p_created_at timestamptz,
  p_session_token text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_phone text := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g');
begin
  perform public.require_staff_session(p_session_token, null);

  if coalesce(p_reservation_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select r.id into v_id
    from public.reservations r
    where r.id = p_reservation_id::uuid;
  end if;

  if v_id is null then
    select r.id into v_id
    from public.reservations r
    where r.article = p_article
      and r.size = p_size
      and r.preferred_location = p_location
      and regexp_replace(coalesce(r.customer_phone, ''), '[^0-9]', '', 'g') = v_phone
      and (p_created_at is null or abs(extract(epoch from (r.created_at - p_created_at))) <= 900)
    order by
      case when p_created_at is null then 0 else abs(extract(epoch from (r.created_at - p_created_at))) end,
      r.created_at desc
    limit 1;
  end if;

  if v_id is null then
    raise exception 'Заявка не найдена на сервере';
  end if;

  perform public.update_reservation_status(v_id, p_status, p_session_token);
  return v_id;
end;
$$;

revoke all on function public.update_reservation_status_compat(text, text, text, text, integer, text, text, timestamptz, text) from public;
grant execute on function public.update_reservation_status_compat(text, text, text, text, integer, text, text, timestamptz, text) to anon, authenticated;
