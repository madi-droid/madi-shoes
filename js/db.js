// Инициализация базы данных и вспомогательные функции для работы с ней (db.js)




const DEFAULT_PRODUCTS = [
  {
    id: "1",
    article: "ET-204-W",
    brand: "Etor",
    name: "Белые кожаные кроссовки",
    description: "Стильные повседневные кроссовки из натуральной кожи от бренда Etor. Мягкая подошва обеспечивает комфорт при длительной ходьбе, а классический дизайн подходит под любой гардероб.",
    price: 28000,
    image: "assets/images/etor_white_sneaker.png",
    gender: "мужской",
    season: "весна",
    category: "кроссовки",
    stock: {
      bazaar: { "40": 3, "42": 5, "44": 2 },
      mall: { "41": 4, "45": 3 }
    }
  },
  {
    id: "2",
    article: "NK-RUN-77",
    brand: "SportPro",
    name: "Черные спортивные кроссовки",
    description: "Легкие беговые кроссовки с амортизирующей подошвой. Отличная вентиляция благодаря сетчатому верху. Идеальны как для тренировок, так и для активного отдыха.",
    price: 32000,
    image: "assets/images/sport_black_sneaker.png",
    gender: "унисекс",
    season: "лето",
    category: "кроссовки",
    stock: {
      bazaar: { "39": 2, "40": 4, "41": 5, "42": 3 },
      mall: { "42": 4, "43": 6, "44": 3, "45": 2 }
    }
  },
  {
    id: "3",
    article: "CL-DERBY-09",
    brand: "Classic Style",
    name: "Кожаные туфли Дерби",
    description: "Элегантные классические туфли дерби из премиальной коричневой кожи. Идеально дополнят деловой костюм или образ в стиле smart-casual.",
    price: 45000,
    image: "assets/images/classic_brown_shoe.png",
    gender: "мужской",
    season: "осень",
    category: "туфли",
    stock: {
      bazaar: { "42": 2, "43": 1 },
      mall: { "40": 3, "41": 4, "42": 3, "43": 3, "44": 2 }
    }
  },
  {
    id: "4",
    article: "WT-BOOTS-02",
    brand: "Nordic",
    name: "Зимние кожаные сапоги",
    description: "Теплые высокие сапоги из натуральной кожи с подкладкой из натурального меха. Надежная подошва защитит от скольжения и любых холодов.",
    price: 38000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    gender: "женский",
    season: "зима",
    category: "сапоги",
    stock: {
      bazaar: { "37": 2, "38": 4, "39": 2 },
      mall: { "38": 3, "40": 1 }
    }
  },
  {
    id: "5",
    article: "CR-CLASSIC-01",
    brand: "Crocs",
    name: "Летние сабо Кроксы",
    description: "Легкие и практичные кроксы для отдыха, бассейна или пляжа. Мягкий полимер Croslite обеспечивает непревзойденный комфорт на весь день.",
    price: 15000,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&q=80",
    gender: "унисекс",
    season: "лето",
    category: "кроксы",
    stock: {
      bazaar: { "40": 5, "41": 3, "42": 4 },
      mall: { "41": 3, "43": 2 }
    }
  },
  {
    id: "6",
    article: "NK-AIR-90",
    brand: "Nike",
    name: "Кроссовки Nike Air Max 90",
    description: "Культовые кроссовки Nike Air Max с видимой амортизирующей вставкой. Идеальное сочетание комфорта, стиля и спортивного наследия.",
    price: 42000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    gender: "мужской",
    season: "весна, осень",
    category: "кроссовки",
    stock: {
      bazaar: { "40": 4, "41": 5, "42": 4, "43": 2 },
      mall: { "42": 3, "43": 4, "44": 2 }
    }
  },
  {
    id: "7",
    article: "AD-ST-05",
    brand: "Adidas",
    name: "Кроссовки Adidas Stan Smith",
    description: "Легендарные теннисные кеды Adidas с минималистичным силуэтом. Натуральная мягкая кожа и фирменный логотип на язычке.",
    price: 35000,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80",
    gender: "унисекс",
    season: "весна, лето",
    category: "кроссовки",
    stock: {
      bazaar: { "38": 2, "39": 3, "40": 4, "41": 3 },
      mall: { "39": 3, "40": 5, "41": 4, "42": 2 }
    }
  },
  {
    id: "8",
    article: "FS-SLIP-12",
    brand: "Fast Step",
    name: "Кожаные шлепанцы Fast Step",
    description: "Удобные мужские шлепанцы из натуральной мягкой кожи. Отличный выбор для жарких летних дней и повседневной носки.",
    price: 18000,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&q=80",
    gender: "мужской",
    season: "лето",
    category: "шлепанцы",
    stock: {
      bazaar: { "40": 5, "41": 6, "42": 4, "43": 3 },
      mall: { "41": 4, "42": 5, "43": 4 }
    }
  },
  {
    id: "9",
    article: "PU-RSX-02",
    brand: "Puma",
    name: "Спортивные кроссовки Puma RS-X",
    description: "Массивные и стильные кроссовки Puma с ярким футуристичным дизайном. Амортизирующая стелька обеспечивает легкий и пружинистый шаг.",
    price: 39000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    gender: "мужской",
    season: "весна, осень",
    category: "кроссовки",
    stock: {
      bazaar: { "41": 2, "42": 4, "43": 3 },
      mall: { "42": 3, "43": 5, "44": 2 }
    }
  },
  {
    id: "10",
    article: "CL-LOAF-22",
    brand: "Classic Style",
    name: "Замшевые лоферы",
    description: "Стильные лоферы из натуральной итальянской замши. Легкие, мягкие и дышащие, подходят для прохладных летних вечеров и осени.",
    price: 31000,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80",
    gender: "мужской",
    season: "весна, лето",
    category: "лоферы",
    stock: {
      bazaar: { "40": 2, "41": 3, "42": 4 },
      mall: { "41": 3, "42": 3, "43": 2 }
    }
  },
  {
    id: "11",
    article: "WT-BOOTS-08",
    brand: "Nordic",
    name: "Женские полусапожки на меху",
    description: "Комфортные женские полусапожки с толстой нескользящей подошвой. Внутри теплая шерстяная подкладка для сильных морозов.",
    price: 34000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    gender: "женский",
    season: "зима",
    category: "сапоги",
    stock: {
      bazaar: { "36": 2, "37": 3, "38": 4, "39": 2 },
      mall: { "37": 3, "38": 3, "39": 4 }
    }
  },
  {
    id: "12",
    article: "ET-MOCC-15",
    brand: "Etor",
    name: "Кожаные мокасины Etor",
    description: "Мягкие классические мокасины из тонкой натуральной кожи. Перфорация обеспечивает отличную вентиляцию летом.",
    price: 26000,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80",
    gender: "мужской",
    season: "лето",
    category: "мокасины",
    stock: {
      bazaar: { "40": 4, "41": 5, "42": 3 },
      mall: { "41": 3, "42": 4, "43": 2 }
    }
  },
  {
    id: "13",
    article: "AD-YZ-350",
    brand: "Adidas",
    name: "Летние кроссовки Yeezy Boost",
    description: "Трендовые легкие кроссовки из дышащего текстиля Primeknit. Подошва Boost создает максимальный уровень комфорта при ходьбе.",
    price: 55000,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&q=80",
    gender: "унисекс",
    season: "лето",
    category: "кроссовки",
    stock: {
      bazaar: { "38": 2, "39": 4, "40": 5, "41": 3 },
      mall: { "40": 4, "41": 5, "42": 3, "43": 2 }
    }
  },
  {
    id: "14",
    article: "FS-SLIP-14",
    brand: "Fast Step",
    name: "Шлепки Fast Step (Серые)",
    description: "Удобные пляжные шлепанцы серого цвета от бренда Fast Step. Водостойкие материалы и ортопедическая стелька.",
    price: 18000,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&q=80",
    gender: "мужской",
    season: "лето",
    category: "шлепанцы",
    stock: {
      bazaar: { "40": 3, "41": 4, "42": 4 },
      mall: { "41": 3, "42": 4, "43": 3 }
    }
  },
  {
    id: "15",
    article: "ET-OXF-88",
    brand: "Etor",
    name: "Классические оксфорды Etor",
    description: "Официальные мужские оксфорды из полированной черной кожи. Прекрасно сочетаются со строгими костюмами и вечерней одеждой.",
    price: 48000,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80",
    gender: "мужской",
    season: "весна, осень",
    category: "туфли",
    stock: {
      bazaar: { "41": 2, "42": 3, "43": 1 },
      mall: { "40": 2, "41": 4, "42": 4, "43": 2 }
    }
  },
  {
    id: "16",
    article: "NK-AF1-01",
    brand: "Nike",
    name: "Кроссовки Nike Air Force 1",
    description: "Классические белые кроссовки Air Force 1. Прочная резиновая подошва со скрытой воздушной подушкой Air.",
    price: 38000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    gender: "унисекс",
    season: "весна, осень",
    category: "кроссовки",
    stock: {
      bazaar: { "37": 3, "38": 4, "39": 5, "40": 4 },
      mall: { "39": 4, "40": 6, "41": 5, "42": 3 }
    }
  },
  {
    id: "17",
    article: "PU-SUEDE-04",
    brand: "Puma",
    name: "Кеды Puma Suede",
    description: "Знаменитые замшевые кеды Puma с контрастной боковой полосой. Икона уличного стиля и хип-хоп культуры.",
    price: 29000,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80",
    gender: "унисекс",
    season: "весна, лето",
    category: "кеды",
    stock: {
      bazaar: { "38": 2, "39": 3, "40": 4, "41": 3 },
      mall: { "39": 3, "40": 4, "41": 3, "42": 2 }
    }
  },
  {
    id: "18",
    article: "WT-BOOTS-09",
    brand: "Nordic",
    name: "Зимние ботинки Timber",
    description: "Водонепроницаемые нубуковые ботинки рыжего цвета. Идеально защищают от грязи, слякоти, снега и мороза.",
    price: 41000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    gender: "мужской",
    season: "зима",
    category: "ботинки",
    stock: {
      bazaar: { "41": 3, "42": 4, "43": 2 },
      mall: { "42": 4, "43": 3, "44": 2 }
    }
  },
  {
    id: "19",
    article: "CL-CHEL-03",
    brand: "Classic Style",
    name: "Осенние ботинки Челси",
    description: "Элегантные ботинки челси с эластичными боковыми вставками. Изготовлены из высококачественной черной кожи.",
    price: 37000,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80",
    gender: "мужской",
    season: "осень",
    category: "ботинки",
    stock: {
      bazaar: { "40": 2, "41": 3, "42": 3 },
      mall: { "41": 4, "42": 4, "43": 2 }
    }
  },
  {
    id: "20",
    article: "CR-CLASSIC-02",
    brand: "Crocs",
    name: "Утепленные сабо Кроксы",
    description: "Кроксы с мягкой пушистой флисовой подкладкой для прохладной погоды. Невероятно мягкие и уютные.",
    price: 19000,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&q=80",
    gender: "унисекс",
    season: "осень, зима",
    category: "кроксы",
    stock: {
      bazaar: { "39": 2, "40": 4, "41": 3 },
      mall: { "40": 3, "41": 5, "42": 2 }
    }
  },
  {
    id: "21",
    article: "FS-SLIP-16",
    brand: "Fast Step",
    name: "Шлепки Fast Step (Коричневые)",
    description: "Удобные летние шлепанцы из натуральной кожи коричневого цвета. Анатомическая стелька снижает нагрузку на суставы.",
    price: 18000,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&q=80",
    gender: "мужской",
    season: "лето",
    category: "шлепанцы",
    stock: {
      bazaar: { "40": 4, "41": 5, "42": 3 },
      mall: { "41": 3, "42": 5, "43": 4 }
    }
  },
  {
    id: "22",
    article: "WT-BOOTS-10",
    brand: "Nordic",
    name: "Зимние спортивные дутики",
    description: "Легкие женские дутики на прочной теплой подошве. Непромокаемый верх из нейлона защитит от мокрого снега.",
    price: 27000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    gender: "женский",
    season: "зима",
    category: "сапоги",
    stock: {
      bazaar: { "36": 2, "37": 4, "38": 3 },
      mall: { "37": 3, "38": 5, "39": 2 }
    }
  },
  {
    id: "23",
    article: "NK-PEG-39",
    brand: "Nike",
    name: "Беговые кроссовки Nike Pegasus",
    description: "Универсальные беговые кроссовки с пеной React и вставкой Zoom Air для упругого и отзывчивого бега.",
    price: 45000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    gender: "унисекс",
    season: "лето, весна",
    category: "кроссовки",
    stock: {
      bazaar: { "39": 3, "40": 4, "41": 5 },
      mall: { "40": 4, "41": 5, "42": 3 }
    }
  },
  {
    id: "24",
    article: "ET-SLIP-07",
    brand: "Etor",
    name: "Кожаные слипоны Etor",
    description: "Мужские слипоны из гладкой кожи на гибкой резиновой подошве. Идеальная обувь на каждый день для теплого сезона.",
    price: 23000,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80",
    gender: "мужской",
    season: "лето",
    category: "слипоны",
    stock: {
      bazaar: { "40": 3, "41": 4, "42": 2 },
      mall: { "41": 3, "42": 4, "43": 1 }
    }
  },
  {
    id: "25",
    article: "CL-BROG-11",
    brand: "Classic Style",
    name: "Кожаные броги",
    description: "Классические броги с декоративной перфорацией вдоль швов. Выполнены из премиальной кожи коньячного цвета.",
    price: 43000,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80",
    gender: "мужской",
    season: "весна, осень",
    category: "туфли",
    stock: {
      bazaar: { "41": 2, "42": 4, "43": 3 },
      mall: { "41": 3, "42": 4, "43": 2 }
    }
  }
];

