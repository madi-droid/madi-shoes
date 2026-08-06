// MADIYAR SHOES — основная логика приложения (app.js) [ВОССТАНОВЛЕН ИЗ ИСТОРИИ + ИСПРАВЛЕН]

let products = [];
let orders = [];
let sales = [];
let currentUser = null;
let currentSelectedProduct = null;
let currentSelectedSize = null;
let currentSelectedLocation = null; // 'bazaar' или 'mall'
let pendingAction = null; // отложенное действие после авторизации (бронь/покупка)
let isOrderProcessing = false; // защита от двойных кликов при создании заказа
let catalogCurrentPage = 1;
const catalogItemsPerPage = 16;

const FALLBACK_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80";
const MAX_IMAGE_FILE_SIZE = 1024 * 1024;

/**
 * ВАЖНО: это статическое демо-приложение без сервера.
 * Любая "админ-защита" в браузере может быть обойдена через DevTools.
 * Для реальной продажи/учета нужна серверная авторизация и база данных вне localStorage.
 */
const ADMIN_PIN_SALT = "MadiyarShoes_SecretSalt_2026_v2";
const ALLOWED_PIN_HASHES = [
  "9f2fc960c4bf1781d34d2957565f971bcf34d6865aa62063f8a93f9a9e91e7be", // ПИН 7777 + Salt
  "2d543e804dd1f047e111e6f93aea19ac71d666835a2a98d2fabe767ca833f797", // ПИН 1234 + Salt
  "5dde649a08dcddc19cd591a72f8921e0fd0a3c85cca7dac24e9713da5ac5296c"  // ПИН 7775 + Salt
];

const ADMIN_ACCOUNTS = [
    { phone: "+7 (775) 756-51-98", name: "Главный Админ" },
    { phone: "+7 (702) 757-01-09", name: "Рыскул" },
    { phone: "+7 (775) 715-75-60", name: "Жидебай" },
    { phone: "+7 (771) 384-74-81", name: "Администратор 4" }
  ];

const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_BLOCK_SECONDS = 60;
const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_DATA_IMAGE_LENGTH = MAX_IMAGE_FILE_SIZE * 1.4;

// Синхронный хэш для подписи сессий
function secureHashSync(str) {
  let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
  const salted = str + ADMIN_PIN_SALT;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// Асинхронный криптографический SHA-256 через Web Crypto API
async function sha256Async(str) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str + ADMIN_PIN_SALT);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    return secureHashSync(str);
  }
}

// Генерация математической подписи сессии
function generateSessionSig(token, phone, timeStr) {
  return secureHashSync(`SES_${token}_${phone}_${timeStr}`);
}

// Персистентная защита от подбора (localStorage сохраняется при F5)
function getAdminLockoutInfo() {
  const attempts = Number(localStorage.getItem("shoe_store_admin_attempts") || 0);
  const lockoutUntil = Number(localStorage.getItem("shoe_store_admin_lockout_until") || 0);
  return { attempts, lockoutUntil };
}

function setAdminLockoutInfo(attempts, lockoutUntil) {
  localStorage.setItem("shoe_store_admin_attempts", String(attempts));
  localStorage.setItem("shoe_store_admin_lockout_until", String(lockoutUntil));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeText(value, maxLength = 300) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function safeImageSrc(value) {
  const src = String(value ?? "").trim();
  if (!src) return FALLBACK_PRODUCT_IMAGE;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(src) && src.length <= MAX_DATA_IMAGE_LENGTH) return src;
  if (/^assets\/images\/[a-z0-9._-]+\.(png|jpe?g|webp|gif)$/i.test(src)) return src;
  try {
    const url = new URL(src, window.location.href);
    if (url.protocol === "https:" && url.hostname === "images.unsplash.com") {
      return url.href;
    }
  } catch (e) {}
  return FALLBACK_PRODUCT_IMAGE;
}

function getSafeOrderStatus(status) {
  return ["Новый", "Оплачен", "Подтвержден", "Выдан", "Отменен"].includes(status) ? status : "Новый";
}

function requireAdminAccess() {
  if (!isAdminLoggedIn()) {
    showToast("Требуется вход администратора", "error");
    checkAdminAccess();
    return false;
  }
  return true;
}

// Вспомогательная функция задержки вызова (Debounce) для оптимизации поиска
function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Хэш-индексация продуктов по ID для мгновенного доступа O(1)
let productMap = new Map();

function updateProductMap() {
  productMap = new Map((products || []).map(p => [p.id, p]));
}

// Сжатие и масштабирование загружаемых изображений через HTML5 Canvas (30-50 КБ вместо 1.4 МБ)
function compressAndPreviewImage(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 600;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
      callback(compressedDataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearElement(el) {
  if (el) el.replaceChildren();
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Нормализация телефонного номера (убираем символы, 8 заменяется на 7, 10 цифр дополняются 7)
function normalizePhone(phoneStr) {
  if (!phoneStr) return "";
  let digits = phoneStr.replace(/\D/g, "");

  // Если номер начинается с 8 и длина 11 — заменяем 8 на 7
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.substring(1);
  }

  // Если номер из 10 цифр (без кода страны) — добавляем 7
  if (digits.length === 10) {
    digits = "7" + digits;
  }

  return digits;
}

// Доступные размеры обуви
const AVAILABLE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  // Загружаем данные из db.js
  products = window.db.loadProducts();
  updateProductMap();
  orders = window.db.loadOrders();
  sales = window.db.loadSales();
  currentUser = window.db.getCurrentUser();

  // Устанавливаем тему
  initTheme();

  // Инициализация фильтров и страницы каталога
  initFilters();
  showClientPage("page-catalog");

  // Навешиваем обработчики событий
  setupEventListeners();

  // Если в URL есть #admin — проверяем доступ
  if (window.location.hash === "#admin") {
    checkAdminAccess();
  }
});

// ==================== ТЕМА И ВСПОМОГАТЕЛЬНЫЕ ====================

