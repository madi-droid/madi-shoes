// MADIYAR SHOES — модуль каталога товаров и гранулярного обновления остатков (catalog.js)

function initFilters() {
  const sizeSelect = document.getElementById("filter-size");
  if (sizeSelect) {
    sizeSelect.innerHTML = '<option value="all">Все размеры</option>';
    AVAILABLE_SIZES.forEach(size => {
      const numericSize = Number(size);
      if (numericSize < 35 || numericSize > 46) return;
      const opt = document.createElement("option");
      opt.value = size;
      opt.textContent = size;
      sizeSelect.appendChild(opt);
    });
  }

  // Настройка чипсов с поддержкой Мультивыбора (Пол, Сезон)
  bindMultiSelectTabs("tabs-gender", "data-gender");
  bindMultiSelectTabs("tabs-season", "data-season");

  // Слушатели для ввода цен и сортировки
  const priceMin = document.getElementById("filter-price-min");
  const priceMax = document.getElementById("filter-price-max");
  const catSortSelect = document.getElementById("catalog-sort-select");

  if (priceMin) priceMin.addEventListener("input", () => renderCatalog(true));
  if (priceMax) priceMax.addEventListener("input", () => renderCatalog(true));

  if (catSortSelect) {
    catSortSelect.addEventListener("change", () => renderCatalog(true));
  }

  renderCategoryTabs();
  renderMobileSizeOptions();
}

