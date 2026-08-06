// MADIYAR SHOES — точка входа и управление состоянием (app.js)

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

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
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

  showClientPage("page-catalog");
  setupEventListeners();

  if (window.location.hash === "#admin") {
    checkAdminAccess();
  }
});

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

  const sortFilter = document.getElementById("filter-sort");
  if (sortFilter) sortFilter.addEventListener("change", () => renderCatalog(true));

  const statusFilter = document.getElementById("filter-status");
  if (statusFilter) statusFilter.addEventListener("change", () => renderCatalog(true));

  const adminSearch = document.getElementById("admin-product-search");
  if (adminSearch) adminSearch.addEventListener("input", debouncedRenderAdminProducts);

  const btnLogo = document.getElementById("btn-logo");
  if (btnLogo) btnLogo.addEventListener("click", () => showClientPage("page-catalog"));

  const navCatalog = document.getElementById("nav-catalog");
  if (navCatalog) navCatalog.addEventListener("click", () => showClientPage("page-catalog"));

  const navAbout = document.getElementById("nav-about");
  if (navAbout) navAbout.addEventListener("click", () => showClientPage("page-about"));

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

  const navProfile = document.getElementById("nav-profile");
  if (navProfile) navProfile.addEventListener("click", openProfileModal);

  const btnThemeToggle = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("shoe_store_theme", newTheme);
    updateThemeIcon(newTheme);
    showToast("Тема успешно изменена", "info");
  };

  const btnTheme = document.getElementById("btn-theme-toggle");
  if (btnTheme) btnTheme.addEventListener("click", btnThemeToggle);

  // Мобильная нижняя навигация (Bottom Nav)
  const bnavCatalog = document.getElementById("bnav-catalog");
  if (bnavCatalog) {
    bnavCatalog.addEventListener("click", () => {
      showClientPage("page-catalog");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const bnavAbout = document.getElementById("bnav-about");
  if (bnavAbout) {
    bnavAbout.addEventListener("click", () => {
      showClientPage("page-about");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const bnavProfile = document.getElementById("bnav-profile");
  if (bnavProfile) {
    bnavProfile.addEventListener("click", openProfileModal);
  }

  const bnavTheme = document.getElementById("bnav-theme");
  if (bnavTheme) {
    bnavTheme.addEventListener("click", btnThemeToggle);
  }

  // Кнопка сворачивания фильтров на мобильных
  const btnToggleFilters = document.getElementById("btn-toggle-filters");
  const filtersGridContainer = document.getElementById("filters-grid-container");
  if (btnToggleFilters && filtersGridContainer) {
    btnToggleFilters.addEventListener("click", () => {
      const isOpen = filtersGridContainer.classList.toggle("is-open");
      btnToggleFilters.classList.toggle("is-active", isOpen);
      btnToggleFilters.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // Обновление бейджа фильтров при изменении селекторов
  const filterInputs = ["filter-location", "filter-size", "filter-sort", "filter-status"];
  filterInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", updateActiveFiltersBadge);
    }
  });

  const btnExport = document.getElementById("btn-export-backup");
  if (btnExport) btnExport.addEventListener("click", exportDatabaseToFile);

  const btnImport = document.getElementById("btn-import-backup");
  if (btnImport) {
    btnImport.addEventListener("click", () => {
      if (!requireAdminAccess()) return;
      const fileInput = document.getElementById("import-file-input");
      if (fileInput) fileInput.click();
    });
  }

  // Интерактивная карта и переключение точек на странице «О нас»
  const mapIframe = document.getElementById("map-iframe");
  const mapPlaceholder = document.getElementById("map-placeholder-text");
  const btnMapBazaar = document.getElementById("btn-map-bazaar");
  const btnMapMall = document.getElementById("btn-map-mall");
  const infoMapBazaar = document.getElementById("info-map-bazaar");
  const infoMapMall = document.getElementById("info-map-mall");
  const btnShowMap = document.getElementById("btn-show-map-action");

  let currentMapPoint = "bazaar";

  function getMapUrl(point) {
    if (point === "mall") {
      return "map.html?lat=40.766395&lon=68.312624&title=" + encodeURIComponent("Гранд Парк (1 блок, 10 бутик)");
    }
    return "map.html?lat=40.774518&lon=68.322906&title=" + encodeURIComponent("Базар Кулпаршын (25 бутик)");
  }

  function displayMap() {
    if (mapIframe) {
      mapIframe.src = getMapUrl(currentMapPoint);
      mapIframe.style.display = "block";
    }
    if (mapPlaceholder) {
      mapPlaceholder.style.display = "none";
    }
  }

  if (btnMapBazaar) {
    btnMapBazaar.addEventListener("click", () => {
      btnMapBazaar.classList.add("active");
      if (btnMapMall) btnMapMall.classList.remove("active");
      if (infoMapBazaar) infoMapBazaar.classList.remove("d-none");
      if (infoMapMall) infoMapMall.classList.add("d-none");

      currentMapPoint = "bazaar";
      if (mapIframe && mapIframe.style.display === "block") {
        mapIframe.src = getMapUrl("bazaar");
      }
    });
  }

  if (btnMapMall) {
    btnMapMall.addEventListener("click", () => {
      btnMapMall.classList.add("active");
      if (btnMapBazaar) btnMapBazaar.classList.remove("active");
      if (infoMapMall) infoMapMall.classList.remove("d-none");
      if (infoMapBazaar) infoMapBazaar.classList.add("d-none");

      currentMapPoint = "mall";
      if (mapIframe && mapIframe.style.display === "block") {
        mapIframe.src = getMapUrl("mall");
      }
    });
  }

  if (btnShowMap) {
    btnShowMap.addEventListener("click", displayMap);
  }

  const btnExitAdmin = document.getElementById("btn-exit-admin");
  if (btnExitAdmin) {
    btnExitAdmin.addEventListener("click", () => {
      purgeAdminSession();
      switchToClientView();
      showClientPage("page-catalog");
    });
  }

  const secretKey = document.getElementById("secret-admin-key");
  if (secretKey) secretKey.addEventListener("click", checkAdminAccess);

  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#admin") {
      checkAdminAccess();
    }
  });

  const authForm = document.getElementById("auth-form");
  if (authForm) authForm.addEventListener("submit", handleClientAuthSubmit);

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", handleClientLogout);

  const adminLoginForm = document.getElementById("admin-login-form");
  if (adminLoginForm) adminLoginForm.addEventListener("submit", handleAdminLoginSubmit);

  const btnBookAction = document.getElementById("btn-book-action");
  if (btnBookAction) btnBookAction.addEventListener("click", () => handleBookingFlow("reserve"));

  const btnBuyAction = document.getElementById("btn-buy-action");
  if (btnBuyAction) btnBuyAction.addEventListener("click", () => handleBookingFlow("kaspi"));

  const btnKaspiConfirm = document.getElementById("btn-kaspi-confirm");
  if (btnKaspiConfirm) btnKaspiConfirm.addEventListener("click", processKaspiPaymentConfirm);

  document.querySelectorAll(".modal-close, .modal-overlay").forEach(element => {
    element.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay") || e.target.closest(".modal-close")) {
        closeAllModals();
      }
    });
  });

  const btnAddProduct = document.getElementById("btn-add-product-modal");
  if (btnAddProduct) btnAddProduct.addEventListener("click", () => openProductEditModal(null));

  const btnCancelEdit = document.getElementById("btn-cancel-edit");
  if (btnCancelEdit) btnCancelEdit.addEventListener("click", () => closeModal("modal-admin-product-edit"));

  const productEditForm = document.getElementById("product-edit-form");
  if (productEditForm) productEditForm.addEventListener("submit", handleProductSaveSubmit);

  const editProductFile = document.getElementById("edit-product-file");
  if (editProductFile) {
    editProductFile.addEventListener("change", (e) => {
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
  }

  const btnExportDb = document.getElementById("btn-export-db");
  if (btnExportDb) btnExportDb.addEventListener("click", exportDatabaseToFile);

  const btnTriggerImport = document.getElementById("btn-trigger-import");
  if (btnTriggerImport) {
    btnTriggerImport.addEventListener("click", () => {
      const fileInput = document.getElementById("import-file-input");
      if (fileInput) fileInput.click();
    });
  }

  const importFileInput = document.getElementById("import-file-input");
  if (importFileInput) importFileInput.addEventListener("change", importDatabaseFromFile);

  const btnResetDb = document.getElementById("btn-reset-db");
  if (btnResetDb) {
    btnResetDb.addEventListener("click", () => {
      if (confirm("Вы действительно хотите сбросить базу к исходному состоянию? Все новые товары, заказы и остатки будут безвозвратно удалены.")) {
        products = window.db.resetDatabase();
        updateProductMap();
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
  }

  const tabProducts = document.getElementById("tab-products");
  if (tabProducts) tabProducts.addEventListener("click", () => switchAdminTab("products"));

  const tabOrders = document.getElementById("tab-orders");
  if (tabOrders) tabOrders.addEventListener("click", () => switchAdminTab("orders"));

  const tabSales = document.getElementById("tab-sales");
  if (tabSales) tabSales.addEventListener("click", () => switchAdminTab("sales"));

  const tabBackup = document.getElementById("tab-backup");
  if (tabBackup) tabBackup.addEventListener("click", () => switchAdminTab("backup"));

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

  document.querySelectorAll("#tabs-gender .nav-tab-btn, #tabs-season .nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const parent = e.target.parentElement;
      parent.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      renderCatalog(true);
    });
  });

  const saleForm = document.getElementById("offline-sale-form");
  if (saleForm) {
    saleForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleOfflineSaleSubmit();
    });
  }
}

function initFormBtnGroups() {
  document.querySelectorAll(".form-btn-group").forEach(group => {
    group.querySelectorAll(".form-group-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const isMulti = group.classList.contains("multi-select");
        if (isMulti) {
          btn.classList.toggle("active");
        } else {
          group.querySelectorAll(".form-group-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        }
      });
    });
  });
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

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

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

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(modal => {
    modal.classList.remove("open");
  });
  document.body.style.overflow = "";
}

function updateActiveFiltersBadge() {
  const badge = document.getElementById("filters-active-badge");
  if (!badge) return;

  const loc = document.getElementById("filter-location")?.value || "all";
  const size = document.getElementById("filter-size")?.value || "all";
  const sort = document.getElementById("filter-sort")?.value || "default";
  const status = document.getElementById("filter-status")?.value || "all";

  let count = 0;
  if (loc !== "all") count++;
  if (size !== "all") count++;
  if (sort !== "default") count++;
  if (status !== "all") count++;

  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("d-none");
  } else {
    badge.classList.add("d-none");
  }
}
