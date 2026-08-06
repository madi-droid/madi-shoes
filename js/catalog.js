// MADIYAR SHOES — модуль каталога товаров (catalog.js)

function initFilters() {
  const sizeSelect = document.getElementById("filter-size");
  if (sizeSelect) {
    sizeSelect.innerHTML = '<option value="all">Все размеры</option>';
    AVAILABLE_SIZES.forEach(size => {
      const opt = document.createElement("option");
      opt.value = size;
      opt.textContent = size;
      sizeSelect.appendChild(opt);
    });
  }

  renderCategoryTabs();
}

function renderCategoryTabs() {
  const tabsContainer = document.getElementById("tabs-category");
  if (!tabsContainer) return;

  const categoriesSet = new Set();
  const defaultCats = ["кроссовки", "туфли", "кеды", "лоферы", "ботинки", "кроксы", "мокасины", "сапоги", "босоножки"];
  defaultCats.forEach(c => categoriesSet.add(c));

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

  const allBtn = document.createElement("button");
  allBtn.className = `nav-tab-btn ${activeVal === "all" ? "active" : ""}`;
  allBtn.setAttribute("data-category", "all");
  allBtn.textContent = "Все";
  tabsContainer.appendChild(allBtn);

  categoriesList.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `nav-tab-btn ${activeVal === cat ? "active" : ""}`;
    btn.setAttribute("data-category", cat);
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    tabsContainer.appendChild(btn);
  });

  tabsContainer.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const targetBtn = e.target.closest(".nav-tab-btn");
      if (!targetBtn) return;
      tabsContainer.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.remove("active"));
      targetBtn.classList.add("active");
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

  const searchInput = document.getElementById("search-input");
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const locationFilter = document.getElementById("filter-location")?.value || "all";
  const sizeFilter = document.getElementById("filter-size")?.value || "all";
  const sortFilter = document.getElementById("filter-sort")?.value || "default";
  const statusFilter = document.getElementById("filter-status")?.value || "all";

  let filtered = products.filter(item => {
    const matchesSearch = item.article.toLowerCase().includes(searchVal) ||
                          item.name.toLowerCase().includes(searchVal) ||
                          item.brand.toLowerCase().includes(searchVal);
    if (!matchesSearch) return false;

    if (locationFilter !== "all") {
      const pointStock = item.stock?.[locationFilter] || {};
      let hasStockAtPoint = Object.values(pointStock).reduce((acc, qty) => acc + qty, 0) > 0;

      if (sizeFilter !== "all") {
        hasStockAtPoint = (pointStock[sizeFilter] || 0) > 0;
      }

      if (!hasStockAtPoint) return false;
    } else {
      if (sizeFilter !== "all") {
        const hasSizeSomewhere = ((item.stock?.bazaar?.[sizeFilter] || 0) > 0) ||
                                 ((item.stock?.mall?.[sizeFilter] || 0) > 0);
        if (!hasSizeSomewhere) return false;
      }
    }

    if (statusFilter === "in-stock") {
      const totalStock = Object.values(item.stock?.bazaar || {}).reduce((a, b) => a + b, 0) +
                         Object.values(item.stock?.mall || {}).reduce((a, b) => a + b, 0);
      if (totalStock === 0) return false;
    }

    const genderTab = document.querySelector("#tabs-gender .nav-tab-btn.active");
    if (genderTab) {
      const genderVal = genderTab.getAttribute("data-gender");
      if (genderVal !== "all") {
        if (item.gender && item.gender !== "унисекс" && item.gender !== genderVal) {
          return false;
        }
      }
    }

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

    const categoryTab = document.querySelector("#tabs-category .nav-tab-btn.active");
    if (categoryTab) {
      const categoryVal = categoryTab.getAttribute("data-category");
      if (categoryVal !== "all") {
        const itemCategories = (item.category || "").split(",").map(c => c.trim().toLowerCase());
        const catMatch = itemCategories.some(c => c.includes(categoryVal) || categoryVal.includes(c));
        const nameMatch = (item.name || "").toLowerCase().includes(categoryVal);
        const descMatch = (item.description || "").toLowerCase().includes(categoryVal);
        if (!catMatch && !nameMatch && !descMatch) {
          return false;
        }
      }
    }

    return true;
  });

  if (sortFilter === "price-asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortFilter === "price-desc") {
    filtered.sort((a, b) => b.price - a.price);
  }

  const countEl = document.getElementById("catalog-count");
  if (countEl) countEl.textContent = `Найдено: ${filtered.length} моделей`;

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

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / catalogItemsPerPage);

  if (catalogCurrentPage > totalPages) catalogCurrentPage = totalPages;
  if (catalogCurrentPage < 1) catalogCurrentPage = 1;

  const startIndex = (catalogCurrentPage - 1) * catalogItemsPerPage;
  const endIndex = Math.min(startIndex + catalogItemsPerPage, totalItems);
  const pageItems = filtered.slice(startIndex, endIndex);

  pageItems.forEach(item => {
    const bazaarSum = Object.values(item.stock?.bazaar || {}).reduce((a, b) => a + b, 0);
    const mallSum = Object.values(item.stock?.mall || {}).reduce((a, b) => a + b, 0);

    const card = document.createElement("div");
    card.className = "product-card";
    card.addEventListener("click", () => openProductDetailsModal(item.id));

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

  if (totalPages > 1 && paginationContainer) {
    const prevBtn = document.createElement("button");
    prevBtn.className = `pagination-btn ${catalogCurrentPage === 1 ? 'disabled' : ''}`;
    prevBtn.textContent = "← Назад";
    prevBtn.addEventListener("click", () => {
      if (catalogCurrentPage > 1) {
        catalogCurrentPage--;
        renderCatalog();
        scrollToSection("products-grid");
      }
    });
    paginationContainer.appendChild(prevBtn);

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

    const nextBtn = document.createElement("button");
    nextBtn.className = `pagination-btn ${catalogCurrentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.textContent = "Вперед →";
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

function openProductDetailsModal(productId) {
  const item = getProductById(productId);
  if (!item) return;

  currentSelectedProduct = item;
  currentSelectedSize = null;
  currentSelectedLocation = null;

  const detailsImg = document.getElementById("details-image");
  detailsImg.src = safeImageSrc(item.image);
  detailsImg.onerror = function() { this.src = FALLBACK_PRODUCT_IMAGE; };
  document.getElementById("details-brand").textContent = safeText(item.brand, 80);
  document.getElementById("details-name").textContent = safeText(item.name, 120);
  document.getElementById("details-article").textContent = `Артикул: ${safeText(item.article, 60)}`;
  document.getElementById("details-description").textContent = safeText(item.description, 500);
  document.getElementById("details-price").textContent = `${Number(item.price || 0).toLocaleString()} ₸`;

  document.getElementById("btn-book-action").disabled = true;
  document.getElementById("btn-buy-action").disabled = true;

  renderSizePills("bazaar", item.stock?.bazaar || {}, "bazaar-sizes-list", "bazaar-point-status");
  renderSizePills("mall", item.stock?.mall || {}, "mall-sizes-list", "mall-point-status");

  openModal("modal-product-details");
}

function renderSizePills(pointId, stockObj, listContainerId, statusLabelId) {
  const container = document.getElementById(listContainerId);
  const statusLabel = document.getElementById(statusLabelId);
  if (!container || !statusLabel) return;
  container.innerHTML = "";

  const totalPairs = Object.values(stockObj).reduce((a, b) => a + b, 0);

  if (totalPairs === 0) {
    statusLabel.className = "status status-out-of-stock";
    statusLabel.textContent = "Нет в наличии";
  } else {
    statusLabel.className = "status status-in-stock";
    statusLabel.textContent = `В наличии (${totalPairs} пар)`;
  }

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

      pill.addEventListener("click", () => {
        document.querySelectorAll(".size-pill").forEach(p => p.classList.remove("selected"));
        pill.classList.add("selected");

        currentSelectedSize = size;
        currentSelectedLocation = pointId;

        document.getElementById("btn-book-action").disabled = false;
        document.getElementById("btn-buy-action").disabled = false;
      });
    }

    container.appendChild(pill);
  });
}
