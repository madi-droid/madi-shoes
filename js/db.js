// Инициализация базы данных и синхронизация с Supabase (db.js)

const DB_PRODUCTS_KEY = "shoe_store_products_v4";
const DB_ORDERS_KEY = "shoe_store_orders";
const DB_SALES_KEY = "shoe_store_sales";
const DB_USERS_KEY = "shoe_store_users";
const DB_CURRENT_USER_KEY = "shoe_store_current_user";
const DB_STOCK_MOVEMENTS_KEY = "shoe_store_stock_movements";

const DEFAULT_PRODUCTS = [
  {
    id: "p-1",
    article: "ET-2481",
    brand: "ETOR",
    name: "Челси Ferro",
    description: "Натуральная кожа, классическая колодка челси, осенняя коллекция.",
    price: 42900,
    image: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "осень",
    category: "ботинки",
    is_active: true,
    stock: {
      bazaar: { "40": 2, "41": 3, "42": 4, "43": 2 },
      mall: { "41": 1, "42": 2, "44": 1 }
    }
  },
  {
    id: "p-2",
    article: "NK-0071",
    brand: "NIKE",
    name: "Air Force 1 Low",
    description: "Культовые кроссовки белого цвета, натуральная кожа.",
    price: 58500,
    image: "https://images.unsplash.com/photo-1623788975845-7d3e0adbae7c?w=900&h=1100&fit=crop&auto=format",
    gender: "унисекс",
    season: "весна",
    category: "кроссовки",
    is_active: true,
    stock: {
      bazaar: { "39": 2, "40": 3, "41": 3, "42": 2, "43": 1, "44": 1 },
      mall: {}
    }
  },
  {
    id: "p-3",
    article: "BS-1140",
    brand: "BASCONI",
    name: "Лофер Velluto",
    description: "Летняя замша, мягкая стелька, итальянский фасон.",
    price: 36700,
    image: "https://images.unsplash.com/photo-1576792741377-eb0f4f6d1a47?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "лето",
    category: "лоферы",
    is_active: true,
    stock: {
      bazaar: { "41": 1, "42": 2 },
      mall: { "40": 2, "41": 2, "42": 3, "43": 1, "44": 1 }
    }
  },
  {
    id: "p-4",
    article: "RK-3309",
    brand: "RIEKER",
    name: "Сандалии Sole",
    description: "Женские легкие сандалии из мягкой кожи для летних прогулок.",
    price: 24300,
    image: "https://images.unsplash.com/photo-1613662632164-7f2b081a5b46?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "лето",
    category: "сандалии",
    is_active: true,
    stock: {
      bazaar: { "36": 3, "37": 4, "38": 3, "39": 2 },
      mall: { "36": 2, "38": 2 }
    }
  },
  {
    id: "p-5",
    article: "SL-7724",
    brand: "SALAMANDER",
    name: "Туфли Notte",
    description: "Элегантные классические туфли, натуральная гладкая кожа.",
    price: 51200,
    image: "https://images.unsplash.com/photo-1553545985-1e0d8781d5db?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "осень",
    category: "туфли",
    is_active: true,
    stock: {
      bazaar: {},
      mall: { "36": 1, "37": 3, "38": 3, "39": 2, "40": 1 }
    }
  },
  {
    id: "p-6",
    article: "ET-2502",
    brand: "ETOR",
    name: "Оксфорд Bruno",
    description: "Классические оксфорды с закрытой шнуровкой, зимняя подкладка.",
    price: 47800,
    image: "https://images.unsplash.com/photo-1760616172899-0681b97a2de3?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "зима",
    category: "туфли",
    is_active: true,
    stock: {
      bazaar: { "40": 2, "41": 2, "42": 3, "43": 1 },
      mall: { "42": 2, "43": 2, "44": 3, "45": 1 }
    }
  },
  {
    id: "p-7",
    article: "CR-0118",
    brand: "CROCS",
    name: "Classic Clog",
    description: "Классические сабо Crocs с амортизацией Croslite.",
    price: 18900,
    image: "https://images.unsplash.com/photo-1614634717465-eb3d6bc8d930?w=900&h=1100&fit=crop&auto=format",
    gender: "унисекс",
    season: "лето",
    category: "кроксы",
    is_active: true,
    stock: {
      bazaar: { "36": 4, "37": 5, "38": 4, "39": 3, "40": 2 },
      mall: { "37": 2, "38": 3 }
    }
  },
  {
    id: "p-8",
    article: "MS-6613",
    brand: "MASCOTTE",
    name: "Мокасины Suede",
    description: "Мужские мокасины из натуральной замши премиум выделки.",
    price: 33400,
    image: "https://images.unsplash.com/photo-1616406432452-07bc5938759d?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "весна",
    category: "мокасины",
    is_active: true,
    stock: {
      bazaar: { "41": 2, "42": 3, "43": 2, "44": 1 },
      mall: { "40": 1, "44": 2, "45": 1 }
    }
  },
  {
    id: "p-9",
    article: "TB-4400",
    brand: "TIMBERLAND",
    name: "Premium 6-Inch",
    description: "Легендарные жёлтые ботинки Timberland с водонепроницаемой мембраной.",
    price: 89600,
    image: "https://images.unsplash.com/photo-1706587161985-abec97ad6af8?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "зима",
    category: "ботинки",
    is_active: true,
    stock: {
      bazaar: { "42": 1, "43": 2, "44": 1 },
      mall: { "40": 1, "41": 2, "42": 3, "43": 3, "44": 2, "45": 1 }
    }
  },
  {
    id: "p-10",
    article: "AD-0982",
    brand: "ADIDAS",
    name: "Samba OG",
    description: "Ретро-кроссовки из замши и кожи, классика городского стиля.",
    price: 62400,
    image: "https://images.unsplash.com/photo-1727705723856-b44b14612e93?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "весна",
    category: "кроссовки",
    is_active: true,
    stock: {
      bazaar: { "36": 2, "37": 3, "38": 2 },
      mall: { "36": 1, "37": 4, "38": 4, "39": 2, "40": 1 }
    }
  },
  {
    id: "p-11",
    article: "BD-5217",
    brand: "BADEN",
    name: "Лофер Cardo",
    description: "Женские лоферы из текстурной кожи с золотистой пряжкой.",
    price: 29800,
    image: "https://images.unsplash.com/photo-1777987601447-266e128de448?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "осень",
    category: "лоферы",
    is_active: true,
    stock: {
      bazaar: { "37": 2, "38": 3, "39": 2, "40": 1 },
      mall: {}
    }
  },
  {
    id: "p-12",
    article: "EC-8830",
    brand: "ECCO",
    name: "Ботинок Nordfjord",
    description: "Утепленные зимние ботинки ECCO с анатомической подошвой FLUIDFORM.",
    price: 74100,
    image: "https://images.unsplash.com/photo-1520718458542-6208153eb61a?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "зима",
    category: "ботинки",
    is_active: true,
    stock: {
      bazaar: { "41": 1, "42": 2, "43": 2, "45": 1 },
      mall: { "42": 1, "44": 2, "45": 2 }
    }
  },
  {
    id: "p-13",
    article: "ET-2560",
    brand: "ETOR",
    name: "Дерби Corso",
    description: "Мужские туфли дерби из вощеной кожи от турецкого бренда Etor.",
    price: 39900,
    image: "https://images.unsplash.com/photo-1708515792135-09a95d8e9119?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "осень",
    category: "туфли",
    is_active: true,
    stock: {
      bazaar: { "40": 1, "41": 3, "42": 2 },
      mall: { "41": 2, "42": 2, "43": 2, "44": 1 }
    }
  },
  {
    id: "p-14",
    article: "GS-2077",
    brand: "GUESS",
    name: "Босоножки Perla",
    description: "Женские летние босоножки на изящном каблуке.",
    price: 55300,
    image: "https://images.unsplash.com/photo-1554238113-6d3dbed5cf55?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "лето",
    category: "сандалии",
    is_active: true,
    stock: {
      bazaar: { "36": 2, "37": 2 },
      mall: { "36": 3, "37": 3, "38": 2, "39": 1 }
    }
  },
  {
    id: "p-15",
    article: "NB-9060",
    brand: "NEW BALANCE",
    name: "9060 Sea Salt",
    description: "Футуристичные кроссовки New Balance с амортизацией ABZORB.",
    price: 71800,
    image: "https://images.unsplash.com/photo-1672920800748-a5fb6dfd0c2b?w=900&h=1100&fit=crop&auto=format",
    gender: "унисекс",
    season: "весна",
    category: "кроссовки",
    is_active: true,
    stock: {
      bazaar: { "37": 2, "38": 2, "39": 3 },
      mall: { "36": 1, "37": 2, "38": 3, "39": 2, "40": 2, "41": 1 }
    }
  },
  {
    id: "p-16",
    article: "NK-0164",
    brand: "NIKE",
    name: "Air Max Plus",
    description: "Мужские спортивные кроссовки с системой Tuned Air.",
    price: 79400,
    image: "https://images.unsplash.com/photo-1727705723856-b44b14612e93?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "лето",
    category: "кроссовки",
    is_active: true,
    stock: {
      bazaar: { "41": 2, "42": 3, "43": 2, "44": 2 },
      mall: { "40": 1, "41": 1, "42": 2 }
    }
  },
  {
    id: "p-17",
    article: "ET-2610",
    brand: "ETOR",
    name: "Челси Montana",
    description: "Утепленные мужские ботинки из натуральной кожи, зимняя коллекция Etor.",
    price: 49500,
    image: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "зима",
    category: "ботинки",
    is_active: true,
    stock: {
      bazaar: { "40": 3, "41": 4, "42": 3 },
      mall: { "41": 2, "42": 3, "43": 1 }
    }
  },
  {
    id: "p-18",
    article: "PM-1020",
    brand: "PUMA",
    name: "Palermo Special",
    description: "Ретро-кеды из замши премиум выделки с золотистым логотипом Puma.",
    price: 38900,
    image: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=900&h=1100&fit=crop&auto=format",
    gender: "унисекс",
    season: "весна",
    category: "кеды",
    is_active: true,
    stock: {
      bazaar: { "37": 3, "38": 4, "39": 2 },
      mall: { "36": 2, "37": 3, "38": 3, "39": 1 }
    }
  },
  {
    id: "p-19",
    article: "CN-7080",
    brand: "CONVERSE",
    name: "Chuck 70 Vintage",
    description: "Культовые кеды Converse из плотного канваса с амортизирующей стелькой OrthoLite.",
    price: 32500,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=900&h=1100&fit=crop&auto=format",
    gender: "унисекс",
    season: "лето",
    category: "кеды",
    is_active: true,
    stock: {
      bazaar: { "38": 2, "39": 3, "40": 4, "41": 2 },
      mall: { "37": 2, "38": 3, "40": 2 }
    }
  },
  {
    id: "p-20",
    article: "SL-9910",
    brand: "SALAMANDER",
    name: "Сапоги Вены",
    description: "Женские зимние сапоги из натуральной гладкой кожи на меху.",
    price: 68400,
    image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "зима",
    category: "сапоги",
    is_active: true,
    stock: {
      bazaar: { "36": 2, "37": 3, "38": 2 },
      mall: { "37": 2, "38": 3, "39": 1 }
    }
  },
  {
    id: "p-21",
    article: "VG-4030",
    brand: "VAGABOND",
    name: "Лофер Cosmo",
    description: "Шведские массивные лоферы на подметке из полиуретана.",
    price: 44000,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "весна",
    category: "лоферы",
    is_active: true,
    stock: {
      bazaar: { "36": 2, "37": 4, "38": 3 },
      mall: { "37": 2, "38": 2, "39": 2 }
    }
  },
  {
    id: "p-22",
    article: "AS-1400",
    brand: "ASICS",
    name: "GEL-Kayano 14",
    description: "Беговые ретро-кроссовки ASICS с гелевой амортизацией GEL.",
    price: 69900,
    image: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=900&h=1100&fit=crop&auto=format",
    gender: "унисекс",
    season: "весна",
    category: "кроссовки",
    is_active: true,
    stock: {
      bazaar: { "40": 2, "41": 3, "42": 4 },
      mall: { "41": 2, "42": 3, "43": 2 }
    }
  },
  {
    id: "p-23",
    article: "ET-3100",
    brand: "ETOR",
    name: "Броги Oxford Elite",
    description: "Элитная мужская обувь из телячьей кожи с перфорацией брогирования.",
    price: 52000,
    image: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "осень",
    category: "туфли",
    is_active: true,
    stock: {
      bazaar: { "40": 1, "41": 3, "42": 3 },
      mall: { "41": 2, "42": 4, "43": 2 }
    }
  },
  {
    id: "p-24",
    article: "RK-8812",
    brand: "RIEKER",
    name: "Ботинки Anti-Stress",
    description: "Немецкие легкие ботинки с гибкой подошвой и комфортной колодкой.",
    price: 37600,
    image: "https://images.unsplash.com/photo-1520718458542-6208153eb61a?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "осень",
    category: "ботинки",
    is_active: true,
    stock: {
      bazaar: { "36": 3, "37": 3, "38": 2 },
      mall: { "37": 2, "38": 4, "39": 2 }
    }
  },
  {
    id: "p-25",
    article: "DM-1460",
    brand: "DR. MARTENS",
    name: "1460 Smooth",
    description: "Культовые 8-дырочные ботинки Dr. Martens с желтой прошивкой ранта.",
    price: 84500,
    image: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=900&h=1100&fit=crop&auto=format",
    gender: "унисекс",
    season: "осень",
    category: "ботинки",
    is_active: true,
    stock: {
      bazaar: { "38": 2, "39": 3, "40": 3 },
      mall: { "39": 1, "40": 2, "41": 3 }
    }
  },
  {
    id: "p-26",
    article: "BS-2040",
    brand: "BIRKENSTOCK",
    name: "Arizona Oiled",
    description: "Ортопедические сандалии Birkenstock из натуральной промасленной кожи.",
    price: 41200,
    image: "https://images.unsplash.com/photo-1613662632164-7f2b081a5b46?w=900&h=1100&fit=crop&auto=format",
    gender: "унисекс",
    season: "лето",
    category: "сандалии",
    is_active: true,
    stock: {
      bazaar: { "37": 2, "38": 3, "39": 3 },
      mall: { "38": 2, "39": 4, "40": 2 }
    }
  },
  {
    id: "p-27",
    article: "UG-2022",
    brand: "UGG",
    name: "Classic Short II",
    description: "Австралийские угги из натуральной овчины с обработкой от воды и грязи.",
    price: 65000,
    image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "зима",
    category: "сапоги",
    is_active: true,
    stock: {
      bazaar: { "36": 2, "37": 4, "38": 3 },
      mall: { "36": 1, "37": 3, "38": 2 }
    }
  },
  {
    id: "p-28",
    article: "BL-9940",
    brand: "BALDININI",
    name: "Туфли Royale",
    description: "Премиальные итальянские лодочки из замши с ювелирной фурнитурой.",
    price: 115000,
    image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=900&h=1100&fit=crop&auto=format",
    gender: "женский",
    season: "лето",
    category: "туфли",
    is_active: true,
    stock: {
      bazaar: { "36": 1, "37": 2 },
      mall: { "37": 2, "38": 2 }
    }
  },
  {
    id: "p-29",
    article: "GX-3050",
    brand: "GEOX",
    name: "Слипоны Respira",
    description: "Дышащая мембранная обувь Geox из мягкой перфорированной кожи.",
    price: 35800,
    image: "https://images.unsplash.com/photo-1616406432452-07bc5938759d?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "весна",
    category: "мокасины",
    is_active: true,
    stock: {
      bazaar: { "40": 2, "41": 3, "42": 4 },
      mall: { "41": 2, "42": 2, "43": 3 }
    }
  },
  {
    id: "p-30",
    article: "NK-5500",
    brand: "NIKE",
    name: "Dunk Low Retro",
    description: "Баскетбольные ретро-кроссовки Nike из контрастной кожи.",
    price: 56000,
    image: "https://images.unsplash.com/photo-1623788975845-7d3e0adbae7c?w=900&h=1100&fit=crop&auto=format",
    gender: "унисекс",
    season: "лето",
    category: "кроссовки",
    is_active: true,
    stock: {
      bazaar: { "38": 2, "39": 3, "40": 4 },
      mall: { "39": 2, "40": 3, "41": 2 }
    }
  },
  {
    id: "p-31",
    article: "CL-1950",
    brand: "CLARKS",
    name: "Desert Boot",
    description: "Английские культовые ботинки дезерты из замши на креповой подошве.",
    price: 48500,
    image: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "осень",
    category: "ботинки",
    is_active: true,
    stock: {
      bazaar: { "40": 2, "41": 3, "42": 3 },
      mall: { "41": 2, "42": 2, "43": 1 }
    }
  },
  {
    id: "p-32",
    article: "LC-2010",
    brand: "LACOSTE",
    name: "Кеды Carnaby",
    description: "Белые минималистичные кеды Lacoste с фирменной вышивкой крокодила.",
    price: 43700,
    image: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=900&h=1100&fit=crop&auto=format",
    gender: "мужской",
    season: "весна",
    category: "кеды",
    is_active: true,
    stock: {
      bazaar: { "40": 2, "41": 4, "42": 3 },
      mall: { "41": 2, "42": 3, "43": 2 }
    }
  }
];

