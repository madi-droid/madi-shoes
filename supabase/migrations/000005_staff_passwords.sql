-- Accept strong staff passwords (Latin letters and digits) instead of a
-- digits-only PIN. Existing bcrypt hashes remain valid.

CREATE OR REPLACE FUNCTION public.login_staff_pin(p_phone TEXT, p_pin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_profile public.profiles%ROWTYPE; v_attempt public.staff_login_attempts%ROWTYPE; v_token TEXT;
BEGIN
  IF p_phone !~ '^7[0-9]{10}$' OR p_pin !~ '^[A-Za-z0-9]{8,64}$' THEN RETURN jsonb_build_object('success', false, 'message', 'Неверные учётные данные'); END IF;
  SELECT * INTO v_attempt FROM public.staff_login_attempts WHERE phone = p_phone FOR UPDATE;
  IF v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > now() THEN RETURN jsonb_build_object('success', false, 'message', 'Слишком много попыток. Повторите позже'); END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE phone = p_phone AND is_active;
  IF NOT FOUND OR v_profile.pin_hash !~ '^\$2[aby]\$' OR crypt(p_pin, v_profile.pin_hash) <> v_profile.pin_hash THEN
    INSERT INTO public.staff_login_attempts(phone, failed_count, locked_until, updated_at) VALUES (p_phone, 1, NULL, now())
    ON CONFLICT (phone) DO UPDATE SET failed_count=CASE WHEN public.staff_login_attempts.failed_count >= 4 THEN 0 ELSE public.staff_login_attempts.failed_count+1 END, locked_until=CASE WHEN public.staff_login_attempts.failed_count >= 4 THEN now()+interval '15 minutes' ELSE NULL END, updated_at=now();
    RETURN jsonb_build_object('success', false, 'message', 'Неверные учётные данные');
  END IF;
  DELETE FROM public.staff_login_attempts WHERE phone = p_phone;
  DELETE FROM public.staff_sessions WHERE profile_id = v_profile.id OR expires_at <= now();
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.staff_sessions(profile_id, token_hash, expires_at) VALUES (v_profile.id, encode(digest(v_token, 'sha256'), 'hex'), now()+interval '2 hours');
  RETURN jsonb_build_object('success',true,'session_token',v_token,'profile',jsonb_build_object('id',v_profile.id,'full_name',v_profile.full_name,'role',v_profile.role,'location',v_profile.location));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_or_update_seller(p_phone TEXT, p_full_name TEXT, p_pin TEXT, p_role TEXT, p_location TEXT, p_is_active BOOLEAN, p_session_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM 1 FROM public.require_staff_session(p_session_token, 'admin');
  IF p_phone !~ '^7[0-9]{10}$' OR length(trim(p_full_name)) < 3 OR p_role NOT IN ('admin','seller') OR p_location NOT IN ('bazaar','mall') THEN RAISE EXCEPTION 'Некорректные данные сотрудника'; END IF;
  IF p_pin IS NOT NULL AND p_pin !~ '^[A-Za-z0-9]{8,64}$' THEN RAISE EXCEPTION 'Пароль должен содержать 8–64 латинских букв или цифр'; END IF;
  IF p_pin IS NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE phone=p_phone) THEN RAISE EXCEPTION 'Для нового сотрудника обязателен пароль'; END IF;
  INSERT INTO public.profiles(phone,full_name,pin_hash,role,location,is_active) VALUES(p_phone,trim(p_full_name),crypt(p_pin,gen_salt('bf',12)),p_role,p_location,p_is_active)
  ON CONFLICT (phone) DO UPDATE SET full_name=EXCLUDED.full_name,role=EXCLUDED.role,location=EXCLUDED.location,is_active=EXCLUDED.is_active,pin_hash=CASE WHEN p_pin IS NULL THEN public.profiles.pin_hash ELSE crypt(p_pin,gen_salt('bf',12)) END RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'profile_id',v_id);
END;
$$;