function renderMobileSizeOptions() {
  const select = document.getElementById("filter-size");
  const container = document.getElementById("mobile-size-options");
  if (!select || !container) return;

  container.innerHTML = "";
  Array.from(select.options).forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mobile-size-option ${select.value === option.value ? "active" : ""}`;
    button.textContent = option.value === "all" ? "Все" : option.textContent;
    button.dataset.value = option.value;
    button.addEventListener("click", () => {
      select.value = option.value;
      container.querySelectorAll(".mobile-size-option").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    container.appendChild(button);
  });
}

function updateMobileFilterSummary(sizeFilter, selectedCategories, totalCount) {
  const sizeTrigger = document.getElementById("mobile-size-trigger");
  const categoryTrigger = document.getElementById("mobile-category-trigger");
  const applyButton = document.getElementById("btn-apply-catalog-filters");

  if (sizeTrigger) {
    sizeTrigger.firstChild.textContent = sizeFilter === "all" ? "Размер " : `Размер ${sizeFilter} `;
  }
  if (categoryTrigger) {
    const categoryText = selectedCategories.includes("all") ? "Категория" : selectedCategories[0];
    categoryTrigger.firstChild.textContent = `${categoryText.charAt(0).toUpperCase()}${categoryText.slice(1)} `;
  }
  if (applyButton) {
    const word = getModelsPluralWord(totalCount);
    applyButton.textContent = `Показать ${totalCount} ${word}`;
  }
}

// Универсальный обработчик мультивыбора для чипсов
function bindMultiSelectTabs(containerId, dataAttr) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute(dataAttr);

      if (val === "all") {
        container.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      } else {
        const allBtn = container.querySelector(`.nav-tab-btn[${dataAttr}="all"]`);
        if (allBtn) allBtn.classList.remove("active");

        btn.classList.toggle("active");

        const activeOthers = container.querySelectorAll(`.nav-tab-btn.active:not([${dataAttr}="all"])`);
        if (activeOthers.length === 0 && allBtn) {
          allBtn.classList.add("active");
        }
      }

      renderCatalog(true);
    });
  });
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
  const activeBtns = Array.from(tabsContainer.querySelectorAll(".nav-tab-btn.active")).map(b => b.getAttribute("data-category"));

  tabsContainer.innerHTML = "";

  const allBtn = document.createElement("button");
  const isAllActive = activeBtns.length === 0 || activeBtns.includes("all");
  allBtn.className = `nav-tab-btn ${isAllActive ? "active" : ""}`;
  allBtn.setAttribute("data-category", "all");
  allBtn.textContent = "Все";
  tabsContainer.appendChild(allBtn);

  categoriesList.forEach(cat => {
    const btn = document.createElement("button");
    const isActive = activeBtns.includes(cat);
    btn.className = `nav-tab-btn ${isActive ? "active" : ""}`;
    btn.setAttribute("data-category", cat);
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    tabsContainer.appendChild(btn);
  });

  bindMultiSelectTabs("tabs-category", "data-category");
}

function getSelectedTabValues(containerId, dataAttr) {
  const container = document.getElementById(containerId);
  if (!container) return ["all"];
  const activeBtns = container.querySelectorAll(`.nav-tab-btn.active`);
  if (activeBtns.length === 0) return ["all"];

  const vals = Array.from(activeBtns).map(b => b.getAttribute(dataAttr));
  if (vals.includes("all")) return ["all"];
  return vals;
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
  const sortFilter = document.getElementById("catalog-sort-select")?.value || "default";
  const statusFilter = document.getElementById("filter-status")?.value || "all";

  const selectedGenders = getSelectedTabValues("tabs-gender", "data-gender");
  const selectedSeasons = getSelectedTabValues("tabs-season", "data-season");
  const selectedCategories = getSelectedTabValues("tabs-category", "data-category");

  // Отрисовка активных тегов и обновление кнопки сброса
  renderActiveFilterTags({
    searchVal,
    locationFilter,
    sizeFilter,
    statusFilter,
    selectedGenders,
    selectedSeasons,
    selectedCategories
  });

  const rawPriceMin = document.getElementById("filter-price-min")?.value;
  const rawPriceMax = document.getElementById("filter-price-max")?.value;

  const priceMinVal = (rawPriceMin !== undefined && rawPriceMin !== "" && !isNaN(rawPriceMin)) ? Math.max(0, parseFloat(rawPriceMin)) : 0;
  const priceMaxVal = (rawPriceMax !== undefined && rawPriceMax !== "" && !isNaN(rawPriceMax)) ? parseFloat(rawPriceMax) : Infinity;

  let filtered = products.filter(item => {
    if (!productMatchesQuery(item, searchVal)) return false;

    // Фильтрация по точной цене
    const itemPrice = Number(item.price || 0);
    if (itemPrice < priceMinVal || itemPrice > priceMaxVal) return false;

    if (!selectedCategories.includes("all")) {
      const itemCats = (item.category || "").split(",").map(c => c.trim().toLowerCase());
      const matchesCat = selectedCategories.some(sc => itemCats.includes(sc.toLowerCase()));
      if (!matchesCat) return false;
    }

    if (!selectedGenders.includes("all")) {
      const g = (item.gender || "").toLowerCase();
      const matchesGender = selectedGenders.some(sg => g === sg.toLowerCase() || g === "унисекс");
      if (!matchesGender) return false;
    }

    if (!selectedSeasons.includes("all")) {
      const s = (item.season || "").toLowerCase();
      const matchesSeason = selectedSeasons.some(ss => s === ss.toLowerCase() || s === "всесезон" || s === "демисезон");
      if (!matchesSeason) return false;
    }

    const bazaarSum = Object.values(item.stock?.bazaar || {}).reduce((a, b) => a + b, 0);
    const mallSum = Object.values(item.stock?.mall || {}).reduce((a, b) => a + b, 0);
    const totalStock = bazaarSum + mallSum;

    if (statusFilter === "in-stock" && totalStock <= 0) {
      return false;
    }

    if (locationFilter !== "all") {
      const pointStock = item.stock?.[locationFilter] || {};
      let hasStockAtPoint = Object.values(pointStock).reduce((acc, qty) => acc + qty, 0) > 0;

      if (sizeFilter !== "all") {
        hasStockAtPoint = (pointStock[sizeFilter] || 0) > 0;
      }

      if (!hasStockAtPoint) return false;
    } else {
      if (sizeFilter !== "all") {
        const bQty = item.stock?.bazaar?.[sizeFilter] || 0;
        const mQty = item.stock?.mall?.[sizeFilter] || 0;
        if (bQty + mQty <= 0) return false;
      }
    }

    return true;
  });

  if (sortFilter === "price-asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortFilter === "price-desc") {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortFilter === "name-asc") {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  const countEl = document.getElementById("catalog-count");
  if (countEl) countEl.textContent = formatCatalogCount(filtered.length);
  updateMobileFilterSummary(sizeFilter, selectedCategories, filtered.length);

  if (filtered.length === 0) {
    if (grid) {
      const empty = createEl("div");
      empty.style.cssText = "grid-column:1/-1;text-align:center;padding:50px 20px;color:var(--text-secondary);";
      empty.appendChild(createEl("h3", "", "Товары по выбранным критериям не найдены"));
      const p = createEl("p", "", "Попробуйте уменьшить число фильтров или нажать «Сбросить все».");
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

  pageItems.forEach((item, idx) => {
    const card = document.createElement("article");
    card.className = "product-card aura group relative flex flex-col border border-line bg-card/55 backdrop-blur-md animate-rise";
    card.style.animationDelay = `${Math.min(idx, 8) * 45}ms`;
    card.setAttribute("data-product-id", item.id);
    card.addEventListener("click", () => openProductDetailsModal(item.id));

    // Контейнер фото строго 4/5 в стиле Figma
    const imageWrap = createEl("div", "relative aspect-[4/5] overflow-hidden bg-bg-deep product-image-container");

    const img = createEl("img", "h-full w-full object-cover opacity-90 transition-all duration-[900ms] ease-out group-hover:scale-[1.05] group-hover:opacity-100 product-image");
    img.src = safeImageSrc(item.image);
    img.alt = `${safeText(item.brand, 60)} ${safeText(item.name, 100)}`;
    img.style.filter = "saturate(0.82) contrast(1.04)";
    img.decoding = "async";
    if (idx < 4) {
      img.loading = "eager";
      img.setAttribute("fetchpriority", "high");
    } else {
      img.loading = "lazy";
    }
    img.onerror = function() { this.src = FALLBACK_PRODUCT_IMAGE; };
    imageWrap.appendChild(img);

    // Теплая пленочная винтажная накладка из Figma
    const filmWash = createEl("div", "pointer-events-none absolute inset-0 film-wash-overlay");
    filmWash.style.background = "linear-gradient(to top, rgba(28,23,16,0.82), rgba(28,23,16,0.06) 52%), radial-gradient(80% 60% at 50% 10%, rgba(194,163,112,0.14), transparent)";
    imageWrap.appendChild(filmWash);

    // Кнопка Сердечко (Избранное) строго из ProductCard.tsx
    const favActive = isFavorite(item.id);
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = `btn-fav-card absolute right-3 top-3 grid h-9 w-9 place-items-center border backdrop-blur-md transition-all duration-300 ${
      favActive
        ? "border-gold/60 bg-bg-deep/70 text-gold active"
        : "border-line bg-bg-deep/45 text-cream/70 hover:text-gold-bright"
    }`;
    favBtn.setAttribute("aria-label", favActive ? "Убрать из избранного" : "Добавить в избранное");
    favBtn.innerHTML = `<svg class="h-[17px] w-[17px]" viewBox="0 0 24 24" fill="${favActive ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const added = toggleFavorite(item.id);
      favBtn.classList.toggle("active", added);
      favBtn.className = `btn-fav-card absolute right-3 top-3 grid h-9 w-9 place-items-center border backdrop-blur-md transition-all duration-300 ${
        added
          ? "border-gold/60 bg-bg-deep/70 text-gold active"
          : "border-line bg-bg-deep/45 text-cream/70 hover:text-gold-bright"
      }`;
      favBtn.querySelector("svg").setAttribute("fill", added ? "currentColor" : "none");
      showToast(added ? "Товар добавлен в Избранное" : "Товар удален из Избранного", "info");
    });
    imageWrap.appendChild(favBtn);

    // Моноширинный тег категории в верхнем левом углу
    const catTag = createEl("span", "absolute left-3 top-3 border border-line bg-bg-deep/60 px-2.5 py-1 font-mono text-[9px] tracking-[0.22em] text-cream/75 uppercase backdrop-blur-md card-category-tag", safeText(item.category || "Обувь", 30));
    imageWrap.appendChild(catTag);

    card.appendChild(imageWrap);

    // Текстовый блок точно по ProductCard.tsx
    const content = createEl("div", "flex flex-1 flex-col gap-1 p-4 lg:p-5 product-card-content");
    
    const brandSpan = createEl("span", "font-mono text-[10px] tracking-[0.34em] text-gold uppercase product-brand", safeText(item.brand, 80));
    content.appendChild(brandSpan);

    const modelH3 = createEl("h3", "font-display text-[17px] leading-snug text-cream product-name", safeText(item.name, 120));
    content.appendChild(modelH3);

    const priceRow = createEl("div", "mt-4 flex items-end justify-between gap-3 border-t border-line pt-4 product-price-row");
    const priceSpan = createEl("span", "text-[18px] font-bold tracking-tight text-cream product-price", `${Number(item.price || 0).toLocaleString()} ₸`);
    priceRow.appendChild(priceSpan);

    const actionBtn = createEl("button", "aura border border-line-strong px-3.5 py-2 text-[10px] tracked text-cream/85 hover:text-gold-bright lg:px-4 btn-card-action", "Подробнее");
    actionBtn.type = "button";
    priceRow.appendChild(actionBtn);

    content.appendChild(priceRow);
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