// --- Чтение и сохранение товаров ---
function loadProducts() {
  const cached = safeGetJSON(DB_PRODUCTS_KEY);
  if (cached && Array.isArray(cached) && cached.length >= 16 && cached.some(p => p.article === "ET-2481" && p.brand === "ETOR")) {
    return cached;
  }
  
  safeSetJSON(DB_PRODUCTS_KEY, DEFAULT_PRODUCTS);
  return DEFAULT_PRODUCTS;
}

function saveProducts(productsList) {
  safeSetJSON(DB_PRODUCTS_KEY, productsList);
  if (typeof updateProductMap === "function") {
    updateProductMap();
  }
  if (typeof window.notifyStateChanged === "function") {
    window.notifyStateChanged("STOCK_UPDATED", { count: productsList ? productsList.length : 0 });
  }
}

// Загрузка товаров из Supabase с фоновым обновлением localCache
async function fetchProductsFromSupabase() {
  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (!supabase) return loadProducts();

  try {
    const { data: prodRows, error: prodErr } = await supabase
      .from('products')
      .select('*, product_stock(*)')
      .eq('is_active', true);

    if (prodErr || !prodRows || prodRows.length === 0) {
      return loadProducts();
    }

    const transformedProducts = prodRows.map(p => {
      const stock = { bazaar: {}, mall: {} };
      if (Array.isArray(p.product_stock)) {
        p.product_stock.forEach(st => {
          const loc = st.location === 'mall' ? 'mall' : 'bazaar';
          stock[loc][String(st.size)] = st.quantity;
        });
      }

      return {
        id: p.id,
        article: p.article,
        brand: p.brand,
        name: p.name,
        description: p.description || "",
        price: p.price,
        image: p.image_url || FALLBACK_PRODUCT_IMAGE,
        gender: p.gender,
        season: p.season,
        category: p.category,
        is_active: p.is_active,
        stock: stock
      };
    });

    saveProducts(transformedProducts);
    return transformedProducts;
  } catch (err) {
    console.error("Ошибка сети при запросе к Supabase:", err);
    return loadProducts();
  }
}

