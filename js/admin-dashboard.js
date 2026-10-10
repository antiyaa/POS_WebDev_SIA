/* admin-dashboard.js – overview, products, stock, ledger, voids, users */

$(function () {
  seedDemoData();
  const user = Auth.guard('admin');
  if (!user) return;

  $('#user-name').text(user.name);
  $('#ledger-date').val(todayKey());

  const methodNames = { cash: 'Cash', gcash: 'GCash', card: 'Card' };
  const orderBadge = {
    'completed': '<span class="badge badge-ok">Completed</span>',
    'void-pending': '<span class="badge badge-warn">Void pending</span>',
    'voided': '<span class="badge badge-danger">Voided</span>'
  };

  /* ---------- Overview ---------- */
  function renderOverview() {
    const products = PosDB.get('products', []);
    const orders = PosDB.get('orders', []).filter(function (o) { return o.day === todayKey() && o.status === 'completed'; });
    const sales = orders.reduce(function (s, o) { return s + o.total; }, 0);
    const items = orders.reduce(function (s, o) {
      return s + o.items.reduce(function (n, i) { return n + i.qty; }, 0);
    }, 0);
    const lowList = products.filter(function (p) { return p.stock <= LOW_STOCK_LIMIT; });
    const pendingVoids = PosDB.get('voids', []).filter(function (v) { return v.status === 'pending'; }).length;

    $('#stat-cards').html(
      stat(peso(sales), "Today's sales") +
      stat(orders.length, 'Transactions today') +
      stat(items, 'Items sold today') +
      stat(products.length, 'Products listed') +
      stat(lowList.length, 'Low or out of stock', lowList.length > 0) +
      stat(pendingVoids, 'Void requests waiting', pendingVoids > 0)
    );

    if (!lowList.length) {
      $('#low-body').html('<tr><td colspan="4" class="empty">All products have enough stock.</td></tr>');
    } else {
      $('#low-body').html(lowList.sort(function (a, b) { return a.stock - b.stock; }).map(function (p) {
        const badge = p.stock <= 0 ? '<span class="badge badge-danger">Out of stock</span>' : '<span class="badge badge-warn">Low stock</span>';
        return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.brand) + '</td><td class="r">' + p.stock + '</td><td>' + badge + '</td></tr>';
      }).join(''));
    }
  }

  function stat(value, label, alert) {
    return '<div class="stat ' + (alert ? 'alert' : '') + '"><div class="value">' + value + '</div><div class="label">' + label + '</div></div>';
  }

  /* ---------- Categories & brands ---------- */
  function renderLists() {
    ['category', 'brand'].forEach(function (kind) {
      const key = kind === 'category' ? 'categories' : 'brands';
      const list = PosDB.get(key, []);
      $('#' + kind + '-list').html(list.map(function (name, idx) {
        return '<span class="chip">' + esc(name) + '<button data-kind="' + kind + '" data-idx="' + idx + '" aria-label="Remove ' + esc(name) + '">&times;</button></span>';
      }).join('') || '<span class="muted">None yet.</span>');
    });
  }

  function addToList(kind) {
    const key = kind === 'category' ? 'categories' : 'brands';
    const $input = $('#new-' + kind);
    const name = $input.val().trim();
    if (!name) return;
    const list = PosDB.get(key, []);
    if (list.some(function (n) { return n.toLowerCase() === name.toLowerCase(); })) { toast('That ' + kind + ' already exists.', 'error'); return; }
    list.push(name);
    PosDB.set(key, list);
    $input.val('');
    renderLists();
  }

  $('#btn-add-category').on('click', function () { addToList('category'); });
  $('#btn-add-brand').on('click', function () { addToList('brand'); });
  $('#new-category').on('keydown', function (e) { if (e.key === 'Enter') addToList('category'); });
  $('#new-brand').on('keydown', function (e) { if (e.key === 'Enter') addToList('brand'); });

  $('#category-list, #brand-list').on('click', 'button', function () {
    const kind = $(this).data('kind');
    const key = kind === 'category' ? 'categories' : 'brands';
    const list = PosDB.get(key, []);
    const name = list[$(this).data('idx')];
    const field = kind === 'category' ? 'category' : 'brand';
    const used = PosDB.get('products', []).some(function (p) { return p[field] === name; });
    if (used) { toast('Cannot remove "' + name + '" while products use it.', 'error'); return; }
    list.splice($(this).data('idx'), 1);
    PosDB.set(key, list);
    renderLists();
  });

  /* ---------- Products ---------- */
  function renderProducts() {
    const products = PosDB.get('products', []);
    if (!products.length) {
      $('#product-body').html('<tr><td colspan="8" class="empty">No products yet. Add your first perfume.</td></tr>');
      return;
    }
    $('#product-body').html(products.map(function (p) {
      const lowTag = p.stock <= 0 ? ' <span class="badge badge-danger">Out</span>' : p.stock <= LOW_STOCK_LIMIT ? ' <span class="badge badge-warn">Low</span>' : '';
      return '<tr data-id="' + p.id + '">' +
        '<td>' + (p.image
          ? '<div class="img-holder thumb' + (p.hoverImage ? ' has-hover-image' : '') + '">' +
            '<img class="image-basic" src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
            (p.hoverImage ? '<img class="image-hover" src="' + esc(p.hoverImage) + '" alt="" aria-hidden="true" loading="lazy">' : '') +
            '</div>'
          : '<div class="img-holder thumb"><span>IMG</span></div>') + '</td>' +
        '<td>' + esc(p.sku) + '</td><td>' + esc(p.name) + '</td><td>' + esc(p.brand) + '</td><td>' + esc(p.category) + '</td>' +
        '<td class="r">' + peso(p.price) + '</td><td class="r">' + p.stock + lowTag + '</td>' +
        '<td class="actions"><button class="btn btn-ghost btn-sm p-edit">Edit</button> <button class="btn btn-ghost btn-sm p-delete">Delete</button></td></tr>';
    }).join(''));
  }

  function fillSelect(sel, list, selected) {
    $(sel).html(list.map(function (n) {
      return '<option' + (n === selected ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join(''));
  }

  function openProductModal(product) {
    fillSelect('#pf-brand', PosDB.get('brands', []), product && product.brand);
    fillSelect('#pf-category', PosDB.get('categories', []), product && product.category);
    $('#pm-title').text(product ? 'Edit product' : 'Add product');
    $('#pf-id').val(product ? product.id : '');
    $('#pf-name').val(product ? product.name : '');
    $('#pf-sku').val(product ? product.sku : '');
    $('#pf-price').val(product ? product.price : '');
    $('#pf-stock').val(0);
    $('#pf-stock-box').prop('hidden', !!product); // stock on existing products changes via restocking
    openModal('#product-modal');
    $('#pf-name').trigger('focus');
  }

  $('#btn-add-product').on('click', function () { openProductModal(null); });

  $('#product-body').on('click', '.p-edit', function () {
    const id = Number($(this).closest('tr').data('id'));
    openProductModal(PosDB.get('products', []).find(function (p) { return p.id === id; }));
  });

  $('#product-body').on('click', '.p-delete', function () {
    const id = Number($(this).closest('tr').data('id'));
    const products = PosDB.get('products', []);
    const p = products.find(function (x) { return x.id === id; });
    if (!p || !window.confirm('Delete "' + p.name + '"? Past sales keep their records.')) return;
    PosDB.set('products', products.filter(function (x) { return x.id !== id; }));
    refreshAll();
    toast('Product deleted.');
  });

  $('#btn-save-product').on('click', function () {
    const name = $('#pf-name').val().trim();
    const sku = $('#pf-sku').val().trim();
    const price = parseFloat($('#pf-price').val());
    const brand = $('#pf-brand').val();
    const category = $('#pf-category').val();
    const editId = $('#pf-id').val();

    if (!name || !sku) { toast('Enter a product name and SKU.', 'error'); return; }
    if (isNaN(price) || price < 0) { toast('Enter a valid price.', 'error'); return; }
    if (!brand || !category) { toast('Add a brand and category first.', 'error'); return; }

    const products = PosDB.get('products', []);
    const dup = products.some(function (p) { return p.sku.toLowerCase() === sku.toLowerCase() && String(p.id) !== String(editId); });
    if (dup) { toast('That SKU is already used.', 'error'); return; }

    if (editId) {
      const p = products.find(function (x) { return String(x.id) === String(editId); });
      p.name = name; p.sku = sku; p.price = price; p.brand = brand; p.category = category;
      PosDB.set('products', products);
    } else {
      const id = nextId(products);
      const startStock = Math.max(0, parseInt($('#pf-stock').val(), 10) || 0);
      products.push({ id: id, sku: sku, name: name, brand: brand, category: category, price: price, stock: 0 });
      PosDB.set('products', products);
      if (startStock > 0) changeStock(id, startStock, 'stock-in', 'Initial stock', user.name);
    }
    closeModal('#product-modal');
    refreshAll();
    toast('Product saved.');
  });

  /* ---------- Stock & restocking ---------- */
  function renderInventory() {
    const products = PosDB.get('products', []);
    const current = $('#rs-product').val();
    $('#rs-product').html(products.map(function (p) {
      return '<option value="' + p.id + '">' + esc(p.name) + ' (' + p.stock + ' in stock)</option>';
    }).join(''));
    if (current) $('#rs-product').val(current);

    const logs = PosDB.get('logs', []).slice(0, 60);
    if (!logs.length) {
      $('#log-body').html('<tr><td colspan="7" class="empty">No stock movement yet.</td></tr>');
      return;
    }
    const typeBadge = {
      'stock-in': '<span class="badge badge-ok">Stock in</span>',
      'restock': '<span class="badge badge-ok">Restock</span>',
      'stock-out': '<span class="badge">Sale</span>',
      'void-return': '<span class="badge badge-warn">Void return</span>'
    };
    $('#log-body').html(logs.map(function (l) {
      return '<tr><td>' + fmtDateTime(l.date) + '</td><td>' + esc(l.name) + '</td><td>' + (typeBadge[l.type] || esc(l.type)) + '</td>' +
        '<td class="r">' + (l.qty > 0 ? '+' : '') + l.qty + '</td><td class="r">' + l.balance + '</td>' +
        '<td>' + esc(l.ref) + '</td><td>' + esc(l.by) + '</td></tr>';
    }).join(''));
  }

  $('#btn-restock').on('click', function () {
    const id = Number($('#rs-product').val());
    const qty = parseInt($('#rs-qty').val(), 10);
    if (!id) { toast('Choose a product first.', 'error'); return; }
    if (!qty || qty < 1) { toast('Enter a quantity of 1 or more.', 'error'); return; }
    changeStock(id, qty, 'restock', $('#rs-note').val().trim() || 'Restock', user.name);
    $('#rs-qty').val('');
    $('#rs-note').val('');
    refreshAll();
    toast('Stock added.');
  });

  /* ---------- Daily sales ledger ---------- */
  function renderLedger() {
    const day = $('#ledger-date').val() || todayKey();
    const orders = PosDB.get('orders', []).filter(function (o) { return o.day === day; });
    const done = orders.filter(function (o) { return o.status === 'completed'; });
    const total = done.reduce(function (s, o) { return s + o.total; }, 0);
    const items = done.reduce(function (s, o) {
      return s + o.items.reduce(function (n, i) { return n + i.qty; }, 0);
    }, 0);

    $('#ledger-title').text('Daily sales ledger – ' + day);
    $('#ledger-summary').html(
      stat(peso(total), 'Total sales') + stat(done.length, 'Completed transactions') + stat(items, 'Items sold')
    );

    if (!orders.length) {
      $('#ledger-body').html('<tr><td colspan="6" class="empty">No sales recorded on this date.</td></tr>');
      return;
    }
    $('#ledger-body').html(orders.map(function (o) {
      const itemText = o.items.map(function (i) { return esc(i.name) + ' x' + i.qty; }).join(', ');
      return '<tr><td>' + esc(o.day) + '</td><td>' + esc(o.txn) + '</td><td>' + itemText + '</td>' +
        '<td class="r">' + peso(o.total) + '</td><td>' + esc(o.cashier) + '</td><td>' + orderBadge[o.status] + '</td></tr>';
    }).join(''));
  }

  $('#ledger-date').on('change', renderLedger);
  $('#btn-print-ledger').on('click', function () { window.print(); });

  /* ---------- Void / refund approvals ---------- */
  function renderVoids() {
    const voids = PosDB.get('voids', []).slice().reverse();
    const pending = voids.filter(function (v) { return v.status === 'pending'; }).length;
    $('#void-count').text(pending).prop('hidden', !pending);

    if (!voids.length) {
      $('#void-body').html('<tr><td colspan="7" class="empty">No void or refund requests yet.</td></tr>');
      return;
    }
    const badge = {
      pending: '<span class="badge badge-warn">Pending</span>',
      approved: '<span class="badge badge-ok">Approved</span>',
      rejected: '<span class="badge badge-danger">Rejected</span>'
    };
    $('#void-body').html(voids.map(function (v) {
      const actions = v.status === 'pending'
        ? '<button class="btn btn-primary btn-sm v-approve">Approve</button> <button class="btn btn-ghost btn-sm v-reject">Reject</button>' : '';
      return '<tr data-id="' + v.id + '"><td>' + esc(v.txn) + '</td><td>' + esc(v.requestedBy) + '</td><td>' + fmtDateTime(v.date) + '</td>' +
        '<td class="r">' + peso(v.amount) + '</td><td>' + esc(v.reason) + '</td><td>' + badge[v.status] + '</td><td class="actions">' + actions + '</td></tr>';
    }).join(''));
  }

  function resolveVoid(id, approve) {
    const voids = PosDB.get('voids', []);
    const v = voids.find(function (x) { return x.id === id; });
    if (!v || v.status !== 'pending') return;
    const orders = PosDB.get('orders', []);
    const order = orders.find(function (o) { return o.id === v.orderId; });

    v.status = approve ? 'approved' : 'rejected';
    PosDB.set('voids', voids);

    if (order) {
      order.status = approve ? 'voided' : 'completed';
      PosDB.set('orders', orders);
      if (approve) {
        order.items.forEach(function (i) { changeStock(i.id, i.qty, 'void-return', order.txn, user.name); });
      }
    }
    refreshAll();
    toast(approve ? 'Void approved. Items returned to stock.' : 'Void request rejected.');
  }

  $('#void-body').on('click', '.v-approve', function () { resolveVoid(Number($(this).closest('tr').data('id')), true); });
  $('#void-body').on('click', '.v-reject',  function () { resolveVoid(Number($(this).closest('tr').data('id')), false); });

  /* ---------- Users ---------- */
  function renderUsers() {
    $('#user-body').html(PosDB.get('users', []).map(function (u) {
      const isMe = u.id === user.id;
      return '<tr data-id="' + u.id + '"><td>' + esc(u.name) + '</td><td>' + esc(u.username) + '</td>' +
        '<td><span class="badge">' + (u.role === 'admin' ? 'Admin / Manager' : 'Cashier') + '</span></td>' +
        '<td class="actions">' + (isMe ? '<span class="muted">You</span>' : '<button class="btn btn-ghost btn-sm u-delete">Delete</button>') + '</td></tr>';
    }).join(''));
  }

  $('#btn-add-user').on('click', function () {
    const name = $('#nu-name').val().trim();
    const username = $('#nu-username').val().trim();
    const password = $('#nu-password').val();
    const role = $('#nu-role').val();
    if (!name || !username || !password) { toast('Fill in name, username and password.', 'error'); return; }
    const users = PosDB.get('users', []);
    if (users.some(function (u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
      toast('That username is taken.', 'error'); return;
    }
    users.push({ id: nextId(users), name: name, username: username, password: password, role: role });
    PosDB.set('users', users);
    $('#nu-name, #nu-username, #nu-password').val('');
    renderUsers();
    toast('User added.');
  });

  $('#user-body').on('click', '.u-delete', function () {
    const id = Number($(this).closest('tr').data('id'));
    const users = PosDB.get('users', []);
    const u = users.find(function (x) { return x.id === id; });
    if (!u || !window.confirm('Delete user "' + u.username + '"?')) return;
    PosDB.set('users', users.filter(function (x) { return x.id !== id; }));
    renderUsers();
  });

  /* ---------- Navigation ---------- */
  function refreshAll() {
    renderOverview();
    renderLists();
    renderProducts();
    renderInventory();
    renderLedger();
    renderVoids();
    renderUsers();
  }

  $('#side-nav').on('click', '.nav-btn', function () {
    $('.nav-btn').removeClass('active');
    $(this).addClass('active');
    $('.section').removeClass('active');
    $('#sec-' + $(this).data('section')).addClass('active');
    refreshAll(); // pick up sales the cashier made in another tab
  });

  $('#btn-logout').on('click', function () { Auth.logout(); });

  refreshAll();
});
