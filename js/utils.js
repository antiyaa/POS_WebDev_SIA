/* utils.js – shared helpers (needs jQuery + storage.js) */

const DISCOUNTS = {
  none:   { label: '',                         rate: 0 },
  senior: { label: 'Senior Citizen (20%)',     rate: 0.20 },
  pwd:    { label: 'PWD (20%)',                rate: 0.20 },
  event:  { label: 'Store Event (10%)',        rate: 0.10 }
};

const PROMO_CODES = {
  PERFUME10: { label: 'Promo PERFUME10 (10% off)', type: 'percent', value: 0.10 },
  FATHER50:  { label: 'Promo FATHER50 (₱50 off)',  type: 'fixed',   value: 50 }
};

function peso(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  return $('<div>').text(s == null ? '' : s).html();
}

function todayKey() {
  return new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd in local time
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function toast(msg, type) {
  if (!$('#toast-box').length) $('body').append('<div id="toast-box"></div>');
  const $t = $('<div class="toast"></div>').text(msg).addClass(type || '');
  $('#toast-box').append($t);
  setTimeout(function () { $t.fadeOut(250, function () { $t.remove(); }); }, 2800);
}

function openModal(sel)  { $(sel).addClass('open'); }
function closeModal(sel) { $(sel).removeClass('open'); }

$(document).on('click', '[data-close]', function () {
  $(this).closest('.modal').removeClass('open');
});

/* Returns { label, amount } for a subtotal + chosen discount */
function computeDiscount(subtotal, key, promoCode) {
  if (key === 'promo') {
    const promo = PROMO_CODES[(promoCode || '').toUpperCase()];
    if (!promo) return { label: '', amount: 0 };
    const amt = promo.type === 'percent' ? subtotal * promo.value : Math.min(promo.value, subtotal);
    return { label: promo.label, amount: Math.round(amt * 100) / 100 };
  }
  const d = DISCOUNTS[key] || DISCOUNTS.none;
  return { label: d.label, amount: Math.round(subtotal * d.rate * 100) / 100 };
}

function receiptHtml(o) {
  const rows = o.items.map(function (i) {
    return '<tr><td>' + esc(i.name) + '<br><small>' + i.qty + ' x ' + peso(i.price) + '</small></td>' +
           '<td class="r">' + peso(i.qty * i.price) + '</td></tr>';
  }).join('');

  const methodNames = { cash: 'Cash', gcash: 'GCash', card: 'Card' };
  let html = '<div class="receipt">' +
    '<div class="rc-head"><h3>Father &amp; Son</h3><p>Perfume Retail</p>' +
    '<p>' + fmtDateTime(o.date) + '</p>' +
    '<p>' + esc(o.txn) + '</p><p>Cashier: ' + esc(o.cashier) + '</p></div>' +
    '<hr><table>' + rows + '</table><hr>' +
    '<div class="rc-line"><span>Subtotal</span><span>' + peso(o.subtotal) + '</span></div>';

  if (o.discount > 0) {
    html += '<div class="rc-line"><span>' + esc(o.discountLabel) + '</span><span>-' + peso(o.discount) + '</span></div>';
  }
  html += '<div class="rc-line rc-total"><span>TOTAL</span><span>' + peso(o.total) + '</span></div><hr>' +
    '<div class="rc-line"><span>Payment</span><span>' + methodNames[o.method] + '</span></div>';

  if (o.method === 'cash') {
    html += '<div class="rc-line"><span>Cash</span><span>' + peso(o.tendered) + '</span></div>' +
            '<div class="rc-line"><span>Change</span><span>' + peso(o.change) + '</span></div>';
  } else {
    html += '<div class="rc-line"><span>Ref. no.</span><span>' + esc(o.ref) + '</span></div>';
  }
  if (o.status !== 'completed') {
    html += '<p class="rc-foot"><strong>*** ' + (o.status === 'voided' ? 'VOIDED' : 'VOID PENDING') + ' ***</strong></p>';
  }
  html += '<p class="rc-foot">Thank you for shopping with us!</p></div>';
  return html;
}