// --- Чтение и сохранение заказов / бронирований ---
function loadOrders() {
  return safeGetJSON(DB_ORDERS_KEY, []);
}

function saveOrders(ordersList) {
  safeSetJSON(DB_ORDERS_KEY, ordersList);
}

// Загрузка заявок из Supabase `reservations`
async function fetchOrdersFromSupabase() {
  const localOrders = loadOrders();
  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (!supabase) return localOrders;

  try {
    const sessionToken = typeof getStaffSessionToken === "function" ? getStaffSessionToken() : "";
    if (!sessionToken) return localOrders;
    const { data: resRows, error: resErr } = await supabase.rpc('list_staff_reservations', {
      p_session_token: sessionToken
    });

    if (resErr || !resRows) {
      return localOrders;
    }

    const sbOrders = resRows.map(r => ({
      id: r.id || ("RES-" + r.created_at),
      userPhone: r.customer_phone || "",
      userName: r.customer_name || "Покупатель",
      productId: r.product_id || "",
      productName: r.name || "Модель",
      productArticle: r.article || "—",
      size: String(r.size || ""),
      location: r.preferred_location || "bazaar",
      price: 0,
      type: r.request_type === 'kaspi_manual_payment' ? 'Kaspi' : 'Бронь',
      kaspiPhone: r.comment || '',
      status: r.status || "new",
      date: r.created_at || new Date().toISOString()
    }));

    // Объединение без затирания локальных заявок
    const mergedMap = new Map();
    localOrders.forEach(o => { if (o && o.id) mergedMap.set(o.id, o); });
    sbOrders.forEach(o => { if (o && o.id) mergedMap.set(o.id, o); });

    const mergedOrders = Array.from(mergedMap.values());
    mergedOrders.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    saveOrders(mergedOrders);
    return mergedOrders;
  } catch (err) {
    console.warn("Ошибка загрузки заявок из Supabase:", err);
    return localOrders;
  }
}

