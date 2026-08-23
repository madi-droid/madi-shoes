// MADIYAR SHOES — модуль административной панели, гибридной загрузки фото и управления продавцами (admin.js)

async function compressImageToWebP(file, maxWidth = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL("image/webp", quality);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        canvas.toBlob((blob) => {
          resolve({ dataUrl, blob, width, height });
        }, "image/webp", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function switchToAdminView() {
  document.body.classList.add("is-admin-portal");

  if (!isAdminLoggedIn()) {
    if (typeof checkAdminAccess === "function") {
      checkAdminAccess();
    }
    return;
  }

  const clientSec = document.getElementById("client-section");
  if (clientSec) clientSec.classList.add("d-none");

  const adminSec = document.getElementById("admin-section");
  if (adminSec) adminSec.classList.remove("d-none");

  // Обновление профиля вошедшего сотрудника в люксовом топбаре
  const userNameEl = document.getElementById("admin-user-display-name");
  const userRoleEl = document.getElementById("admin-user-display-role");
  const storedName = sessionStorage.getItem("shoe_store_admin_name") || "Сотрудник";
  const storedRole = sessionStorage.getItem("shoe_store_admin_role") === "admin" ? "Управляющий" : "Продавец";

  if (userNameEl) userNameEl.textContent = storedName;
  if (userRoleEl) userRoleEl.textContent = storedRole;

  renderAdminDashboard();
  switchAdminTab("products");
}

function switchToClientView() {
  document.body.classList.remove("is-admin-portal");

  const clientSec = document.getElementById("client-section");
  if (clientSec) clientSec.classList.remove("d-none");

  const adminSec = document.getElementById("admin-section");
  if (adminSec) adminSec.classList.add("d-none");

  renderCatalog();
}

function showClientPage(pageId) {
  const navMenu = document.getElementById("nav-menu");
  const btnMobileMenu = document.getElementById("btn-mobile-menu");
  if (navMenu) navMenu.classList.remove("active");
  if (btnMobileMenu) btnMobileMenu.classList.remove("active");

  document.querySelectorAll(".client-page").forEach(page => {
    page.classList.add("d-none");
  });
  const activePage = document.getElementById(pageId);
  if (activePage) {
    activePage.classList.remove("d-none");
  }
  window.scrollTo(0, 0);

  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.remove("active");
  });

  document.querySelectorAll(".bottom-nav-item").forEach(item => {
    item.classList.remove("active");
  });

  if (pageId === "page-catalog") {
    const el = document.getElementById("nav-catalog");
    if (el) el.classList.add("active");
    const bnav = document.getElementById("bnav-catalog");
    if (bnav) bnav.classList.add("active");
    renderCatalog();
  } else if (pageId === "page-about") {
    const el = document.getElementById("nav-about");
    if (el) el.classList.add("active");
    const bnav = document.getElementById("bnav-about");
    if (bnav) bnav.classList.add("active");
  }
}

function renderAdminDashboard() {
  if (!requireAdminAccess()) return;
  products = window.db.loadProducts();
  orders = window.db.loadOrders();
  sales = window.db.loadSales();

  const totalModelsEl = document.getElementById("dash-total-models");
  if (totalModelsEl) totalModelsEl.textContent = products.length;

  let bazaarTotal = 0;
  let mallTotal = 0;
  products.forEach(p => {
    bazaarTotal += Object.values(p.stock?.bazaar || {}).reduce((a, b) => a + b, 0);
    mallTotal += Object.values(p.stock?.mall || {}).reduce((a, b) => a + b, 0);
  });

  const bazaarStockEl = document.getElementById("dash-bazaar-stock");
  if (bazaarStockEl) bazaarStockEl.textContent = bazaarTotal;
  const mallStockEl = document.getElementById("dash-mall-stock");
  if (mallStockEl) mallStockEl.textContent = mallTotal;

  const pending = orders.filter(o => o.status === "new" || o.status === "Новый").length;
  const pendingOrdersEl = document.getElementById("dash-pending-orders");
  if (pendingOrdersEl) pendingOrdersEl.textContent = pending;
}

