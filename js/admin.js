// MADIYAR SHOES — модуль административной панели (admin.js)

function switchToAdminView() {
  if (!isAdminLoggedIn()) {
    checkAdminAccess();
    return;
  }
  const clientSec = document.getElementById("client-section");
  if (clientSec) clientSec.classList.add("d-none");
  const adminSec = document.getElementById("admin-section");
  if (adminSec) adminSec.classList.remove("d-none");
  window.location.hash = "admin";

  renderAdminDashboard();
  switchAdminTab("products");
}

function switchToClientView() {
  const clientSec = document.getElementById("client-section");
  if (clientSec) clientSec.classList.remove("d-none");
  const adminSec = document.getElementById("admin-section");
  if (adminSec) adminSec.classList.add("d-none");
  window.location.hash = "";

  renderCatalog();
}

function showClientPage(pageId) {
  document.querySelectorAll(".client-page").forEach(page => {
    page.classList.add("d-none");
  });
  const activePage = document.getElementById(pageId);
  if (activePage) {
    activePage.classList.remove("d-none");
  }

  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.remove("active");
  });

  if (pageId === "page-catalog") {
    const el = document.getElementById("nav-catalog");
    if (el) el.classList.add("active");
    renderCatalog();
  } else if (pageId === "page-about") {
    const el = document.getElementById("nav-about");
    if (el) el.classList.add("active");
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

  const pending = orders.filter(o => o.status === "Новый").length;
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
  } else if (tabName === "sales") {
    const tab = document.getElementById("tab-sales");
    const panel = document.getElementById("panel-sales");
    if (tab) tab.classList.add("active");
    if (panel) panel.classList.add("active");
    populateSaleProductsSelect();
    renderAdminSalesTable();
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
  if (!tbody) return;
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

window.deleteProductById = function(productId) {
  if (!requireAdminAccess()) return;
  const p = getProductById(productId);
  if (!p) return;
  if (confirm(`Вы действительно хотите удалить модель «${safeText(p.brand, 30)} ${safeText(p.name, 50)}» из базы данных?`)) {
    products = products.filter(item => item.id !== productId);
    updateProductMap();
    window.db.saveProducts(products);
    showToast("Модель успешно удалена из каталога", "success");
    renderAdminProductsTable();
    renderAdminDashboard();
  }
};

window.openProductEditModal = function(productId) {
  if (!requireAdminAccess()) return;
  const form = document.getElementById("product-edit-form");
  if (form) form.reset();

  const fileInput = document.getElementById("edit-product-file");
  if (fileInput) fileInput.value = "";
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

function handleProductSaveSubmit(e) {
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
  const image = safeImageSrc(document.getElementById("edit-product-image").value.trim());

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
    const newId = "prod_" + Date.now();
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
    products.unshift(newProduct);
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

function renderAdminOrdersTable() {
  if (!requireAdminAccess()) return;
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
    if (o.status === "Оплачен") badgeClass = "badge-paid";
    else if (o.status === "Подтвержден") badgeClass = "badge-confirmed";
    else if (o.status === "Выдан" || o.status === "Отменен") badgeClass = "badge-completed";

    const locText = o.location === "bazaar" ? "Базар (25б)" : "Гранд Парк (10б)";

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