const DB_PRODUCTS_KEY = "shoe_store_products";
const DB_ORDERS_KEY = "shoe_store_orders";
const DB_USERS_KEY = "shoe_store_users";
const DB_CURRENT_USER_KEY = "shoe_store_current_user";
const DB_SALES_KEY = "shoe_store_sales";

// Загрузка товаров
function loadProducts() {
  const data = localStorage.getItem(DB_PRODUCTS_KEY);
  if (!data) {
    localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
    return DEFAULT_PRODUCTS;
  }

  // Миграция: автоматически добавляем новые дефолтные товары и дополняем отсутствующие свойства (пол, сезон, категория)
  let loaded;
  try {
    loaded = JSON.parse(data);
    if (!Array.isArray(loaded)) throw new Error("Данные товаров не массив");
  } catch (e) {
    console.warn("Ошибка при чтении товаров, сбрасываем к defaults:", e);
    localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
    return DEFAULT_PRODUCTS;
  }
  let updated = false;

  // 1. Нормализация и очистка свойств всех товаров из localStorage
  loaded = loaded.map(p => {
    if (!p || typeof p !== "object") return null;

    p.id = cleanString(p.id, 50);
    p.brand = cleanString(p.brand, 80);
    p.name = cleanString(p.name, 120);
    p.article = cleanString(p.article, 60);
    p.category = cleanString(p.category, 60);
    p.price = Math.max(0, parseInt(p.price) || 0);

    // Гарантируем структуру складов
    if (!p.stock || typeof p.stock !== "object") {
      p.stock = { bazaar: {}, mall: {} };
      updated = true;
    }
    if (!p.stock.bazaar || typeof p.stock.bazaar !== "object") {
      p.stock.bazaar = {};
      updated = true;
    }
    if (!p.stock.mall || typeof p.stock.mall !== "object") {
      p.stock.mall = {};
      updated = true;
    }

    const def = DEFAULT_PRODUCTS.find(d => d.id === p.id);
    if (def) {
      if (!p.gender || !p.season || !p.category) {
        p.gender = p.gender || def.gender;
        p.season = p.season || def.season;
        p.category = p.category || def.category;
        updated = true;
      }
    }
    return p;
  }).filter(Boolean);

  // 2. Добавляем новые товары (например, кроксы, зимние сапоги), если их вообще не было
  DEFAULT_PRODUCTS.forEach(defProd => {
    if (!loaded.some(p => p.id === defProd.id)) {
      loaded.push(defProd);
      updated = true;
    }
  });

  if (updated) {
    localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(loaded));
  }

  return loaded;
}