function switchAdminTab(tabName) {
  if (!requireAdminAccess()) return;
  document.querySelectorAll(".admin-tab").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".admin-panel-content").forEach(p => p.classList.remove("active"));

  if (tabName === "products") {
    const tab = document.getElementById("tab-products");
    const panel = document.getElementById("panel-products");
    if (tab) tab.classList.add("active");
    if (panel) panel.classList.add("active");
    renderAdminProductsTable();
  } else if (tabName === "orders") {
    const tab = document.getElementById("tab-orders");
    const panel = document.getElementById("panel-orders");
    if (tab) tab.classList.add("active");
    if (panel) panel.classList.add("active");
    renderAdminOrdersTable();
    if (window.db && typeof window.db.fetchOrdersFromSupabase === "function") {
      window.db.fetchOrdersFromSupabase().then(updated => {
        orders = updated || window.db.loadOrders();
        renderAdminOrdersTable();
      }).catch(() => {});
    }
  } else if (tabName === "sales") {
    const tab = document.getElementById("tab-sales");
    const panel = document.getElementById("panel-sales");
    if (tab) tab.classList.add("active");
    if (panel) panel.classList.add("active");
    populateSaleProductsSelect();
    renderAdminSalesTable();
  } else if (tabName === "staff") {
    const tab = document.getElementById("tab-staff");
    const panel = document.getElementById("panel-staff");
    if (tab) tab.classList.add("active");
    if (panel) panel.classList.add("active");
    renderAdminStaffTable();
  } else if (tabName === "backup") {
    const tab = document.getElementById("tab-backup");
    const panel = document.getElementById("panel-backup");
    if (tab) tab.classList.add("active");
    if (panel) panel.classList.add("active");
  }
}

function renderAdminProductsTable() {
  if (!requireAdminAccess()) return;
  const tbody = document.getElementById("admin-products-list");
  const mobileList = document.getElementById("admin-products-mobile-list");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (mobileList) mobileList.innerHTML = "";

  const searchInput = document.getElementById("admin-product-search");
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";

  const filtered = products.filter(p => productMatchesQuery(p, searchVal));

  filtered.forEach(p => {
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
    tdBazaar.textContent = formatStock(p.stock?.bazaar);
    tr.appendChild(tdBazaar);

    const tdMall = document.createElement("td");
    tdMall.style.fontSize = "13px";
    tdMall.textContent = formatStock(p.stock?.mall);
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
    delBtn.className = "btn-danger btn-delete-product";
    delBtn.style.cssText = "padding:6px 14px; font-size:12px; background:rgba(239,68,68,0.22) !important; border:1px solid rgba(239,68,68,0.8) !important; color:#ff4444 !important; font-weight:800; cursor:pointer;";
    delBtn.textContent = "Удалить";
    delBtn.addEventListener("click", () => window.deleteProductById(p.id));
    actionsDiv.appendChild(delBtn);

    tdActions.appendChild(actionsDiv);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);

    if (mobileList) {
      const mobileCard = document.createElement("article");
      mobileCard.className = "admin-product-mobile-card";

      const image = document.createElement("img");
      image.className = "admin-product-mobile-image";
      image.src = safeImageSrc(p.image);
      image.alt = safeText(p.name, 80);
      image.onerror = function() { this.src = FALLBACK_PRODUCT_IMAGE; };

      const content = document.createElement("div");
      content.className = "admin-product-mobile-content";
      content.appendChild(createEl("span", "admin-product-mobile-article", safeText(p.article, 60)));
      content.appendChild(createEl("strong", "", `${safeText(p.brand, 60)} ${safeText(p.name, 100)}`));
      content.appendChild(createEl("span", "admin-product-mobile-stock", `Базар: ${formatStock(p.stock?.bazaar)} · Гранд Парк: ${formatStock(p.stock?.mall)}`));
      content.appendChild(createEl("strong", "admin-product-mobile-price", `${Number(p.price || 0).toLocaleString()} ₸`));

      const editMobileBtn = document.createElement("button");
      editMobileBtn.type = "button";
      editMobileBtn.className = "btn-secondary admin-product-mobile-edit";
      editMobileBtn.textContent = "Открыть и изменить";
      editMobileBtn.addEventListener("click", () => openProductEditModal(p.id));

      mobileCard.append(image, content, editMobileBtn);
      mobileList.appendChild(mobileCard);
    }
  });
}