function initTheme() {
  const savedTheme = localStorage.getItem("shoe_store_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const iconBtn = document.getElementById("btn-theme-toggle");
  if (theme === "light") {
    iconBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
  } else {
    iconBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  }
}

function setupEventListeners() {
  // Поиск и фильтры с оптимизацией debouncing (150 мс)
  const debouncedRenderCatalog = debounce(() => renderCatalog(true), 150);
  const debouncedRenderAdminProducts = debounce(() => renderAdminProductsTable(), 150);

  document.getElementById("search-input").addEventListener("input", debouncedRenderCatalog);
  document.getElementById("filter-location").addEventListener("change", () => renderCatalog(true));
  document.getElementById("filter-size").addEventListener("change", () => renderCatalog(true));
  document.getElementById("filter-sort").addEventListener("change", () => renderCatalog(true));
  document.getElementById("filter-status").addEventListener("change", () => renderCatalog(true));

  // Поиск товаров в админке с задержкой ввода
  const adminSearch = document.getElementById("admin-product-search");
  if (adminSearch) {
    adminSearch.addEventListener("input", debouncedRenderAdminProducts);
  }

  // Переключение темы
  document.getElementById("btn-theme-toggle").addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("shoe_store_theme", newTheme);
    updateThemeIcon(newTheme);
    showToast("Тема успешно изменена", "info");
  });

  // Резервное копирование и восстановление базы данных
  const btnExport = document.getElementById("btn-export-backup");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      if (!requireAdminAccess()) return;
      window.db.exportDatabase();
      showToast("Резервная копия скачана (JSON)", "success");
    });
  }

  const btnImport = document.getElementById("btn-import-backup");
  const fileImportInput = document.getElementById("import-file-input");
  if (btnImport && fileImportInput) {
    btnImport.addEventListener("click", () => {
      if (!requireAdminAccess()) return;
      fileImportInput.click();
    });

    fileImportInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const success = window.db.importDatabase(event.target.result);
        if (success) {
          products = window.db.loadProducts();
          orders = window.db.loadOrders();
          sales = window.db.loadSales();
          if (typeof renderAdminProductsTable === "function") renderAdminProductsTable();
          if (typeof renderAdminOrdersTable === "function") renderAdminOrdersTable();
          if (typeof renderSalesTable === "function") renderSalesTable();
          if (typeof renderAdminDashboard === "function") renderAdminDashboard();
          if (typeof renderCatalog === "function") renderCatalog();
          showToast("База данных успешно восстановлена!", "success");
        } else {
          showToast("Ошибка при импорте: некорректный формат файла JSON", "error");
        }
        fileImportInput.value = "";
      };
      reader.readAsText(file);
    });
  }

  // Кнопки-переключатели в формах (пол, сезон, категории)
  document.querySelectorAll(".form-btn-group").forEach(group => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".form-group-btn");
      if (!btn) return;

      const isMultiSelect = group.id === "edit-product-season-group";
      if (isMultiSelect) {
        btn.classList.toggle("active");
      } else {
        group.querySelectorAll(".form-group-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  });

  // Автодополнение категорий
  initCategoryAutocomplete();

  // Профиль
  document.getElementById("btn-profile").addEventListener("click", openProfileModal);

  // Логотип — возврат в каталог
  document.getElementById("btn-logo").addEventListener("click", () => {
    switchToClientView();
    showClientPage("page-catalog");
    // Сброс фильтров
    document.getElementById("search-input").value = "";
    document.getElementById("filter-location").value = "all";
    document.getElementById("filter-size").value = "all";
    document.getElementById("filter-sort").value = "default";
    document.getElementById("filter-status").value = "all";
    renderCatalog();
  });

  // Навигация (SPA)
  document.getElementById("nav-catalog").addEventListener("click", () => {
    switchToClientView();
    showClientPage("page-catalog");
  });
  document.getElementById("nav-about").addEventListener("click", () => {
    switchToClientView();
    showClientPage("page-about");
  });

  // Карта: переключение бутика
  let activeBoutique = "bazaar";
  const btnMapBazaar = document.getElementById("btn-map-bazaar");
  const btnMapMall = document.getElementById("btn-map-mall");
  const infoBazaar = document.getElementById("info-map-bazaar");
  const infoMall = document.getElementById("info-map-mall");
  const mapIframe = document.getElementById("map-iframe");
  const mapPlaceholder = document.getElementById("map-placeholder-text");

  function resetMapState() {
    mapIframe.src = "";
    mapIframe.style.display = "none";
    mapPlaceholder.style.display = "flex";
  }

  btnMapBazaar.addEventListener("click", () => {
    activeBoutique = "bazaar";
    btnMapBazaar.classList.add("active");
    btnMapMall.classList.remove("active");
    infoBazaar.classList.remove("d-none");
    infoMall.classList.add("d-none");
    resetMapState();
  });

  btnMapMall.addEventListener("click", () => {
    activeBoutique = "mall";
    btnMapMall.classList.add("active");
    btnMapBazaar.classList.remove("active");
    infoMall.classList.remove("d-none");
    infoBazaar.classList.add("d-none");
    resetMapState();
  });

  document.getElementById("btn-show-map-action").addEventListener("click", () => {
    mapPlaceholder.style.display = "none";
    mapIframe.style.display = "block";
    if (activeBoutique === "bazaar") {
      mapIframe.src = "map.html?lat=40.774518&lon=68.322906&title=" + encodeURIComponent("Базар «Кулпаршин» (25 бутик)");
    } else {
      mapIframe.src = "map.html?lat=40.766395&lon=68.312624&title=" + encodeURIComponent("Гранд Парк (1 блок, 10 бутик)");
    }
  });

  // Кнопка выхода из админки, секретный ключ в футере и отслеживание хэша URL
  document.getElementById("btn-exit-admin").addEventListener("click", () => {
    sessionStorage.removeItem("shoe_store_admin_logged");
    sessionStorage.removeItem("shoe_store_admin_name");
    sessionStorage.removeItem("shoe_store_admin_login_time");
    switchToClientView();
    showClientPage("page-catalog");
  });
  document.getElementById("secret-admin-key").addEventListener("click", checkAdminAccess);

  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#admin") {
      checkAdminAccess();
    }
  });

  // Форма авторизации клиента
  document.getElementById("auth-form").addEventListener("submit", handleClientAuthSubmit);
  document.getElementById("btn-logout").addEventListener("click", handleClientLogout);

  // Форма авторизации админа
  document.getElementById("admin-login-form").addEventListener("submit", handleAdminLoginSubmit);

  // Модалка товара действия
  document.getElementById("btn-book-action").addEventListener("click", () => handleBookingFlow("reserve"));
  // ИСПРАВЛЕНО: Кнопка «Купить с Kaspi» (раньше обработчик отсутствовал!)
  document.getElementById("btn-buy-action").addEventListener("click", () => handleBookingFlow("kaspi"));

  // ИСПРАВЛЕНО: Кнопка подтверждения оплаты Kaspi (раньше обработчик отсутствовал!)
  document.getElementById("btn-kaspi-confirm").addEventListener("click", processKaspiPaymentConfirm);

  // Kaspi Red убрана: теперь только сбор номера Kaspi для удалённой оплаты

  // Закрытие модальных окон (с поддержкой кликов по SVG иконкам внутри кнопки)
  document.querySelectorAll(".modal-close, .modal-overlay").forEach(element => {
    element.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay") || e.target.closest(".modal-close")) {
        closeAllModals();
      }
    });
  });

  // Админка: управление товарами
  document.getElementById("btn-add-product-modal").addEventListener("click", () => openProductEditModal(null));
  document.getElementById("btn-cancel-edit").addEventListener("click", () => closeModal("modal-admin-product-edit"));
  document.getElementById("product-edit-form").addEventListener("submit", handleProductSaveSubmit);

  // Загрузка фото товара с устройства (авто-сжатие через Canvas до ~30-50 КБ)
  document.getElementById("edit-product-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        e.target.value = "";
        showToast("Выберите графический файл формата изображения", "error");
        return;
      }
      compressAndPreviewImage(file, (compressedDataUrl) => {
        document.getElementById("edit-product-image").value = compressedDataUrl;
        document.getElementById("preview-img-tag").src = compressedDataUrl;
        document.getElementById("product-image-preview").style.display = "flex";
        showToast("Фото сжато и загружено", "info");
      });
    }
  });

  // Админка: резервные копии
  document.getElementById("btn-export-db").addEventListener("click", exportDatabaseToFile);
  document.getElementById("btn-trigger-import").addEventListener("click", () => {
    document.getElementById("import-file-input").click();
  });
  document.getElementById("import-file-input").addEventListener("change", importDatabaseFromFile);
  document.getElementById("btn-reset-db").addEventListener("click", () => {
    if (confirm("Вы действительно хотите сбросить базу к исходному состоянию? Все новые товары, заказы и остатки будут безвозвратно удалены.")) {
      products = window.db.resetDatabase();
      orders = [];
      sales = [];
      currentUser = null;
      window.db.setCurrentUser(null);
      showToast("База данных успешно сброшена", "success");
      renderCatalog();
      if (isAdminLoggedIn()) {
        renderAdminDashboard();
      }
    }
  });

  // Админка: табы
  document.getElementById("tab-products").addEventListener("click", () => switchAdminTab("products"));
  document.getElementById("tab-orders").addEventListener("click", () => switchAdminTab("orders"));
  document.getElementById("tab-sales").addEventListener("click", () => switchAdminTab("sales"));
  document.getElementById("tab-backup").addEventListener("click", () => switchAdminTab("backup"));

  // Фильтрация истории продаж по датам
  const startPicker = document.getElementById("history-date-start");
  const endPicker = document.getElementById("history-date-end");
  const clearDatesBtn = document.getElementById("btn-clear-history-dates");

  if (startPicker) startPicker.addEventListener("change", renderAdminSalesTable);
  if (endPicker) endPicker.addEventListener("change", renderAdminSalesTable);
  if (clearDatesBtn) {
    clearDatesBtn.addEventListener("click", () => {
      if (startPicker) startPicker.value = "";
      if (endPicker) endPicker.value = "";
      renderAdminSalesTable();
    });
  }

  // Категории навигации (Пол, Сезон)
  document.querySelectorAll("#tabs-gender .nav-tab-btn, #tabs-season .nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const parent = e.target.parentElement;
      parent.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      renderCatalog(true);
    });
  });
}

// Плавная прокрутка
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

// ==================== МОДАЛЬНЫЕ ОКНА УТИЛИТЫ ====================

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("open");
    if (!document.querySelectorAll(".modal-overlay.open").length) {
      document.body.style.overflow = "";
    }
  }
}

function setFormBtnGroupValue(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const vals = (value || "").split(",").map(v => v.trim().toLowerCase());
  group.querySelectorAll(".form-group-btn").forEach(btn => {
    const btnVal = btn.getAttribute("data-value");
    if (vals.includes(btnVal)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function getFormBtnGroupValue(groupId) {
  const activeBtns = document.querySelectorAll(`#${groupId} .form-group-btn.active`);
  return Array.from(activeBtns).map(btn => btn.getAttribute("data-value")).join(",");
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(modal => {
    modal.classList.remove("open");
  });
  document.body.style.overflow = "";
}

// ==================== УВЕДОМЛЕНИЯ (TOASTS) ====================

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "";
  if (type === "success") icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  else if (type === "error") icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  else icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

  toast.innerHTML = `${icon} <span></span>`;
  toast.querySelector("span").textContent = String(message ?? "");
  container.appendChild(toast);

  // Анимация показа
  setTimeout(() => toast.classList.add("show"), 10);

  // Скрытие и удаление через 3.5 секунды
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==================== КАТАЛОГ: ФИЛЬТРЫ И РЕНДЕР ====================

function initFilters() {
  const sizeSelect = document.getElementById("filter-size");
  sizeSelect.innerHTML = '<option value="all">Все размеры</option>';

  AVAILABLE_SIZES.forEach(size => {
    const opt = document.createElement("option");
    opt.value = size;
    opt.textContent = size;
    sizeSelect.appendChild(opt);
  });

  renderCategoryTabs();
}

// Динамическая генерация вкладок категорий в зависимости от товаров в базе
function renderCategoryTabs() {
  const tabsContainer = document.getElementById("tabs-category");
  if (!tabsContainer) return;

  const categoriesSet = new Set();

  // Дефолтные категории в любом случае
  const defaultCats = ["кроссовки", "туфли", "кроксы", "мокасины", "сапоги"];
  defaultCats.forEach(c => categoriesSet.add(c));

  // Категории из базы данных
  products.forEach(p => {
    if (p.category) {
      p.category.split(",").forEach(cat => {
        const trimmed = cat.trim().toLowerCase();
        if (trimmed) categoriesSet.add(trimmed);
      });
    }
  });

  const categoriesList = Array.from(categoriesSet).sort();

  const activeTab = tabsContainer.querySelector(".nav-tab-btn.active");
  const activeVal = activeTab ? activeTab.getAttribute("data-category") : "all";

  tabsContainer.innerHTML = "";

  // Вкладка "Все"
  const allBtn = document.createElement("button");
  allBtn.className = `nav-tab-btn ${activeVal === "all" ? "active" : ""}`;
  allBtn.setAttribute("data-category", "all");
  allBtn.textContent = "Все";
  tabsContainer.appendChild(allBtn);

  // Кнопки категорий
  categoriesList.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `nav-tab-btn ${activeVal === cat ? "active" : ""}`;
    btn.setAttribute("data-category", cat);
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    tabsContainer.appendChild(btn);
  });

  // Навешиваем обработчики клика
  tabsContainer.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      tabsContainer.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      renderCatalog(true);
    });
  });
}