// Сохранение товаров
function saveProducts(products) {
  localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(products));
}

// Загрузка заказов/броней (ИСПРАВЛЕНО: защита от повреждённого localStorage)
function loadOrders() {
  const data = localStorage.getItem(DB_ORDERS_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Ошибка при чтении заказов, возвращаем пустой список:", e);
    return [];
  }
}

// Сохранение заказов/броней
function saveOrders(orders) {
  localStorage.setItem(DB_ORDERS_KEY, JSON.stringify(orders));
}

// Загрузка пользователей (ИСПРАВЛЕНО: защита от повреждённого localStorage)
function loadUsers() {
  const data = localStorage.getItem(DB_USERS_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Ошибка при чтении пользователей, возвращаем пустой список:", e);
    return [];
  }
}

// Сохранение пользователей
function saveUsers(users) {
  localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
}

// Получить текущего авторизованного пользователя (ИСПРАВЛЕНО: защита от повреждённого localStorage)
function getCurrentUser() {
  const data = localStorage.getItem(DB_CURRENT_USER_KEY);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    console.warn("Ошибка при чтении текущего пользователя, сбрасываем:", e);
    localStorage.removeItem(DB_CURRENT_USER_KEY);
    return null;
  }
}

// Установить текущего пользователя
function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(DB_CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(DB_CURRENT_USER_KEY);
  }
}

