/* cashier-dashboard.js – checkout, payment, receipt, my transactions */

$(function () {
  seedDemoData();
  const user = Auth.guard('cashier');
  if (!user) return;

  $('#user-name').text(user.name);

  let cart = [];       // [{ id, qty }]
  let promoCode = '';  // applied promo code

  /* ---------- Products ---------- */
  function renderProducts() {
    const q = $('#search').val().trim().toLowerCase();
    const products = PosDB.get('products', []).filter(function (p) {
      return !q || [p.name, p.brand, p.category, p.sku].join(' ').toLowerCase().indexOf(q) !== -1;
    });

    if (!products.length) {
      $('#product-grid').html('<p class="empty">No products match your search.</p>');
      return;
    }

    $('#product-grid').html(products.map(function (p) {
      const out = p.stock <= 0;
      const low = !out && p.stock <= LOW_STOCK_LIMIT;
      const stockTag = out ? '<span class="badge badge-danger">Out of stock</span>'
        : low ? '<span class="badge badge-warn">Only ' + p.stock + ' left</span>'
        : '<span class="stock">' + p.stock + ' in stock</span>';
      return '<button class="product-card ' + (out ? 'is-out' : '') + '" data-id="' + p.id + '" ' + (out ? 'disabled' : '') + '>' +
        (p.image ? '<div class="img-holder' + (p.hoverImage ? ' has-hover-image' : '') + '">' +
          '<img class="image-basic" src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
          (p.hoverImage ? '<img class="image-hover" src="' + esc(p.hoverImage) + '" alt="" aria-hidden="true" loading="lazy">' : '') +
          '</div>'
          : '<div class="img-holder"><span>IMAGE</span></div>') +
        '<div class="p-name">' + esc(p.name) + '</div>' +
        '<div class="p-meta">' + esc(p.brand) + '</div>' +
        '<div class="p-meta">' + esc(p.category) + '</div>' +
        '<div class="p-row"><strong>' + peso(p.price) + '</strong>' + stockTag + '</div>' +
        '</button>';
    }).join(''));
  }

  function renderLowStockBanner() {
    const products = PosDB.get('products', []);
    const out = products.filter(function (p) { return p.stock <= 0; }).length;
    const low = products.filter(function (p) { return p.stock > 0 && p.stock <= LOW_STOCK_LIMIT; }).length;
    if (!out && !low) { $('#low-stock-banner').prop('hidden', true); return; }
    const parts = [];
    if (low) parts.push(low + ' item' + (low > 1 ? 's' : '') + ' running low');
    if (out) parts.push(out + ' out of stock');
    $('#low-stock-banner').text('Stock alert: ' + parts.join(', ') + '. Let the manager know.').prop('hidden', false);
  }

  /* ---------- Cart ---------- */
  function cartLines() {
    const products = PosDB.get('products', []);
    return cart.map(function (c) {
      const p = products.find(function (x) { return x.id === c.id; });
      return p ? { id: p.id, name: p.name, price: p.price, qty: c.qty, stock: p.stock } : null;
    }).filter(Boolean);
  }

  function totals() {
    const lines = cartLines();
    const subtotal = lines.reduce(function (s, l) { return s + l.price * l.qty; }, 0);
    const d = computeDiscount(subtotal, $('#discount-type').val(), promoCode);
    return { lines: lines, subtotal: subtotal, discount: d.amount, discountLabel: d.label, total: subtotal - d.amount };
  }

  function renderCart() {
    const t = totals();
    if (!t.lines.length) {
      $('#cart-items').html('<p class="empty">Tap a product to add it to the sale.</p>');
    } else {
      $('#cart-items').html(t.lines.map(function (l) {
        return '<div class="cart-line" data-id="' + l.id + '">' +
          '<div class="name">' + esc(l.name) + '<div class="muted">' + peso(l.price) + ' each</div></div>' +
          '<div class="line-total">' + peso(l.price * l.qty) + '</div>' +
          '<div class="qty"><button class="qty-minus" aria-label="Less">-</button><span>' + l.qty + '</span>' +
          '<button class="qty-plus" aria-label="More">+</button><button class="remove">Remove</button></div>' +
          '</div>';
      }).join(''));
    }
    $('#t-subtotal').text(peso(t.subtotal));
    $('#t-discount-label').text(t.discount > 0 ? t.discountLabel : 'Discount');
    $('#t-discount').text('-' + peso(t.discount));
    $('#t-total').text(peso(t.total));
    $('#btn-pay').prop('disabled', !t.lines.length);
  }

  function addToCart(id) {
    const p = PosDB.get('products', []).find(function (x) { return x.id === id; });
    if (!p) return;
    const item = cart.find(function (c) { return c.id === id; });
    const current = item ? item.qty : 0;
    if (current + 1 > p.stock) { toast('Only ' + p.stock + ' in stock for ' + p.name + '.', 'error'); return; }
    if (item) item.qty++; else cart.push({ id: id, qty: 1 });
    renderCart();
  }

  $('#search').on('input', renderProducts);

  $('#product-grid').on('click', '.product-card', function () {
    addToCart(Number($(this).data('id')));
  });

  $('#cart-items').on('click', '.qty-plus', function () {
    addToCart(Number($(this).closest('.cart-line').data('id')));
  });
  $('#cart-items').on('click', '.qty-minus', function () {
    const id = Number($(this).closest('.cart-line').data('id'));
    const item = cart.find(function (c) { return c.id === id; });
    if (item && --item.qty <= 0) cart = cart.filter(function (c) { return c.id !== id; });
    renderCart();
  });
  $('#cart-items').on('click', '.remove', function () {
    const id = Number($(this).closest('.cart-line').data('id'));
    cart = cart.filter(function (c) { return c.id !== id; });
    renderCart();
  });

  $('#btn-clear').on('click', function () {
    cart = []; promoCode = '';
    $('#promo-code').val('');
    $('#discount-type').val('none').trigger('change');
  });

  /* ---------- Discounts ---------- */
  $('#discount-type').on('change', function () {
    const isPromo = $(this).val() === 'promo';
    $('#promo-row').prop('hidden', !isPromo);
    if (!isPromo) promoCode = '';
    renderCart();
  });

  $('#btn-apply-promo').on('click', function () {
    const code = $('#promo-code').val().trim().toUpperCase();
    if (!PROMO_CODES[code]) { promoCode = ''; toast('That promo code is not valid.', 'error'); }
    else { promoCode = code; toast('Promo applied: ' + code); }
    renderCart();
  });

  /* ---------- Payment ---------- */
  function updateChange() {
    const t = totals();
    const tendered = parseFloat($('#pay-tendered').val()) || 0;
    $('#pay-change').text(peso(Math.max(0, tendered - t.total)));
  }

  $('#btn-pay').on('click', function () {
    const t = totals();
    if (!t.lines.length) return;
    $('#pay-total').text(peso(t.total));
    $('#pay-method').val('cash').trigger('change');
    $('#pay-tendered').val('');
    $('#pay-ref').val('');
    updateChange();
    openModal('#payment-modal');
    $('#pay-tendered').trigger('focus');
  });

  $('#pay-method').on('change', function () {
    const cash = $(this).val() === 'cash';
    $('#pay-cash-box').prop('hidden', !cash);
    $('#pay-ref-box').prop('hidden', cash);
  });
  $('#pay-tendered').on('input', updateChange);

  $('#btn-confirm-pay').on('click', function () {
    const t = totals();
    const method = $('#pay-method').val();
    let tendered = t.total, change = 0, ref = '';

    // Make sure stock is still enough
    const bad = t.lines.find(function (l) { return l.qty > l.stock; });
    if (bad) { toast('Not enough stock for ' + bad.name + '.', 'error'); return; }

    if (method === 'cash') {
      tendered = parseFloat($('#pay-tendered').val()) || 0;
      if (tendered < t.total) { toast('Cash received is less than the total.', 'error'); return; }
      change = tendered - t.total;
    } else {
      ref = $('#pay-ref').val().trim();
      if (!ref) { toast('Enter the reference or approval number.', 'error'); return; }
    }

    const orders = PosDB.get('orders', []);
    const order = {
      id: nextId(orders),
      txn: 'TXN-' + String(orders.length + 1).padStart(5, '0'),
      date: new Date().toISOString(),
      day: todayKey(),
      cashier: user.name,
      cashierUser: user.username,
      items: t.lines.map(function (l) { return { id: l.id, name: l.name, price: l.price, qty: l.qty }; }),
      subtotal: t.subtotal,
      discountLabel: t.discountLabel,
      discount: t.discount,
      total: t.total,
      method: method,
      ref: ref,
      tendered: tendered,
      change: change,
      status: 'completed'
    };
    orders.push(order);
    PosDB.set('orders', orders);

    // Automatic stock deduction
    order.items.forEach(function (i) { changeStock(i.id, -i.qty, 'stock-out', order.txn, user.name); });

    closeModal('#payment-modal');
    showReceipt(order);

    cart = []; promoCode = '';
    $('#promo-code').val('');
    $('#discount-type').val('none').trigger('change');
    renderProducts();
    renderLowStockBanner();
    renderTransactions();
  });

  /* ---------- Receipt ---------- */
  function showReceipt(order) {
    $('#receipt-content').html(receiptHtml(order));
    openModal('#receipt-modal');
  }

  $('#btn-print').on('click', function () {
    $('body').addClass('printing-receipt');
    window.print();
    $('body').removeClass('printing-receipt');
  });

  /* ---------- My transactions ---------- */
  function myOrdersToday() {
    return PosDB.get('orders', []).filter(function (o) {
      return o.cashierUser === user.username && o.day === todayKey();
    }).reverse();
  }

  function renderTransactions() {
    const orders = myOrdersToday();
    const done = orders.filter(function (o) { return o.status === 'completed'; });
    const sum = done.reduce(function (s, o) { return s + o.total; }, 0);
    $('#tx-summary').text(done.length + ' sale' + (done.length === 1 ? '' : 's') + ' · ' + peso(sum));

    if (!orders.length) {
      $('#tx-body').html('<tr><td colspan="7" class="empty">No sales yet today.</td></tr>');
      return;
    }
    const methodNames = { cash: 'Cash', gcash: 'GCash', card: 'Card' };
    const statusBadge = {
      'completed': '<span class="badge badge-ok">Completed</span>',
      'void-pending': '<span class="badge badge-warn">Void pending</span>',
      'voided': '<span class="badge badge-danger">Voided</span>'
    };
    $('#tx-body').html(orders.map(function (o) {
      const count = o.items.reduce(function (s, i) { return s + i.qty; }, 0);
      return '<tr data-id="' + o.id + '">' +
        '<td>' + esc(o.txn) + '</td><td>' + fmtTime(o.date) + '</td><td>' + count + '</td>' +
        '<td>' + methodNames[o.method] + '</td><td class="r">' + peso(o.total) + '</td>' +
        '<td>' + statusBadge[o.status] + '</td>' +
        '<td class="actions"><button class="btn btn-ghost btn-sm tx-receipt">Receipt</button> ' +
        (o.status === 'completed' ? '<button class="btn btn-ghost btn-sm tx-void">Request void</button>' : '') +
        '</td></tr>';
    }).join(''));
  }

  $('#tx-body').on('click', '.tx-receipt', function () {
    const id = Number($(this).closest('tr').data('id'));
    const order = PosDB.get('orders', []).find(function (o) { return o.id === id; });
    if (order) showReceipt(order);
  });

  $('#tx-body').on('click', '.tx-void', function () {
    const id = Number($(this).closest('tr').data('id'));
    const reason = window.prompt('Reason for void / refund (an admin must approve):');
    if (reason === null) return;
    if (!reason.trim()) { toast('A reason is required.', 'error'); return; }

    const orders = PosDB.get('orders', []);
    const order = orders.find(function (o) { return o.id === id; });
    if (!order || order.status !== 'completed') return;
    order.status = 'void-pending';
    PosDB.set('orders', orders);

    const voids = PosDB.get('voids', []);
    voids.push({
      id: nextId(voids), orderId: order.id, txn: order.txn, amount: order.total,
      reason: reason.trim(), requestedBy: user.name, date: new Date().toISOString(), status: 'pending'
    });
    PosDB.set('voids', voids);

    toast('Void request sent to the admin.');
    renderTransactions();
  });

  /* ---------- Tabs & logout ---------- */
  $('.tab').on('click', function () {
    $('.tab').removeClass('active');
    $(this).addClass('active');
    $('.tab-panel').removeClass('active');
    $('#tab-' + $(this).data('tab')).addClass('active');
    if ($(this).data('tab') === 'transactions') renderTransactions();
  });

  $('#btn-logout').on('click', function () { Auth.logout(); });

  /* ---------- Start ---------- */
  renderProducts();
  renderLowStockBanner();
  renderCart();
  renderTransactions();
});
