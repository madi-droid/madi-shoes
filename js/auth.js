// MADIYAR SHOES — модуль авторизации сотрудников и клиентов (auth.js)

function isAdminLoggedIn() {
  const token = getStaffSessionToken();
  const phone = sessionStorage.getItem("shoe_store_admin_phone");
  const loginTime = Number(sessionStorage.getItem("shoe_store_admin_login_time") || 0);

  if (!token || !phone || !loginTime) {
    purgeAdminSession();
    return false;
  }

  // TTL Session Check (2 hours)
  if (Date.now() - loginTime > ADMIN_SESSION_TTL_MS) {
    purgeAdminSession();
    return false;
  }

  return true;
}

function purgeAdminSession() {
  sessionStorage.removeItem("shoe_store_staff_session_token");
  sessionStorage.removeItem("shoe_store_admin_phone");
  sessionStorage.removeItem("shoe_store_admin_name");
  sessionStorage.removeItem("shoe_store_admin_role");
  sessionStorage.removeItem("shoe_store_admin_location");
  sessionStorage.removeItem("shoe_store_admin_login_time");
  sessionStorage.removeItem("shoe_store_admin_logged");
}

function checkAdminAccess() {
  if (isAdminLoggedIn()) {
    switchToAdminView();
  } else {
    const pinEl = document.getElementById("admin-pin-input");
    if (pinEl) pinEl.value = "";
    openModal("modal-admin-auth");
  }
}

function requireAdminAccess() {
  if (!isAdminLoggedIn()) {
    checkAdminAccess();
    return false;
  }
  return true;
}

// Авторизация сотрудника по Номеру Телефона и 4-значному PIN-коду через RPC login_staff_pin
async function handleAdminLoginSubmit(e) {
  e.preventDefault();

  const phoneInput = document.getElementById("admin-phone-input").value;
  const pinInput = document.getElementById("admin-pin-input").value;

  const phoneNorm = normalizePhone(phoneInput);
  const pin = pinInput.trim();

  if (pin.length < 8 || pin.length > 64 || !/^[A-Za-z0-9]+$/.test(pin)) {
    showToast("Пароль должен содержать 8–64 латинских букв или цифр", "error");
    return;
  }

  // 1. Вызов RPC-функции login_staff_pin в Supabase
  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('login_staff_pin', {
        p_phone: phoneNorm,
        p_pin: pin
      });

      if (error || !data || !data.success || !data.session_token || !data.profile) {
        throw new Error(data?.message || error?.message || "Не удалось выполнить вход");
      }

      sessionStorage.setItem("shoe_store_staff_session_token", data.session_token);
      sessionStorage.setItem("shoe_store_admin_phone", phoneNorm);
      sessionStorage.setItem("shoe_store_admin_name", data.profile.full_name);
      sessionStorage.setItem("shoe_store_admin_role", data.profile.role);
      sessionStorage.setItem("shoe_store_admin_location", data.profile.location || "bazaar");
      sessionStorage.setItem("shoe_store_admin_login_time", String(Date.now()));
      closeModal("modal-admin-auth");
      showToast(`Вход выполнен: ${data.profile.full_name}`, "success");
      switchToAdminView();
      return;
    } catch (err) {
      console.warn("Ошибка входа сотрудника:", err);
      showToast(err.message || "Неверный телефон, пароль или временная блокировка", "error");
      return;
    }
  }
  showToast("Сервер авторизации недоступен. Оффлайн-вход отключён для защиты данных.", "error");
}

// Авторизация клиента
function openProfileModal() {
  if (currentUser) {
    document.getElementById("auth-form-container").classList.add("d-none");
    document.getElementById("profile-container").classList.remove("d-none");

    const formatted = formatFullName(safeText(currentUser.name, 100));
    document.getElementById("profile-user-name").textContent = `Здравствуйте, ${formatted}!`;
    document.getElementById("profile-user-phone").textContent = formatPhoneDisplay(currentUser.phone);

    renderClientOrders();
  } else {
    document.getElementById("auth-form-container").classList.remove("d-none");
    document.getElementById("profile-container").classList.add("d-none");

    const titleEl = document.getElementById("auth-modal-title");
    const descEl = document.getElementById("auth-modal-desc");
    const nameGroup = document.getElementById("name-group");
    const submitBtn = document.getElementById("btn-auth-submit");
    const authNameEl = document.getElementById("auth-name");

    if (titleEl) titleEl.textContent = "Вход в профиль";
    if (descEl) descEl.textContent = "Сохраняйте бронирования и заявки Kaspi в одном месте.";
    if (nameGroup) nameGroup.classList.remove("d-none");
    if (authNameEl) authNameEl.required = true;
    if (submitBtn) submitBtn.textContent = "Продолжить";

    document.getElementById("auth-form").reset();
  }
  openModal("modal-auth-profile");
}