window.deleteProductById = async function(productId) {
  if (!requireAdminAccess()) return;
  const p = getProductById(productId);
  if (!p) return;

  if (confirm(`Вы действительно хотите удалить модель «${safeText(p.brand, 30)} ${safeText(p.name, 50)}» из базы данных?`)) {
    const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
    if (supabase) {
      try {
        const { error } = await supabase.rpc('deactivate_product', {
          p_product_id: productId,
          p_session_token: getStaffSessionToken()
        });
        if (error) throw error;
      } catch (err) {
        console.warn("Ошибка удаления товара из Supabase:", err);
        showToast("Не удалось удалить товар на сервере", "error");
        return;
      }
    }

    products = products.filter(item => item.id !== productId);
    updateProductMap();
    window.db.saveProducts(products);
    showToast("Модель успешно удалена из каталога", "success");
    renderAdminProductsTable();
    renderAdminDashboard();
    renderCatalog();
  }
};

window.openProductEditModal = function(productId) {
  if (!requireAdminAccess()) return;
  const form = document.getElementById("product-edit-form");
  if (form) form.reset();

  const fileInput = document.getElementById("edit-product-file");
  if (fileInput) fileInput.value = "";
  const urlInput = document.getElementById("edit-product-image-url");
  if (urlInput) urlInput.value = "";
  const previewDiv = document.getElementById("product-image-preview");
  const previewImg = document.getElementById("preview-img-tag");

  if (productId) {
    const p = getProductById(productId);
    if (!p) return;

    document.getElementById("product-modal-title").textContent = "Редактирование товара";
    document.getElementById("edit-product-id").value = p.id;
    document.getElementById("edit-product-article").value = p.article || "";
    document.getElementById("edit-product-brand").value = p.brand || "";
    document.getElementById("edit-product-name").value = p.name || "";
    document.getElementById("edit-product-desc").value = p.description || "";
    document.getElementById("edit-product-price").value = p.price || "";
    document.getElementById("edit-product-image").value = p.image || "";
    if (urlInput) urlInput.value = p.image && p.image.startsWith("http") ? p.image : "";

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

    if (p.image && previewImg && previewDiv) {
      previewImg.src = safeImageSrc(p.image);
      previewDiv.style.display = "flex";
    } else if (previewDiv) {
      previewDiv.style.display = "none";
    }

    generateSizesInputs("admin-sizes-bazaar", "bazaar", p.stock?.bazaar || {});
    generateSizesInputs("admin-sizes-mall", "mall", p.stock?.mall || {});
  } else {
    document.getElementById("product-modal-title").textContent = "Добавление новой модели";
    document.getElementById("edit-product-id").value = "";
    document.getElementById("edit-product-image").value = "";
    if (previewDiv) previewDiv.style.display = "none";

    setFormBtnGroupValue("edit-product-gender-group", "мужской");
    setFormBtnGroupValue("edit-product-season-group", "весна");
    document.getElementById("edit-product-category").value = "";

    generateSizesInputs("admin-sizes-bazaar", "bazaar", {});
    generateSizesInputs("admin-sizes-mall", "mall", {});
  }

  openModal("modal-admin-product-edit");
};

function generateSizesInputs(containerId, pointId, stockObj) {
  const container = document.getElementById(containerId);
  if (!container) return;
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
    input.value = val;
    input.min = "0";

    group.appendChild(label);
    group.appendChild(input);
    container.appendChild(group);
  });
}

