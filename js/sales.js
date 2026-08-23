// MADIYAR SHOES — модуль кассы, продаж и оффлайн-очереди (sales.js)

const OFFLINE_QUEUE_KEY = "shoe_store_offline_sales_queue";

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getOfflineQueue() {
  return safeGetJSON(OFFLINE_QUEUE_KEY, []);
}

function saveOfflineQueue(queue) {
  safeSetJSON(OFFLINE_QUEUE_KEY, queue);
}

function populateSaleProductsSelect() {
  if (!requireAdminAccess()) return;
  const searchInput = document.getElementById("sale-product-search");
  const hiddenInput = document.getElementById("sale-product-id");
  const dropdown = document.getElementById("sale-product-autocomplete-dropdown");
  if (!searchInput || !dropdown) return;

  if (searchInput.dataset.autocompleteInitialized === "true") return;
  searchInput.dataset.autocompleteInitialized = "true";

  function renderSuggestions(query) {
    dropdown.innerHTML = "";
    const filtered = products.filter(p => productMatchesQuery(p, query));

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
  if (bazaarBtn) bazaarBtn.addEventListener("click", () => setTimeout(updateSaleSizesSelect, 50));
  if (mallBtn) mallBtn.addEventListener("click", () => setTimeout(updateSaleSizesSelect, 50));

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

  // Оффлайн-перерасход: позволяем выбрать размер даже если 0
  if (!hasStock) {
    AVAILABLE_SIZES.forEach(size => {
      const opt = document.createElement("option");
      opt.value = size;
      opt.textContent = `${size} размер (⚠ Нет в наличии — оффлайн-перерасход)`;
      sizeSelect.appendChild(opt);
    });
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
      if (s.payment === "kaspi" || s.payment === "kaspi_qr") sumKaspi += sum;
      else if (s.payment === "red" || s.payment === "kaspi_red") sumRed += sum;
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
    if (s.payment === "red" || s.payment === "kaspi_red") payLabel = "Каспи Ред";
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

    // Добавляем плашку оффлайн-перерасхода
    if (s.overdraft_warning) {
      const overdraftBadge = document.createElement("span");
      overdraftBadge.style.cssText = "display:inline-block; margin-top:4px; padding:2px 6px; font-size:11px; background:#fff3cd; color:#856404; border:1px solid #ffeeba; border-radius:4px; font-weight:bold;";
      overdraftBadge.textContent = "⚠ Оффлайн-перерасход";
      tdProduct.appendChild(overdraftBadge);
    }

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

// Проведение продажи через Supabase RPC sell_product_item с fallback на Offline Queue
window.handleOfflineSaleSubmit = async function() {
  if (!requireAdminAccess()) return;
  const productId = document.getElementById("sale-product-id").value;
  const size = document.getElementById("sale-size-select").value;
  const point = getFormBtnGroupValue("sale-point-group") || "bazaar";
  const rawPayment = getFormBtnGroupValue("sale-payment-group") || "kaspi";

  if (!productId || !size) {
    showToast("Пожалуйста, выберите корректный товар по артикулу и доступный размер", "error");
    return;
  }

  const product = getProductById(productId);
  if (!product) return;

  const clientSaleId = generateUUID();
  let paymentMethod = "kaspi_qr";
  if (rawPayment === "red") paymentMethod = "kaspi_red";
  else if (rawPayment === "cash") paymentMethod = "cash";

  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  const isOnline = navigator.onLine && supabase;

  if (isOnline) {
    try {
      const { data, error } = await supabase.rpc('sell_product_item', {
        p_client_sale_id: clientSaleId,
        p_product_id: productId,
        p_location: point,
        p_size: parseInt(size, 10),
        p_payment_method: paymentMethod,
        p_is_offline: false,
        p_session_token: getStaffSessionToken()
      });

      if (error) {
        showToast(`Ошибка продажи: ${error.message}`, "error");
        return;
      }

      if (data && data.success) {
        // Обновляем локальный остаток
        if (!product.stock[point]) product.stock[point] = {};
        product.stock[point][size] = data.new_quantity;

        const newSale = {
          id: data.sale_id || clientSaleId,
          client_sale_id: clientSaleId,
          productId: product.id,
          article: product.article,
          brand: product.brand,
          name: product.name,
          price: product.price,
          point: point,
          size: size,
          payment: rawPayment,
          seller_name: sessionStorage.getItem("shoe_store_admin_name") || "Продавец",
          date: new Date().toISOString(),
          is_offline_synced: true,
          overdraft_warning: !!data.overdraft_warning
        };

        sales.unshift(newSale);
        window.db.saveSales(sales);
        window.db.saveProducts(products);
        window.db.logStockMovement(product.id, product.article, size, point, -1, "Кассовая продажа (RPC)", newSale.id);

        if (data.overdraft_warning) {
          showToast("⚠ Внимание: Оффлайн-перерасход! Данного размера не было на складе.", "warning");
        } else {
          showToast("Продажа успешно проведена!", "success");
        }

        resetSaleForm();
        return;
      }
    } catch (rpcErr) {
      console.warn("Ошибка подключения к RPC, переход на оффлайн-очередь:", rpcErr);
    }
  }

  // Оффлайн-режим: Сохраняем в OfflineSalesQueue
  const currentStock = product.stock?.[point]?.[size] || 0;
  const isOverdraft = currentStock <= 0;

  if (!product.stock[point]) product.stock[point] = {};
  product.stock[point][size] = currentStock - 1;

  const queueItem = {
    client_sale_id: clientSaleId,
    product_id: product.id,
    location: point,
    size: parseInt(size, 10),
    payment_method: paymentMethod,
    article: product.article,
    brand: product.brand,
    name: product.name,
    price: product.price,
    overdraft_warning: isOverdraft,
    created_at: new Date().toISOString()
  };

  const queue = getOfflineQueue();
  queue.push(queueItem);
  saveOfflineQueue(queue);

  const newOfflineSale = {
    id: clientSaleId,
    client_sale_id: clientSaleId,
    productId: product.id,
    article: product.article,
    brand: product.brand,
    name: product.name,
    price: product.price,
    point: point,
    size: size,
    payment: rawPayment,
    seller_name: sessionStorage.getItem("shoe_store_admin_name") || "Продавец",
    date: new Date().toISOString(),
    is_offline_synced: false,
    overdraft_warning: isOverdraft
  };

  sales.unshift(newOfflineSale);
  window.db.saveSales(sales);
  window.db.saveProducts(products);
  window.db.logStockMovement(product.id, product.article, size, point, -1, isOverdraft ? "Оффлайн-перерасход" : "Оффлайн-продажа", clientSaleId);

  if (isOverdraft) {
    showToast("⚠ Оффлайн-перерасход! Продажа сохранена оффлайн с предупреждением.", "warning");
  } else {
    showToast("Продажа сохранена в оффлайн-очередь. Синхронизируется при появлении сети.", "info");
  }

  resetSaleForm();
};

function resetSaleForm() {
  const searchInput = document.getElementById("sale-product-search");
  if (searchInput) searchInput.value = "";
  const hiddenInput = document.getElementById("sale-product-id");
  if (hiddenInput) hiddenInput.value = "";
  updateSaleSizesSelect();

  renderAdminSalesTable();
  renderAdminProductsTable();
  renderAdminDashboard();
  renderCatalog();
}

let isSyncingQueue = false;

// Автоматическая синхронизация оффлайн-очереди
async function syncOfflineSalesQueue() {
  if (isSyncingQueue) return;
  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (!navigator.onLine || !supabase) return;

  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  isSyncingQueue = true;
  console.log(`[OfflineQueue] Синхронизация ${queue.length} оффлайн-продаж...`);
  const remainingQueue = [];

  try {
    for (const item of queue) {
      try {
        const { data, error } = await supabase.rpc('sell_product_item', {
          p_client_sale_id: item.client_sale_id,
          p_product_id: item.product_id,
          p_location: item.location,
          p_size: item.size,
          p_payment_method: item.payment_method,
          p_is_offline: true,
          p_session_token: getStaffSessionToken()
        });

        if (error) {
          console.error(`[OfflineQueue] Ошибка синхронизации ${item.client_sale_id}:`, error);
          remainingQueue.push(item);
        } else {
          console.log(`[OfflineQueue] Продажа ${item.client_sale_id} успешно синхронизирована.`);
        }
      } catch (e) {
        remainingQueue.push(item);
      }
    }

    saveOfflineQueue(remainingQueue);
    if (queue.length > remainingQueue.length) {
      showToast(`Успешно синхронизировано оффлайн-продаж: ${queue.length - remainingQueue.length}`, "success");
      window.db.fetchProductsFromSupabase().then(() => {
        renderCatalog();
        renderAdminProductsTable();
        renderAdminSalesTable();
      });
    }
  } finally {
    isSyncingQueue = false;
  }
}

// Слушатель восстановившегося соединения
window.addEventListener("online", syncOfflineSalesQueue);

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
  window.db.logStockMovement(sale.productId, sale.article, sale.size, sale.point, 1, "Отмена продажи", sale.id);

  showToast("Продажа отменена, остаток возвращен на склад", "info");

  renderAdminSalesTable();
  renderAdminProductsTable();
  renderAdminDashboard();
  renderCatalog();
  updateSaleSizesSelect();
};