// Отрисовка плашки активных тегов и управления кнопкой сброса
function renderActiveFilterTags(params) {
  const container = document.getElementById("active-filters-tags");
  const resetBtn = document.getElementById("btn-reset-filters");
  const badgeEl = document.getElementById("filters-active-badge");
  if (!container) return;

  container.innerHTML = "";
  const tags = [];

  if (params.searchVal) {
    tags.push({ label: `Поиск: "${params.searchVal}"`, type: "search" });
  }
  if (params.locationFilter !== "all") {
    const locText = params.locationFilter === "bazaar" ? "Базар" : "Гранд Парк";
    tags.push({ label: `Точка: ${locText}`, type: "location" });
  }
  if (params.sizeFilter !== "all") {
    tags.push({ label: `Размер: ${params.sizeFilter}`, type: "size" });
  }
  if (params.statusFilter !== "all") {
    tags.push({ label: `В наличии`, type: "status" });
  }
  if (!params.selectedGenders.includes("all")) {
    params.selectedGenders.forEach(g => tags.push({ label: `Пол: ${g}`, type: "gender", val: g }));
  }
  if (!params.selectedSeasons.includes("all")) {
    params.selectedSeasons.forEach(s => tags.push({ label: `Сезон: ${s}`, type: "season", val: s }));
  }
  if (!params.selectedCategories.includes("all")) {
    params.selectedCategories.forEach(c => tags.push({ label: `Категория: ${c}`, type: "category", val: c }));
  }

  if (badgeEl) {
    badgeEl.textContent = tags.length;
    if (tags.length > 0) badgeEl.classList.remove("d-none");
    else badgeEl.classList.add("d-none");
  }

  if (resetBtn) {
    if (tags.length > 0) resetBtn.classList.remove("d-none");
    else resetBtn.classList.add("d-none");
  }

  if (tags.length === 0) {
    container.classList.add("d-none");
    return;
  }

  container.classList.remove("d-none");

  tags.forEach(t => {
    const tagEl = document.createElement("span");
    tagEl.className = "active-tag";
    tagEl.textContent = t.label + " ";

    const closeIcon = document.createElement("button");
    closeIcon.type = "button";
    closeIcon.className = "tag-remove-btn";
    closeIcon.innerHTML = "&times;";
    closeIcon.addEventListener("click", () => removeSingleFilter(t.type, t.val));

    tagEl.appendChild(closeIcon);
    container.appendChild(tagEl);
  });
}

