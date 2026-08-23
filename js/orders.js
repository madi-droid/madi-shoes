// MADIYAR SHOES — модуль заявок клиентов и бронирования (orders.js)

function handleBookingFlow(actionType) {
  if (!currentSelectedProduct || !currentSelectedSize || !currentSelectedLocation) {
    showToast("Пожалуйста, выберите размер обуви!", "error");
    return;
  }

  if (!currentUser) {
    pendingAction = {
      type: actionType,
      productId: currentSelectedProduct.id,
      size: currentSelectedSize,
      location: currentSelectedLocation
    };
    closeModal("modal-product-details");
    openModal("modal-auth-profile");

    const smsGroup = document.getElementById("sms-code-group");
    if (smsGroup) smsGroup.classList.add("d-none");
    const btnAuthSubmit = document.getElementById("btn-auth-submit");
    if (btnAuthSubmit) btnAuthSubmit.textContent = "Продолжить";
    const authForm = document.getElementById("auth-form");
    if (authForm) authForm.reset();
  } else {
    if (actionType === "reserve") {
      executeBooking();
    } else if (actionType === "kaspi") {
      openKaspiPaymentSim();
    }
  }
}

async function executeBooking() {
  if (isOrderProcessing) return;
  isOrderProcessing = true;

  try {
    if (!currentSelectedProduct || !currentSelectedSize || !currentSelectedLocation || !currentUser) {
      showToast("Данные о товаре повреждены. Пожалуйста, повторите попытку.", "error");
      return;
    }

    const canonicalProduct = getProductById(currentSelectedProduct.id);
    if (!canonicalProduct) {
      showToast("Товар не найден в базе данных.", "error");
      return;
    }

    const realPrice = Math.max(0, parseInt(canonicalProduct.price) || 0);
    const locKey = currentSelectedLocation === "mall" ? "mall" : "bazaar";

    const orderId = "RES-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(100 + Math.random() * 900);
    const userPhoneNorm = typeof normalizePhone === "function" ? normalizePhone(currentUser.phone) : currentUser.phone;
    const newOrder = {
      id: orderId,
      userPhone: userPhoneNorm,
      userName: safeText(currentUser.name, 100),
      productId: canonicalProduct.id,
      productName: safeText(canonicalProduct.name, 120),
      productArticle: safeText(canonicalProduct.article, 60),
      size: safeText(currentSelectedSize, 5),
      location: locKey,
      price: realPrice,
      type: "Бронь",
      status: "new",
      date: new Date().toISOString()
    };

    // Сервер атомарно создаёт резерв и временно удерживает одну пару.
    const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
    if (supabase) {
      try {
        const { error } = await supabase.rpc('create_reservation', {
          p_product_id: canonicalProduct.id,
          p_size: parseInt(currentSelectedSize, 10),
          p_location: locKey,
          p_customer_name: currentUser.name,
          p_customer_phone: currentUser.phone,
          p_request_type: 'fitting',
          p_comment: null
        });

        if (error) {
          console.warn("Ошибка сохранения заявки в Supabase reservations:", error);
          showToast("Не удалось подтвердить бронь на сервере", "error");
          return;
        }
      } catch (err) {
        console.warn("Ошибка соединения с Supabase:", err);
        showToast("Нет соединения с сервером. Бронь не была создана.", "error");
        return;
      }
    }

    orders = window.db ? window.db.loadOrders() : (orders || []);
    orders.unshift(newOrder);
    window.db.saveOrders(orders);

    if (typeof renderAdminOrdersTable === "function") {
      try { renderAdminOrdersTable(); } catch (e) {}
    }

    closeAllModals();
    showToast(`Заявка ${orderId} создана! Продавец свяжется с вами для уточнения время примерки.`, "success");

    currentSelectedProduct = null;
    currentSelectedSize = null;
    currentSelectedLocation = null;
    pendingAction = null;

    renderCatalog();
  } finally {
    isOrderProcessing = false;
  }
}

function openKaspiPaymentSim() {
  const canonicalProduct = getProductById(currentSelectedProduct?.id) || currentSelectedProduct;
  if (!canonicalProduct) return;

  const labelProduct = document.getElementById("kaspi-product-label");
  if (labelProduct) {
    labelProduct.textContent = `${safeText(canonicalProduct.brand, 80)} ${safeText(canonicalProduct.name, 120)} (Размер: ${safeText(currentSelectedSize, 5)}, ${currentSelectedLocation === "bazaar" ? "Базар" : "Гранд Парк"})`;
  }
  const labelAmount = document.getElementById("kaspi-amount-label");
  if (labelAmount) {
    labelAmount.textContent = `${Number(canonicalProduct.price || 0).toLocaleString()} ₸`;
  }

  const phoneInput = document.getElementById("kaspi-phone-input");
  if (phoneInput) phoneInput.value = "";

  closeModal("modal-product-details");
  openModal("modal-kaspi-sim");
}