// Гибридная загрузка фото и сохранение товара
async function handleProductSaveSubmit(e) {
  e.preventDefault();
  if (!requireAdminAccess()) return;

  const id = document.getElementById("edit-product-id").value;
  const article = document.getElementById("edit-product-article").value.trim().toUpperCase();
  const brand = document.getElementById("edit-product-brand").value.trim();
  const name = document.getElementById("edit-product-name").value.trim();
  const desc = document.getElementById("edit-product-desc").value.trim();

  const priceRaw = parseInt(document.getElementById("edit-product-price").value, 10);
  if (!Number.isFinite(priceRaw) || priceRaw <= 0 || priceRaw > 9999999) {
    showToast("Введите корректную цену (от 1 до 9 999 999 ₸)", "error");
    return;
  }
  const price = priceRaw;

  // Обработка фотографий: гибридный вариант (Canvas WebP + Прямая ссылка)
  const fileInput = document.getElementById("edit-product-file");
  const urlInput = document.getElementById("edit-product-image-url");
  let finalImageUrl = document.getElementById("edit-product-image").value.trim();

  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      showToast("Сжатие фотографии (Canvas WebP 1000px)...", "info");
      const compressed = await compressImageToWebP(fileInput.files[0], 1000, 0.82);
      
      const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
      if (supabase) {
        const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(fileName, compressed.blob, { contentType: 'image/webp' });

        if (!uploadErr && uploadData) {
          const { data: pubUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
          finalImageUrl = pubUrlData.publicUrl;
        } else {
          finalImageUrl = compressed.dataUrl;
        }
      } else {
        finalImageUrl = compressed.dataUrl;
      }
    } catch (imgErr) {
      console.warn("Ошибка обработки изображения через Canvas:", imgErr);
    }
  } else if (urlInput && urlInput.value.trim()) {
    finalImageUrl = urlInput.value.trim();
  }

  if (!finalImageUrl) {
    finalImageUrl = FALLBACK_PRODUCT_IMAGE;
  }

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

  const productId = id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "prod_" + Date.now());

  const productData = {
    id: productId,
    article: safeText(article, 60).toUpperCase(),
    brand: safeText(brand, 80),
    name: safeText(name, 120),
    description: safeText(desc, 500),
    price,
    image: finalImageUrl,
    gender,
    season,
    category,
    is_active: true,
    stock: { bazaar: bazaarStock, mall: mallStock }
  };

  // Синхронизация с Supabase при наличии подключения
  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (supabase) {
    try {
      const stockRows = [];
      ["bazaar", "mall"].forEach(loc => {
        const locStock = loc === "bazaar" ? bazaarStock : mallStock;
        AVAILABLE_SIZES.forEach(sz => stockRows.push({ location: loc, size: Number(sz), quantity: Number(locStock[sz] || 0) }));
      });
      const { data, error } = await supabase.rpc('save_product', {
        p_product: productData,
        p_stock: stockRows,
        p_session_token: getStaffSessionToken()
      });
      if (error || !data?.success) throw error || new Error("Сервер не сохранил товар");
      productData.id = data.id;
    } catch (sbErr) {
      console.warn("Ошибка синхронизации с Supabase:", sbErr);
      showToast("Не удалось сохранить товар на сервере", "error");
      return;
    }
  }

  if (id) {
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = productData;
      showToast("Товар успешно обновлен", "success");
    }
  } else {
    products.unshift(productData);
    showToast("Новая модель добавлена в каталог", "success");
  }

  updateProductMap();
  window.db.saveProducts(products);
  closeModal("modal-admin-product-edit");
  renderAdminProductsTable();
  renderAdminDashboard();
  renderCatalog();
  renderCategoryTabs();
}

// --- Управление продавцами и сотрудниками ---
let staffProfilesList = [];

