// MADIYAR SHOES — модули авторизации админа и пользователей (auth.js)

function isAdminLoggedIn() {
  const token = sessionStorage.getItem("shoe_store_admin_token");
  const phone = sessionStorage.getItem("shoe_store_admin_phone");
  const loginTime = Number(sessionStorage.getItem("shoe_store_admin_login_time") || 0);
  const sig = sessionStorage.getItem("shoe_store_admin_sig");

  if (!token || !phone || !loginTime || !sig) {
    purgeAdminSession();
    return false;
  }

  // Защита от истечения сессии
  if (Date.now() - loginTime > ADMIN_SESSION_TTL_MS) {
    purgeAdminSession();
    return false;
  }

  // Защита от подделки сессии через DevTools
  const expectedSig = generateSessionSig(token, phone, String(loginTime));
  if (sig !== expectedSig) {
    console.warn("Обнаружена попытка подделки сессии администратора!");
    purgeAdminSession();
    return false;
  }

  return true;
}

function purgeAdminSession() {
  sessionStorage.removeItem("shoe_store_admin_token");
  sessionStorage.removeItem("shoe_store_admin_phone");
  sessionStorage.removeItem("shoe_store_admin_name");
  sessionStorage.removeItem("shoe_store_admin_login_time");
  sessionStorage.removeItem("shoe_store_admin_sig");
  sessionStorage.removeItem("shoe_store_admin_logged");
}

function checkAdminAccess() {
  if (isAdminLoggedIn()) {
    switchToAdminView();
  } else {
    document.getElementById("admin-pin-input").value = "";
    openModal("modal-admin-auth");
  }
}

function requireAdminAccess() {
  if (!isAdminLoggedIn()) {
    showToast("Требуется вход администратора", "error");
    checkAdminAccess();
    return false;
  }
  return true;
}

async function handleAdminLoginSubmit(e) {
  e.preventDefault();

  const phoneInput = document.getElementById("admin-phone-input").value;
  const pinInput = document.getElementById("admin-pin-input").value;

  const phoneNorm = normalizePhone(phoneInput);
  const pin = pinInput.trim();

  // Проверка персистентной блокировки (не сбрасывается при F5)
  const lockout = getAdminLockoutInfo();
  const now = Date.now();
  if (now < lockout.lockoutUntil) {
    const secsLeft = Math.ceil((lockout.lockoutUntil - now) / 1000);
    showToast(`Слишком много попыток. Подождите ${secsLeft} сек.`, "error");
    return;
  }

  const matchedAdmin = ADMIN_ACCOUNTS.find(acc => normalizePhone(acc.phone) === phoneNorm);
  const pinHash = await sha256Async(pin);

  // Валидация ПИН-кода по разрешенным криптографическим хэшам
  const isValidPin = ALLOWED_PIN_HASHES.includes(pinHash);

  if (matchedAdmin && isValidPin) {
    setAdminLockoutInfo(0, 0);

    const token = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) + Date.now();
    const loginTimeStr = String(Date.now());
    const sig = generateSessionSig(token, phoneNorm, loginTimeStr);

    sessionStorage.setItem("shoe_store_admin_token", token);
    sessionStorage.setItem("shoe_store_admin_phone", phoneNorm);
    sessionStorage.setItem("shoe_store_admin_name", matchedAdmin.name);
    sessionStorage.setItem("shoe_store_admin_login_time", loginTimeStr);
    sessionStorage.setItem("shoe_store_admin_sig", sig);

    closeModal("modal-admin-auth");
    showToast(`Вход выполнен: ${matchedAdmin.name}`, "success");
    switchToAdminView();
  } else if (!matchedAdmin) {
    showToast("Номер телефона отсутствует в списке администраторов!", "error");
  } else {
    let attempts = lockout.attempts + 1;
    let lockoutUntil = 0;
    if (attempts >= ADMIN_MAX_ATTEMPTS) {
      lockoutUntil = Date.now() + ADMIN_BLOCK_SECONDS * 1000;
      attempts = 0;
      showToast(`Слишком много попыток. Доступ заблокирован на ${ADMIN_BLOCK_SECONDS} сек.`, "error");
    } else {
      showToast(`Неверный ПИН-код! Осталось попыток: ${ADMIN_MAX_ATTEMPTS - attempts}`, "error");
    }
    setAdminLockoutInfo(attempts, lockoutUntil);
  }
}

// Авторизация клиента
function openProfileModal() {
  if (currentUser) {
    document.getElementById("auth-form-container").classList.add("d-none");
    document.getElementById("profile-container").classList.remove("d-none");

    document.getElementById("profile-user-name").textContent = `Здравствуйте, ${safeText(currentUser.name, 100)}!`;
    document.getElementById("profile-user-phone").textContent = currentUser.phone;

    renderClientOrders();
  } else {
    document.getElementById("auth-form-container").classList.remove("d-none");
    document.getElementById("profile-container").classList.add("d-none");
    document.getElementById("sms-code-group").classList.add("d-none");
    document.getElementById("btn-auth-submit").textContent = "Продолжить";
    document.getElementById("auth-form").reset();
  }
  openModal("modal-auth-profile");
}

function handleClientAuthSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById("auth-name").value.trim();
  const phoneInput = document.getElementById("auth-phone").value.trim();
  const smsGroup = document.getElementById("sms-code-group");
  const smsInput = document.getElementById("auth-sms").value.trim();

  if (smsGroup.classList.contains("d-none")) {
    if (!nameInput || !phoneInput) {
      showToast("Заполните все поля", "error");
      return;
    }
    if (normalizePhone(phoneInput).length !== 11) {
      showToast("Введите корректный номер телефона в формате +7 (7XX) XXX-XX-XX", "error");
      return;
    }
    smsGroup.classList.remove("d-none");
    document.getElementById("btn-auth-submit").textContent = "Войти и продолжить";
    showToast("Симуляция СМС: код отправлен на ваш номер", "info");
    return;
  }

  if (smsInput !== "1234") {
    showToast("Неверный код СМС! Введите 1234", "error");
    return;
  }

  const newUser = { name: safeText(nameInput, 100), phone: normalizePhone(phoneInput) };

  let users = window.db.loadUsers();
  if (!users.some(u => u.phone === newUser.phone)) {
    users.push(newUser);
    window.db.saveUsers(users);
  }

  currentUser = newUser;
  window.db.setCurrentUser(newUser);

  showToast("Вы успешно вошли в профиль!", "success");
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
