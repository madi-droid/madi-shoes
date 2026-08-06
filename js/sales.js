// MADIYAR SHOES — модуль оффлайн-продаж и кассового учета (sales.js)

function populateSaleProductsSelect() {
  if (!requireAdminAccess()) return;
  const searchInput = document.getElementById("sale-product-search");
  const hiddenInput = document.getElementById("sale-product-id");
  const dropdown = document.getElementById("sale-product-autocomplete-dropdown");
  if (!searchInput || !dropdown) return;

  function renderSuggestions(query) {
    dropdown.innerHTML = "";

    const filtered = products.filter(p => {
      if (!query) return true;
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

  searchInput.addEventListener("input", (e) => {
    hiddenInput.value = "";
    updateSaleSizesSelect();
    renderSuggestions(e.target.value.trim());
  });

  searchInput.addEventListener("focus", () => {
    renderSuggestions(searchInput.value.trim());
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add("d-none");
    }
  });

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

  const p = getProductById(productId);
  if (!p) return;

  const point = getFormBtnGroupValue("sale-point-group") || "bazaar";
  const stock = p.stock?.[point] || {};

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

function renderAdminSalesTable() {
  if (!requireAdminAccess()) return;
  const tbody = document.getElementById("offline-sales-list");
  if (!tbody) return;
  tbody.innerHTML = "";

  sales = window.db.loadSales();

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

  filteredSalesForTable.sort((a, b) => new Date(b.date) - new Date(a.date));

  filteredSalesForTable.forEach(s => {
    const sum = Number(s.price) || 0;
    const dateObj = new Date(s.date);
    const dateStr = dateObj.toLocaleDateString("ru-RU") + " " + dateObj.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });

    const pointLabel = s.point === "bazaar" ? "Базар" : "ТЦ";
    let payLabel = "Каспи QR";
    if (s.payment === "red") payLabel = "Каспи Ред";
    else if (s.payment === "cash") payLabel = "Наличные";

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

  const product = getProductById(productId);
  if (!product) return;

  if (product.stock?.[point] && product.stock[point][size] > 0) {
    product.stock[point][size]--;
  } else {
    showToast("Этого размера уже нет в наличии на выбранной точке!", "error");
    return;
  }

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

  const searchInput = document.getElementById("sale-product-search");
  if (searchInput) searchInput.value = "";
  const hiddenInput = document.getElementById("sale-product-id");
  if (hiddenInput) hiddenInput.value = "";
  updateSaleSizesSelect();

  renderAdminSalesTable();
  renderAdminProductsTable();
  renderAdminDashboard();
  renderCatalog();
};

window.deleteOfflineSaleById = function(saleId) {
  if (!requireAdminAccess()) return;
  if (!confirm("Вы действительно хотите отменить эту операцию продажи? Остаток вернется на склад.")) return;

  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;

  const product = getProductById(sale.productId);
  if (product) {
    if (!product.stock[sale.point]) product.stock[sale.point] = {};
    if (!product.stock[sale.point][sale.size]) product.stock[sale.point][sale.size] = 0;
    product.stock[sale.point][sale.size]++;
  }

  sales = sales.filter(s => s.id !== saleId);
  window.db.saveSales(sales);
  window.db.saveProducts(products);

  showToast("Продажа отменена, остаток возвращен на склад", "info");

  renderAdminSalesTable();
  renderAdminProductsTable();
  renderAdminDashboard();
  renderCatalog();
  populateSaleProductsSelect();
};
