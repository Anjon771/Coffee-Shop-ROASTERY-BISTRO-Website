/**
 * Coffee Shop & Bistro - Modern Application Engine
 * Handles dynamic catalog rendering, search, filtering, cart management,
 * favorites persistence, quick view modals, checkout, reservations, and live schedule.
 */

// Application State
const state = {
  activeCategory: 'all',
  activeTag: null,
  searchQuery: '',
  sortBy: 'recommended',
  cart: [],
  favorites: new Set(),
  orderType: 'dine-in', // 'dine-in', 'takeaway', 'delivery'
  appliedPromo: null,
  activeQuickViewItem: null,
  quickViewQty: 1,
  paymentMethod: 'counter'
};

// Storage keys
const STORAGE_KEYS = {
  CART: 'artisan_cafe_cart_v2',
  FAVORITES: 'artisan_cafe_favorites_v2'
};

// Available Promo Codes
const PROMO_CODES = {
  'CAFE10': { type: 'percent', value: 0.10, label: '10% Off Entire Order' },
  'WELCOME5': { type: 'fixed', value: 5.00, label: '$5.00 Off Welcome Gift' },
  'BARISTA': { type: 'percent', value: 0.15, label: '15% Off Barista Special' }
};

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadStoredState();
  initCategoryCounts();
  renderMenu();
  updateCartUI();
  updateFavoritesUI();
  initLiveHoursStatus();
  initEventListeners();
  initCurrentYear();
});

function loadStoredState() {
  try {
    const savedCart = localStorage.getItem(STORAGE_KEYS.CART);
    if (savedCart) {
      state.cart = JSON.parse(savedCart);
    }
  } catch (e) {
    console.warn('Failed to load cart from storage', e);
    state.cart = [];
  }

  try {
    const savedFavs = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (savedFavs) {
      state.favorites = new Set(JSON.parse(savedFavs));
    }
  } catch (e) {
    console.warn('Failed to load favorites from storage', e);
    state.favorites = new Set();
  }
}

function saveCartState() {
  try {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.cart));
  } catch (e) {
    console.warn('Failed to save cart to storage', e);
  }
}

function saveFavoritesState() {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(state.favorites)));
  } catch (e) {
    console.warn('Failed to save favorites to storage', e);
  }
}

function initCurrentYear() {
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

/* ==========================================================================
   CATEGORY COUNTS & NAVIGATION
   ========================================================================== */
function initCategoryCounts() {
  if (typeof MENU_ITEMS === 'undefined' || !Array.isArray(MENU_ITEMS)) return;

  const counts = {
    all: MENU_ITEMS.length,
    coffee: 0,
    tea: 0,
    breakfast: 0,
    pizza: 0,
    mains: 0,
    pasta: 0,
    dessert: 0
  };

  MENU_ITEMS.forEach(item => {
    if (counts[item.category] !== undefined) {
      counts[item.category]++;
    }
  });

  Object.keys(counts).forEach(cat => {
    const badge = document.getElementById(`count-${cat}`);
    if (badge) {
      badge.textContent = counts[cat];
    }
  });
}

/* ==========================================================================
   MENU FILTERING, SORTING & RENDERING
   ========================================================================== */
function getFilteredAndSortedItems() {
  if (typeof MENU_ITEMS === 'undefined' || !Array.isArray(MENU_ITEMS)) return [];

  let items = [...MENU_ITEMS];

  // 1. Category Filter
  if (state.activeCategory !== 'all') {
    items = items.filter(item => item.category === state.activeCategory);
  }

  // 2. Tag / Secondary Filter
  if (state.activeTag) {
    if (state.activeTag === 'favorites') {
      items = items.filter(item => state.favorites.has(item.id));
    } else {
      items = items.filter(item => item.tags && item.tags.includes(state.activeTag));
    }
  }

  // 3. Search Query
  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase().trim();
    items = items.filter(item => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description && item.description.toLowerCase().includes(q);
      const matchCat = item.categoryLabel && item.categoryLabel.toLowerCase().includes(q);
      const matchTags = item.tags && item.tags.some(t => t.toLowerCase().includes(q));
      return matchName || matchDesc || matchCat || matchTags;
    });
  }

  // 4. Sorting
  switch (state.sortBy) {
    case 'price-low':
      items.sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      items.sort((a, b) => b.price - a.price);
      break;
    case 'name':
      items.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'recommended':
    default:
      // Keep original editorial order, prioritize signature
      items.sort((a, b) => {
        const aSig = a.tags && a.tags.includes('signature') ? 1 : 0;
        const bSig = b.tags && b.tags.includes('signature') ? 1 : 0;
        return bSig - aSig;
      });
      break;
  }

  return items;
}