// --- Чтение и сохранение кассовых продаж ---
function loadSales() {
  return safeGetJSON(DB_SALES_KEY, []);
}

function saveSales(salesList) {
  safeSetJSON(DB_SALES_KEY, salesList);
}

async function fetchSalesFromSupabase() {
  const supabase = window.AppConfig ? window.AppConfig.getSupabaseClient() : null;
  if (!supabase) return loadSales();

  try {
    const sessionToken = typeof getStaffSessionToken === "function" ? getStaffSessionToken() : "";
    if (!sessionToken) return loadSales();
    const { data: salesRows, error: salesErr } = await supabase.rpc('list_staff_sales', {
      p_session_token: sessionToken
    });

    if (salesErr || !salesRows) {
      return loadSales();
    }

    const transformedSales = salesRows.map(s => ({
      id: s.id,
      client_sale_id: s.client_sale_id,
      productId: s.product_id,
      article: s.article,
      brand: s.brand,
      name: s.name,
      price: s.price,
      point: s.location,
      size: String(s.size),
      payment: s.payment_method === 'kaspi_qr' ? 'kaspi' : (s.payment_method === 'kaspi_red' ? 'red' : 'cash'),
      seller_name: s.seller_name,
      date: s.created_at,
      overdraft_warning: s.overdraft_warning,
      is_offline_synced: s.is_offline_synced
    }));

    saveSales(transformedSales);
    return transformedSales;
  } catch (err) {
    console.warn("Ошибка загрузки продаж из Supabase:", err);
    return loadSales();
  }
}