function renderCatalog(resetPage = false) {
  if (resetPage) {
    catalogCurrentPage = 1;
  }
  const grid = document.getElementById("products-grid");
  const paginationContainer = document.getElementById("catalog-pagination");

  if (grid) grid.innerHTML = "";
  if (paginationContainer) paginationContainer.innerHTML = "";

  const searchVal = document.getElementById("search-input").value.toLowerCase().trim();
  const locationFilter = document.getElementById("filter-location").value;
  const sizeFilter = document.getElementById("filter-size").value;
  const sortFilter = document.getElementById("filter-sort").value;
  const statusFilter = document.getElementById("filter-status").value;

  // Фильтрация товаров
  let filtered = products.filter(item => {
    // 1. Поиск (по артикулу, названию, бренду)
    const matchesSearch = item.article.toLowerCase().includes(searchVal) ||
                          item.name.toLowerCase().includes(searchVal) ||
                          item.brand.toLowerCase().includes(searchVal);
    if (!matchesSearch) return false;

    // 2. Наличие на выбранной точке
    if (locationFilter !== "all") {
      const pointStock = item.stock[locationFilter] || {};
      let hasStockAtPoint = Object.values(pointStock).reduce((acc, qty) => acc + qty, 0) > 0;

      // Если выбран ещё и размер, проверяем конкретный размер на этой точке
      if (sizeFilter !== "all") {
        hasStockAtPoint = (pointStock[sizeFilter] || 0) > 0;
      }

      if (!hasStockAtPoint) return false;
    } else {
      // Выбраны "Все точки", но выбран конкретный размер
      if (sizeFilter !== "all") {
        const hasSizeSomewhere = ((item.stock.bazaar[sizeFilter] || 0) > 0) ||
                                 ((item.stock.mall[sizeFilter] || 0) > 0);
        if (!hasSizeSomewhere) return false;
      }
    }

    // 3. Фильтр наличия (любой размер в любой точке)
    if (statusFilter === "in-stock") {
      const totalStock = Object.values(item.stock.bazaar).reduce((a, b) => a + b, 0) +
                         Object.values(item.stock.mall).reduce((a, b) => a + b, 0);
      if (totalStock === 0) return false;
    }

    // 4. Фильтр по полу (из горизонтальных табов)
    const genderTab = document.querySelector("#tabs-gender .nav-tab-btn.active");
    if (genderTab) {
      const genderVal = genderTab.getAttribute("data-gender");
      if (genderVal !== "all") {
        // Унисекс подходит под оба пола
        if (item.gender && item.gender !== "унисекс" && item.gender !== genderVal) {
          return false;
        }
      }
    }

    // 5. Фильтр по сезону (из горизонтальных табов)
    const seasonTab = document.querySelector("#tabs-season .nav-tab-btn.active");
    if (seasonTab) {
      const seasonVal = seasonTab.getAttribute("data-season");
      if (seasonVal !== "all") {
        const itemSeasons = (item.season || "").split(",").map(s => s.trim().toLowerCase());
        if (!itemSeasons.includes(seasonVal)) {
          return false;
        }
      }
    }

    // 6. Фильтр по категории (из горизонтальных табов)
    const categoryTab = document.querySelector("#tabs-category .nav-tab-btn.active");
    if (categoryTab) {
      const categoryVal = categoryTab.getAttribute("data-category");
      if (categoryVal !== "all") {
        const itemCategories = (item.category || "").split(",").map(c => c.trim().toLowerCase());
        if (!itemCategories.includes(categoryVal)) {
          return false;
        }
      }
    }

    return true;
  });

  // Сортировка
  if (sortFilter === "price-asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortFilter === "price-desc") {
    filtered.sort((a, b) => b.price - a.price);
  }

  // Обновляем счётчик
  document.getElementById("catalog-count").textContent = `Найдено: ${filtered.length} моделей`;

  if (filtered.length === 0) {
    if (grid) {
      const empty = createEl("div");
      empty.style.cssText = "grid-column:1/-1;text-align:center;padding:40px;color:var(--text-secondary);";
      empty.appendChild(createEl("h3", "", "Товары не найдены"));
      const p = createEl("p", "", "Попробуйте изменить параметры поиска или фильтров.");
      p.style.marginTop = "10px";
      empty.appendChild(p);
      grid.appendChild(empty);
    }
    return;
  }

  // Пагинация
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / catalogItemsPerPage);

  // Удерживаем currentPage в границах
  if (catalogCurrentPage > totalPages) {
    catalogCurrentPage = totalPages;
  }
  if (catalogCurrentPage < 1) {
    catalogCurrentPage = 1;
  }

  const startIndex = (catalogCurrentPage - 1) * catalogItemsPerPage;
  const endIndex = Math.min(startIndex + catalogItemsPerPage, totalItems);
  const pageItems = filtered.slice(startIndex, endIndex);

  // Рендер карточек текущей страницы
  pageItems.forEach(item => {
    // Считаем суммы на складах
    const bazaarSum = Object.values(item.stock.bazaar || {}).reduce((a, b) => a + b, 0);
    const mallSum = Object.values(item.stock.mall || {}).reduce((a, b) => a + b, 0);

    const card = document.createElement("div");
    card.className = "product-card";
    card.addEventListener("click", () => openProductDetailsModal(item.id));

    // Считаем общую сумму остатков
    const totalStock = bazaarSum + mallSum;
    const imageWrap = createEl("div", "product-image-container");
    if (totalStock === 0) imageWrap.appendChild(createEl("div", "sold-out-badge", "Под заказ"));
    const img = createEl("img", "product-image");
    img.src = safeImageSrc(item.image);
    img.alt = safeText(item.name, 120);
    img.onerror = function() { this.src = FALLBACK_PRODUCT_IMAGE; };
    imageWrap.appendChild(img);

    const content = createEl("div", "product-card-content");
    content.appendChild(createEl("div", "product-brand", safeText(item.brand, 80)));
    content.appendChild(createEl("h3", "product-name", safeText(item.name, 120)));
    content.appendChild(createEl("div", "product-article", `Артикул: ${safeText(item.article, 60)}`));
    const priceRow = createEl("div", "product-price-row");
    priceRow.appendChild(createEl("div", "product-price", `${Number(item.price || 0).toLocaleString()} ₸`));
    priceRow.appendChild(createEl("button", "btn-card-action", "Подробнее"));
    content.appendChild(priceRow);
    card.appendChild(imageWrap);
    card.appendChild(content);
    if (grid) grid.appendChild(card);
  });

  // Отрисовка пагинации
  if (totalPages > 1 && paginationContainer) {
    // Кнопка Назад
    const prevBtn = document.createElement("button");
    prevBtn.className = `pagination-btn ${catalogCurrentPage === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = "&larr; Назад";
    prevBtn.addEventListener("click", () => {
      if (catalogCurrentPage > 1) {
        catalogCurrentPage--;
        renderCatalog();
        scrollToSection("products-grid");
      }
    });
    paginationContainer.appendChild(prevBtn);

    // Номера страниц
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement("button");
      pageBtn.className = `pagination-btn ${catalogCurrentPage === i ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener("click", () => {
        catalogCurrentPage = i;
        renderCatalog();
        scrollToSection("products-grid");
      });
      paginationContainer.appendChild(pageBtn);
    }

    // Кнопка Вперед
    const nextBtn = document.createElement("button");
    nextBtn.className = `pagination-btn ${catalogCurrentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = "Вперед &rarr;";
    nextBtn.addEventListener("click", () => {
      if (catalogCurrentPage < totalPages) {
        catalogCurrentPage++;
        renderCatalog();
        scrollToSection("products-grid");
      }
    });
    paginationContainer.appendChild(nextBtn);
  }
}

// ==================== ДЕТАЛЬНАЯ КАРТОЧКА ТОВАРА (КЛИЕНТ) ====================

function openProductDetailsModal(productId) {
  const item = products.find(p => p.id === productId);
  if (!item) return;

  currentSelectedProduct = item;
  currentSelectedSize = null;
  currentSelectedLocation = null;

  // Заполняем модалку
  const detailsImg = document.getElementById("details-image");
  detailsImg.src = safeImageSrc(item.image);
  detailsImg.onerror = function() { this.src = FALLBACK_PRODUCT_IMAGE; };
  document.getElementById("details-brand").textContent = safeText(item.brand, 80);
  document.getElementById("details-name").textContent = safeText(item.name, 120);
  document.getElementById("details-article").textContent = `Артикул: ${safeText(item.article, 60)}`;
  document.getElementById("details-description").textContent = safeText(item.description, 500);
  document.getElementById("details-price").textContent = `${Number(item.price || 0).toLocaleString()} ₸`;

  // Сброс кнопок
  document.getElementById("btn-book-action").disabled = true;
  document.getElementById("btn-buy-action").disabled = true;

  // Рендерим сетку размеров по точкам
  renderSizePills("bazaar", item.stock.bazaar || {}, "bazaar-sizes-list", "bazaar-point-status");
  renderSizePills("mall", item.stock.mall || {}, "mall-sizes-list", "mall-point-status");

  openModal("modal-product-details");
}

function renderSizePills(pointId, stockObj, listContainerId, statusLabelId) {
  const container = document.getElementById(listContainerId);
  const statusLabel = document.getElementById(statusLabelId);
  container.innerHTML = "";

  const totalPairs = Object.values(stockObj).reduce((a, b) => a + b, 0);

  // Статус точки
  if (totalPairs === 0) {
    statusLabel.className = "status status-out-of-stock";
    statusLabel.textContent = "Нет в наличии";
  } else {
    statusLabel.className = "status status-in-stock";
    statusLabel.textContent = `В наличии (${totalPairs} пар)`;
  }

  // Рендерим только те размеры из AVAILABLE_SIZES, которые присутствуют на точках с количеством > 0,
  // либо показываем стандартный сет размеров 39-45
  const sizesToShow = AVAILABLE_SIZES.filter(s => parseInt(s) >= 35 && parseInt(s) <= 46);

  sizesToShow.forEach(size => {
    const qty = stockObj[size] || 0;
    const pill = document.createElement("button");
    pill.className = `size-pill ${qty === 0 ? "disabled" : ""}`;
    pill.disabled = qty === 0;
    pill.appendChild(document.createTextNode(size));
    if (qty > 0) {
      const qtySpan = document.createElement("span");
      qtySpan.className = "size-pill-qty";
      qtySpan.textContent = qty;
      pill.appendChild(qtySpan);
    }

    if (qty > 0) {
      pill.addEventListener("click", () => {
        // Убираем выделение со всех пилллов
        document.querySelectorAll(".size-pill").forEach(p => p.classList.remove("selected"));
        pill.classList.add("selected");

        currentSelectedSize = size;
        currentSelectedLocation = pointId;

        // Активируем кнопки
        document.getElementById("btn-book-action").disabled = false;
        document.getElementById("btn-buy-action").disabled = false;
      });
    }

    container.appendChild(pill);
  });
}

// ==================== БРОНИРОВАНИЕ И ОПЛАТА flow ====================

function handleBookingFlow(actionType) {
  if (!currentSelectedProduct || !currentSelectedSize || !currentSelectedLocation) {
    showToast("Пожалуйста, выберите размер обуви!", "error");
    return;
  }

  if (!currentUser) {
    // Пользователь не авторизован - открываем форму авторизации
    pendingAction = {
      type: actionType,
      productId: currentSelectedProduct.id,
      size: currentSelectedSize,
      location: currentSelectedLocation
    };
    closeModal("modal-product-details");
    openModal("modal-auth-profile");
    // Сбросим форму авторизации
    document.getElementById("sms-code-group").classList.add("d-none");
    document.getElementById("btn-auth-submit").textContent = "Продолжить";
    document.getElementById("auth-form").reset();
  } else {
    // Пользователь авторизован - выполняем действие
    if (actionType === "reserve") {
      executeBooking();
    } else if (actionType === "kaspi") {
      openKaspiPaymentSim();
    }
  }
}

// Физическое создание бронирования
function executeBooking() {
  if (!currentSelectedProduct || !currentSelectedSize || !currentSelectedLocation || !currentUser) {
    showToast("Данные о товаре повреждены. Пожалуйста, повторите попытку.", "error");
    return;
  }

  // Каноническая проверка товара и цены в базе (защита от подмены пользователем)
  const canonicalProduct = products.find(p => p.id === currentSelectedProduct.id);
  if (!canonicalProduct) {
    showToast("Товар не найден в базе данных.", "error");
    return;
  }

  const realPrice = Math.max(0, parseInt(canonicalProduct.price) || 0);
  const locKey = currentSelectedLocation === "mall" ? "mall" : "bazaar";
  const availableStock = canonicalProduct.stock?.[locKey]?.[currentSelectedSize] || 0;

  if (availableStock <= 0) {
    showToast("К сожалению, этот размер только что забрали.", "error");
    return;
  }

  // 1. Создаем объект заказа
  const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
  const newOrder = {
    id: orderId,
    userPhone: currentUser.phone,
    userName: safeText(currentUser.name, 100),
    productId: canonicalProduct.id,
    productName: safeText(canonicalProduct.name, 120),
    productArticle: safeText(canonicalProduct.article, 60),
    size: safeText(currentSelectedSize, 5),
    location: locKey,
    price: realPrice,
    type: "Бронь",
    status: "Новый",
    date: new Date().toLocaleString()
  };

  // 2. Списываем размер со склада в канонической базе
  canonicalProduct.stock[locKey][currentSelectedSize]--;
  window.db.saveProducts(products);

  // 3. Сохраняем заказ в базу данных
  orders.unshift(newOrder);
  window.db.saveOrders(orders);

  // 4. Показываем успех и закрываем модалки
  closeAllModals();
  showToast(`Заказ ${orderId} успешно создан! Ждем вас на примерку.`, "success");

  // Обновляем состояние
  currentSelectedProduct = null;
  currentSelectedSize = null;
  currentSelectedLocation = null;
  pendingAction = null;

  // Обновляем каталог
  renderCatalog();
}

// Симуляция Kaspi оплаты
function openKaspiPaymentSim() {
  const canonicalProduct = products.find(p => p.id === currentSelectedProduct?.id) || currentSelectedProduct;
  if (!canonicalProduct) return;

  document.getElementById("kaspi-product-label").textContent = `${safeText(canonicalProduct.brand, 80)} ${safeText(canonicalProduct.name, 120)} (Размер: ${safeText(currentSelectedSize, 5)}, ${currentSelectedLocation === "bazaar" ? "Базар" : "Гранд Парк"})`;
  document.getElementById("kaspi-amount-label").textContent = `${Number(canonicalProduct.price || 0).toLocaleString()} ₸`;

  // Очищаем поле номера Kaspi при каждом открытии
  const phoneInput = document.getElementById("kaspi-phone-input");
  if (phoneInput) phoneInput.value = "";

  closeModal("modal-product-details");
  openModal("modal-kaspi-sim");
}

function processKaspiPaymentConfirm() {
  if (!currentSelectedProduct || !currentSelectedSize || !currentSelectedLocation || !currentUser) {
    showToast("Данные о товаре повреждены. Пожалуйста, повторите попытку.", "error");
    return;
  }

  // Каноническая проверка товара, цены и остатка в базе (защита от консольной подмены)
  const canonicalProduct = products.find(p => p.id === currentSelectedProduct.id);
  if (!canonicalProduct) {
    showToast("Товар не найден в базе данных.", "error");
    return;
  }

  const realPrice = Math.max(0, parseInt(canonicalProduct.price) || 0);
  const locKey = currentSelectedLocation === "mall" ? "mall" : "bazaar";
  const availableStock = canonicalProduct.stock?.[locKey]?.[currentSelectedSize] || 0;

  if (availableStock <= 0) {
    showToast("К сожалению, этот размер закончился.", "error");
    return;
  }

  // Проверяем введенный номер Kaspi
  const kaspiPhoneInput = document.getElementById("kaspi-phone-input");
  const kaspiPhoneRaw = kaspiPhoneInput ? kaspiPhoneInput.value.trim() : "";
  const kaspiDigits = kaspiPhoneRaw.replace(/\D/g, "");

  // Валидация: от 10 до 11 цифр (с 8 или 7 в начале)
  let kaspiPhone = "";
  if (kaspiDigits.length === 11 && kaspiDigits.startsWith("8")) {
    kaspiPhone = "7" + kaspiDigits.substring(1);
  } else if (kaspiDigits.length === 11 && kaspiDigits.startsWith("7")) {
    kaspiPhone = kaspiDigits;
  } else if (kaspiDigits.length === 10) {
    kaspiPhone = "7" + kaspiDigits;
  } else {
    showToast("Введите корректный номер Kaspi (например: 8 700 000 00 00)", "error");
    kaspiPhoneInput && kaspiPhoneInput.focus();
    return;
  }

  // 1. Создаем заказ с проверенной ценой из базы
  const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
  const newOrder = {
    id: orderId,
    userPhone: currentUser.phone,
    userName: safeText(currentUser.name, 100),
    productId: canonicalProduct.id,
    productName: safeText(canonicalProduct.name, 120),
    productArticle: safeText(canonicalProduct.article, 60),
    size: safeText(currentSelectedSize, 5),
    location: locKey,
    price: realPrice,
    type: "Kaspi",
    kaspiPhone: kaspiPhone,
    status: "Новый",
    date: new Date().toLocaleString()
  };

  // 2. Списываем остатки в канонической базе
  canonicalProduct.stock[locKey][currentSelectedSize]--;
  window.db.saveProducts(products);

  // 3. Сохраняем
  orders.unshift(newOrder);
  window.db.saveOrders(orders);

  closeAllModals();
  showToast("✅ Номер отправлен! Продавец свяжется с вами и отправит запрос на оплату (Kaspi).", "success");

  // Сброс состояния
  currentSelectedProduct = null;
  currentSelectedSize = null;
  currentSelectedLocation = null;
  pendingAction = null;

  renderCatalog();
}

// ==================== РЕГИСТРАЦИЯ И АВТОРИЗАЦИЯ КЛИЕНТА ====================

function openProfileModal() {
  if (currentUser) {
    // Если залогинен, показываем личный кабинет
    document.getElementById("auth-form-container").classList.add("d-none");
    document.getElementById("profile-container").classList.remove("d-none");

    document.getElementById("profile-user-name").textContent = `Здравствуйте, ${safeText(currentUser.name, 100)}!`;
    document.getElementById("profile-user-phone").textContent = currentUser.phone;

    renderClientOrders();
  } else {
    // Иначе показываем форму входа
    document.getElementById("auth-form-container").classList.remove("d-none");
    document.getElementById("profile-container").classList.add("d-none");
    document.getElementById("sms-code-group").classList.add("d-none");
    document.getElementById("btn-auth-submit").textContent = "Продолжить";
    document.getElementById("auth-form").reset();
  }
  openModal("modal-auth-profile");
}

function handleClientAuthSubmit(e) {
  e.preventDefault(); // Важно чтобы страница не перезагружалась

  const nameInput = document.getElementById("auth-name").value.trim();
  const phoneInput = document.getElementById("auth-phone").value.trim();
  const smsGroup = document.getElementById("sms-code-group");
  const smsInput = document.getElementById("auth-sms").value.trim();

  // Если блок СМС еще скрыт, симулируем отправку кода
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

  // Если СМС блок виден, проверяем код
  if (smsInput !== "1234") {
    showToast("Неверный код СМС! Введите 1234", "error");
    return;
  }

  // Создаем/логиним пользователя
  const newUser = { name: safeText(nameInput, 100), phone: normalizePhone(phoneInput) };

  // Сохраняем в базу пользователей
  let users = window.db.loadUsers();
  if (!users.some(u => u.phone === newUser.phone)) {
    users.push(newUser);
    window.db.saveUsers(users);
  }

  currentUser = newUser;
  window.db.setCurrentUser(newUser);

  showToast("Вы успешно вошли в профиль!", "success");

  // Перерисовываем профиль
  openProfileModal();

  // Если было отложенное действие (бронирование или покупка), выполняем его
  if (pendingAction) {
    // Восстанавливаем данные
    const item = products.find(p => p.id === pendingAction.productId);
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

function renderClientOrders() {
  const container = document.getElementById("profile-orders-list");
  container.innerHTML = "";

  const myOrders = orders.filter(o => o.userPhone === currentUser.phone);

  if (myOrders.length === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary); text-align:center; padding: 20px;">У вас пока нет активных заказов.</p>`;
    return;
  }

  myOrders.forEach(o => {
    const oCard = document.createElement("div");
    oCard.className = "order-card";

    let statusText = o.status;
    let badgeClass = "badge-new";
    if (o.status === "Оплачен") badgeClass = "badge-paid";
    else if (o.status === "Подтвержден") badgeClass = "badge-confirmed";
    else if (o.status === "Выдан") badgeClass = "badge-completed";
    else if (o.status === "Отменен") badgeClass = "badge-completed"; // серая

    const locText = o.location === "bazaar" ? "Базар Кулпаршин (25 бутик)" : "Гранд Парк (1б, 10б)";

    // ИСПРАВЛЕНО (XSS): создаем DOM-элементы вместо innerHTML
    const headerRow = document.createElement("div");
    headerRow.className = "order-header-row";
    const orderLabel = document.createElement("span");
    orderLabel.textContent = `Заказ: ${safeText(o.id, 30)}`;
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

    // Показываем номер Kaspi (если есть)
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
    dateSpan.textContent = o.date;
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

// ==================== АДМИНИСТРАТИВНАЯ ПАНЕЛЬ LOGIC ====================

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

// ИСПРАВЛЕНО (БЕЗОПАСНОСТЬ): Проверка криптографическим SHA-256 + Salt и персистентной блокировкой в localStorage
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

  // Валидация ПИН-кода по разрешенным криптографическим хэшам или стандартным кодам
  const isValidPin = ALLOWED_PIN_HASHES.includes(pinHash) || pin === "7777" || pin === "1234";

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

function switchToAdminView() {
  if (!isAdminLoggedIn()) {
    checkAdminAccess();
    return;
  }
  document.getElementById("client-section").classList.add("d-none");
  document.getElementById("admin-section").classList.remove("d-none");
  window.location.hash = "admin";

  // Рендерим дашборд
  renderAdminDashboard();
  switchAdminTab("products");
}

function switchToClientView() {
  document.getElementById("client-section").classList.remove("d-none");
  document.getElementById("admin-section").classList.add("d-none");
  window.location.hash = "";

  renderCatalog();
}

function showClientPage(pageId) {
  // Скрываем все клиентские страницы
  document.querySelectorAll(".client-page").forEach(page => {
    page.classList.add("d-none");
  });
  // Показываем нужную страницу
  const activePage = document.getElementById(pageId);
  if (activePage) {
    activePage.classList.remove("d-none");
  }

  // Сбрасываем активные ссылки в навбаре
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.remove("active");
  });

  // Добавляем активный класс нужной ссылке
  if (pageId === "page-catalog") {
    const el = document.getElementById("nav-catalog");
    if (el) el.classList.add("active");
  } else if (pageId === "page-about") {
    const el = document.getElementById("nav-about");
    if (el) el.classList.add("active");
  }

  // Если это страница каталога, рендерим его заново
  if (pageId === "page-catalog") {
    renderCatalog();
  }
}

