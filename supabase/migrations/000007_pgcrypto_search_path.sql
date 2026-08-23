-- Supabase installs pgcrypto into the `extensions` schema. SECURITY DEFINER
-- functions must explicitly include it in their controlled search path.
-- Otherwise staff login fails with: function crypt(text, text) does not exist.

ALTER FUNCTION public.require_staff_session(TEXT, TEXT)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.login_staff_pin(TEXT, TEXT)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.create_or_update_seller(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT)
  SET search_path = public, extensions, pg_temp;