function removeSingleFilter(type, val) {
  if (type === "search") {
    const el = document.getElementById("search-input");
    if (el) el.value = "";
  } else if (type === "location") {
    const el = document.getElementById("filter-location");
    if (el) el.value = "all";
  } else if (type === "size") {
    const el = document.getElementById("filter-size");
    if (el) el.value = "all";
  } else if (type === "status") {
    const el = document.getElementById("filter-status");
    if (el) el.value = "all";
  } else if (type === "gender") {
    deselectTabVal("tabs-gender", "data-gender", val);
  } else if (type === "season") {
    deselectTabVal("tabs-season", "data-season", val);
  } else if (type === "category") {
    deselectTabVal("tabs-category", "data-category", val);
  }

  renderCatalog(true);
}

function deselectTabVal(containerId, dataAttr, val) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const btn = container.querySelector(`.nav-tab-btn[${dataAttr}="${val}"]`);
  if (btn) btn.classList.remove("active");

  const activeOthers = container.querySelectorAll(`.nav-tab-btn.active:not([${dataAttr}="all"])`);
  if (activeOthers.length === 0) {
    const allBtn = container.querySelector(`.nav-tab-btn[${dataAttr}="all"]`);
    if (allBtn) allBtn.classList.add("active");
  }
}

function resetAllFilters() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";

  const locFilter = document.getElementById("filter-location");
  if (locFilter) locFilter.value = "all";

  const sizeFilter = document.getElementById("filter-size");
  if (sizeFilter) sizeFilter.value = "all";

  const statusFilter = document.getElementById("filter-status");
  if (statusFilter) statusFilter.value = "all";

  const sortSelect = document.getElementById("catalog-sort-select");
  if (sortSelect) sortSelect.value = "default";

  ["tabs-gender", "tabs-season", "tabs-category"].forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      container.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.remove("active"));
      const allBtn = container.querySelector('.nav-tab-btn[data-gender="all"], .nav-tab-btn[data-season="all"], .nav-tab-btn[data-category="all"]');
      if (allBtn) allBtn.classList.add("active");
    }
  });

  renderCatalog(true);
  renderMobileSizeOptions();
}

