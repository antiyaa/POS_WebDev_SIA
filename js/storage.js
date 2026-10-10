/* storage.js – demo database (localStorage), seed data, and stock helper */

const PosDB = {
  get(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem('pos_' + key));
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  },
  set(key, val) { localStorage.setItem('pos_' + key, JSON.stringify(val)); }
};

const LOW_STOCK_LIMIT = 5;

function seedDemoData() {
  if (!PosDB.get('users')) {
    PosDB.set('users', [
      { id: 1, name: 'Demo Cashier', username: 'cashier', password: 'cashier123', role: 'cashier' },
      { id: 2, name: 'Demo Admin',   username: 'admin',   password: 'admin123',   role: 'admin' }
    ]);
  }
  if (!PosDB.get('categories')) {
    PosDB.set('categories', ['Eau de Parfum', 'Eau de Toilette', 'Cologne', 'Gift Set']);
  }
  if (!PosDB.get('brands')) {
    PosDB.set('brands', ['Maison Aurelle', 'Cedar & Co.', 'Velvet Rose']);
  }
  if (!PosDB.get('products')) {
    PosDB.set('products', [
      { id: 1, sku: 'FS-001', name: 'Vesper',      brand: 'Maison Aurelle', category: 'Eau de Parfum',   price: 2450, stock: 18, image: 'Images/vesper_basic.jpg' },
      { id: 2, sku: 'FS-002', name: 'Skyfall',     brand: 'Cedar & Co.',    category: 'Eau de Toilette', price: 1890, stock: 12, image: 'Images/skyfall_basic.jpg' },
      { id: 3, sku: 'FS-003', name: 'Silver',      brand: 'Velvet Rose',    category: 'Eau de Parfum',   price: 1650, stock: 4, image: 'Images/silver_basic.jpg' },
      { id: 4, sku: 'FS-004', name: 'Old Money',   brand: 'Cedar & Co.',    category: 'Cologne',         price: 980,  stock: 25, image: 'Images/OldMoney_basic.jpg' },
      { id: 5, sku: 'FS-005', name: 'Intense',     brand: 'Maison Aurelle', category: 'Eau de Parfum',   price: 3980, stock: 7, image: 'Images/Intense_basic.jpg' },
      { id: 6, sku: 'FS-006', name: 'Golden Dawn', brand: 'Cedar & Co.',    category: 'Gift Set',        price: 3200, stock: 3, image: 'Images/GoldenDawn_basic.jpg' },
      { id: 7, sku: 'FS-007', name: 'Gentleman',   brand: 'Velvet Rose',    category: 'Eau de Toilette', price: 1450, stock: 0, image: 'Images/gentleman_basic.jpg' },
      { id: 8, sku: 'FS-008', name: 'Call Me',     brand: 'Maison Aurelle', category: 'Cologne',         price: 1120, stock: 15, image: 'Images/callme_basic.jpg', hoverImage: 'Images/Callme.png' }
    ]);
  }
  const brands = PosDB.get('brands', []);
  if (brands.indexOf('Father & Son') === -1) {
    brands.push('Father & Son');
    PosDB.set('brands', brands);
  }
  const products = PosDB.get('products', []);
  const basicProducts = [
    { sku: 'FS-001', name: 'Vesper', image: 'Images/vesper_basic.jpg', hoverImage: 'Images/Vesper.png' },
    { sku: 'FS-002', name: 'Skyfall', image: 'Images/skyfall_basic.jpg', hoverImage: 'Images/skyfall_basic.jpg' },
    { sku: 'FS-003', name: 'Silver', image: 'Images/silver_basic.jpg', hoverImage: 'Images/silver_basic.jpg' },
    { sku: 'FS-004', name: 'Old Money', image: 'Images/OldMoney_basic.jpg', hoverImage: 'Images/OldMoney_basic.jpg' },
    { sku: 'FS-005', name: 'Intense', image: 'Images/Intense_basic.jpg', hoverImage: 'Images/Intense_basic.jpg' },
    { sku: 'FS-006', name: 'Golden Dawn', image: 'Images/GoldenDawn_basic.jpg', hoverImage: 'Images/GoldenDawn_basic.jpg' },
    { sku: 'FS-007', name: 'Gentleman', image: 'Images/gentleman_basic.jpg', hoverImage: 'Images/gentleman_basic.jpg' },
    { sku: 'FS-008', name: 'Call Me', image: 'Images/callme_basic.jpg', hoverImage: 'Images/Callme.png' }
  ];
  basicProducts.forEach(function (basic) {
    const existing = products.find(function (product) { return product.sku === basic.sku; });
    if (!existing) return;
    existing.name = basic.name;
    existing.image = basic.image;
    if (basic.hoverImage) {
      existing.hoverImage = basic.hoverImage;
    } else {
      delete existing.hoverImage;
    }
  });
  const sampleProducts = [
    { sku: 'FS-009', name: 'Debonair 100ml', image: 'Images/Debonair_basic.jpg', hoverImage: 'Images/Debonair.png' },
    { sku: 'FS-010', name: 'Kingsman 100ml', image: 'Images/kingsman_basic.jpg', hoverImage: 'Images/Kingsman.png' },
    { sku: 'FS-011', name: 'Sailor 100ml', image: 'Images/Sailor_basic.jpg', hoverImage: 'Images/Sailor.png' },
    { sku: 'FS-012', name: 'Achilles 100ml', image: 'Images/Achilles_basic.jpg', hoverImage: 'Images/Achilles.png' }
  ];
  sampleProducts.forEach(function (sample) {
    const existing = products.find(function (product) { return product.sku === sample.sku; });
    if (existing) {
      existing.name = sample.name;
      existing.image = sample.image;
      existing.hoverImage = sample.hoverImage;
      return;
    }
    products.push({
      id: nextId(products),
      sku: sample.sku,
      name: sample.name,
      brand: 'Father & Son',
      category: 'Eau de Parfum',
      price: 1450,
      stock: 10,
      image: sample.image,
      hoverImage: sample.hoverImage
    });
  });
  PosDB.set('products', products);
  if (!PosDB.get('orders')) PosDB.set('orders', []);
  if (!PosDB.get('logs'))   PosDB.set('logs', []);
  if (!PosDB.get('voids'))  PosDB.set('voids', []);
}

function nextId(list) {
  return list.length ? Math.max.apply(null, list.map(function (i) { return i.id; })) + 1 : 1;
}

/* Change a product's stock and write an inventory log entry.
   type: 'stock-in' | 'stock-out' | 'restock' | 'void-return' */
function changeStock(productId, delta, type, ref, by) {
  const products = PosDB.get('products', []);
  const p = products.find(function (x) { return x.id === productId; });
  if (!p) return;
  p.stock = Math.max(0, p.stock + delta);
  PosDB.set('products', products);

  const logs = PosDB.get('logs', []);
  logs.unshift({
    date: new Date().toISOString(),
    productId: productId,
    name: p.name,
    type: type,
    qty: delta,
    balance: p.stock,
    ref: ref || '',
    by: by || ''
  });
  PosDB.set('logs', logs);
}