async function processKaspiPaymentConfirm() {
  if (isOrderProcessing) return;
  isOrderProcessing = true;

  try {
    if (!currentSelectedProduct || !currentSelectedSize || !currentSelectedLocation || !currentUser) {
      showToast("Данные о товаре повреждены. Пожалуйста, повторите попытку.", "error");
      return;
    }

    const canonicalProduct = getProductById(currentSelectedProduct.id);
    if (!canonicalProduct) {
      showToast("Товар не найден в базе данных.", "error");
      return;
    }

    const realPrice = Math.max(0, parseInt(canonicalProduct.price) || 0);
    const locKey = currentSelectedLocation === "mall" ? "mall" : "bazaar";

    const kaspiPhoneInput = document.getElementById("kaspi-phone-input");
    const kaspiPhoneRaw = kaspiPhoneInput ? kaspiPhoneInput.value.trim() : "";
    const kaspiDigits = kaspiPhoneRaw.replace(/\D/g, "");

    let kaspiPhone = "";
    if (kaspiDigits.length === 11 && kaspiDigits.startsWith("8")) {
      kaspiPhone = "7" + kaspiDigits.substring(1);
    } else if (kaspiDigits.length === 11 && kaspiDigits.startsWith("7")) {
      kaspiPhone = kaspiDigits;
    } else if (kaspiDigits.length === 10) {
      kaspiPhone = "7" + kaspiDigits;
    } else {
      showToast("Введите корректный номер Kaspi (например: 8 700 000 00 00)", "error");
      if (kaspiPhoneInput) kaspiPhoneInput.focus();
      return;
    }

    const orderId = "RES-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(100 + Math.random() * 900);
    const userPhoneNorm = typeof normalizePhone === "function" ? normalizePhone(currentUser.phone) : currentUser.phone;
    const newOrder = {
      id: orderId,
      userPhone: userPhoneNorm,
      userName: safeText(currentUser.name, 100),
      productId: canonicalProduct.id,
      productName: safeText(canonicalProduct.name, 120),
      productArticle: safeText(canonicalProduct.article, 60),
      size: safeText(currentSelectedSize, 5),
      location: locKey,
      price: realPrice,
      type: "Kaspi",
      kaspiPhone: kaspiPhone,
      status: "new",
      date: new Date().toISOString()
    };

    // Сервер атомарно создаёт резерв и временно удерживает одну пару.
    const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
    if (supabase) {
      try {
        const { error } = await supabase.rpc('create_reservation', {
          p_product_id: canonicalProduct.id,
          p_size: parseInt(currentSelectedSize, 10),
          p_location: locKey,
          p_customer_name: currentUser.name,
          p_customer_phone: currentUser.phone,
          p_request_type: 'kaspi_manual_payment',
          p_comment: kaspiPhone
        });

        if (error) {
          console.warn("Ошибка отправки заявки Kaspi в Supabase:", error);
          showToast("Не удалось подтвердить заявку на сервере", "error");
          return;
        }
      } catch (err) {
        console.warn("Ошибка сети при отправке в Supabase:", err);
        showToast("Нет соединения с сервером. Заявка не была создана.", "error");
        return;
      }
    }

    orders = window.db ? window.db.loadOrders() : (orders || []);
    orders.unshift(newOrder);
    window.db.saveOrders(orders);

    if (typeof renderAdminOrdersTable === "function") {
      try { renderAdminOrdersTable(); } catch (e) {}
    }

    closeAllModals();
    showToast("Номер отправлен! Продавец свяжется с вами и выставит счет на оплату.", "success");

    currentSelectedProduct = null;
    currentSelectedSize = null;
    currentSelectedLocation = null;
    pendingAction = null;

    renderCatalog();
  } finally {
    isOrderProcessing = false;
  }
}