// Отрисовка модального окна Избранных товаров
function openFavoritesModal() {
  const favIds = loadFavorites();
  const grid = document.getElementById("favorites-products-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (favIds.length === 0) {
    const empty = createEl("div");
    empty.style.cssText = "grid-column:1/-1; text-align:center; padding:40px; color:var(--text-secondary);";
    empty.appendChild(createEl("h3", "", "Ваш список избранного пуст"));
    const p = createEl("p");
    p.innerHTML = `Нажмите на <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle; color:#c2a370; margin:0 3px;"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> на карточке любого товара в каталоге, чтобы сохранить его здесь.`;
    p.style.marginTop = "8px";
    empty.appendChild(p);
    grid.appendChild(empty);
  } else {
    const favProducts = products.filter(p => favIds.includes(p.id));
    favProducts.forEach(item => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.setAttribute("data-product-id", item.id);
      card.addEventListener("click", () => {
        closeModal("modal-favorites-list");
        openProductDetailsModal(item.id);
      });

      const imageWrap = createEl("div", "product-image-container");

      const favBtn = document.createElement("button");
      favBtn.className = "btn-fav-card active";
      favBtn.title = "Удалить из избранного";
      favBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(item.id);
        openFavoritesModal();
      });
      imageWrap.appendChild(favBtn);

      const img = createEl("img", "product-image");
      img.src = safeImageSrc(item.image);
      img.alt = safeText(item.name, 120);
      img.onerror = function() { this.src = FALLBACK_PRODUCT_IMAGE; };
      imageWrap.appendChild(img);

      const content = createEl("div", "product-card-content");
      content.appendChild(createEl("div", "product-brand", safeText(item.brand, 80)));
      content.appendChild(createEl("h3", "product-name", safeText(item.name, 120)));
      const priceRow = createEl("div", "product-price-row");
      priceRow.appendChild(createEl("div", "product-price", `${Number(item.price || 0).toLocaleString()} ₸`));
      priceRow.appendChild(createEl("button", "btn-card-action", "Подробнее"));
      content.appendChild(priceRow);
      card.appendChild(imageWrap);
      card.appendChild(content);
      grid.appendChild(card);
    });
  }

  openModal("modal-favorites-list");
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
    pill.setAttribute("data-size", size);
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

// Гранулярное обновление остатков Realtime без перезагрузки всей страницы
window.updateProductModalStockGranular = function(productId, location, size, newQty) {
  if (currentSelectedProduct && currentSelectedProduct.id === productId) {
    if (!currentSelectedProduct.stock[location]) {
      currentSelectedProduct.stock[location] = {};
    }
    currentSelectedProduct.stock[location][String(size)] = newQty;

    renderSizePills("bazaar", currentSelectedProduct.stock?.bazaar || {}, "bazaar-sizes-list", "bazaar-point-status");
    renderSizePills("mall", currentSelectedProduct.stock?.mall || {}, "mall-sizes-list", "mall-point-status");
  }
};

window.updateProductCardStockGranular = function(productId, location, size, newQty) {
  const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
  const item = getProductById(productId);
  if (item) {
    if (!item.stock[location]) item.stock[location] = {};
    item.stock[location][String(size)] = newQty;

    // Витрина не показывает техническую плашку «Под заказ»:
    // доступность клиент видит после открытия товара и выбора точки.
  }
};
