// MADIYAR SHOES — утилиты и вспомогательные функции (utils.js)

const FALLBACK_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80";
const MAX_IMAGE_FILE_SIZE = 1024 * 1024;
const MAX_DATA_IMAGE_LENGTH = MAX_IMAGE_FILE_SIZE * 1.4;

// Модальные окна (Modal Controllers)
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal._lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => modal.querySelector(".modal-close, .modal-close-btn, [autofocus]")?.focus());
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("open");
  const anyOpen = document.querySelector(".modal-overlay.open");
  if (!anyOpen) {
    document.body.style.overflow = "";
    const opener = modal._lastFocusedElement;
    if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("open"));
  document.body.style.overflow = "";
}

// Безопасные обертки для работы с localStorage (SafeStorage)
function safeSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[Storage Error] Не удалось сохранить ${key}:`, e);
    if (typeof showToast === "function") {
      showToast("Ошибка: Хранилище браузера переполнено!", "error");
    }
    return false;
  }
}

function safeGetJSON(key, fallback = null) {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    return JSON.parse(data) ?? fallback;
  } catch (e) {
    console.warn(`[Storage Warning] Ошибка чтения ${key}:`, e);
    return fallback;
  }
}

// Единый модуль поиска товаров (DRY)
function normalizeSearchText(val) {
  return String(val ?? "").toLowerCase().trim();
}

function productMatchesQuery(product, query) {
  if (!product || typeof product !== "object") return false;
  const q = normalizeSearchText(query);
  if (!q) return true;
  const brand = normalizeSearchText(product.brand);
  const name = normalizeSearchText(product.name);
  return brand.includes(q) || name.includes(q);
}

const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const AVAILABLE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

// Полномочия сотрудников проверяет Supabase; браузер хранит только
// краткоживущий серверный токен и никогда не вычисляет роль самостоятельно.
function getStaffSessionToken() {
  return sessionStorage.getItem("shoe_store_staff_session_token") || "";
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
  if (/^(assets\/images\/|\/assets\/images\/)[a-z0-9._-]+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(src)) return src;
  try {
    const url = new URL(src, window.location.href);
    if (url.protocol === "https:") {
      return url.href;
    }
  } catch (e) {}
  return FALLBACK_PRODUCT_IMAGE;
}

function getSafeOrderStatus(status) {
  return ["Новый", "Оплачен", "Подтвержден", "Выдан", "Отменен", "new", "contacted", "paid", "completed", "cancelled"].includes(status) ? status : "Новый";
}

function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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

function normalizePhone(phoneStr) {
  if (!phoneStr) return "";
  let digits = phoneStr.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.substring(1);
  }
  if (digits.length === 10) {
    digits = "7" + digits;
  }
  return digits;
}

function formatPhoneDisplay(phoneStr) {
  const norm = normalizePhone(phoneStr);
  if (norm.length === 11) {
    return `+7 (${norm.slice(1, 4)}) ${norm.slice(4, 7)}-${norm.slice(7, 9)}-${norm.slice(9, 11)}`;
  }
  return phoneStr || "";
}

function isValidKazakhstanPhone(phoneStr) {
  const norm = normalizePhone(phoneStr);
  return /^7(7[0-8]|74|70|77)\d{8}$/.test(norm);
}

function formatFullName(str) {
  if (!str) return "";
  const parts = str.trim().split(/\s+/);
  return parts.map(part => {
    if (!part) return "";
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(" ");
}

function isValidFullName(nameStr) {
  if (!nameStr) return false;
  const clean = nameStr.trim();
  const parts = clean.split(/\s+/);
  if (parts.length < 2) return false;
  const nameRegex = /^[a-zA-Zа-яА-ЯёЁәғқңөұүһӘҒҚҢӨҰҮҺ'-]{2,30}$/u;
  return parts.every(part => nameRegex.test(part));
}

function isValidPassword(pwd) {
  if (!pwd || pwd.length < 6) return false;
  const hasLetter = /[a-zA-Zа-яА-ЯёЁәғқңөұүһӘҒҚҢӨҰҮҺ]/u.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  return hasLetter && hasDigit;
}

function scrollToSection(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

// Кнопки-переключатели групп (Radio-like button groups)
function initFormBtnGroups() {
  document.querySelectorAll(".form-btn-group").forEach(group => {
    group.querySelectorAll(".form-group-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        group.querySelectorAll(".form-group-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  });
}

function setFormBtnGroupValue(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll(".form-group-btn").forEach(btn => {
    if (btn.getAttribute("data-value") === value) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function getFormBtnGroupValue(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return null;
  const activeBtn = group.querySelector(".form-group-btn.active");
  return activeBtn ? activeBtn.getAttribute("data-value") : null;
}

// Уведомления (Toasts)
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "";
  if (type === "success") icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  else if (type === "error") icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  else icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

  toast.innerHTML = `${icon} <span></span>`;
  toast.querySelector("span").textContent = String(message ?? "");
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Склонение числительного для грамматической корректности ("1 модель", "2 модели", "5 моделей")
function getModelsPluralWord(count) {
  const abs = Math.abs(Number(count) || 0) % 100;
  const num = abs % 10;
  if (abs > 10 && abs < 20) return "моделей";
  if (num > 1 && num < 5) return "модели";
  if (num === 1) return "модель";
  return "моделей";
}

function formatCatalogCount(count) {
  return `Найдено: ${count} ${getModelsPluralWord(count)}`;
}

// Избранные товары (Favorites Storage)
const DB_FAVORITES_KEY = "shoe_store_favorites";

function loadFavorites() {
  return safeGetJSON(DB_FAVORITES_KEY, []);
}

function saveFavorites(favIds) {
  safeSetJSON(DB_FAVORITES_KEY, favIds);
  updateFavoritesBadges();
}

function isFavorite(productId) {
  const favs = loadFavorites();
  return favs.includes(productId);
}

function toggleFavorite(productId) {
  let favs = loadFavorites();
  let added = false;
  if (favs.includes(productId)) {
    favs = favs.filter(id => id !== productId);
  } else {
    favs.push(productId);
    added = true;
  }
  saveFavorites(favs);
  return added;
}

function updateFavoritesBadges() {
  const favs = loadFavorites();
  const badge = document.getElementById("fav-badge");
  if (badge) {
    badge.textContent = favs.length;
    if (favs.length > 0) {
      badge.classList.remove("d-none");
    } else {
      badge.classList.add("d-none");
    }
  }
}