async function renderAdminStaffTable() {
  if (!requireAdminAccess()) return;
  const tbody = document.getElementById("admin-staff-list");
  if (!tbody) return;
  tbody.innerHTML = "";

  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (supabase) {
    try {
      const { data: profiles, error } = await supabase.rpc('list_staff_profiles', {
        p_session_token: getStaffSessionToken()
      });

      if (!error && profiles) {
        staffProfilesList = profiles.filter(profile => profile.is_active);
      }
    } catch (err) {
      console.warn("Ошибка загрузки профилей продавцов:", err);
    }
  }

  // Не показываем локальные «демо»-аккаунты: они могли бы выглядеть как
  // настоящие сотрудники и обходить серверную авторизацию.

  staffProfilesList.forEach(st => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    const nameStrong = document.createElement("strong");
    nameStrong.textContent = safeText(st.full_name, 100);
    tdName.appendChild(nameStrong);
    tr.appendChild(tdName);

    const tdPhone = document.createElement("td");
    tdPhone.textContent = formatPhoneDisplay(st.phone);
    tr.appendChild(tdPhone);

    const tdRole = document.createElement("td");
    const roleSpan = document.createElement("span");
    roleSpan.className = `order-status-badge ${st.role === 'admin' ? 'badge-confirmed' : 'badge-new'}`;
    roleSpan.textContent = st.role === 'admin' ? 'Администратор' : 'Продавец';
    tdRole.appendChild(roleSpan);
    tr.appendChild(tdRole);

    const tdLoc = document.createElement("td");
    tdLoc.textContent = st.location === 'mall' ? 'Гранд Парк' : 'Базар';
    tr.appendChild(tdLoc);

    const tdStatus = document.createElement("td");
    const statusSpan = document.createElement("span");
    statusSpan.style.cssText = st.is_active ? "color:var(--accent-green); font-weight:600;" : "color:var(--accent-red); font-weight:600;";
    statusSpan.textContent = st.is_active ? "Активен" : "Заблокирован";
    tdStatus.appendChild(statusSpan);
    tr.appendChild(tdStatus);

    const tdActions = document.createElement("td");
    const actDiv = document.createElement("div");
    actDiv.style.cssText = "display:flex; gap:6px;";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-secondary";
    editBtn.style.cssText = "padding:4px 8px; font-size:11px;";
    editBtn.textContent = "Изменить";
    editBtn.addEventListener("click", () => openStaffModal(st));
    actDiv.appendChild(editBtn);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn-secondary";
    toggleBtn.style.cssText = `padding:4px 8px; font-size:11px; ${st.is_active ? 'border-color:var(--accent-red); color:var(--accent-red);' : ''}`;
    toggleBtn.textContent = st.is_active ? "Деактивировать" : "Активировать";
    toggleBtn.addEventListener("click", () => toggleStaffActiveStatus(st));
    actDiv.appendChild(toggleBtn);

    tdActions.appendChild(actDiv);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

function openStaffModal(profileObj = null) {
  if (!requireAdminAccess()) return;
  const form = document.getElementById("staff-edit-form");
  if (form) form.reset();

  const modalTitle = document.getElementById("staff-modal-title");
  const editId = document.getElementById("edit-staff-id");
  const nameInput = document.getElementById("edit-staff-name");
  const phoneInput = document.getElementById("edit-staff-phone");
  const pinInput = document.getElementById("edit-staff-pin");

  if (profileObj) {
    if (modalTitle) modalTitle.textContent = "Редактирование сотрудника";
    if (editId) editId.value = profileObj.id || "";
    if (nameInput) nameInput.value = profileObj.full_name || profileObj.name || "";
    if (phoneInput) phoneInput.value = profileObj.phone || "";
    if (pinInput) {
      pinInput.value = "";
      pinInput.placeholder = "Оставьте пустым, если не меняете";
      pinInput.required = false;
    }
    setFormBtnGroupValue("edit-staff-role-group", profileObj.role || "seller");
    setFormBtnGroupValue("edit-staff-location-group", profileObj.location || "bazaar");
  } else {
    if (modalTitle) modalTitle.textContent = "Добавление нового продавца";
    if (editId) editId.value = "";
    if (pinInput) {
      pinInput.placeholder = "****";
      pinInput.required = true;
    }
    setFormBtnGroupValue("edit-staff-role-group", "seller");
    setFormBtnGroupValue("edit-staff-location-group", "bazaar");
  }

  openModal("modal-admin-staff-edit");
}

async function handleStaffSaveSubmit(e) {
  e.preventDefault();
  if (!requireAdminAccess()) return;

  const nameInput = document.getElementById("edit-staff-name").value.trim();
  const phoneInput = document.getElementById("edit-staff-phone").value.trim();
  const pinInput = document.getElementById("edit-staff-pin").value.trim();
  const role = getFormBtnGroupValue("edit-staff-role-group") || "seller";
  const location = getFormBtnGroupValue("edit-staff-location-group") || "bazaar";

  const normPhone = normalizePhone(phoneInput);

  if (!isValidKazakhstanPhone(phoneInput)) {
    showToast("Введите корректный номер телефона РК", "error");
    return;
  }

  let pinHash = "";
  if (pinInput) {
    if (pinInput.length < 8 || pinInput.length > 64 || !/^[A-Za-z0-9]+$/.test(pinInput)) {
      showToast("Пароль должен содержать 8–64 латинских букв или цифр", "error");
      return;
    }
    pinHash = pinInput;
  }

  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('create_or_update_seller', {
        p_phone: normPhone,
        p_full_name: nameInput,
        p_pin: pinHash || null,
        p_role: role,
        p_location: location,
        p_is_active: true,
        p_session_token: getStaffSessionToken()
      });

      if (error) {
        showToast(`Ошибка сохранения продавца: ${error.message}`, "error");
        return;
      }
    } catch (err) {
      console.warn("Ошибка сохранения сотрудника в Supabase:", err);
      showToast("Не удалось сохранить сотрудника на сервере", "error");
      return;
    }
  }

  showToast(`Сотрудник ${nameInput} успешно сохранен!`, "success");
  closeModal("modal-admin-staff-edit");
  renderAdminStaffTable();
}