function renderMenu() {
  const container = document.getElementById('menu-items-container');
  if (!container) return;

  const items = getFilteredAndSortedItems();

  if (items.length === 0) {
    container.innerHTML = `
      <div class="menu-empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
        <h3 class="empty-state-title">No menu items found</h3>
        <p class="empty-state-text">We couldn't find anything matching your current filters or search terms.</p>
        <button class="btn-primary-lg" onclick="resetAllFilters()">Reset All Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const isFav = state.favorites.has(item.id);
    const badgeLabel = item.badge || (item.tags && item.tags.includes('signature') ? 'Signature' : null);

    return `
      <article class="menu-card" id="card-${item.id}">
        <div class="menu-card-media" onclick="openQuickView('${item.id}')">
          <img src="${item.image}" alt="${escapeHtml(item.name)}" class="menu-card-img" loading="lazy">
          ${badgeLabel ? `<span class="menu-card-badge">${escapeHtml(badgeLabel)}</span>` : ''}
          <button 
            type="button" 
            class="menu-card-fav-btn ${isFav ? 'is-fav' : ''}" 
            onclick="toggleFavorite(event, '${item.id}')"
            aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}"
            title="${isFav ? 'Remove from favorites' : 'Add to favorites'}"
          >
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
          </button>
        </div>

        <div class="menu-card-content">
          <div class="menu-card-meta">
            <span class="menu-card-category">${escapeHtml(item.categoryLabel)}</span>
            <span class="menu-card-calorie">${item.calories || ''}</span>
          </div>

          <h3 class="menu-card-title" onclick="openQuickView('${item.id}')">${escapeHtml(item.name)}</h3>
          <p class="menu-card-desc">${escapeHtml(item.description)}</p>

          <div class="menu-card-footer">
            <span class="menu-card-price">$${item.price.toFixed(2)}</span>
            <div class="menu-card-actions">
              <button class="btn-card-quickview" onclick="openQuickView('${item.id}')">Details</button>
              <button 
                id="btn-add-${item.id}" 
                class="btn-card-add" 
                onclick="addItemToCart('${item.id}')" 
                aria-label="Add ${escapeHtml(item.name)} to cart"
              >
                <i class="fa-solid fa-plus"></i> Add
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function resetAllFilters() {
  state.activeCategory = 'all';
  state.activeTag = null;
  state.searchQuery = '';
  state.sortBy = 'recommended';

  // Reset category tabs UI
  document.querySelectorAll('.category-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === 'all');
    btn.setAttribute('aria-selected', btn.dataset.category === 'all');
  });

  // Reset tag chips UI
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.remove('active');
  });

  // Reset search input
  const searchInput = document.getElementById('menu-search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.remove('visible');

  // Reset sort select
  const sortSelect = document.getElementById('menu-sort-select');
  if (sortSelect) sortSelect.value = 'recommended';

  renderMenu();
  showToast('Filters reset to default view');
}

/* ==========================================================================
   SHOPPING CART ENGINE
   ========================================================================== */
function addItemToCart(itemId, quantity = 1) {
  if (typeof MENU_ITEMS === 'undefined') return;
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const existingIndex = state.cart.findIndex(c => c.id === itemId);
  if (existingIndex > -1) {
    state.cart[existingIndex].quantity += quantity;
  } else {
    state.cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      categoryLabel: item.categoryLabel,
      quantity: quantity
    });
  }

  saveCartState();
  updateCartUI();

  // Visual button feedback
  const btn = document.getElementById(`btn-add-${itemId}`);
  if (btn) {
    const originalText = btn.innerHTML;
    btn.classList.add('added-feedback');
    btn.innerHTML = `<i class="fa-solid fa-check"></i> Added`;
    setTimeout(() => {
      btn.classList.remove('added-feedback');
      btn.innerHTML = originalText;
    }, 1200);
  }

  showToast(`Added ${item.name} to order`);
}

function updateCartItemQty(itemId, change) {
  const index = state.cart.findIndex(c => c.id === itemId);
  if (index === -1) return;

  state.cart[index].quantity += change;
  if (state.cart[index].quantity <= 0) {
    const removedName = state.cart[index].name;
    state.cart.splice(index, 1);
    showToast(`Removed ${removedName} from order`);
  }

  saveCartState();
  updateCartUI();
}