function initClientAuthListeners() {
  const authPhoneEl = document.getElementById("auth-phone");
  const authNameEl = document.getElementById("auth-name");
  const titleEl = document.getElementById("auth-modal-title");
  const descEl = document.getElementById("auth-modal-desc");
  const nameGroup = document.getElementById("name-group");
  const submitBtn = document.getElementById("btn-auth-submit");

  if (!authPhoneEl) return;

  authPhoneEl.addEventListener("input", () => {
    const norm = normalizePhone(authPhoneEl.value);
    if (norm.length === 11) {
      const users = window.db.loadUsers();
      const found = users.find(u => u.phone === norm);
      if (found) {
        if (titleEl) titleEl.textContent = "Профиль найден";
        if (descEl) descEl.textContent = "Проверьте имя и нажмите «Войти».";
        if (found.name && authNameEl) authNameEl.value = formatFullName(found.name);
        if (nameGroup) nameGroup.classList.remove("d-none");
        if (authNameEl) authNameEl.required = true;
        if (submitBtn) submitBtn.textContent = "Войти";
      } else {
        if (titleEl) titleEl.textContent = "Создание профиля";
        if (descEl) descEl.textContent = "Укажите имя и фамилию, чтобы продавец мог связаться с вами.";
        if (nameGroup) nameGroup.classList.remove("d-none");
        if (authNameEl) authNameEl.required = true;
        if (submitBtn) submitBtn.textContent = "Зарегистрироваться";
      }
    } else {
      if (titleEl) titleEl.textContent = "Вход в профиль";
      if (descEl) descEl.textContent = "Введите номер телефона, который использовали для заявки.";
      if (nameGroup) nameGroup.classList.remove("d-none");
      if (authNameEl) authNameEl.required = true;
      if (submitBtn) submitBtn.textContent = "Продолжить";
    }
  });

  const btnToggleAdminPin = document.getElementById("btn-toggle-admin-pin");
  const adminPinInput = document.getElementById("admin-pin-input");
  const eyeIconAdmin = document.getElementById("eye-icon-admin");

  if (btnToggleAdminPin && adminPinInput) {
    btnToggleAdminPin.addEventListener("click", () => {
      const isPwd = adminPinInput.type === "password";
      adminPinInput.type = isPwd ? "text" : "password";
      btnToggleAdminPin.setAttribute("aria-label", isPwd ? "Скрыть пароль" : "Показать пароль");
      if (eyeIconAdmin) {
        eyeIconAdmin.innerHTML = isPwd
          ? `<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>`
          : `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>`;
      }
    });
  }
}

function handleClientAuthSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById("auth-name").value.trim();
  const phoneInput = document.getElementById("auth-phone").value.trim();
  const normPhone = normalizePhone(phoneInput);

  if (!isValidKazakhstanPhone(phoneInput)) {
    showToast("Введите корректный номер телефона РК (например: +7 777 123 45 67)", "error");
    return;
  }

  let users = window.db.loadUsers();
  let existingUser = users.find(u => u.phone === normPhone || (typeof normalizePhone === "function" && normalizePhone(u.phone) === normPhone));

  if (existingUser) {
    const finalName = formatFullName(existingUser.name);
    currentUser = { name: finalName, phone: normPhone };
    window.db.setCurrentUser(currentUser);
    showToast(`Вы успешно вошли! С возвращением, ${finalName}`, "success");
  } else {
    if (!isValidFullName(nameInput)) {
      showToast("Введите ваши имя и фамилию через пробел (например: Арман Сериков)", "error");
      return;
    }
    const finalName = formatFullName(safeText(nameInput, 100));
    const newUser = {
      name: finalName,
      phone: normPhone,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    window.db.saveUsers(users);

    currentUser = { name: finalName, phone: normPhone };
    window.db.setCurrentUser(currentUser);
    showToast(`Регистрация завершена! Добро пожаловать, ${finalName}`, "success");
  }

  openProfileModal();

  if (pendingAction) {
    const item = getProductById(pendingAction.productId);
    if (item) {
      currentSelectedProduct = item;
      currentSelectedSize = pendingAction.size;
      currentSelectedLocation = pendingAction.location;

      setTimeout(() => {
        closeAllModals();
        if (pendingAction.type === "reserve") {
          executeBooking();
        } else if (pendingAction.type === "kaspi") {
          openKaspiPaymentSim();
        }
      }, 500);
    }
  }
}

function handleClientLogout() {
  currentUser = null;
  window.db.setCurrentUser(null);
  showToast("Вы вышли из профиля", "info");
  closeAllModals();
}