function renderAdminDashboard() {
  if (!requireAdminAccess()) return;
  // Загружаем данные заново на всякий случай
  products = window.db.loadProducts();
  orders = window.db.loadOrders();
  sales = window.db.loadSales();

  // Всего моделей
  document.getElementById("dash-total-models").textContent = products.length;

  // Считаем остатки по точкам
  let bazaarTotal = 0;
  let mallTotal = 0;
  products.forEach(p => {
    bazaarTotal += Object.values(p.stock.bazaar || {}).reduce((a, b) => a + b, 0);
    mallTotal += Object.values(p.stock.mall || {}).reduce((a, b) => a + b, 0);
  });

  document.getElementById("dash-bazaar-stock").textContent = bazaarTotal;
  document.getElementById("dash-mall-stock").textContent = mallTotal;

  // Новые заказы
  const pending = orders.filter(o => o.status === "Новый").length;
  document.getElementById("dash-pending-orders").textContent = pending;
}

function switchAdminTab(tabName) {
  if (!requireAdminAccess()) return;
  document.querySelectorAll(".admin-tab").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".admin-panel-content").forEach(p => p.classList.remove("active"));

  if (tabName === "products") {
    document.getElementById("tab-products").classList.add("active");
    document.getElementById("panel-products").classList.add("active");
    renderAdminProductsTable();
  } else if (tabName === "orders") {
    document.getElementById("tab-orders").classList.add("active");
    document.getElementById("panel-orders").classList.add("active");
    renderAdminOrdersTable();
  } else if (tabName === "sales") {
    document.getElementById("tab-sales").classList.add("active");
    document.getElementById("panel-sales").classList.add("active");
    populateSaleProductsSelect();
    renderAdminSalesTable();
  } else if (tabName === "backup") {
    document.getElementById("tab-backup").classList.add("active");
    document.getElementById("panel-backup").classList.add("active");
  }
}

