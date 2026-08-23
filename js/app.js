// MADIYAR SHOES — точка входа, управление состоянием и Supabase Realtime (app.js)

let products = [];
let orders = [];
let sales = [];
let currentUser = null;
let currentSelectedProduct = null;
let currentSelectedSize = null;
let currentSelectedLocation = null;
let pendingAction = null;
let isOrderProcessing = false;
let catalogCurrentPage = 1;
const catalogItemsPerPage = 16;

let productMap = new Map();

function updateProductMap() {
  productMap = new Map((products || []).map(p => [p.id, p]));
}

function getProductById(id) {
  if (productMap.size === 0 && products.length > 0) {
    updateProductMap();
  }
  return productMap.get(id) || products.find(p => p.id === id);
}

// Создание канала межвкладочной синхронизации Shared State
const stateChannel = new BroadcastChannel("madiyar_shoes_state_channel");

stateChannel.onmessage = (event) => {
  if (event.data && (event.data.type === "STOCK_UPDATED" || event.data.type === "DATA_MUTATED")) {
    console.log("[SharedState] Получен сигнал об изменении данных из другой вкладки:", event.data);
    syncSharedStateFromStore();
  }
};

window.notifyStateChanged = function(actionType = "DATA_MUTATED", payload = {}) {
  syncSharedStateFromStore();
  try {
    stateChannel.postMessage({ type: actionType, payload, timestamp: Date.now() });
  } catch (e) {
    console.warn("BroadcastChannel error:", e);
  }
  window.dispatchEvent(new CustomEvent("madiyar:state-changed", { detail: { actionType, payload } }));
};

function syncSharedStateFromStore() {
  products = window.db.loadProducts();
  updateProductMap();
  orders = window.db.loadOrders();
  sales = window.db.loadSales();

  if (document.body.classList.contains("is-admin-portal")) {
    if (typeof renderAdminDashboard === "function") renderAdminDashboard();
    if (typeof renderAdminProductsTable === "function") renderAdminProductsTable();
    if (typeof renderAdminOrdersTable === "function") renderAdminOrdersTable();
    if (typeof renderAdminSalesTable === "function") renderAdminSalesTable();
  } else {
    if (typeof renderCatalog === "function") renderCatalog();
  }
}

// Слушатель локального хранилища (для вкладок без поддержки BroadcastChannel)
window.addEventListener("storage", (e) => {
  if (e.key && e.key.startsWith("shoe_store_")) {
    syncSharedStateFromStore();
  }
});

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", async () => {
  products = window.db.loadProducts();
  updateProductMap();
  orders = window.db.loadOrders();
  sales = window.db.loadSales();
  currentUser = window.db.getCurrentUser();

  initTheme();
  initFilters();
  initFormBtnGroups();
  initCategoryAutocomplete();
  initClientAuthListeners();
  updateFavoritesBadges();

  handleRouteInit();
  setupEventListeners();

  window.addEventListener("hashchange", handleRouteInit);
  window.addEventListener("popstate", handleRouteInit);

  // Фоновая загрузка актуальных данных из Supabase
  initSupabaseDataSync();

  // Подписка на Supabase Realtime изменение остатков product_stock
  initRealtimeSubscriptions();
});

// Панель сотрудников открывается только со служебной страницы staff.html.
function handleRouteInit() {
  const hash = window.location.hash;
  const isAdminRoute = hash === "#staff";

  if (isAdminRoute) {
    document.body.classList.add("is-admin-portal");
    if (typeof switchToAdminView === "function") {
      switchToAdminView();
    }
  } else {
    document.body.classList.remove("is-admin-portal");
    if (typeof switchToClientView === "function") {
      switchToClientView();
    }
  }
}

async function initSupabaseDataSync() {
  const fetchedProducts = await window.db.fetchProductsFromSupabase();
  if (fetchedProducts && Array.isArray(fetchedProducts) && fetchedProducts.length >= 16) {
    products = fetchedProducts;
    updateProductMap();
    renderCatalog();
  }

  const fetchedOrders = await window.db.fetchOrdersFromSupabase();
  if (fetchedOrders) {
    orders = fetchedOrders;
  }

  const fetchedSales = await window.db.fetchSalesFromSupabase();
  if (fetchedSales) {
    sales = fetchedSales;
  }
}

let realtimeChannel = null;