function renderClientOrders() {
  const container = document.getElementById("profile-orders-list");
  if (!container) return;
  container.innerHTML = "";

  if (!currentUser) return;

  orders = window.db.loadOrders();
  const cPhoneNorm = typeof normalizePhone === "function" ? normalizePhone(currentUser.phone) : currentUser.phone;

  const myOrders = orders.filter(o => {
    if (!o || !o.userPhone) return false;
    const oPhoneNorm = typeof normalizePhone === "function" ? normalizePhone(o.userPhone) : o.userPhone;
    return oPhoneNorm === cPhoneNorm || o.userPhone === currentUser.phone || o.userPhone === cPhoneNorm;
  });

  if (myOrders.length === 0) {
    const emptyP = createEl("p", "", "У вас пока нет активных заявок.");
    emptyP.style.cssText = "color:var(--text-secondary); text-align:center; padding: 20px;";
    container.appendChild(emptyP);
    return;
  }

  myOrders.forEach(o => {
    const oCard = document.createElement("div");
    oCard.className = "order-card";

    let statusText = o.status;
    let badgeClass = "badge-new";
    if (o.status === "paid" || o.status === "Оплачен") { statusText = "Оплачен"; badgeClass = "badge-paid"; }
    else if (o.status === "contacted" || o.status === "Подтвержден") { statusText = "Подтвержден"; badgeClass = "badge-confirmed"; }
    else if (o.status === "completed" || o.status === "Выдан") { statusText = "Выполнен"; badgeClass = "badge-completed"; }
    else if (o.status === "cancelled" || o.status === "Отменен") { statusText = "Отменен"; badgeClass = "badge-completed"; }
    else { statusText = "Новая заявка"; }

    const locText = o.location === "bazaar" ? "Базар Кулпаршин (25 бутик)" : "Гранд Парк (1б, 10б)";

    const headerRow = document.createElement("div");
    headerRow.className = "order-header-row";
    const orderLabel = document.createElement("span");
    orderLabel.textContent = `Заявка: ${safeText(o.id, 30)}`;
    const statusBadge = document.createElement("span");
    statusBadge.className = `order-status-badge ${badgeClass}`;
    statusBadge.textContent = statusText;
    headerRow.appendChild(orderLabel);
    headerRow.appendChild(statusBadge);

    const detailsRow = document.createElement("div");
    detailsRow.className = "order-details-row";
    const detailsInner = document.createElement("div");

    const p1 = document.createElement("p");
    const strong1 = document.createElement("strong");
    strong1.textContent = safeText(o.productName, 100);
    p1.append("Товар: ", strong1);

    const p2 = document.createElement("p");
    const strong2 = document.createElement("strong");
    strong2.textContent = safeText(o.size, 5);
    p2.append("Размер: ", strong2);

    const p3 = document.createElement("p");
    const strong3 = document.createElement("strong");
    strong3.textContent = locText;
    p3.append("Адрес: ", strong3);

    const p4 = document.createElement("p");
    const strong4 = document.createElement("strong");
    strong4.textContent = safeText(o.type, 60);
    p4.append("Тип: ", strong4);

    detailsInner.appendChild(p1);
    detailsInner.appendChild(p2);
    detailsInner.appendChild(p3);
    detailsInner.appendChild(p4);

    if (o.kaspiPhone) {
      const pKaspi = document.createElement("p");
      const strongKaspi = document.createElement("strong");
      strongKaspi.style.color = "var(--kaspi-red)";
      strongKaspi.textContent = safeText(o.kaspiPhone, 20);
      pKaspi.append("Kaspi: ", strongKaspi);
      detailsInner.appendChild(pKaspi);
    }
    detailsRow.appendChild(detailsInner);

    const footerDiv = document.createElement("div");
    footerDiv.style.cssText = "display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--border-color); padding-top:10px; font-size:13px;";
    const dateSpan = document.createElement("span");
    dateSpan.style.color = "var(--text-muted)";

    let dateStr = o.date;
    try {
      if (o.date && o.date.includes("T")) {
        dateStr = new Date(o.date).toLocaleString();
      }
    } catch(e) {}
    dateSpan.textContent = dateStr;

    const priceStrong = document.createElement("strong");
    priceStrong.style.cssText = "color:var(--primary); font-size:15px;";
    priceStrong.textContent = `${Number(o.price || 0).toLocaleString()} ₸`;
    footerDiv.appendChild(dateSpan);
    footerDiv.appendChild(priceStrong);

    oCard.appendChild(headerRow);
    oCard.appendChild(detailsRow);
    oCard.appendChild(footerDiv);
    container.appendChild(oCard);
  });
}