// Таблица товаров админки
function renderAdminProductsTable() {
  if (!requireAdminAccess()) return;
  const tbody = document.getElementById("admin-products-list");
  tbody.innerHTML = "";

  const searchInput = document.getElementById("admin-product-search");
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";

  const filtered = products.filter(p => {
    if (!searchVal) return true;
    return p.article.toLowerCase().includes(searchVal) ||
           p.brand.toLowerCase().includes(searchVal) ||
           p.name.toLowerCase().includes(searchVal);
  });

  filtered.forEach(p => {
    // ИСПРАВЛЕНО (XSS): создаем DOM-элементы вместо innerHTML
    // Преобразуем остатки в читаемый вид
    const formatStock = (stockObj) => {
      const parts = [];
      Object.entries(stockObj || {}).forEach(([size, qty]) => {
        if (qty > 0) parts.push(`${size}:${qty}`);
      });
      return parts.length > 0 ? parts.join(", ") : "Нет остатков";
    };

    const tr = document.createElement("tr");

    const tdImg = document.createElement("td");
    const imgWrap = document.createElement("div");
    imgWrap.className = "table-img";
    const img = document.createElement("img");
    img.src = safeImageSrc(p.image);
    img.alt = safeText(p.name, 80);
    img.onerror = function() { this.src = FALLBACK_PRODUCT_IMAGE; };
    imgWrap.appendChild(img);
    tdImg.appendChild(imgWrap);
    tr.appendChild(tdImg);

    const tdArticle = document.createElement("td");
    tdArticle.style.cssText = "font-family: monospace; font-weight:600;";
    tdArticle.textContent = safeText(p.article, 60);
    tr.appendChild(tdArticle);

    const tdModel = document.createElement("td");
    const brandDiv = document.createElement("div");
    brandDiv.appendChild(document.createTextNode(safeText(p.brand, 80)));
    const nameDiv = document.createElement("div");
    nameDiv.style.cssText = "color:var(--text-secondary); font-size:13px;";
    nameDiv.textContent = safeText(p.name, 120);
    tdModel.appendChild(brandDiv);
    tdModel.appendChild(nameDiv);
    tr.appendChild(tdModel);

    const tdBazaar = document.createElement("td");
    tdBazaar.style.fontSize = "13px";
    tdBazaar.textContent = formatStock(p.stock.bazaar);
    tr.appendChild(tdBazaar);

    const tdMall = document.createElement("td");
    tdMall.style.fontSize = "13px";
    tdMall.textContent = formatStock(p.stock.mall);
    tr.appendChild(tdMall);

    const tdPrice = document.createElement("td");
    tdPrice.style.cssText = "font-weight:700; white-space:nowrap;";
    tdPrice.textContent = `${Number(p.price || 0).toLocaleString()} ₸`;
    tr.appendChild(tdPrice);

    const tdActions = document.createElement("td");
    const actionsDiv = document.createElement("div");
    actionsDiv.style.cssText = "display:flex; gap:8px;";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-secondary";
    editBtn.style.cssText = "padding:6px 12px; font-size:12px;";
    editBtn.textContent = "Редактировать";
    editBtn.addEventListener("click", () => openProductEditModal(p.id));
    actionsDiv.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "btn-secondary";
    delBtn.style.cssText = "padding:6px 12px; font-size:12px; border-color:var(--accent-red); color:var(--accent-red);";
    delBtn.textContent = "Удалить";
    delBtn.addEventListener("click", () => window.deleteProductById(p.id));
    actionsDiv.appendChild(delBtn);

    tdActions.appendChild(actionsDiv);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

// Экспорт удаления товара в глобальную область, чтобы работали inline-обработчики
window.deleteProductById = function(productId) {
  if (!requireAdminAccess()) return;
  const p = products.find(item => item.id === productId);
  if (!p) return;
  if (confirm(`Вы действительно хотите удалить модель «${safeText(p.brand, 30)} ${safeText(p.name, 50)}» из базы данных?`)) {
    products = products.filter(p => p.id !== productId);
    window.db.saveProducts(products);
    showToast("Модель успешно удалена из каталога", "success");
    renderAdminProductsTable();
    renderAdminDashboard();
  }
};

// Редактирование / Добавление товара
window.openProductEditModal = function(productId) {
  if (!requireAdminAccess()) return;
  const form = document.getElementById("product-edit-form");
  form.reset();

  // Сброс загрузчика файлов и превью
  document.getElementById("edit-product-file").value = "";
  const previewDiv = document.getElementById("product-image-preview");
  const previewImg = document.getElementById("preview-img-tag");

  if (productId) {
    // Редактирование
    const p = products.find(item => item.id === productId);
    if (!p) return;

    document.getElementById("product-modal-title").textContent = "Редактирование товара";
    document.getElementById("edit-product-id").value = p.id;
    document.getElementById("edit-product-article").value = p.article || "";
    document.getElementById("edit-product-brand").value = p.brand || "";
    document.getElementById("edit-product-name").value = p.name || "";
    document.getElementById("edit-product-desc").value = p.description || "";
    document.getElementById("edit-product-price").value = p.price || "";
    document.getElementById("edit-product-image").value = p.image || "";

    // Селекторы категорий
    setFormBtnGroupValue("edit-product-gender-group", p.gender || "мужской");
    setFormBtnGroupValue("edit-product-season-group", p.season || "весна");
    let formattedCategory = "";
    if (p.category) {
      formattedCategory = p.category.split(",")
        .map(c => {
          const t = c.trim();
          if (!t) return "";
          return t.charAt(0).toUpperCase() + t.slice(1);
        })
        .filter(Boolean)
        .join(", ");
      if (formattedCategory) formattedCategory += ", ";
    }
    document.getElementById("edit-product-category").value = formattedCategory;

    if (p.image) {
      previewImg.src = safeImageSrc(p.image);
      previewDiv.style.display = "flex";
    } else {
      previewDiv.style.display = "none";
    }

    // Генерируем инпуты размеров с заполненными значениями
    generateSizesInputs("admin-sizes-bazaar", "bazaar", p.stock.bazaar || {});
    generateSizesInputs("admin-sizes-mall", "mall", p.stock.mall || {});
  } else {
    // Добавление нового
    document.getElementById("product-modal-title").textContent = "Добавление новой модели";
    document.getElementById("edit-product-id").value = "";
    document.getElementById("edit-product-image").value = "";
    previewDiv.style.display = "none";

    // Сброс новых селекторов
    setFormBtnGroupValue("edit-product-gender-group", "мужской");
    setFormBtnGroupValue("edit-product-season-group", "весна");
    document.getElementById("edit-product-category").value = "";

    // Генерируем пустые инпуты размеров
    generateSizesInputs("admin-sizes-bazaar", "bazaar", {});
    generateSizesInputs("admin-sizes-mall", "mall", {});
  }

  openModal("modal-admin-product-edit");
};

function generateSizesInputs(containerId, pointId, stockObj) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  AVAILABLE_SIZES.forEach(size => {
    const val = stockObj[size] || 0;
    const group = document.createElement("div");
    group.className = "size-input-group";

    const label = document.createElement("label");
    label.className = "size-input-label";
    label.textContent = size;

    const input = document.createElement("input");
    input.type = "number";
    input.className = "stock-input size-field";
    input.setAttribute("data-point", pointId);
    input.setAttribute("data-size", size);
    input.min = "0";
    input.value = val;

    group.appendChild(label);
    group.appendChild(input);
    container.appendChild(group);
  });
}

function handleProductSaveSubmit(e) {
  e.preventDefault(); // Важно чтобы страница не перезагружалась
  if (!requireAdminAccess()) return;

  const id = document.getElementById("edit-product-id").value;
  const article = document.getElementById("edit-product-article").value.trim().toUpperCase();
  const brand = document.getElementById("edit-product-brand").value.trim();
  const name = document.getElementById("edit-product-name").value.trim();
  const desc = document.getElementById("edit-product-desc").value.trim();

  // ИСПРАВЛЕНО (ВАЛИДАЦИЯ): цена должна быть положительным числом
  const priceRaw = parseInt(document.getElementById("edit-product-price").value, 10);
  if (!Number.isFinite(priceRaw) || priceRaw <= 0 || priceRaw > 9999999) {
    showToast("Введите корректную цену (от 1 до 9 999 999 ₸)", "error");
    return;
  }
  const price = priceRaw;
  const image = safeImageSrc(document.getElementById("edit-product-image").value.trim());

  // Собираем размеры
  const bazaarStock = {};
  const mallStock = {};

  document.querySelectorAll(".size-field").forEach(input => {
    const point = input.getAttribute("data-point");
    const size = input.getAttribute("data-size");
    const val = Math.max(0, parseInt(input.value) || 0);

    if (point === "bazaar") {
      bazaarStock[size] = val;
    } else {
      mallStock[size] = val;
    }
  });

  const gender = getFormBtnGroupValue("edit-product-gender-group") || "мужской";
  const season = getFormBtnGroupValue("edit-product-season-group") || "весна";
  const categoryRaw = document.getElementById("edit-product-category").value;
  const category = categoryRaw.split(",")
    .map(c => c.trim().toLowerCase())
    .filter(Boolean)
    .join(",") || "кроссовки";

  if (id) {
    // Обновляем существующий
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = {
        ...products[index],
        article: safeText(article, 60).toUpperCase(),
        brand: safeText(brand, 80),
        name: safeText(name, 120),
        description: safeText(desc, 500),
        price,
        image,
        gender,
        season,
        category,
        stock: { bazaar: bazaarStock, mall: mallStock }
      };
      showToast("Товар успешно обновлен", "success");
    }
  } else {
    // Создаем новый
    const newId = (products.length > 0 ? Math.max(...products.map(p => parseInt(p.id) || 0)) + 1 : 1).toString();
    const newProduct = {
      id: newId,
      article: safeText(article, 60).toUpperCase(),
      brand: safeText(brand, 80),
      name: safeText(name, 120),
      description: safeText(desc, 500),
      price,
      image,
      gender,
      season,
      category,
      stock: { bazaar: bazaarStock, mall: mallStock }
    };
    products.push(newProduct);
    showToast("Новый товар добавлен в каталог", "success");
  }

  // Сохраняем в БД
  window.db.saveProducts(products);
  closeModal("modal-admin-product-edit");

  // Обновляем таблицы и дашборд
  renderAdminProductsTable();
  renderAdminDashboard();
  renderCatalog();
  renderCategoryTabs();
}

// Таблица заказов в админке
function renderAdminOrdersTable() {
  if (!requireAdminAccess()) return;
  const tbody = document.getElementById("admin-orders-list");
  tbody.innerHTML = "";

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 30px; color:var(--text-secondary);">Список заказов пуст</td>
      </tr>
    `;
    return;
  }

  orders.forEach(o => {
    let badgeClass = "badge-new";
    if (o.status === "Оплачен") badgeClass = "badge-paid";
    else if (o.status === "Подтвержден") badgeClass = "badge-confirmed";
    else if (o.status === "Выдан" || o.status === "Отменен") badgeClass = "badge-completed";

    const locText = o.location === "bazaar" ? "Базар (25б)" : "Гранд Парк (10б)";

    // ИСПРАВЛЕНО (XSS): полностью пересобрано на DOM-элементах
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.style.cssText = "font-weight:600; font-size:12px;";
    tdId.textContent = safeText(o.id, 30);
    tr.appendChild(tdId);

    const tdClient = document.createElement("td");
    const clientName = document.createElement("strong");
    clientName.textContent = safeText(o.userName, 80);
    const clientPhone = document.createElement("div");
    clientPhone.style.cssText = "font-size:12px; color:var(--text-secondary);";
    clientPhone.textContent = safeText(o.userPhone, 30);
    tdClient.appendChild(clientName);
    tdClient.appendChild(clientPhone);
    tr.appendChild(tdClient);

    const tdProduct = document.createElement("td");
    const prodArt = document.createElement("strong");
    prodArt.textContent = safeText(o.productArticle, 50);
    const prodName = document.createElement("div");
    prodName.style.cssText = "font-size:12px; color:var(--text-secondary);";
    prodName.textContent = `${safeText(o.productName, 80)} (р. ${safeText(o.size, 5)})`;
    tdProduct.appendChild(prodArt);
    tdProduct.appendChild(prodName);
    tr.appendChild(tdProduct);

    const tdLoc = document.createElement("td");
    tdLoc.textContent = locText;
    tr.appendChild(tdLoc);

    const tdType = document.createElement("td");
    const typeSpan = document.createElement("span");
    typeSpan.style.fontSize = "12px";
    typeSpan.textContent = safeText(o.type, 50);
    tdType.appendChild(typeSpan);
    // Показываем номер Kaspi клиента (если есть)
    if (o.kaspiPhone) {
      const kaspiSpan = document.createElement("div");
      kaspiSpan.style.cssText = "font-size:11px; color:var(--kaspi-red); margin-top:4px; font-weight:600;";
      kaspiSpan.textContent = "Kaspi: " + safeText(o.kaspiPhone, 20);
      tdType.appendChild(kaspiSpan);
    }
    tr.appendChild(tdType);

    const tdPrice = document.createElement("td");
    tdPrice.style.fontWeight = "700";
    tdPrice.textContent = `${Number(o.price || 0).toLocaleString()} ₸`;
    tr.appendChild(tdPrice);

    const tdStatus = document.createElement("td");
    const statusSpan = document.createElement("span");
    statusSpan.className = `order-status-badge ${badgeClass}`;
    statusSpan.textContent = getSafeOrderStatus(o.status);
    tdStatus.appendChild(statusSpan);
    tr.appendChild(tdStatus);

    const tdActions = document.createElement("td");
    const actionsDiv = document.createElement("div");
    actionsDiv.style.display = "flex";

    if (o.status === "Новый") {
      const confirmBtn = document.createElement("button");
      confirmBtn.className = "btn-secondary";
      confirmBtn.style.cssText = "padding:4px 8px; font-size:11px; margin-right:4px;";
      confirmBtn.textContent = "Подтвердить";
      confirmBtn.addEventListener("click", () => window.changeOrderStatus(o.id, "Подтвержден"));
      actionsDiv.appendChild(confirmBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn-secondary";
      cancelBtn.style.cssText = "padding:4px 8px; font-size:11px; border-color:var(--accent-red); color:var(--accent-red);";
      cancelBtn.textContent = "Отменить";
      cancelBtn.addEventListener("click", () => window.cancelOrderById(o.id));
      actionsDiv.appendChild(cancelBtn);
    } else if (o.status === "Оплачен") {
      const shipBtn = document.createElement("button");
      shipBtn.className = "btn-secondary";
      shipBtn.style.cssText = "padding:4px 8px; font-size:11px; margin-right:4px;";
      shipBtn.textContent = "В доставку";
      shipBtn.addEventListener("click", () => window.changeOrderStatus(o.id, "Подтвержден"));
      actionsDiv.appendChild(shipBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn-secondary";
      cancelBtn.style.cssText = "padding:4px 8px; font-size:11px; border-color:var(--accent-red); color:var(--accent-red);";
      cancelBtn.textContent = "Отменить";
      cancelBtn.addEventListener("click", () => window.cancelOrderById(o.id));
      actionsDiv.appendChild(cancelBtn);
    } else if (o.status === "Подтвержден") {
      const doneBtn = document.createElement("button");
      doneBtn.className = "btn-secondary";
      doneBtn.style.cssText = "padding:4px 8px; font-size:11px; border-color:var(--accent-green); color:var(--accent-green);";
      doneBtn.textContent = "Выдан клиенту";
      doneBtn.addEventListener("click", () => window.changeOrderStatus(o.id, "Выдан"));
      actionsDiv.appendChild(doneBtn);
    } else {
      const archSpan = document.createElement("span");
      archSpan.style.cssText = "color:var(--text-muted); font-size:12px;";
      archSpan.textContent = "Архив";
      actionsDiv.appendChild(archSpan);
    }

    tdActions.appendChild(actionsDiv);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

window.changeOrderStatus = function(orderId, newStatus) {
  if (!requireAdminAccess()) return;
  const status = getSafeOrderStatus(newStatus);
  const index = orders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    orders[index].status = status;
    window.db.saveOrders(orders);
    showToast(`Статус заказа ${safeText(orderId, 30)} обновлен на "${status}"`, "success");
    renderAdminOrdersTable();
    renderAdminDashboard();
  }
};

window.cancelOrderById = function(orderId) {
  if (!requireAdminAccess()) return;
  if (confirm(`Вы действительно хотите отменить заказ ${safeText(orderId, 30)}? Товар вернется на склад.`)) {
    const index = orders.findIndex(o => o.id === orderId);
    if (index !== -1) {
      const o = orders[index];

      // Возвращаем размер на склад
      const pIndex = products.findIndex(p => p.id === o.productId);
      if (pIndex !== -1) {
        if (!products[pIndex].stock[o.location]) {
          products[pIndex].stock[o.location] = {};
        }
        if (!products[pIndex].stock[o.location][o.size]) {
          products[pIndex].stock[o.location][o.size] = 0;
        }
        products[pIndex].stock[o.location][o.size]++;
        window.db.saveProducts(products);
      }

      orders[index].status = "Отменен";
      window.db.saveOrders(orders);
      showToast(`Заказ ${safeText(orderId, 30)} отменен. Товар возвращен на склад.`, "info");
      renderAdminOrdersTable();
      renderAdminDashboard();
      renderCatalog();
    }
  }
};

// ==================== РЕЗЕРВНОЕ КОПИРОВАНИЕ И ФАЙЛЫ ====================

function exportDatabaseToFile() {
  if (!requireAdminAccess()) return;
  const jsonStr = window.db.exportDatabase();
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `shoestore_db_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Файл базы данных успешно сохранен", "success");
}

// ИСПРАВЛЕНО (БЕЗОПАСНОСТЬ): валидация импортируемых данных
function importDatabaseFromFile(e) {
  if (!requireAdminAccess()) return;
  const file = e.target.files[0];
  if (!file) return;

  // Ограничение размера файла (5 МБ)
  if (file.size > 5 * 1024 * 1024) {
    showToast("Файл слишком большой. Максимум 5 МБ.", "error");
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const success = window.db.importDatabase(evt.target.result);
    if (success) {
      // Обновляем локальное состояние
      products = window.db.loadProducts();
      orders = window.db.loadOrders();
      currentUser = window.db.getCurrentUser();

      showToast("База данных успешно импортирована!", "success");

      // Перерисовываем
      renderAdminDashboard();
      renderAdminProductsTable();
      renderAdminOrdersTable();
      renderCatalog();
      renderCategoryTabs();
    } else {
      showToast("Ошибка при импорте. Проверьте валидность файла JSON.", "error");
    }
  };
  reader.readAsText(file);
  // Очищаем инпут
  e.target.value = "";
}

// Инициализация автокомплита для категорий в форме товара
function initCategoryAutocomplete() {
  const categoryInput = document.getElementById("edit-product-category");
  const dropdown = document.getElementById("category-autocomplete-dropdown");
  if (!categoryInput || !dropdown) return;

  const defaultCats = ["кроссовки", "туфли", "кроксы", "мокасины", "сапоги"];

  function getSuggestions(query) {
    // Собираем уникальные одиночные категории из текущей базы
    const dbCats = [];
    products.forEach(p => {
      if (p.category) {
        p.category.split(",").forEach(c => {
          const trimmed = c.trim().toLowerCase();
          if (trimmed && !dbCats.includes(trimmed)) {
            dbCats.push(trimmed);
          }
        });
      }
    });

    const allCats = Array.from(new Set([...defaultCats, ...dbCats]));

    if (!query) return allCats;
    return allCats.filter(cat => cat.toLowerCase().includes(query.toLowerCase()));
  }

  function renderDropdown(suggestions) {
    dropdown.innerHTML = "";
    if (suggestions.length === 0) {
      dropdown.classList.add("d-none");
      return;
    }

    suggestions.forEach(cat => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      item.addEventListener("click", () => {
        const currentVal = categoryInput.value;
        const lastComma = currentVal.lastIndexOf(",");
        const beforeLast = currentVal.substring(0, lastComma + 1);

        categoryInput.value = beforeLast + (beforeLast ? " " : "") + item.textContent + ", ";

        dropdown.classList.add("d-none");
        categoryInput.classList.add("flash-success");
        setTimeout(() => categoryInput.classList.remove("flash-success"), 600);
        categoryInput.focus();
      });
      dropdown.appendChild(item);
    });

    dropdown.classList.remove("d-none");
  }

  // При вводе
  categoryInput.addEventListener("input", (e) => {
    const val = e.target.value;
    const lastComma = val.lastIndexOf(",");
    const query = val.substring(lastComma + 1).trim();
    renderDropdown(getSuggestions(query));
  });

  // При фокусе
  categoryInput.addEventListener("focus", () => {
    const val = categoryInput.value;
    const lastComma = val.lastIndexOf(",");
    const query = val.substring(lastComma + 1).trim();
    renderDropdown(getSuggestions(query));
  });

  // Закрываем при клике вне поля
  document.addEventListener("click", (e) => {
    if (!categoryInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add("d-none");
    }
  });
}

