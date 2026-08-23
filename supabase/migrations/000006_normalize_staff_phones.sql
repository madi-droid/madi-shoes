-- Canonical staff-phone format used by the browser: digits only, beginning 7.
UPDATE public.profiles
SET phone = regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone <> regexp_replace(phone, '[^0-9]', '', 'g');