// --- Управление пользователями и сессией ---
function loadUsers() {
  return safeGetJSON(DB_USERS_KEY, []);
}

function saveUsers(usersList) {
  safeSetJSON(DB_USERS_KEY, usersList);
}

function getCurrentUser() {
  return safeGetJSON(DB_CURRENT_USER_KEY, null);
}

function setCurrentUser(userObj) {
  if (!userObj) {
    localStorage.removeItem(DB_CURRENT_USER_KEY);
  } else {
    safeSetJSON(DB_CURRENT_USER_KEY, userObj);
  }
}

// --- Лог движений остатков ---
function loadStockMovements() {
  return safeGetJSON(DB_STOCK_MOVEMENTS_KEY, []);
}

function logStockMovement(productId, article, size, location, change, reason, relatedId = null) {
  const movements = loadStockMovements();
  const newLog = {
    id: "SM-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    productId,
    article,
    size: String(size),
    location,
    delta: Number(change),
    reason,
    relatedId,
    date: new Date().toISOString()
  };
  movements.unshift(newLog);
  safeSetJSON(DB_STOCK_MOVEMENTS_KEY, movements.slice(0, 500));
}

// --- Сброс / Экспорт / Импорт ---
function resetDatabase() {
  localStorage.removeItem(DB_PRODUCTS_KEY);
  localStorage.removeItem(DB_ORDERS_KEY);
  localStorage.removeItem(DB_SALES_KEY);
  localStorage.removeItem(DB_STOCK_MOVEMENTS_KEY);
  return loadProducts();
}