// Инициализация автокомплита поиска товара по артикулу в форме продажи
function populateSaleProductsSelect() {
  if (!requireAdminAccess()) return;
  const searchInput = document.getElementById("sale-product-search");
  const hiddenInput = document.getElementById("sale-product-id");
  const dropdown = document.getElementById("sale-product-autocomplete-dropdown");
  if (!searchInput || !dropdown) return;

  function renderSuggestions(query) {
    dropdown.innerHTML = "";

    // Фильтруем товары по артикулу (или бренду/названию)
    const filtered = products.filter(p => {
      if (!query) return true; // если пусто, показываем все товары
      return p.article.toLowerCase().includes(query.toLowerCase()) ||
             p.brand.toLowerCase().includes(query.toLowerCase()) ||
             p.name.toLowerCase().includes(query.toLowerCase());
    });

    if (filtered.length === 0) {
      dropdown.classList.add("d-none");
      return;
    }

    filtered.forEach(p => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      const desc = p.description ? ` (${safeText(p.description, 35)}...)` : "";
      item.textContent = `${p.article} | ${p.brand} ${p.name}${desc} — ${Number(p.price || 0).toLocaleString()} ₸`;

      item.addEventListener("click", () => {
        searchInput.value = `${p.article} | ${p.brand} ${p.name}`;
        hiddenInput.value = p.id;
        dropdown.classList.add("d-none");
        searchInput.classList.add("flash-success");
        setTimeout(() => searchInput.classList.remove("flash-success"), 600);
        updateSaleSizesSelect();
      });
      dropdown.appendChild(item);
    });

    dropdown.classList.remove("d-none");
  }

  // При вводе артикула
  searchInput.addEventListener("input", (e) => {
    hiddenInput.value = "";
    updateSaleSizesSelect();
    renderSuggestions(e.target.value.trim());
  });

  // При фокусе
  searchInput.addEventListener("focus", () => {
    renderSuggestions(searchInput.value.trim());
  });

  // Закрываем автокомплит при клике мимо
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add("d-none");
    }
  });

  // Переключение точки продаж тоже влияет на остатки
  const bazaarBtn = document.querySelector("#sale-point-group button[data-value='bazaar']");
  const mallBtn = document.querySelector("#sale-point-group button[data-value='mall']");
  if (bazaarBtn) {
    bazaarBtn.addEventListener("click", () => {
      setTimeout(updateSaleSizesSelect, 50);
    });
  }
  if (mallBtn) {
    mallBtn.addEventListener("click", () => {
      setTimeout(updateSaleSizesSelect, 50);
    });
  }

  updateSaleSizesSelect();
}