// Supabase Realtime: Точечное (гранулярное) обновление размеров в режиме реального времени
function initRealtimeSubscriptions() {
  if (realtimeChannel) return;
  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (!supabase) return;

  try {
    realtimeChannel = supabase
      .channel('public:product_stock_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_stock' }, payload => {
        const record = payload.new || payload.old;
        if (!record || !record.product_id) return;

        const productId = record.product_id;
        const location = record.location;
        const size = record.size;
        const quantity = record.quantity !== undefined ? record.quantity : 0;

        console.log(`[Realtime Update] Товар: ${productId}, Точка: ${location}, Размер: ${size}, Остаток: ${quantity}`);

        // Гранулярное обновление карточки и модального окна без перезагрузки всей страницы
        if (typeof window.updateProductCardStockGranular === "function") {
          window.updateProductCardStockGranular(productId, location, size, quantity);
        }
        if (typeof window.updateProductModalStockGranular === "function") {
          window.updateProductModalStockGranular(productId, location, size, quantity);
        }
      })
      .subscribe();
  } catch (err) {
    console.warn("Realtime subscription initialization error:", err);
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("shoe_store_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const iconBtn = document.getElementById("btn-theme-toggle");
  if (!iconBtn) return;
  if (theme === "light") {
    iconBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
  } else {
    iconBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  }
}

function setupEventListeners() {
  const debouncedRenderCatalog = debounce(() => renderCatalog(true), 150);
  const debouncedRenderAdminProducts = debounce(() => renderAdminProductsTable(), 150);

  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.addEventListener("input", debouncedRenderCatalog);

  const locFilter = document.getElementById("filter-location");
  if (locFilter) locFilter.addEventListener("change", () => renderCatalog(true));

  const sizeFilter = document.getElementById("filter-size");
  if (sizeFilter) sizeFilter.addEventListener("change", () => renderCatalog(true));

  const statusFilter = document.getElementById("filter-status");
  if (statusFilter) statusFilter.addEventListener("change", () => renderCatalog(true));

  // Мобильная шторка фильтров
  const btnToggleFilters = document.getElementById("btn-toggle-filters");
  const filtersGridContainer = document.getElementById("filters-grid-container");
  const filterSheet = document.getElementById("catalog-filter-sheet");
  const mobileFilterOptions = document.getElementById("mobile-filter-options");
  const closeFilterSheet = () => {
    filterSheet?.classList.remove("open");
    btnToggleFilters?.setAttribute("aria-expanded", "false");
    btnToggleFilters?.classList.remove("is-active");
    document.body.classList.remove("catalog-filters-open");
  };
  const openFilterSheet = (sectionId) => {
    if (!filterSheet) return;
    filterSheet.classList.add("open");
    filtersGridContainer?.classList.add("open");
    mobileFilterOptions?.classList.add("open");
    btnToggleFilters?.setAttribute("aria-expanded", "true");
    btnToggleFilters?.classList.add("is-active");
    document.body.classList.add("catalog-filters-open");
    if (sectionId) {
      requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ block: "start" }));
    }
  };

  if (btnToggleFilters) btnToggleFilters.addEventListener("click", () => openFilterSheet());
  document.getElementById("btn-close-catalog-filters")?.addEventListener("click", closeFilterSheet);
  document.getElementById("btn-apply-catalog-filters")?.addEventListener("click", closeFilterSheet);
  document.getElementById("mobile-reset-filters")?.addEventListener("click", () => {
    resetAllFilters();
    openFilterSheet();
  });
  document.getElementById("mobile-size-trigger")?.addEventListener("click", () => openFilterSheet("filter-section-size"));
  document.getElementById("mobile-category-trigger")?.addEventListener("click", () => openFilterSheet("filter-section-category"));
  document.getElementById("mobile-sort-trigger")?.addEventListener("click", () => {
    const sort = document.getElementById("catalog-sort-select");
    if (!sort) return;
    try {
      if (typeof sort.showPicker === "function") sort.showPicker();
      else sort.click();
    } catch (_error) {
      sort.focus();
    }
  });

  const adminSearch = document.getElementById("admin-product-search");
  if (adminSearch) adminSearch.addEventListener("input", debouncedRenderAdminProducts);

  const btnLogo = document.getElementById("btn-logo");
  if (btnLogo) btnLogo.addEventListener("click", () => showClientPage("page-catalog"));

  const navCatalog = document.getElementById("nav-catalog");
  if (navCatalog) navCatalog.addEventListener("click", () => showClientPage("page-catalog"));

  const navAbout = document.getElementById("nav-about");
  if (navAbout) navAbout.addEventListener("click", () => showClientPage("page-about"));

  const navAdmin = document.getElementById("nav-admin");
  if (navAdmin) navAdmin.addEventListener("click", checkAdminAccess);

  const btnMobileMenu = document.getElementById("btn-mobile-menu");
  const navMenu = document.getElementById("nav-menu");
  if (btnMobileMenu && navMenu) {
    btnMobileMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      navMenu.classList.toggle("active");
      btnMobileMenu.classList.toggle("active");
    });
    document.addEventListener("click", (e) => {
      if (!navMenu.contains(e.target) && !btnMobileMenu.contains(e.target)) {
        navMenu.classList.remove("active");
        btnMobileMenu.classList.remove("active");
      }
    });
  }

  const btnProfile = document.getElementById("btn-profile");
  if (btnProfile) btnProfile.addEventListener("click", openProfileModal);

  const btnFavorites = document.getElementById("btn-favorites");
  if (btnFavorites) btnFavorites.addEventListener("click", openFavoritesModal);

  const btnContactQuick = document.getElementById("btn-contact-quick");
  if (btnContactQuick) btnContactQuick.addEventListener("click", () => openModal("modal-quick-contact"));

  const btnResetFilters = document.getElementById("btn-reset-filters");
  if (btnResetFilters) btnResetFilters.addEventListener("click", resetAllFilters);

  const bnavCatalog = document.getElementById("bnav-catalog");
  if (bnavCatalog) bnavCatalog.addEventListener("click", () => showClientPage("page-catalog"));

  const bnavAbout = document.getElementById("bnav-about");
  if (bnavAbout) bnavAbout.addEventListener("click", () => showClientPage("page-about"));

  const bnavProfile = document.getElementById("bnav-profile");
  if (bnavProfile) bnavProfile.addEventListener("click", openProfileModal);

  const bnavTheme = document.getElementById("bnav-theme");
  if (bnavTheme) bnavTheme.addEventListener("click", toggleTheme);

  const btnThemeToggle = document.getElementById("btn-theme-toggle");
  if (btnThemeToggle) btnThemeToggle.addEventListener("click", toggleTheme);

  const btnAdminThemeToggle = document.getElementById("btn-admin-theme-toggle");
  if (btnAdminThemeToggle) btnAdminThemeToggle.addEventListener("click", toggleTheme);

  const authForm = document.getElementById("auth-form");
  if (authForm) authForm.addEventListener("submit", handleClientAuthSubmit);

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", handleClientLogout);

  // Исправлено: ID формы авторизации сотрудника в index.html — admin-login-form
  const adminLoginForm = document.getElementById("admin-login-form") || document.getElementById("admin-auth-form");
  if (adminLoginForm) adminLoginForm.addEventListener("submit", handleAdminLoginSubmit);

  const btnBookAction = document.getElementById("btn-book-action");
  if (btnBookAction) btnBookAction.addEventListener("click", () => handleBookingFlow("reserve"));

  const btnBuyAction = document.getElementById("btn-buy-action");
  if (btnBuyAction) btnBuyAction.addEventListener("click", () => handleBookingFlow("kaspi"));

  const btnShareProduct = document.getElementById("btn-share-product");
  if (btnShareProduct) {
    btnShareProduct.addEventListener("click", async () => {
      const shareData = {
        title: currentSelectedProduct?.name || "MADIYAR",
        text: currentSelectedProduct ? `${currentSelectedProduct.brand} — ${currentSelectedProduct.name}` : "MADIYAR",
        url: window.location.href
      };
      try {
        if (navigator.share) await navigator.share(shareData);
        else {
          await navigator.clipboard.writeText(shareData.url);
          showToast("Ссылка на товар скопирована");
        }
      } catch (error) {
        if (error?.name !== "AbortError") showToast("Не удалось поделиться ссылкой", "error");
      }
    });
  }

  // Подтверждение оплаты Kaspi
  const btnKaspiConfirm = document.getElementById("btn-kaspi-confirm");
  if (btnKaspiConfirm) {
    btnKaspiConfirm.addEventListener("click", (e) => {
      e.preventDefault();
      processKaspiPaymentConfirm();
    });
  }

  // Форма записи оффлайн-продаж
  const offlineSaleForm = document.getElementById("offline-sale-form");
  if (offlineSaleForm) {
    offlineSaleForm.addEventListener("submit", (e) => {
      e.preventDefault();
      window.handleOfflineSaleSubmit();
    });
  }

  const btnAddProduct = document.getElementById("btn-add-product");
  if (btnAddProduct) btnAddProduct.addEventListener("click", () => openProductEditModal(null));

  const btnAddProductModal = document.getElementById("btn-add-product-modal");
  if (btnAddProductModal) btnAddProductModal.addEventListener("click", () => openProductEditModal(null));

  const productEditForm = document.getElementById("product-edit-form");
  if (productEditForm) productEditForm.addEventListener("submit", handleProductSaveSubmit);

  const btnCancelEdit = document.getElementById("btn-cancel-edit");
  if (btnCancelEdit) btnCancelEdit.addEventListener("click", () => closeModal("modal-admin-product-edit"));

  // Управление продавцами
  const tabStaff = document.getElementById("tab-staff");
  if (tabStaff) tabStaff.addEventListener("click", () => switchAdminTab("staff"));

  const btnAddStaff = document.getElementById("btn-add-staff-modal");
  if (btnAddStaff) btnAddStaff.addEventListener("click", () => openStaffModal(null));

  const staffForm = document.getElementById("staff-edit-form");
  if (staffForm) staffForm.addEventListener("submit", handleStaffSaveSubmit);

  const btnCancelStaff = document.getElementById("btn-cancel-staff");
  if (btnCancelStaff) btnCancelStaff.addEventListener("click", () => closeModal("modal-admin-staff-edit"));

  // Закрытие модальных окон
  const leaveStaffSignIn = () => {
    closeModal("modal-admin-auth");
    if (window.location.hash === "#staff") {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    switchToClientView();
  };

  document.querySelectorAll(".modal-overlay:not(#modal-product-details)").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        if (overlay.id === "modal-admin-auth" && !isAdminLoggedIn()) leaveStaffSignIn();
        else closeModal(overlay.id);
      }
    });
  });

  // На телефоне окно можно закрыть естественным свайпом вниз за свободную область.
  document.querySelectorAll(".modal-overlay:not(#modal-product-details)").forEach(overlay => {
    const sheet = overlay.querySelector(".modal-container, .modal-content");
    if (!sheet) return;
    let startY = null;
    let offset = 0;

    sheet.addEventListener("touchstart", (event) => {
      if (!overlay.classList.contains("open")) return;
      if (event.target.closest("button, a, input, textarea, select, label")) return;
      if (event.touches[0].clientY - sheet.getBoundingClientRect().top > 76) return;
      startY = event.touches[0].clientY;
      offset = 0;
      sheet.classList.add("is-swiping");
    }, { passive: true });

    sheet.addEventListener("touchmove", (event) => {
      if (startY === null) return;
      offset = Math.max(0, event.touches[0].clientY - startY);
      if (!offset) return;
      sheet.style.transform = `translateY(${Math.min(offset, 180)}px)`;
      overlay.style.opacity = String(Math.max(0.45, 1 - offset / 420));
    }, { passive: true });

    sheet.addEventListener("touchend", () => {
      if (startY === null) return;
      sheet.classList.remove("is-swiping");
      sheet.style.transform = "";
      overlay.style.opacity = "";
      if (offset > 90) closeModal(overlay.id);
      startY = null;
      offset = 0;
    });
  });

  document.querySelectorAll(".modal-close, .modal-close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-overlay");
      if (!modal) return;
      if (modal.id === "modal-admin-auth" && !isAdminLoggedIn()) leaveStaffSignIn();
      else closeModal(modal.id);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modal = document.querySelector(".modal-overlay.open");
    if (!modal) return;
    if (modal.id === "modal-admin-auth" && !isAdminLoggedIn()) leaveStaffSignIn();
    else closeModal(modal.id);
  });

  // Вкладки в админке
  const tabProd = document.getElementById("tab-products");
  if (tabProd) tabProd.addEventListener("click", () => switchAdminTab("products"));

  const tabOrd = document.getElementById("tab-orders");
  if (tabOrd) tabOrd.addEventListener("click", () => switchAdminTab("orders"));

  const tabSal = document.getElementById("tab-sales");
  if (tabSal) tabSal.addEventListener("click", () => switchAdminTab("sales"));

  const tabBack = document.getElementById("tab-backup");
  if (tabBack) tabBack.addEventListener("click", () => switchAdminTab("backup"));

  const btnClientView = document.getElementById("btn-switch-client-view");
  if (btnClientView) btnClientView.addEventListener("click", switchToClientView);

  // Кнопки выхода и бэкапа в верхушке админки
  const btnExitAdmin = document.getElementById("btn-exit-admin");
  if (btnExitAdmin) {
    btnExitAdmin.addEventListener("click", () => {
      purgeAdminSession();
      switchToClientView();
      showToast("Вы вышли из панели управления", "info");
    });
  }

  const btnExportBackupHeader = document.getElementById("btn-export-backup");
  if (btnExportBackupHeader) btnExportBackupHeader.addEventListener("click", exportDatabaseToFile);

  const btnImportBackupHeader = document.getElementById("btn-import-backup");
  if (btnImportBackupHeader) {
    btnImportBackupHeader.addEventListener("click", () => {
      switchAdminTab("backup");
      triggerImportFileSelect();
    });
  }

  // Бэкап вкладка
  const btnExport = document.getElementById("btn-export-db");
  if (btnExport) btnExport.addEventListener("click", exportDatabaseToFile);

  const btnTriggerImport = document.getElementById("btn-trigger-import");
  const fileInputImport = document.getElementById("import-file-input") || document.getElementById("input-import-db");

  function triggerImportFileSelect() {
    if (fileInputImport) fileInputImport.click();
  }

  if (btnTriggerImport) btnTriggerImport.addEventListener("click", triggerImportFileSelect);
  if (fileInputImport) fileInputImport.addEventListener("change", importDatabaseFromFile);

  const btnReset = document.getElementById("btn-reset-db");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (confirm("Вы действительно хотите сбросить базу данных до демо-состояния?")) {
        products = window.db.resetDatabase();
        updateProductMap();
        orders = [];
        sales = [];
        showToast("База данных сброшена до начального демо-состояния", "info");
        renderAdminDashboard();
        renderAdminProductsTable();
        renderAdminOrdersTable();
        renderAdminSalesTable();
        renderAdminStaffTable();
        renderCatalog();
      }
    });
  }

  // Фильтры истории продаж по датам
  const historyStart = document.getElementById("history-date-start");
  const historyEnd = document.getElementById("history-date-end");
  const btnClearDates = document.getElementById("btn-clear-history-dates");

  if (historyStart) historyStart.addEventListener("change", () => renderAdminSalesTable());
  if (historyEnd) historyEnd.addEventListener("change", () => renderAdminSalesTable());

  if (btnClearDates) {
    btnClearDates.addEventListener("click", () => {
      if (historyStart) historyStart.value = "";
      if (historyEnd) historyEnd.value = "";
      renderAdminSalesTable();
    });
  }

  // Интерактивная карта на странице "О нас"
  initAboutPageMap();
}

