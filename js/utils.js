// MADIYAR SHOES — утилиты и вспомогательные функции (utils.js)

const FALLBACK_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80";
const MAX_IMAGE_FILE_SIZE = 1024 * 1024;
const MAX_DATA_IMAGE_LENGTH = MAX_IMAGE_FILE_SIZE * 1.4;

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

const AVAILABLE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

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

// Вспомогательная функция задержки вызова (Debounce) для оптимизации поиска
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

// Нормализация телефонного номера
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

// Валидация мобильных номеров РК (+7 7XX XXX XX XX)
function isValidKazakhstanPhone(phoneStr) {
  const norm = normalizePhone(phoneStr);
  return /^7(7[0-8]|74|70|77)\d{8}$/.test(norm);
}

// Валидация имени пользователя (только буквы, минимум 2 символа, без цифр)
function isValidName(nameStr) {
  if (!nameStr) return false;
  const clean = nameStr.trim();
  if (clean.length < 2 || clean.length > 50) return false;
  return /^[a-zA-Zа-яА-ЯёЁәғқңөұүһӘҒҚҢӨҰҮҺ\s'-]+$/u.test(clean);
}

// Сжатие и масштабирование загружаемых изображений через HTML5 Canvas
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