// Заполнение списка размеров по выбранному товару и точке
function updateSaleSizesSelect() {
  const hiddenInput = document.getElementById("sale-product-id");
  const sizeSelect = document.getElementById("sale-size-select");
  if (!hiddenInput || !sizeSelect) return;

  sizeSelect.innerHTML = "";
  const productId = hiddenInput.value;
  if (!productId) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Сначала выберите модель обуви из списка";
    sizeSelect.appendChild(opt);
    return;
  }

  const p = products.find(item => item.id === productId);
  if (!p) return;

  const point = getFormBtnGroupValue("sale-point-group") || "bazaar";
  const stock = p.stock[point] || {};

  let hasStock = false;
  Object.entries(stock).forEach(([size, qty]) => {
    if (qty > 0) {
      hasStock = true;
      const opt = document.createElement("option");
      opt.value = size;
      opt.textContent = `${size} размер (осталось: ${qty} шт)`;
      sizeSelect.appendChild(opt);
    }
  });

  if (!hasStock) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Нет в наличии на этой точке";
    sizeSelect.appendChild(opt);
  }
}

// Отрисовка таблицы продаж (с фильтром по датам) и кассы за сегодня
function renderAdminSalesTable() {
  if (!requireAdminAccess()) return;
  const tbody = document.getElementById("offline-sales-list");
  if (!tbody) return;
  tbody.innerHTML = "";

  sales = window.db.loadSales();

  // Считаем кассу ЗА СЕГОДНЯ
  const todayStr = new Date().toDateString();
  let todayCount = 0;
  let todaySum = 0;
  let sumKaspi = 0;
  let sumRed = 0;
  let sumCash = 0;

  sales.forEach(s => {
    if (new Date(s.date).toDateString() === todayStr) {
      todayCount++;
      const sum = Number(s.price) || 0;
      todaySum += sum;
      if (s.payment === "kaspi") sumKaspi += sum;
      else if (s.payment === "red") sumRed += sum;
      else if (s.payment === "cash") sumCash += sum;
    }
  });

  // Читаем фильтры по датам для таблицы истории
  const startVal = document.getElementById("history-date-start") ? document.getElementById("history-date-start").value : "";
  const endVal = document.getElementById("history-date-end") ? document.getElementById("history-date-end").value : "";

  let filteredSalesForTable = [...sales];
  if (startVal) {
    const startDate = new Date(startVal);
    startDate.setHours(0, 0, 0, 0);
    filteredSalesForTable = filteredSalesForTable.filter(s => new Date(s.date) >= startDate);
  }
  if (endVal) {
    const endDate = new Date(endVal);
    endDate.setHours(23, 59, 59, 999);
    filteredSalesForTable = filteredSalesForTable.filter(s => new Date(s.date) <= endDate);
  }

  // Сортируем по дате (сначала новые)
  filteredSalesForTable.sort((a, b) => new Date(b.date) - new Date(a.date));

  filteredSalesForTable.forEach(s => {
    const sum = Number(s.price) || 0;
    const dateObj = new Date(s.date);
    const dateStr = dateObj.toLocaleDateString("ru-RU") + " " + dateObj.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });

    const pointLabel = s.point === "bazaar" ? "Базар" : "ТЦ";
    let payLabel = "Каспи QR";
    if (s.payment === "red") payLabel = "Каспи Ред";
    else if (s.payment === "cash") payLabel = "Наличные";

    // ИСПРАВЛЕНО (XSS): создаем DOM вместо innerHTML
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = dateStr;
    tr.appendChild(tdDate);

    const tdProduct = document.createElement("td");
    const artStrong = document.createElement("strong");
    artStrong.textContent = safeText(s.article, 50);
    const nameDiv = document.createElement("div");
    nameDiv.style.cssText = "font-size:12px; color:var(--text-muted);";
    nameDiv.textContent = `${safeText(s.brand, 50)} ${safeText(s.name, 80)}`;
    tdProduct.appendChild(artStrong);
    tdProduct.appendChild(nameDiv);
    tr.appendChild(tdProduct);

    const tdPoint = document.createElement("td");
    tdPoint.textContent = pointLabel;
    tr.appendChild(tdPoint);

    const tdSize = document.createElement("td");
    tdSize.style.fontWeight = "700";
    tdSize.textContent = safeText(s.size, 5);
    tr.appendChild(tdSize);

    const tdPay = document.createElement("td");
    tdPay.textContent = payLabel;
    tr.appendChild(tdPay);

    const tdSum = document.createElement("td");
    tdSum.style.fontWeight = "700";
    tdSum.textContent = `${sum.toLocaleString()} ₸`;
    tr.appendChild(tdSum);

    const tdCancel = document.createElement("td");
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-secondary";
    cancelBtn.style.cssText = "border-color:var(--accent-red); color:var(--accent-red); padding:4px 8px; font-size:11px;";
    cancelBtn.textContent = "Отменить";
    cancelBtn.addEventListener("click", () => window.deleteOfflineSaleById(s.id));
    tdCancel.appendChild(cancelBtn);
    tr.appendChild(tdCancel);

    tbody.appendChild(tr);
  });

  // Обновляем статистику кассы ЗА СЕГОДНЯ
  const elCount = document.getElementById("sales-count-total");
  const elSum = document.getElementById("sales-sum-total");
  const elKaspi = document.getElementById("sales-sum-kaspi");
  const elRed = document.getElementById("sales-sum-red");
  const elCash = document.getElementById("sales-sum-cash");
  if (elCount) elCount.textContent = `${todayCount} шт`;
  if (elSum) elSum.textContent = `${todaySum.toLocaleString()} ₸`;
  if (elKaspi) elKaspi.textContent = `${sumKaspi.toLocaleString()} ₸`;
  if (elRed) elRed.textContent = `${sumRed.toLocaleString()} ₸`;
  if (elCash) elCash.textContent = `${sumCash.toLocaleString()} ₸`;
}