function exportDatabase() {
  return JSON.stringify({
    products: loadProducts(),
    orders: loadOrders(),
    sales: loadSales(),
    users: loadUsers(),
    stockMovements: loadStockMovements(),
    version: "2.0",
    exportedAt: new Date().toISOString()
  }, null, 2);
}

function importDatabase(jsonString) {
  try {
    const dbData = JSON.parse(jsonString);
    if (dbData.products && Array.isArray(dbData.products)) {
      saveProducts(dbData.products);
    }
    if (dbData.orders && Array.isArray(dbData.orders)) {
      saveOrders(dbData.orders);
    }
    if (dbData.sales && Array.isArray(dbData.sales)) {
      saveSales(dbData.sales);
    }
    return true;
  } catch (e) {
    console.error("Ошибка при импорте базы данных:", e);
    return false;
  }
}

window.db = {
  loadProducts,
  saveProducts,
  fetchProductsFromSupabase,
  loadOrders,
  saveOrders,
  fetchOrdersFromSupabase,
  loadUsers,
  saveUsers,
  getCurrentUser,
  setCurrentUser,
  resetDatabase,
  exportDatabase,
  importDatabase,
  loadSales,
  saveSales,
  fetchSalesFromSupabase,
  logStockMovement,
  loadStockMovements
};