function removeCartItem(itemId) {
  const index = state.cart.findIndex(c => c.id === itemId);
  if (index === -1) return;

  const removedName = state.cart[index].name;
  state.cart.splice(index, 1);
  saveCartState();
  updateCartUI();
  showToast(`Removed ${removedName}`);
}

function clearCart() {
  if (state.cart.length === 0) return;
  state.cart = [];
  state.appliedPromo = null;
  saveCartState();
  updateCartUI();
  showToast('Order cleared');
}

function updateCartUI() {
  const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Nav badges
  const navBadge = document.getElementById('cart-item-count-badge');
  if (navBadge) navBadge.textContent = totalCount;

  const drawerBadge = document.getElementById('drawer-item-count');
  if (drawerBadge) drawerBadge.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

  // Render list
  const container = document.getElementById('cart-items-list');
  const footerPane = document.getElementById('cart-footer-pane');
  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-view">
        <div class="cart-empty-icon"><i class="fa-solid fa-mug-hot"></i></div>
        <h4>Your order is empty</h4>
        <p>Explore our menu and add your favorite coffees, wood-fired pizzas, and dishes.</p>
        <button class="btn-primary-lg" onclick="closeCartDrawer(); location.href='#menu';">Explore Menu</button>
      </div>
    `;
    if (footerPane) footerPane.style.display = 'none';
    return;
  }

  if (footerPane) footerPane.style.display = 'block';

  container.innerHTML = state.cart.map(item => `
    <div class="cart-item-row" id="cart-item-${item.id}">
      <img src="${item.image}" alt="${escapeHtml(item.name)}" class="cart-item-img">
      <div class="cart-item-info">
        <h4 class="cart-item-name">${escapeHtml(item.name)}</h4>
        <span class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
      </div>
      <div class="cart-item-controls">
        <div class="qty-stepper">
          <button class="qty-btn" onclick="updateCartItemQty('${item.id}', -1)" aria-label="Decrease quantity">
            <i class="fa-solid fa-minus"></i>
          </button>
          <span class="qty-number">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartItemQty('${item.id}', 1)" aria-label="Increase quantity">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
        <button class="btn-remove-item" onclick="removeCartItem('${item.id}')" title="Remove item" aria-label="Remove item">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');

  // Calculate discounts
  let discountAmount = 0;
  if (state.appliedPromo) {
    if (state.appliedPromo.type === 'percent') {
      discountAmount = subtotal * state.appliedPromo.value;
    } else if (state.appliedPromo.type === 'fixed') {
      discountAmount = Math.min(subtotal, state.appliedPromo.value);
    }
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = taxableAmount * 0.08;
  const total = taxableAmount + tax;

  const subtotalEl = document.getElementById('cart-subtotal-val');
  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

  const discountRow = document.getElementById('cart-discount-row');
  const discountVal = document.getElementById('cart-discount-val');
  if (discountRow && discountVal) {
    if (discountAmount > 0) {
      discountRow.style.display = 'flex';
      discountVal.textContent = `-$${discountAmount.toFixed(2)} (${state.appliedPromo.label})`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  const taxEl = document.getElementById('cart-tax-val');
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;

  const totalEl = document.getElementById('cart-total-val');
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

  const modalTotal = document.getElementById('chk-modal-total-display');
  if (modalTotal) modalTotal.textContent = `$${total.toFixed(2)}`;
}

function setOrderType(type) {
  state.orderType = type;
  document.querySelectorAll('.order-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  // Update table field visibility in checkout
  const tableGroup = document.getElementById('chk-table-group');
  if (tableGroup) {
    const label = tableGroup.querySelector('label');
    const input = tableGroup.querySelector('input');
    if (type === 'dine-in') {
      label.textContent = 'Table Number (or seating area)';
      input.placeholder = "e.g. Table #12 or 'Window Booth'";
    } else if (type === 'takeaway') {
      label.textContent = 'Pickup Time / Curbside Notes';
      input.placeholder = "e.g. In 15 mins / In silver Honda";
    } else {
      label.textContent = 'Delivery Address';
      input.placeholder = "e.g. 104 Main St, Apt 4B";
    }
  }

  showToast(`Order type set to: ${type.charAt(0).toUpperCase() + type.slice(1)}`);
}

function applyPromoCode() {
  const input = document.getElementById('cart-promo-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();

  if (!code) {
    showToast('Please enter a promo code');
    return;
  }

  if (PROMO_CODES[code]) {
    state.appliedPromo = { ...PROMO_CODES[code], code };
    updateCartUI();
    showToast(`Promo "${code}" applied: ${PROMO_CODES[code].label}`);
    input.value = '';
  } else {
    showToast('Invalid promo code. Try CAFE10 or WELCOME5');
  }
}

function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');
  if (drawer && overlay) {
    drawer.classList.add('active');
    overlay.classList.add('active');
    document.body.classList.add('drawer-open');
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');
  if (drawer && overlay) {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
    document.body.classList.remove('drawer-open');
  }
}

/* ==========================================================================
   FAVORITES SYSTEM
   ========================================================================== */
function toggleFavorite(event, itemId) {
  if (event) event.stopPropagation();

  if (state.favorites.has(itemId)) {
    state.favorites.delete(itemId);
    showToast('Removed from favorites');
  } else {
    state.favorites.add(itemId);
    showToast('Saved to your favorites');
  }

  saveFavoritesState();
  updateFavoritesUI();
  renderMenu();
}

function updateFavoritesUI() {
  const count = state.favorites.size;
  const badge = document.getElementById('nav-fav-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

/* ==========================================================================
   DISH DETAILS / QUICK VIEW MODAL
   ========================================================================== */
function openQuickView(itemId) {
  if (typeof MENU_ITEMS === 'undefined') return;
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  state.activeQuickViewItem = item;
  state.quickViewQty = 1;

  document.getElementById('qv-item-img').src = item.image;
  document.getElementById('qv-item-img').alt = item.name;
  document.getElementById('qv-item-category').textContent = item.categoryLabel;
  document.getElementById('qv-item-title').textContent = item.name;
  document.getElementById('qv-item-price').textContent = `$${item.price.toFixed(2)}`;
  document.getElementById('qv-item-desc').textContent = item.description;
  document.getElementById('qv-item-prep').textContent = item.prepTime || '5 min';
  document.getElementById('qv-item-cal').textContent = item.calories || 'Est. 280 kcal';
  document.getElementById('qv-item-craft').textContent = item.tags && item.tags.includes('signature') ? 'Signature' : 'Artisanal';
  document.getElementById('qv-item-badge').textContent = item.badge || 'Chef Selection';
  document.getElementById('qv-item-notes').textContent = item.prepNotes ? `Kitchen note: ${item.prepNotes}` : '';

  updateQuickViewQtyDisplay();

  const modal = document.getElementById('quick-view-modal');
  if (modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }
}

function closeQuickView() {
  const modal = document.getElementById('quick-view-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
}

function adjustQuickViewQty(delta) {
  state.quickViewQty = Math.max(1, state.quickViewQty + delta);
  updateQuickViewQtyDisplay();
}

function updateQuickViewQtyDisplay() {
  const qtyEl = document.getElementById('qv-item-qty');
  const btnLabel = document.getElementById('qv-add-btn-label');
  if (qtyEl) qtyEl.textContent = state.quickViewQty;

  if (btnLabel && state.activeQuickViewItem) {
    const total = (state.activeQuickViewItem.price * state.quickViewQty).toFixed(2);
    btnLabel.textContent = `Add to Order • $${total}`;
  }
}

function addQuickViewToCart() {
  if (!state.activeQuickViewItem) return;
  addItemToCart(state.activeQuickViewItem.id, state.quickViewQty);
  closeQuickView();
  openCartDrawer();
}

/* ==========================================================================
   CHECKOUT & CONFIRMATION RECEIPT
   ========================================================================== */
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('Your order is empty');
    return;
  }
  closeCartDrawer();
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
}

function setPaymentMethod(method) {
  state.paymentMethod = method;
  document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pay === method);
  });
}

function handleCheckoutSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('chk-name').value.trim();
  const phone = document.getElementById('chk-phone').value.trim();
  const tableOrAddress = document.getElementById('chk-table').value.trim();
  const notes = document.getElementById('chk-notes').value.trim();

  // Generate random unique order code
  const orderId = 'CF-' + Math.floor(100000 + Math.random() * 900000);

  // Subtotal & taxes
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discountAmount = 0;
  if (state.appliedPromo) {
    if (state.appliedPromo.type === 'percent') {
      discountAmount = subtotal * state.appliedPromo.value;
    } else if (state.appliedPromo.type === 'fixed') {
      discountAmount = Math.min(subtotal, state.appliedPromo.value);
    }
  }
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = taxableAmount * 0.08;
  const total = taxableAmount + tax;

  // Build items receipt HTML
  const itemsHtml = state.cart.map(item => `
    <div class="receipt-item-row">
      <span>${item.quantity}x ${escapeHtml(item.name)}</span>
      <strong>$${(item.price * item.quantity).toFixed(2)}</strong>
    </div>
  `).join('');

  const receiptTarget = document.getElementById('receipt-content-target');
  if (receiptTarget) {
    receiptTarget.innerHTML = `
      <div class="receipt-header">
        <h4>Coffee Shop Roastery & Kitchen</h4>
        <div class="receipt-order-id">Order ID: #${orderId}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
          ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>

      <div style="font-size: 0.84rem; margin-bottom: 0.8rem; padding-bottom: 0.8rem; border-bottom: 1px solid var(--border-subtle);">
        <div><strong>Guest:</strong> ${escapeHtml(name)} (${escapeHtml(phone)})</div>
        <div><strong>Fulfillment:</strong> ${state.orderType.toUpperCase()} ${tableOrAddress ? `(${escapeHtml(tableOrAddress)})` : ''}</div>
        <div><strong>Est. Ready Time:</strong> 12 - 18 minutes</div>
        ${notes ? `<div><strong>Notes:</strong> ${escapeHtml(notes)}</div>` : ''}
      </div>

      <div style="margin-bottom: 0.8rem;">
        ${itemsHtml}
      </div>

      <div style="border-top: 1px dashed var(--border-subtle); padding-top: 0.8rem; font-size: 0.88rem;">
        <div class="receipt-item-row" style="color: var(--text-muted);">
          <span>Subtotal</span>
          <span>$${subtotal.toFixed(2)}</span>
        </div>
        ${discountAmount > 0 ? `
          <div class="receipt-item-row" style="color: #2e7d32;">
            <span>Discount (${state.appliedPromo.code})</span>
            <span>-$${discountAmount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="receipt-item-row" style="color: var(--text-muted);">
          <span>Tax (8%)</span>
          <span>$${tax.toFixed(2)}</span>
        </div>
        <div class="receipt-item-row" style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin-top: 6px;">
          <span>Total Paid</span>
          <span>$${total.toFixed(2)}</span>
        </div>
      </div>
    `;
  }

  // Clear cart & close checkout modal
  state.cart = [];
  state.appliedPromo = null;
  saveCartState();
  updateCartUI();

  closeCheckoutModal();

  // Open receipt modal
  const receiptModal = document.getElementById('receipt-modal');
  if (receiptModal) {
    receiptModal.classList.add('active');
    document.body.classList.add('modal-open');
  }

  showToast(`Order #${orderId} confirmed! Estimated ready in 15 mins.`);
}

function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
}

/* ==========================================================================
   TABLE RESERVATION SUBMISSION
   ========================================================================== */
function handleReservationSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('res-name').value.trim();
  const phone = document.getElementById('res-phone').value.trim();
  const date = document.getElementById('res-date').value;
  const time = document.getElementById('res-time').value;
  const guests = document.getElementById('res-guests').value;
  const seating = document.getElementById('res-seating').value;

  const resCode = 'RES-' + Math.floor(1000 + Math.random() * 9000);

  showToast(`Table confirmed! Code: #${resCode} for ${guests} on ${date} at ${time}.`);

  // Reset form
  const form = document.getElementById('table-reservation-form');
  if (form) form.reset();

  // Set min date again
  setMinReservationDate();
}

function setMinReservationDate() {
  const dateInput = document.getElementById('res-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    if (!dateInput.value) {
      dateInput.value = today;
    }
  }
}

/* ==========================================================================
   LIVE OPENING HOURS STATUS & SCHEDULE
   ========================================================================== */
function initLiveHoursStatus() {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeVal = currentHour + (currentMinute / 60);

  // Highlight today's schedule row
  const rows = document.querySelectorAll('#schedule-hours-table tr');
  rows.forEach(row => {
    if (parseInt(row.dataset.day, 10) === currentDay) {
      row.classList.add('today-row');
      const timeCell = row.querySelector('.time-col');
      if (timeCell) {
        timeCell.innerHTML += ' <span style="font-size: 0.72rem; color: var(--brand-crema); text-transform: uppercase;">(Today)</span>';
      }
    }
  });

  // Calculate open / closed status
  // Mon-Thu: 7am - 10pm (7 - 22)
  // Fri: 7am - 11pm (7 - 23)
  // Sat: 8am - 11pm (8 - 23)
  // Sun: 8am - 9:30pm (8 - 21.5)
  let openHour = 7;
  let closeHour = 22;

  if (currentDay === 5) {
    closeHour = 23;
  } else if (currentDay === 6) {
    openHour = 8;
    closeHour = 23;
  } else if (currentDay === 0) {
    openHour = 8;
    closeHour = 21.5;
  }

  const isOpen = currentTimeVal >= openHour && currentTimeVal < closeHour;
  const statusEl = document.getElementById('live-hours-status-text');
  const dotEl = document.querySelector('.status-dot-pulse');

  if (statusEl) {
    if (isOpen) {
      statusEl.textContent = `Open Now • Kitchen & Roastery Serving until ${formatHourString(closeHour)}`;
    } else {
      statusEl.textContent = `Currently Closed • Reopening at ${formatHourString(openHour)}`;
      if (dotEl) {
        dotEl.style.backgroundColor = '#e63946';
        dotEl.style.boxShadow = 'none';
      }
    }
  }
}

function formatHourString(num) {
  const isHalf = num % 1 !== 0;
  const h = Math.floor(num);
  const minutes = isHalf ? ':30' : ':00';
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${displayH}${minutes} ${period}`;
}

/* ==========================================================================
   NEWSLETTER SUBSCRIPTION
   ========================================================================== */
function handleNewsletterSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('newsletter-email-input');
  if (!input) return;

  const email = input.value.trim();
  if (email) {
    showToast(`Welcome! A 10% discount promo has been sent to ${email}.`);
    input.value = '';
  }
}

/* ==========================================================================
   MODAL & BACKDROP DISMISSAL
   ========================================================================== */
function handleModalBackdropClick(event, modalId) {
  if (event.target.id === modalId) {
    if (modalId === 'quick-view-modal') closeQuickView();
    if (modalId === 'checkout-modal') closeCheckoutModal();
    if (modalId === 'receipt-modal') closeReceiptModal();
  }
}

/* ==========================================================================
   TOAST NOTIFICATION ENGINE
   ========================================================================== */
function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.innerHTML = `
    <i class="fa-solid fa-mug-saucer toast-icon"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

/* ==========================================================================
   EVENT LISTENERS SETUP
   ========================================================================== */
function initEventListeners() {
  // Sticky Navbar Scroll Listener
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });

  // Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobile-menu-toggle-btn');
  const navList = document.getElementById('main-nav-links');
  if (mobileToggle && navList) {
    mobileToggle.addEventListener('click', () => {
      navList.classList.toggle('mobile-active');
      const icon = mobileToggle.querySelector('i');
      if (navList.classList.contains('mobile-active')) {
        icon.className = 'fa-solid fa-xmark';
      } else {
        icon.className = 'fa-solid fa-bars';
      }
    });

    // Close on link click
    navList.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('mobile-active');
        const icon = mobileToggle.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars';
      });
    });
  }

  // Cart Button Click
  const navCartBtn = document.getElementById('nav-cart-btn');
  if (navCartBtn) {
    navCartBtn.addEventListener('click', openCartDrawer);
  }

  // Favorites Nav Button Click -> filters to favorites
  const favNavBtn = document.getElementById('nav-favorites-btn');
  if (favNavBtn) {
    favNavBtn.addEventListener('click', (e) => {
      e.preventDefault();
      location.href = '#menu';
      const favChip = document.getElementById('chip-filter-favorites');
      if (favChip) {
        favChip.click();
      }
    });
  }

  // Category Tabs Click
  const categoryTabs = document.querySelectorAll('.category-tab-btn');
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      state.activeCategory = tab.dataset.category;
      renderMenu();
    });
  });

  // Secondary Filter Chips
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (state.activeTag === tag) {
        // Toggle off
        state.activeTag = null;
        chip.classList.remove('active');
      } else {
        filterChips.forEach(c => c.classList.remove('active'));
        state.activeTag = tag;
        chip.classList.add('active');
      }
      renderMenu();
    });
  });

  // Search Input
  const searchInput = document.getElementById('menu-search-input');
  const searchClear = document.getElementById('search-clear-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (searchClear) {
        searchClear.classList.toggle('visible', state.searchQuery.length > 0);
      }
      renderMenu();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.searchQuery = '';
      searchClear.classList.remove('visible');
      renderMenu();
    });
  }

  // Sort Select
  const sortSelect = document.getElementById('menu-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderMenu();
    });
  }

  // Reservation Date Minimum
  setMinReservationDate();

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeQuickView();
      closeCheckoutModal();
      closeReceiptModal();
    }
  });
}

/* Helper to prevent XSS */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