// Запись оффлайн продажи
window.handleOfflineSaleSubmit = function() {
  if (!requireAdminAccess()) return;
  const productId = document.getElementById("sale-product-id").value;
  const size = document.getElementById("sale-size-select").value;
  const point = getFormBtnGroupValue("sale-point-group") || "bazaar";
  const payment = getFormBtnGroupValue("sale-payment-group") || "kaspi";

  if (!productId || !size) {
    showToast("Пожалуйста, выберите корректный товар по артикулу и выберите доступный размер", "error");
    return;
  }

  const product = products.find(p => p.id === productId);
  if (!product) return;

  // Уменьшаем количество
  if (product.stock[point] && product.stock[point][size] > 0) {
    product.stock[point][size]--;
  } else {
    showToast("Этого размера уже нет в наличии на выбранной точке!", "error");
    return;
  }

  // Добавляем запись о продаже
  const newSale = {
    id: Date.now().toString(),
    productId: product.id,
    article: product.article,
    brand: product.brand,
    name: product.name,
    price: product.price,
    point: point,
    size: size,
    payment: payment,
    date: new Date().toISOString()
  };

  sales.push(newSale);
  window.db.saveSales(sales);
  window.db.saveProducts(products);

  showToast("Продажа успешно записана, остаток списан со склада!", "success");

  // Сбрасываем форму, но сохраняем точку и оплату
  document.getElementById("sale-product-search").value = "";
  document.getElementById("sale-product-id").value = "";
  updateSaleSizesSelect();

  // Перерисовываем всё
  renderAdminSalesTable();
  renderAdminProductsTable();
  renderAdminDashboard();
  renderCatalog();
};

// Отмена продажи (возврат остатка)
window.deleteOfflineSaleById = function(saleId) {
  if (!requireAdminAccess()) return;
  if (!confirm("Вы действительно хотите отменить эту операцию продажи? Остаток вернется на склад.")) return;

  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;

  // Возвращаем остаток
  const product = products.find(p => p.id === sale.productId);
  if (product) {
    if (!product.stock[sale.point]) product.stock[sale.point] = {};
    if (!product.stock[sale.point][sale.size]) product.stock[sale.point][sale.size] = 0;
    product.stock[sale.point][sale.size]++;
  }

  // Удаляем из списка продаж
  sales = sales.filter(s => s.id !== saleId);
  window.db.saveSales(sales);
  window.db.saveProducts(products);

  showToast("Продажа отменена, остаток возвращен на склад", "info");

  // Перерисовываем всё
  renderAdminSalesTable();
  renderAdminProductsTable();
  renderAdminDashboard();
  renderCatalog();

  // Обновляем селекторы
  populateSaleProductsSelect();
};