// Карта Leaflet на странице "О нас"
function initAboutPageMap() {
  const btnBazaar = document.getElementById("btn-map-bazaar");
  const btnMall = document.getElementById("btn-map-mall");
  const infoBazaar = document.getElementById("info-map-bazaar");
  const infoMall = document.getElementById("info-map-mall");
  const btnShowMap = document.getElementById("btn-show-map-action");
  const mapIframe = document.getElementById("map-iframe");
  const mapPlaceholder = document.getElementById("map-placeholder-text");

  let activeStore = "bazaar";

  const storeCoords = {
    bazaar: { lat: 40.774518, lon: 68.322906, title: "Базар «Кулпаршын» (25 бутик)" },
    mall: { lat: 40.766811, lon: 68.315188, title: "Гранд Парк (1 блок, 10 бутик)" }
  };

  function updateMapIframeSrc() {
    if (!mapIframe || mapIframe.style.display === "none") return;
    const store = storeCoords[activeStore];
    mapIframe.src = `map.html?lat=${store.lat}&lon=${store.lon}&title=${encodeURIComponent(store.title)}`;
  }

  if (btnBazaar) {
    btnBazaar.addEventListener("click", () => {
      activeStore = "bazaar";
      btnBazaar.classList.add("active");
      if (btnMall) btnMall.classList.remove("active");
      if (infoBazaar) infoBazaar.classList.remove("d-none");
      if (infoMall) infoMall.classList.add("d-none");
      updateMapIframeSrc();
    });
  }

  if (btnMall) {
    btnMall.addEventListener("click", () => {
      activeStore = "mall";
      btnMall.classList.add("active");
      if (btnBazaar) btnBazaar.classList.remove("active");
      if (infoMall) infoMall.classList.remove("d-none");
      if (infoBazaar) infoBazaar.classList.add("d-none");
      updateMapIframeSrc();
    });
  }

  if (btnShowMap) {
    btnShowMap.addEventListener("click", () => {
      if (mapPlaceholder) mapPlaceholder.style.display = "none";
      if (mapIframe) {
        mapIframe.style.display = "block";
        updateMapIframeSrc();
      }
    });
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("shoe_store_theme", next);
  updateThemeIcon(next);
}