async function toggleStaffActiveStatus(staffObj) {
  if (!requireAdminAccess()) return;
  const newStatus = !staffObj.is_active;

  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (supabase && staffObj.phone) {
    try {
      const { error } = await supabase.rpc('set_staff_active', {
        p_phone: staffObj.phone,
        p_is_active: newStatus,
        p_session_token: getStaffSessionToken()
      });
      if (error) throw error;
    } catch (err) {
      console.warn("Ошибка изменения статуса профиля в Supabase:", err);
      showToast("Не удалось изменить статус сотрудника на сервере", "error");
      return;
    }
  }

  staffObj.is_active = newStatus;
  showToast(`Статус сотрудника ${staffObj.full_name || staffObj.name} изменен на ${newStatus ? 'Активен' : 'Заблокирован'}`, "info");
  renderAdminStaffTable();
}

function renderAdminOrdersTable() {
  if (!requireAdminAccess()) return;
  orders = window.db.loadOrders();
  const tbody = document.getElementById("admin-orders-list");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (orders.length === 0) {
    const emptyTr = document.createElement("tr");
    const emptyTd = createEl("td", "", "Список заказов пуст");
    emptyTd.colSpan = 8;
    emptyTd.style.cssText = "text-align:center; padding: 30px; color:var(--text-secondary);";
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    return;
  }

  orders.forEach(o => {
    let badgeClass = "badge-new";
    if (o.status === "paid" || o.status === "Оплачен") badgeClass = "badge-paid";
    else if (o.status === "contacted" || o.status === "Подтвержден") badgeClass = "badge-confirmed";
    else if (o.status === "completed" || o.status === "Выдан" || o.status === "cancelled" || o.status === "Отменен") badgeClass = "badge-completed";

    const locText = o.location === "bazaar" ? "Базар (25б)" : "Гранд Парк (10б)";

    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.style.cssText = "font-weight:700; font-size:12px; color:#ffffff;";
    tdId.textContent = safeText(o.id, 30);
    tr.appendChild(tdId);

    const tdClient = document.createElement("td");
    const clientName = document.createElement("strong");
    clientName.style.cssText = "color:#ffffff; font-weight:700; font-size:13px; display:block;";
    clientName.textContent = safeText(o.userName, 80);
    const clientPhone = document.createElement("div");
    clientPhone.style.cssText = "font-size:12px; color:#8892b0; font-weight:600; margin-top:2px;";
    clientPhone.textContent = safeText(o.userPhone, 30);
    tdClient.appendChild(clientName);
    tdClient.appendChild(clientPhone);
    tr.appendChild(tdClient);

    const tdProduct = document.createElement("td");
    const prodArt = document.createElement("strong");
    prodArt.style.cssText = "color:#FFD700; font-weight:700; font-size:13px; display:block;";
    prodArt.textContent = safeText(o.productArticle, 50);
    const prodName = document.createElement("div");
    prodName.style.cssText = "font-size:12px; color:#ccd6f6; font-weight:600; margin-top:2px;";
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

    if (o.status === "new" || o.status === "Новый") {
      const confirmBtn = document.createElement("button");
      confirmBtn.className = "btn-secondary";
      confirmBtn.style.cssText = "padding:4px 8px; font-size:11px; margin-right:4px;";
      confirmBtn.textContent = "Подтвердить";
      confirmBtn.addEventListener("click", () => window.changeOrderStatus(o.id, "contacted"));
      actionsDiv.appendChild(confirmBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn-secondary";
      cancelBtn.style.cssText = "padding:4px 8px; font-size:11px; border-color:var(--accent-red); color:var(--accent-red);";
      cancelBtn.textContent = "Отменить";
      cancelBtn.addEventListener("click", () => window.cancelOrderById(o.id));
      actionsDiv.appendChild(cancelBtn);
    } else if (o.status === "contacted" || o.status === "Подтвержден") {
      const doneBtn = document.createElement("button");
      doneBtn.className = "btn-secondary";
      doneBtn.style.cssText = "padding:4px 8px; font-size:11px; border-color:var(--accent-green); color:var(--accent-green);";
      doneBtn.textContent = "Выдан клиенту";
      doneBtn.addEventListener("click", () => window.changeOrderStatus(o.id, "completed"));
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

window.changeOrderStatus = async function(orderId, newStatus) {
  if (!requireAdminAccess()) return;
  const index = orders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
    if (supabase) {
      try {
        const { error } = await supabase.rpc('update_reservation_status', {
          p_reservation_id: orderId,
          p_status: newStatus,
          p_session_token: getStaffSessionToken()
        });
        if (error) throw error;
      } catch (err) {
        console.warn("Ошибка обновления статуса заявки в Supabase:", err);
        showToast("Не удалось обновить заявку на сервере", "error");
        return;
      }
    }

    orders[index].status = newStatus;
    window.db.saveOrders(orders);

    showToast(`Статус заявки обновлен`, "success");
    renderAdminOrdersTable();
    renderAdminDashboard();
  }
};

window.cancelOrderById = async function(orderId) {
  if (!requireAdminAccess()) return;
  if (confirm(`Вы действительно хотите отменить заявку ${safeText(orderId, 30)}?`)) {
    const index = orders.findIndex(o => o.id === orderId);
    if (index !== -1) {
      const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
      if (supabase) {
        try {
          const { error } = await supabase.rpc('update_reservation_status', {
            p_reservation_id: orderId,
            p_status: 'cancelled',
            p_session_token: getStaffSessionToken()
          });
          if (error) throw error;
        } catch (err) {
          console.warn("Ошибка отмены заявки в Supabase:", err);
          showToast("Не удалось отменить заявку на сервере", "error");
          return;
        }
      }

      orders[index].status = "cancelled";
      window.db.saveOrders(orders);

      showToast(`Заявка отменена`, "info");
      renderAdminOrdersTable();
      renderAdminDashboard();
      renderCatalog();
    }
  }
};

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

function importDatabaseFromFile(e) {
  if (!requireAdminAccess()) return;
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast("Файл слишком большой. Максимум 5 МБ.", "error");
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const success = window.db.importDatabase(evt.target.result);
    if (success) {
      products = window.db.loadProducts();
      updateProductMap();
      orders = window.db.loadOrders();
      sales = window.db.loadSales();
      currentUser = window.db.getCurrentUser();

      showToast("База данных успешно импортирована!", "success");

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
  e.target.value = "";
}

function initCategoryAutocomplete() {
  const categoryInput = document.getElementById("edit-product-category");
  const dropdown = document.getElementById("category-autocomplete-dropdown");
  if (!categoryInput || !dropdown) return;

  if (categoryInput.dataset.autocompleteInitialized === "true") return;
  categoryInput.dataset.autocompleteInitialized = "true";

  const defaultCats = ["кроссовки", "туфли", "кроксы", "мокасины", "сапоги"];

  function getSuggestions(query) {
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

  categoryInput.addEventListener("input", (e) => {
    const val = e.target.value;
    const lastComma = val.lastIndexOf(",");
    const query = val.substring(lastComma + 1).trim();
    renderDropdown(getSuggestions(query));
  });

  categoryInput.addEventListener("focus", () => {
    const val = categoryInput.value;
    const lastComma = val.lastIndexOf(",");
    const query = val.substring(lastComma + 1).trim();
    renderDropdown(getSuggestions(query));
  });

  document.addEventListener("click", (e) => {
    if (!categoryInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add("d-none");
    }
  });
}