// Загрузка оффлайн продаж (ИСПРАВЛЕНО: защита от повреждённого localStorage)
function loadSales() {
  const data = localStorage.getItem(DB_SALES_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Ошибка при чтении продаж, возвращаем пустой список:", e);
    return [];
  }
}

// Сохранение оффлайн продаж
function saveSales(sales) {
  localStorage.setItem(DB_SALES_KEY, JSON.stringify(sales));
}

// Сброс базы к начальным настройкам
function resetDatabase() {
  localStorage.setItem(DB_PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
  localStorage.removeItem(DB_ORDERS_KEY);
  localStorage.removeItem(DB_USERS_KEY);
  localStorage.removeItem(DB_CURRENT_USER_KEY);
  localStorage.removeItem(DB_SALES_KEY);
  return DEFAULT_PRODUCTS;
}

// Экспорт базы в JSON файл
function exportDatabase() {
  const dbData = {
    products: loadProducts(),
    orders: loadOrders(),
    users: loadUsers(),
    sales: loadSales()
  };
  return JSON.stringify(dbData, null, 2);
}

// Санитизация строк
function cleanString(val, maxLen = 500) {
  if (typeof val !== "string") return "";
  return val.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLen);
}

// Импорт базы из JSON строки
function importDatabase(jsonString) {
  try {
    const dbData = JSON.parse(jsonString);
    if (!dbData || typeof dbData !== "object") return false;

    // Валидация и очистка товаров
    if (dbData.products !== undefined) {
      if (!Array.isArray(dbData.products)) return false;
      const cleanedProducts = dbData.products.map(p => {
        if (!p || (typeof p.id !== "string" && typeof p.id !== "number")) return null;
        const stock = {};
        const cleanStock = (stockObj) => {
          const result = {};
          if (stockObj && typeof stockObj === "object") {
            for (const [size, qty] of Object.entries(stockObj)) {
              const s = cleanString(size, 4);
              const n = Math.max(0, parseInt(qty) || 0);
              if (s && n >= 0) result[s] = n;
            }
          }
          return result;
        };
        stock.bazaar = cleanStock(p.stock?.bazaar);
        stock.mall = cleanStock(p.stock?.mall);

        const imageStr = cleanString(p.image, 1000);
        let image = imageStr;
        if (image && !image.startsWith("data:image/") && !image.startsWith("assets/images/") && !image.startsWith("https://images.unsplash.com/")) {
          image = "";
        }

        return {
          id: String(p.id).slice(0, 50),
          article: cleanString(p.article, 60).toUpperCase(),
          brand: cleanString(p.brand, 80),
          name: cleanString(p.name, 120),
          description: cleanString(p.description, 500),
          price: Math.max(0, parseInt(p.price) || 0),
          image,
          gender: cleanString(p.gender, 30) || "мужской",
          season: cleanString(p.season, 60) || "весна",
          category: cleanString(p.category, 100) || "кроссовки",
          stock
        };
      }).filter(Boolean);
      saveProducts(cleanedProducts);
    }

    // Валидация и очистка заказов
    if (dbData.orders !== undefined) {
      if (!Array.isArray(dbData.orders)) return false;
      const cleanedOrders = dbData.orders.map(o => ({
        id: cleanString(o?.id, 50),
        userPhone: cleanString(o?.userPhone, 20),
        userName: cleanString(o?.userName, 100),
        productId: cleanString(o?.productId, 50),
        productName: cleanString(o?.productName, 120),
        productArticle: cleanString(o?.productArticle, 60),
        size: cleanString(o?.size, 5),
        location: o?.location === "mall" ? "mall" : "bazaar",
        price: Math.max(0, parseInt(o?.price) || 0),
        type: cleanString(o?.type, 60),
        kaspiPhone: cleanString(o?.kaspiPhone, 20),
        status: ["Новый", "Оплачен", "Подтвержден", "Выдан", "Отменен"].includes(o?.status) ? o.status : "Новый",
        date: cleanString(o?.date, 100)
      })).filter(o => o.id && o.userPhone);
      saveOrders(cleanedOrders);
    }

    // Валидация и очистка пользователей
    if (dbData.users !== undefined) {
      if (!Array.isArray(dbData.users)) return false;
      const cleanedUsers = dbData.users.map(u => ({
        name: cleanString(u?.name, 100),
        phone: cleanString(u?.phone, 20)
      })).filter(u => u.phone);
      saveUsers(cleanedUsers);
    }

    // Валидация и очистка продаж
    if (dbData.sales !== undefined) {
      if (!Array.isArray(dbData.sales)) return false;
      const cleanedSales = dbData.sales.map(s => ({
        id: cleanString(s?.id, 50),
        productId: cleanString(s?.productId, 50),
        article: cleanString(s?.article, 60),
        brand: cleanString(s?.brand, 80),
        name: cleanString(s?.name, 120),
        price: Math.max(0, parseInt(s?.price) || 0),
        point: s?.point === "mall" ? "mall" : "bazaar",
        size: cleanString(s?.size, 5),
        payment: ["kaspi", "red", "cash"].includes(s?.payment) ? s.payment : "kaspi",
        date: cleanString(s?.date, 100)
      })).filter(s => s.id);
      saveSales(cleanedSales);
    }

    return true;
  } catch (e) {
    console.error("Ошибка при импорте базы данных:", e);
    return false;
  }
}

// Инициализация при подключении скрипта
window.db = {
  loadProducts,
  saveProducts,
  loadOrders,
  saveOrders,
  loadUsers,
  saveUsers,
  getCurrentUser,
  setCurrentUser,
  resetDatabase,
  exportDatabase,
  importDatabase,
  loadSales,
  saveSales
};
