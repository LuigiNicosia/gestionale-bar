const state = {
  role: localStorage.getItem('barmaster_role') || 'dipendente',
  drinks: [],
  ingredients: [],
  orders: [],
  cart: [],
  activeTab: 'tab-ordini',
  categoryFilter: 'all',
  drinkSearch: '',
  queueStatusFilter: 'all',
  inventoryCatFilter: 'all',
  inventorySearch: '',
  inventoryStockFilter: 'all',
  pollingInterval: null
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRoleUI();
  initClock();
  initTabs();
  initPinModal();
  initOrderForm();
  initInventoryEvents();
  initDrinkEvents();
  initQueueEvents();
  initCustomDrinkEvents();
  initEditOrderEvents();
  initBottleCalcEvents();

  refreshAllData();

  state.pollingInterval = setInterval(() => {
    silentSyncQueueAndDrinks();
  }, 6000);
});

function initRoleUI() {
  updateRoleVisuals();

  const btnToggleRole = document.getElementById('btn-toggle-role');
  btnToggleRole.addEventListener('click', () => {
    if (state.role === 'titolare') {
      setRole('dipendente');
      showToast('Sei tornato alla modalità Dipendente', 'warning');
      switchTab('tab-ordini');
    } else {
      openPinModal();
    }
  });
}

function setRole(newRole) {
  state.role = newRole;
  localStorage.setItem('barmaster_role', newRole);
  updateRoleVisuals();
}

function updateRoleVisuals() {
  const body = document.body;
  const roleText = document.getElementById('role-text');
  const roleBtnText = document.getElementById('role-btn-text');

  if (state.role === 'titolare') {
    body.classList.remove('role-dipendente');
    body.classList.add('role-titolare');
    roleText.textContent = 'Titolare (Owner)';
    roleBtnText.textContent = 'Torna a Dipendente';
  } else {
    body.classList.remove('role-titolare');
    body.classList.add('role-dipendente');
    roleText.textContent = 'Dipendente';
    roleBtnText.textContent = 'Accedi come Titolare';
  }
}

function initTabs() {
  const navBtns = document.querySelectorAll('.nav-btn');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      if (btn.classList.contains('owner-only') && state.role !== 'titolare') {
        openPinModal(() => {
          switchTab(targetTab);
        });
        return;
      }

      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === tabId);
  });

  if (tabId === 'tab-coda') {
    fetchOrders();
  } else if (tabId === 'tab-magazzino') {
    fetchIngredients();
  } else if (tabId === 'tab-drink') {
    fetchDrinks();
  } else if (tabId === 'tab-statistiche') {
    fetchStats();
  } else if (tabId === 'tab-ordini') {
    fetchDrinks();
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('barmaster_theme') || 'default';
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const themeBtnText = document.getElementById('theme-btn-text');

  if (savedTheme === 'azzurro') {
    document.body.classList.add('theme-azzurro');
    if (themeBtnText) themeBtnText.textContent = 'Tema Notte';
    if (btnToggleTheme) {
      const icon = btnToggleTheme.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-moon';
    }
  }

  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', () => {
      const isAzzurro = document.body.classList.toggle('theme-azzurro');
      if (isAzzurro) {
        localStorage.setItem('barmaster_theme', 'azzurro');
        if (themeBtnText) themeBtnText.textContent = 'Tema Notte';
        const icon = btnToggleTheme.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-moon';
        showToast('Palette Azzurro & Bianco attivata', 'success');
      } else {
        localStorage.setItem('barmaster_theme', 'default');
        if (themeBtnText) themeBtnText.textContent = 'Azzurro & Bianco';
        const icon = btnToggleTheme.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-palette';
        showToast('Palette Notte attivata', 'success');
      }
    });
  }
}

function initClock() {
  const clockEl = document.getElementById('live-clock');
  function updateTime() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('it-IT');
  }
  updateTime();
  setInterval(updateTime, 1000);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function refreshAllData() {
  await Promise.all([
    fetchDrinks(),
    fetchIngredients(),
    fetchOrders(),
    fetchStats()
  ]);
}

async function silentSyncQueueAndDrinks() {
  try {
    const [drinksRes, ordersRes] = await Promise.all([
      fetch('/api/drinks'),
      fetch('/api/orders')
    ]);
    const drinksData = await drinksRes.json();
    const ordersData = await ordersRes.json();

    if (drinksData.success) {
      state.drinks = drinksData.drinks;
      renderDrinkCatalog();
      if (state.activeTab === 'tab-drink') renderDrinksManagement();
    }

    if (ordersData.success) {
      state.orders = ordersData.orders;
      updateQueueBadge();
      if (state.activeTab === 'tab-coda') renderOrdersQueue();
    }
  } catch (err) {
  }
}

async function fetchDrinks() {
  try {
    const res = await fetch('/api/drinks?all=true');
    const data = await res.json();
    if (data.success) {
      state.drinks = data.drinks;
      renderDrinkCatalog();
      renderDrinksManagement();
    }
  } catch (err) {
    console.error('Errore caricamento drink:', err);
  }
}

function renderDrinkCatalog() {
  const grid = document.getElementById('drinks-catalog-grid');
  if (!grid) return;

  const filtered = state.drinks.filter(d => {
    if (!d.is_active) return false;
    const matchCat = state.categoryFilter === 'all' || d.category.toLowerCase().includes(state.categoryFilter.toLowerCase());
    const matchSearch = d.name.toLowerCase().includes(state.drinkSearch.toLowerCase()) ||
                        d.category.toLowerCase().includes(state.drinkSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-whiskey-glass"></i>
        <span>Nessun drink trovato con questi filtri.</span>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(drink => {
    const inCartItem = state.cart.find(c => c.drink_id === drink.id);
    const inCartQty = inCartItem ? inCartItem.quantity : 0;
    const effectiveAvailable = Math.max(0, drink.available_count - inCartQty);

    let statusClass = 'status-available';
    let statusText = `🟢 ${drink.available_count} disponibili`;

    if (drink.available_count <= 0) {
      statusClass = 'status-danger';
      const missingIng = drink.bottleneck ? drink.bottleneck.name : 'Materie prime';
      statusText = `🔴 Esaurito (Manca: ${escapeHtml(missingIng)})`;
    } else if (drink.available_count <= 4) {
      statusClass = 'status-warning';
      statusText = `🟡 Solo ${drink.available_count} rimasti!`;
    }

    const recipeTags = (drink.recipe || []).map(r =>
      `<span class="recipe-tag">${escapeHtml(r.ingredient_name)}: ${r.amount}${r.ingredient_unit}</span>`
    ).join('');

    const isOutOfStock = drink.available_count <= 0 || effectiveAvailable <= 0;

    return `
      <div class="drink-card ${drink.available_count <= 0 ? 'out-of-stock' : ''}" data-drink-id="${drink.id}">
        <div>
          <div class="drink-category-tag">${escapeHtml(drink.category)}</div>
          <div class="drink-card-top">
            <h4 class="drink-name">${escapeHtml(drink.name)}</h4>
            <span class="drink-price">€ ${drink.price.toFixed(2)}</span>
          </div>
          ${state.role === 'titolare' && drink.margin_profit !== undefined ? `
            <div class="profit-badge" title="Costo ingredienti: €${(drink.cost_of_ingredients || 0).toFixed(2)}">
              <i class="fa-solid fa-sack-dollar"></i> Guadagno: € ${(drink.margin_profit || 0).toFixed(2)} (+${drink.margin_percent || 0}%)
            </div>
          ` : ''}
          <p class="drink-description">${escapeHtml(drink.description || 'Delizioso cocktail preparato con ingredienti premium.')}</p>

          <div class="drink-recipe-preview">
            ${recipeTags}
          </div>
        </div>

        <div>
          <div class="drink-availability-pill ${statusClass}">
            <span>${statusText}</span>
            ${drink.bottleneck && drink.available_count > 0 ?
              `<span class="bottleneck-tip" title="Ingrediente che limita la preparazione: ${escapeHtml(drink.bottleneck.name)}">
                <i class="fa-solid fa-circle-info"></i> Limite: ${escapeHtml(drink.bottleneck.name)}
              </span>` : ''}
          </div>

          <div class="drink-card-action">
            <div class="qty-stepper">
              <button class="btn-step btn-step-minus" data-action="decrease" ${isOutOfStock ? 'disabled' : ''}>-</button>
              <span class="qty-display" id="qty-disp-${drink.id}">1</span>
              <button class="btn-step btn-step-plus" data-action="increase" ${isOutOfStock ? 'disabled' : ''}>+</button>
            </div>
            <button class="btn-add-to-cart" data-action="add" ${isOutOfStock ? 'disabled' : ''}>
              <i class="fa-solid fa-plus"></i>
              <span>${inCartQty > 0 ? `Aggiungi (${inCartQty} nel carrello)` : 'Aggiungi'}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.drink-card').forEach(card => {
    const drinkId = parseInt(card.getAttribute('data-drink-id'));
    const drink = state.drinks.find(d => d.id === drinkId);
    if (!drink) return;

    const qtyDisp = card.querySelector(`#qty-disp-${drinkId}`);
    let currentSelectQty = 1;

    const btnMinus = card.querySelector('.btn-step-minus');
    const btnPlus = card.querySelector('.btn-step-plus');
    const btnAdd = card.querySelector('.btn-add-to-cart');

    if (btnMinus) {
      btnMinus.addEventListener('click', () => {
        if (currentSelectQty > 1) {
          currentSelectQty--;
          qtyDisp.textContent = currentSelectQty;
        }
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', () => {
        const inCartItem = state.cart.find(c => c.drink_id === drinkId);
        const inCartQty = inCartItem ? inCartItem.quantity : 0;
        const maxCanAdd = drink.available_count - inCartQty;

        if (currentSelectQty < maxCanAdd) {
          currentSelectQty++;
          qtyDisp.textContent = currentSelectQty;
        } else {
          showToast(`Massimo disponibile raggiunto per ${drink.name} (${drink.available_count} porzioni)`, 'warning');
        }
      });
    }

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        addToCart(drink, currentSelectQty);
        currentSelectQty = 1;
        qtyDisp.textContent = 1;
      });
    }
  });
}

function initOrderForm() {
  const tableInput = document.getElementById('order-table-input');
  const activeTableLabel = document.getElementById('active-table-label');

  tableInput.addEventListener('input', () => {
    const val = tableInput.value.trim();
    activeTableLabel.textContent = val ? `Comanda per: ${val}` : 'Nessun tavolo selezionato';
  });

  document.querySelectorAll('.btn-pill-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-pill-pick').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.getAttribute('data-val');
      tableInput.value = val;
      activeTableLabel.textContent = `Comanda per: ${val}`;
    });
  });

  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.categoryFilter = pill.getAttribute('data-cat');
      renderDrinkCatalog();
    });
  });

  const searchInput = document.getElementById('search-drink-input');
  searchInput.addEventListener('input', (e) => {
    state.drinkSearch = e.target.value.trim();
    renderDrinkCatalog();
  });

  document.getElementById('btn-clear-cart').addEventListener('click', () => {
    if (state.cart.length === 0) return;
    state.cart = [];
    renderCart();
    renderDrinkCatalog();
    showToast('Carrello svuotato', 'warning');
  });

  document.getElementById('btn-submit-order').addEventListener('click', submitOrder);
}

function addToCart(drink, quantity) {
  const existing = state.cart.find(c => c.drink_id === drink.id);
  const currentInCart = existing ? existing.quantity : 0;
  const maxAvailable = drink.available_count;

  if (currentInCart + quantity > maxAvailable) {
    showToast(`Non ci sono abbastanza ingredienti per preparare altri ${drink.name}! Rimanenti: ${maxAvailable - currentInCart}`, 'error');
    return;
  }

  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({
      drink_id: drink.id,
      name: drink.name,
      price: drink.price,
      quantity: quantity,
      max_available: maxAvailable
    });
  }

  renderCart();
  renderDrinkCatalog();
  showToast(`Aggiunto ${quantity}x ${drink.name} alla comanda!`, 'success');
}

function updateCartItemQty(drinkId, delta) {
  const item = state.cart.find(c => c.drink_id === drinkId);
  if (!item) return;

  const drink = state.drinks.find(d => d.id === drinkId);
  const maxAvailable = drink ? drink.available_count : item.max_available;

  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    removeFromCart(drinkId);
    return;
  }

  if (newQty > maxAvailable) {
    showToast(`Massima disponibilità scorte raggiunta (${maxAvailable})`, 'warning');
    return;
  }

  item.quantity = newQty;
  renderCart();
  renderDrinkCatalog();
}

function removeFromCart(drinkId) {
  state.cart = state.cart.filter(c => c.drink_id !== drinkId);
  renderCart();
  renderDrinkCatalog();
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const totalDrinksEl = document.getElementById('cart-total-drinks');
  const totalPriceEl = document.getElementById('cart-total-price');

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-state">
        <i class="fa-solid fa-wine-bottle"></i>
        <p>Nessun drink selezionato</p>
        <small>Seleziona i drink dal menu a sinistra per comporre la comanda del tavolo.</small>
      </div>`;
    totalDrinksEl.textContent = '0';
    totalPriceEl.textContent = '€ 0.00';
    return;
  }

  let totalDrinks = 0;
  let totalPrice = 0;

  container.innerHTML = state.cart.map(item => {
    const subtotal = item.price * item.quantity;
    totalDrinks += item.quantity;
    totalPrice += subtotal;

    return `
      <div class="cart-item-row">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-sub">€ ${item.price.toFixed(2)} cad.</div>
        </div>
        <div class="cart-item-controls">
          <div class="cart-qty-pill">
            <button class="cart-btn-qty" onclick="updateCartItemQty(${item.drink_id}, -1)">-</button>
            <span class="cart-qty-num">${item.quantity}</span>
            <button class="cart-btn-qty" onclick="updateCartItemQty(${item.drink_id}, 1)">+</button>
          </div>
          <div class="cart-item-price">€ ${subtotal.toFixed(2)}</div>
          <button class="cart-item-remove" onclick="removeFromCart(${item.drink_id})" title="Rimuovi"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
    `;
  }).join('');

  totalDrinksEl.textContent = totalDrinks;
  totalPriceEl.textContent = `€ ${totalPrice.toFixed(2)}`;
}

async function submitOrder() {
  const tableInput = document.getElementById('order-table-input');
  const staffInput = document.getElementById('order-staff-input');
  const notesInput = document.getElementById('order-notes-input');

  const tableNumber = tableInput.value.trim();
  const staffName = staffInput.value.trim() || 'Cameriere';
  const notes = notesInput.value.trim();

  if (!tableNumber) {
    showToast('Inserisci il Numero del Tavolo prima di inviare!', 'error');
    tableInput.focus();
    return;
  }

  if (state.cart.length === 0) {
    showToast('Aggiungi almeno un drink alla comanda!', 'warning');
    return;
  }

  const payload = {
    table_number: tableNumber,
    staff_name: staffName,
    notes: notes,
    items: state.cart.map(i => ({ drink_id: i.drink_id, quantity: i.quantity }))
  };

  const btnSubmit = document.getElementById('btn-submit-order');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Invio in corso...`;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Comanda ${data.order.order_code} per ${tableNumber} inviata con successo!`, 'success');

      state.cart = [];
      notesInput.value = '';
      renderCart();

      await Promise.all([
        fetchDrinks(),
        fetchIngredients(),
        fetchOrders()
      ]);
    } else {
      showToast(data.message || 'Errore durante la creazione dell\'ordine', 'error');
    }
  } catch (err) {
    showToast('Errore di connessione con il server', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Invia Comanda alla Coda</span>`;
  }
}

function initQueueEvents() {
  document.querySelectorAll('#queue-status-filters .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#queue-status-filters .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.queueStatusFilter = pill.getAttribute('data-status');
      renderOrdersQueue();
    });
  });

  document.getElementById('btn-refresh-queue').addEventListener('click', () => {
    fetchOrders(true);
  });
}

async function fetchOrders(showFeedback = false) {
  try {
    const res = await fetch('/api/orders');
    const data = await res.json();
    if (data.success) {
      state.orders = data.orders;
      updateQueueBadge();
      renderOrdersQueue();
      if (showFeedback) showToast('Coda ordini aggiornata!', 'success');
    }
  } catch (err) {
    console.error('Errore recupero ordini:', err);
  }
}

function updateQueueBadge() {
  const badge = document.getElementById('queue-badge-count');
  const activeCount = state.orders.filter(o => o.status === 'in_attesa' || o.status === 'in_preparazione').length;
  badge.textContent = activeCount;
  badge.style.display = activeCount > 0 ? 'inline-block' : 'none';
}

function renderOrdersQueue() {
  const container = document.getElementById('orders-queue-container');
  if (!container) return;

  const filtered = state.orders.filter(o => {
    if (state.queueStatusFilter === 'all') return true;
    return o.status === state.queueStatusFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-check-double"></i>
        <span>Nessuna comanda in questa visualizzazione.</span>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(order => {
    const elapsed = getTimeElapsed(order.created_at);

    const itemsHtml = (order.items || []).map(item => {
      const dosesList = (item.recipe || []).map(r => `${r.amount}${r.unit} ${escapeHtml(r.ing_name)}`).join(' • ');

      return `
        <div class="ticket-item">
          <div class="ticket-item-main">
            <div>
              <span class="ticket-item-qty">${item.quantity}x</span>
              <span class="ticket-item-name">${escapeHtml(item.drink_name)}</span>
            </div>
            ${item.recipe && item.recipe.length > 0 ? `
              <button type="button" class="btn-toggle-recipe" onclick="toggleRecipeDoses(this)">
                <i class="fa-solid fa-receipt"></i> Dosi
              </button>
            ` : ''}
          </div>
          ${item.recipe && item.recipe.length > 0 ? `
            <div class="ticket-recipe-doses">
              <i class="fa-solid fa-glass-water-droplet"></i> Ricetta: ${escapeHtml(dosesList)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    let actionButtons = '';
    if (order.status === 'in_attesa') {
      actionButtons = `
        <button class="btn btn-primary" onclick="setOrderStatus(${order.id}, 'in_preparazione')">
          <i class="fa-solid fa-fire"></i> Inizia Preparazione
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openEditOrderModal(${order.id})" title="Il cliente vuole cambiare drink prima che sia preparato">
          <i class="fa-solid fa-pen-to-square"></i> Modifica
        </button>
        <button class="btn btn-secondary" onclick="setOrderStatus(${order.id}, 'annullato')">
          <i class="fa-solid fa-ban"></i> Annulla
        </button>
      `;
    } else if (order.status === 'in_preparazione') {
      actionButtons = `
        <button class="btn btn-success" onclick="setOrderStatus(${order.id}, 'servito')">
          <i class="fa-solid fa-check"></i> Servito al Tavolo
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openEditOrderModal(${order.id})" title="Modifica drink o quantità">
          <i class="fa-solid fa-pen-to-square"></i> Modifica
        </button>
        <button class="btn btn-secondary" onclick="setOrderStatus(${order.id}, 'annullato')">
          <i class="fa-solid fa-ban"></i> Annulla
        </button>
      `;
    } else if (order.status === 'servito') {
      actionButtons = `
        <button class="btn btn-secondary" onclick="setOrderStatus(${order.id}, 'pagato')">
          <i class="fa-solid fa-cash-register"></i> Segna come Pagato
        </button>
      `;
    }

    const statusLabels = {
      'in_attesa': '⏳ In Attesa',
      'in_preparazione': '🍸 In Preparazione',
      'servito': '✅ Servito',
      'pagato': '💰 Pagato',
      'annullato': '❌ Annullato'
    };

    return `
      <div class="order-ticket status-${order.status}">
        <div class="ticket-header">
          <div class="ticket-table-name">
            <i class="fa-solid fa-chair"></i> ${escapeHtml(order.table_number)}
          </div>
          <div class="ticket-meta">
            <div>${escapeHtml(order.order_code)}</div>
            <div class="ticket-time-ago">${elapsed}</div>
          </div>
        </div>

        <div class="ticket-body">
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.6rem;">
            Preso da: <strong>${escapeHtml(order.staff_name)}</strong>
          </div>

          ${order.notes ? `
            <div class="ticket-notes">
              <i class="fa-solid fa-comment-dots"></i> <strong>Nota:</strong> ${escapeHtml(order.notes)}
            </div>
          ` : ''}

          <div class="ticket-items-list">
            ${itemsHtml}
          </div>
        </div>

        <div class="ticket-footer">
          <div class="ticket-footer-info">
            <span class="ticket-status-pill">${statusLabels[order.status] || order.status}</span>
            <strong style="color: var(--primary); font-size: 1.05rem;">€ ${order.total_amount.toFixed(2)}</strong>
          </div>
          <div class="ticket-actions-row">
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleRecipeDoses(btn) {
  const item = btn.closest('.ticket-item');
  const doses = item.querySelector('.ticket-recipe-doses');
  if (doses) {
    const isVisible = doses.style.display === 'block';
    doses.style.display = isVisible ? 'none' : 'block';
  }
}

async function setOrderStatus(orderId, newStatus) {
  if (newStatus === 'annullato') {
    if (!confirm("Sei sicuro di voler annullare questo ordine? Tutte le materie prime consumate verranno ripristinate automaticamente in magazzino!")) {
      return;
    }
  }

  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await Promise.all([
        fetchOrders(),
        fetchDrinks(),
        fetchIngredients(),
        fetchStats()
      ]);
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Errore di rete durante l\'aggiornamento dello stato', 'error');
  }
}

function initInventoryEvents() {
  const searchInput = document.getElementById('search-inventory-input');
  const catSelect = document.getElementById('filter-inventory-cat');

  searchInput.addEventListener('input', (e) => {
    state.inventorySearch = e.target.value.trim();
    renderInventoryTable();
  });

  catSelect.addEventListener('change', (e) => {
    state.inventoryCatFilter = e.target.value;
    renderInventoryTable();
  });

  const cardLowStock = document.getElementById('card-filter-low-stock');
  const cardAll = document.getElementById('card-filter-all');
  const btnResetFilter = document.getElementById('btn-reset-low-filter');

  if (cardLowStock) {
    cardLowStock.addEventListener('click', () => {
      if (state.inventoryStockFilter === 'low_stock') {
        setInventoryStockFilter('all');
      } else {
        setInventoryStockFilter('low_stock');
      }
    });
  }

  if (cardAll) {
    cardAll.addEventListener('click', () => {
      setInventoryStockFilter('all');
    });
  }

  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      setInventoryStockFilter('all');
    });
  }

  document.querySelectorAll('#inventory-status-filters .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const f = pill.getAttribute('data-stock-filter');
      setInventoryStockFilter(f);
    });
  });

  document.getElementById('btn-open-add-ingredient').addEventListener('click', () => {
    openIngredientModal();
  });

  document.getElementById('btn-save-ingredient').addEventListener('click', saveIngredient);

  document.getElementById('btn-confirm-restock').addEventListener('click', confirmRestock);

  document.querySelectorAll('.btn-qty-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('restock-amount-input').value = btn.getAttribute('data-add');
    });
  });

  document.getElementById('btn-view-logs').addEventListener('click', openStockLogsModal);
}

async function setInventoryStockFilter(newFilter) {
  state.inventoryStockFilter = newFilter;

  document.querySelectorAll('#inventory-status-filters .filter-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-stock-filter') === newFilter);
  });

  const cardLow = document.getElementById('card-filter-low-stock');
  const cardAll = document.getElementById('card-filter-all');
  const banner = document.getElementById('inventory-filter-banner');

  if (cardLow) cardLow.classList.toggle('active-filter', newFilter === 'low_stock');
  if (cardAll) cardAll.classList.toggle('active-filter', newFilter === 'all');
  if (banner) banner.style.display = newFilter === 'low_stock' ? 'flex' : 'none';

  await fetchIngredients();

  if (newFilter === 'low_stock') {
    showToast(`Query eseguita: trovate ${state.ingredients.length} materie prime in esaurimento`, 'warning');
  } else if (newFilter === 'out_of_stock') {
    showToast(`Query eseguita: trovate ${state.ingredients.length} materie prime esaurite`, 'error');
  } else {
    showToast('Visualizzazione completa di tutte le scorte ripristinata', 'success');
  }
}

async function fetchIngredients() {
  try {
    let url = '/api/ingredients';
    if (state.inventoryStockFilter === 'low_stock') {
      url += '?low_stock=true';
    } else if (state.inventoryStockFilter === 'out_of_stock') {
      url += '?status=esaurito';
    }

    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      state.ingredients = data.ingredients;
      renderInventoryTable();
      updateInventoryMetrics();
    }
  } catch (err) {
    console.error('Errore recupero ingredienti:', err);
  }
}

async function updateInventoryMetrics() {
  const totalEl = document.getElementById('metric-total-ingredients');
  const lowStockEl = document.getElementById('metric-low-stock');
  const valueEl = document.getElementById('metric-stock-value');

  try {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();
    if (data.success && data.stats) {
      if (totalEl) totalEl.textContent = data.stats.stock_value > 0 ? (totalEl.textContent || '0') : '0';
      if (lowStockEl) lowStockEl.textContent = data.stats.low_stock_count;
      if (valueEl) valueEl.textContent = `€ ${data.stats.stock_value.toFixed(2)}`;
    }
  } catch (e) {
  }

  if (state.inventoryStockFilter === 'all' && totalEl) {
    totalEl.textContent = state.ingredients.length;
  }
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const filtered = state.ingredients.filter(i => {
    const matchCat = state.inventoryCatFilter === 'all' || i.category === state.inventoryCatFilter;
    const matchSearch = i.name.toLowerCase().includes(state.inventorySearch.toLowerCase());
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-dim); padding: 2rem;">Nessuna materia prima trovata.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(ing => {
    const maxReference = Math.max(ing.stock, ing.alert_threshold * 2.5, 1000);
    const percent = Math.min(100, Math.round((ing.stock / maxReference) * 100));

    let statusBadge = '<span class="badge-status badge-ok">Ottimo</span>';
    let fillClass = 'fill-ok';

    if (ing.stock <= 0) {
      statusBadge = '<span class="badge-status badge-danger">Esaurito</span>';
      fillClass = 'fill-danger';
    } else if (ing.stock <= ing.alert_threshold) {
      statusBadge = '<span class="badge-status badge-warning">Scorta Bassa</span>';
      fillClass = 'fill-warn';
    }

    const cpu = ing.cost_per_unit || 0.0;
    const stockVal = ing.stock * cpu;

    return `
      <tr>
        <td>
          <strong style="color: #fff;">${escapeHtml(ing.name)}</strong>
        </td>
        <td><span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(ing.category)}</span></td>
        <td>
          <span style="font-weight: 700; font-size: 1rem; color: ${ing.stock <= ing.alert_threshold ? 'var(--warning)' : '#fff'};">
            ${ing.stock} ${ing.unit}
          </span>
        </td>
        <td>
          <div class="stock-bar-container">
            <div class="stock-bar-fill ${fillClass}" style="width: ${percent}%;"></div>
          </div>
          <small style="font-size: 0.7rem; color: var(--text-dim);">${percent}% capacità</small>
        </td>
        <td>
          <span style="font-size: 0.85rem; font-weight: 600;">€ ${cpu.toFixed(4)} / ${ing.unit}</span>
          ${ing.unit === 'ml' && cpu > 0 ? `<br><small style="font-size: 0.7rem; color: var(--text-dim);">(€ ${(cpu * 700).toFixed(2)} / 700ml)</small>` : ''}
        </td>
        <td>
          <strong style="color: var(--success); font-size: 0.95rem;">€ ${stockVal.toFixed(2)}</strong>
        </td>
        <td>${ing.alert_threshold} ${ing.unit}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-primary btn-sm" onclick="openRestockModal(${ing.id})" title="Aggiungi merce">
              <i class="fa-solid fa-truck-ramp-box"></i> Ricarica
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openIngredientModal(${ing.id})" title="Modifica">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="deleteIngredient(${ing.id})" title="Elimina">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openRestockModal(ingId) {
  const ing = state.ingredients.find(i => i.id === ingId);
  if (!ing) return;

  document.getElementById('restock-item-id').value = ing.id;
  document.getElementById('restock-item-name').textContent = ing.name;
  document.getElementById('restock-unit-label').textContent = ing.unit;
  document.getElementById('restock-amount-input').value = '';
  document.getElementById('restock-reason-input').value = 'Carico Fornitore';

  openModal('modal-restock');
}

async function confirmRestock() {
  const id = document.getElementById('restock-item-id').value;
  const amount = parseFloat(document.getElementById('restock-amount-input').value);
  const reason = document.getElementById('restock-reason-input').value.trim();

  if (isNaN(amount) || amount <= 0) {
    showToast('Inserisci una quantità valida da caricare!', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/ingredients/${id}/restock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-restock');
      await Promise.all([
        fetchIngredients(),
        fetchDrinks(),
        fetchStats()
      ]);
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Errore di connessione', 'error');
  }
}

function openIngredientModal(ingId = null) {
  const modal = document.getElementById('modal-ingredient');
  const title = document.getElementById('modal-ingredient-title');

  const idInput = document.getElementById('ingredient-id-input');
  const nameInput = document.getElementById('ing-name-input');
  const catInput = document.getElementById('ing-category-input');
  const unitInput = document.getElementById('ing-unit-input');
  const stockInput = document.getElementById('ing-stock-input');
  const threshInput = document.getElementById('ing-threshold-input');
  const costInput = document.getElementById('ing-cost-input');

  const badgeStock = document.getElementById('badge-unit-stock');
  const badgeThresh = document.getElementById('badge-unit-thresh');

  function updateUnitBadges() {
    if (badgeStock) badgeStock.textContent = unitInput.value;
    if (badgeThresh) badgeThresh.textContent = unitInput.value;
  }

  unitInput.onchange = updateUnitBadges;

  const bottlePrice = document.getElementById('calc-bottle-price');
  const bottleVol = document.getElementById('calc-bottle-volume');
  const preview = document.getElementById('calc-result-preview');
  if (bottlePrice) bottlePrice.value = '';
  if (bottleVol) bottleVol.value = '700';

  if (ingId) {
    const ing = state.ingredients.find(i => i.id === ingId);
    if (!ing) return;
    title.innerHTML = `<i class="fa-solid fa-pen-to-square text-accent"></i> Modifica ${escapeHtml(ing.name)}`;
    idInput.value = ing.id;
    nameInput.value = ing.name;
    catInput.value = ing.category;
    unitInput.value = ing.unit;
    stockInput.value = ing.stock;
    threshInput.value = ing.alert_threshold;
    costInput.value = ing.cost_per_unit || '';
    if (preview) {
      if (ing.cost_per_unit && ing.cost_per_unit > 0) {
        preview.innerHTML = `Costo attuale: <strong>€ ${ing.cost_per_unit.toFixed(4)} / ${ing.unit}</strong> (pari a € ${(ing.cost_per_unit * 700).toFixed(2)} per 700ml)`;
      } else {
        preview.textContent = 'Inserisci prezzo e volume per calcolare il costo esatto al ml';
      }
    }
  } else {
    title.innerHTML = `<i class="fa-solid fa-bottle-droplet text-accent"></i> Nuova Materia Prima`;
    idInput.value = '';
    nameInput.value = '';
    catInput.value = 'Distillati';
    unitInput.value = 'ml';
    stockInput.value = '1000';
    threshInput.value = '200';
    costInput.value = '';
    if (preview) preview.textContent = 'Inserisci prezzo e volume per calcolare il costo esatto al ml';
  }

  updateUnitBadges();
  openModal('modal-ingredient');
  setTimeout(() => nameInput.focus(), 120);
}

async function saveIngredient() {
  const id = document.getElementById('ingredient-id-input').value;
  const name = document.getElementById('ing-name-input').value.trim();
  const category = document.getElementById('ing-category-input').value;
  const unit = document.getElementById('ing-unit-input').value;
  const stock = parseFloat(document.getElementById('ing-stock-input').value);
  const alert_threshold = parseFloat(document.getElementById('ing-threshold-input').value) || 200;
  const cost_per_unit = parseFloat(document.getElementById('ing-cost-input').value) || 0;

  if (!name) {
    showToast('Il nome della materia prima è obbligatorio!', 'error');
    return;
  }
  if (isNaN(stock) || stock < 0) {
    showToast('Inserisci una quantità di giacenza valida!', 'error');
    return;
  }

  const payload = { name, category, unit, stock, alert_threshold, cost_per_unit };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/ingredients/${id}` : '/api/ingredients';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-ingredient');
      await Promise.all([
        fetchIngredients(),
        fetchDrinks(),
        fetchStats()
      ]);
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Errore durante il salvataggio', 'error');
  }
}

async function deleteIngredient(ingId) {
  const ing = state.ingredients.find(i => i.id === ingId);
  if (!confirm(`Sei sicuro di voler eliminare definitivamente '${ing ? ing.name : ''}'?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/ingredients/${ingId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await Promise.all([
        fetchIngredients(),
        fetchDrinks(),
        fetchStats()
      ]);
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Errore durante l\'eliminazione', 'error');
  }
}

async function openStockLogsModal() {
  try {
    const res = await fetch('/api/stock-logs?limit=40');
    const data = await res.json();
    const tbody = document.getElementById('stock-logs-body');

    if (data.success && data.logs.length > 0) {
      tbody.innerHTML = data.logs.map(log => {
        const isPositive = log.change_amount > 0;
        const color = isPositive ? 'var(--success)' : 'var(--danger)';
        const sign = isPositive ? '+' : '';

        return `
          <tr>
            <td style="font-size: 0.8rem; color: var(--text-dim);">${formatDateTime(log.created_at)}</td>
            <td><strong>${escapeHtml(log.ingredient_name)}</strong></td>
            <td style="font-weight: 700; color: ${color};">${sign}${log.change_amount} ${log.unit}</td>
            <td>${log.resulting_stock} ${log.unit}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(log.reason)}</td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim);">Nessun movimento registrato.</td></tr>`;
    }
    openModal('modal-logs');
  } catch (err) {
    showToast('Errore recupero log movimenti', 'error');
  }
}

function initDrinkEvents() {
  document.getElementById('btn-open-add-drink').addEventListener('click', () => {
    openDrinkModal();
  });

  document.getElementById('btn-add-recipe-row').addEventListener('click', () => {
    addRecipeRow();
  });

  document.getElementById('btn-save-drink').addEventListener('click', saveDrink);
}

function renderDrinksManagement() {
  const container = document.getElementById('drinks-management-container');
  if (!container) return;

  if (state.drinks.length === 0) {
    container.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-martini-glass"></i>
        <span>Nessun drink configurato. Creane uno per iniziare!</span>
      </div>`;
    return;
  }

  container.innerHTML = state.drinks.map(drink => {
    const recipeItemsHtml = (drink.recipe || []).map(r => `
      <li class="recipe-spec-item">
        <span>${escapeHtml(r.ingredient_name)}</span>
        <strong>${r.amount} ${r.ingredient_unit}</strong>
      </li>
    `).join('');

    return `
      <div class="drink-mgmt-card card-glass">
        <div>
          <div class="drink-mgmt-header">
            <div>
              <span class="drink-category-tag">${escapeHtml(drink.category)}</span>
              <h3 style="color: #fff; font-size: 1.2rem;">${escapeHtml(drink.name)}</h3>
            </div>
            <span class="drink-price">€ ${drink.price.toFixed(2)}</span>
          </div>

          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            ${escapeHtml(drink.description || 'Nessuna descrizione impostata.')}
          </p>

          <div class="profit-calculator-card" style="margin-bottom: 0.75rem; padding: 0.5rem 0.75rem;">
            <div class="profit-calc-item">
              <span class="profit-calc-label"><i class="fa-solid fa-boxes-stacked"></i> Costo Materie:</span>
              <strong class="profit-calc-val">€ ${(drink.cost_of_ingredients || 0).toFixed(2)}</strong>
            </div>
            <div class="profit-calc-item highlight">
              <span class="profit-calc-label"><i class="fa-solid fa-sack-dollar text-success"></i> Guadagno Netto:</span>
              <strong class="profit-calc-val text-success">€ ${(drink.margin_profit || 0).toFixed(2)} (+${drink.margin_percent || 0}%)</strong>
            </div>
          </div>

          <div class="recipe-spec-box">
            <div class="recipe-spec-title"><i class="fa-solid fa-flask"></i> Dosi Ricetta per Porzione</div>
            <ul class="recipe-spec-list">
              ${recipeItemsHtml || '<li style="color: var(--danger);">Nessun ingrediente associato!</li>'}
            </ul>
          </div>
        </div>

        <div>
          <div class="drink-availability-pill ${drink.available_count > 4 ? 'status-available' : (drink.available_count > 0 ? 'status-warning' : 'status-danger')}" style="margin-bottom: 0.75rem;">
            <span>Disponibilità attuale: <strong>${drink.available_count} drink</strong></span>
            ${drink.bottleneck ? `<small title="Fattore limitante">(Scorta: ${escapeHtml(drink.bottleneck.name)})</small>` : ''}
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm flex-1" onclick="openDrinkModal(${drink.id})">
              <i class="fa-solid fa-pen"></i> Modifica Ricetta & Dosi
            </button>
            <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="deleteDrink(${drink.id})" title="Elimina / Archivia">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openDrinkModal(drinkId = null) {
  const title = document.getElementById('modal-drink-title');
  const idInput = document.getElementById('drink-id-input');
  const nameInput = document.getElementById('drink-name-input');
  const catInput = document.getElementById('drink-category-input');
  const priceInput = document.getElementById('drink-price-input');
  const descInput = document.getElementById('drink-desc-input');
  const rowsContainer = document.getElementById('recipe-rows-container');

  rowsContainer.innerHTML = '';

  if (drinkId) {
    const drink = state.drinks.find(d => d.id === drinkId);
    if (!drink) return;
    title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Modifica ${escapeHtml(drink.name)}`;
    idInput.value = drink.id;
    nameInput.value = drink.name;
    catInput.value = drink.category;
    priceInput.value = drink.price;
    descInput.value = drink.description || '';

    if (drink.recipe && drink.recipe.length > 0) {
      drink.recipe.forEach(r => addRecipeRow(r.ingredient_id, r.amount));
    } else {
      addRecipeRow();
    }
  } else {
    title.innerHTML = `<i class="fa-solid fa-martini-glass"></i> Crea Nuovo Drink & Ricetta`;
    idInput.value = '';
    nameInput.value = '';
    catInput.value = 'Cocktail';
    priceInput.value = '8.00';
    descInput.value = '';
    addRecipeRow();
    addRecipeRow();
  }

  openModal('modal-drink');
}

function addRecipeRow(selectedIngId = null, amount = '') {
  const container = document.getElementById('recipe-rows-container');
  const row = document.createElement('div');
  row.className = 'recipe-input-row';

  const optionsHtml = state.ingredients.map(ing => `
    <option value="${ing.id}" ${selectedIngId === ing.id ? 'selected' : ''}>
      ${escapeHtml(ing.name)} (${ing.unit}) — Giacenza: ${ing.stock}${ing.unit}
    </option>
  `).join('');

  row.innerHTML = `
    <select class="recipe-ing-select">
      <option value="">-- Seleziona Alcolico / Mixer --</option>
      ${optionsHtml}
    </select>
    <input type="number" class="recipe-amount-input" step="any" placeholder="Dose (es. 30, 50)" value="${amount}">
    <button type="button" class="btn-remove-row" title="Rimuovi ingrediente"><i class="fa-solid fa-trash-can"></i></button>
  `;

  row.querySelector('.btn-remove-row').addEventListener('click', () => {
    row.remove();
  });

  container.appendChild(row);
}

async function saveDrink() {
  const id = document.getElementById('drink-id-input').value;
  const name = document.getElementById('drink-name-input').value.trim();
  const category = document.getElementById('drink-category-input').value;
  const price = parseFloat(document.getElementById('drink-price-input').value);
  const description = document.getElementById('drink-desc-input').value.trim();

  if (!name) {
    showToast('Il nome del drink è obbligatorio!', 'error');
    return;
  }
  if (isNaN(price) || price < 0) {
    showToast('Inserisci un prezzo di vendita valido!', 'error');
    return;
  }

  const recipeRows = document.querySelectorAll('#recipe-rows-container .recipe-input-row');
  const recipe = [];

  recipeRows.forEach(row => {
    const ingId = row.querySelector('.recipe-ing-select').value;
    const amt = parseFloat(row.querySelector('.recipe-amount-input').value);
    if (ingId && !isNaN(amt) && amt > 0) {
      recipe.push({ ingredient_id: parseInt(ingId), amount: amt });
    }
  });

  if (recipe.length === 0) {
    showToast('Inserisci almeno un ingrediente con la quantità usata per comporre la ricetta!', 'warning');
    return;
  }

  const payload = { name, category, price, description, recipe };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/drinks/${id}` : '/api/drinks';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-drink');
      await fetchDrinks();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Errore durante il salvataggio del drink', 'error');
  }
}

async function deleteDrink(drinkId) {
  const drink = state.drinks.find(d => d.id === drinkId);
  if (!confirm(`Vuoi rimuovere il drink '${drink ? drink.name : ''}' dal menu?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/drinks/${drinkId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await fetchDrinks();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Errore durante l\'eliminazione del drink', 'error');
  }
}

async function fetchStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();
    if (data.success) {
      renderStats(data.stats);
    }
  } catch (err) {
    console.error('Errore recupero statistiche:', err);
  }
}

function renderStats(stats) {
  const revToday = document.getElementById('stat-revenue-today');
  const ordToday = document.getElementById('stat-orders-today');
  const revTotal = document.getElementById('stat-revenue-total');
  const ordTotal = document.getElementById('stat-orders-total');
  const topName = document.getElementById('stat-top-drink-name');
  const topCount = document.getElementById('stat-top-drink-count');
  const pending = document.getElementById('stat-pending-orders');

  if (revToday) revToday.textContent = `€ ${stats.today_revenue.toFixed(2)}`;
  if (ordToday) ordToday.textContent = `${stats.today_orders} comande oggi`;
  if (revTotal) revTotal.textContent = `€ ${stats.total_revenue.toFixed(2)}`;
  if (ordTotal) ordTotal.textContent = `${stats.total_orders} comande complessive`;
  if (pending) pending.textContent = stats.pending_orders;

  const profitToday = document.getElementById('stat-profit-today');
  const marginToday = document.getElementById('stat-margin-today');
  if (profitToday) {
    const profit = stats.today_profit !== undefined ? stats.today_profit : stats.today_revenue;
    profitToday.textContent = `€ ${profit.toFixed(2)}`;
  }
  if (marginToday) {
    const margin = stats.today_margin_pct !== undefined ? stats.today_margin_pct : 0;
    marginToday.textContent = `Margine stimato: +${margin}%`;
  }

  if (stats.top_drinks && stats.top_drinks.length > 0) {
    const best = stats.top_drinks[0];
    if (topName) topName.textContent = best.name;
    if (topCount) topCount.textContent = `${best.sold_count} serviti (€ ${best.total_earned.toFixed(2)})`;
  } else {
    if (topName) topName.textContent = '--';
    if (topCount) topCount.textContent = '0 serviti';
  }

  const topTableBody = document.getElementById('top-drinks-body');
  if (topTableBody) {
    if (stats.top_drinks && stats.top_drinks.length > 0) {
      topTableBody.innerHTML = stats.top_drinks.map(d => `
        <tr>
          <td><strong>${escapeHtml(d.name)}</strong></td>
          <td>${d.sold_count} porzioni</td>
          <td style="color: var(--primary); font-weight: 700;">€ ${d.total_earned.toFixed(2)}</td>
        </tr>
      `).join('');
    } else {
      topTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-dim);">Nessuna vendita registrata finora.</td></tr>`;
    }
  }

  const lowList = document.getElementById('low-stock-alert-list');
  if (lowList) {
    if (stats.low_stock_items && stats.low_stock_items.length > 0) {
      lowList.innerHTML = stats.low_stock_items.map(item => `
        <div class="low-stock-item">
          <div>
            <strong style="color: #fff;">${escapeHtml(item.name)}</strong>
            <div style="font-size: 0.75rem; color: var(--danger);">Scorta attuale: ${item.stock} ${item.unit} (Soglia: ${item.alert_threshold} ${item.unit})</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openRestockModal(${item.id})">
            <i class="fa-solid fa-plus"></i> Ricarica
          </button>
        </div>
      `).join('');
    } else {
      lowList.innerHTML = `<div style="color: var(--success); font-size: 0.85rem;"><i class="fa-solid fa-circle-check"></i> Tutte le scorte sono a livelli ottimali!</div>`;
    }
  }
}

let pinSuccessCallback = null;

function initPinModal() {
  const pinInput = document.getElementById('input-owner-pin');
  const btnClear = document.getElementById('btn-pin-clear');
  const btnConfirm = document.getElementById('btn-pin-confirm');

  document.querySelectorAll('.btn-pin[data-num]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (pinInput.value.length < 8) {
        pinInput.value += btn.getAttribute('data-num');
      }
    });
  });

  btnClear.addEventListener('click', () => {
    pinInput.value = '';
  });

  btnConfirm.addEventListener('click', submitPin);

  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPin();
  });
}

function openPinModal(onSuccess = null) {
  pinSuccessCallback = onSuccess;
  const pinInput = document.getElementById('input-owner-pin');
  const errorBox = document.getElementById('pin-error-msg');
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }
  if (pinInput) {
    pinInput.value = '';
    pinInput.classList.remove('pin-shake');
  }
  openModal('modal-pin');
  setTimeout(() => {
    if (pinInput) pinInput.focus();
  }, 100);
}

async function submitPin() {
  const pinInput = document.getElementById('input-owner-pin');
  const errorBox = document.getElementById('pin-error-msg');
  const pin = pinInput ? pinInput.value.trim() : '';

  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  if (!pin) {
    if (errorBox) {
      errorBox.textContent = 'Inserisci il PIN prima di confermare!';
      errorBox.style.display = 'block';
    }
    showToast('Inserisci il PIN!', 'warning');
    if (pinInput) pinInput.focus();
    return;
  }

  try {
    const res = await fetch('/api/auth/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      data = { success: false, message: 'Risposta del server non valida (Errore ' + res.status + ')' };
    }

    if (data.success) {
      setRole('titolare');
      closeModal('modal-pin');
      showToast('Benvenuto Titolare! Accesso sbloccato.', 'success');
      if (typeof pinSuccessCallback === 'function') {
        pinSuccessCallback();
        pinSuccessCallback = null;
      } else {
        switchTab('tab-magazzino');
      }
    } else {
      const errMsg = data.message || 'PIN errato! Riprova con il PIN predefinito (1234).';
      if (errorBox) {
        errorBox.textContent = '❌ ' + errMsg;
        errorBox.style.display = 'block';
      }
      showToast(errMsg, 'error');
      if (pinInput) {
        pinInput.value = '';
        pinInput.classList.add('pin-shake');
        setTimeout(() => pinInput.classList.remove('pin-shake'), 400);
        pinInput.focus();
      }
    }
  } catch (err) {
    const connMsg = 'Errore di connessione: ' + (err.message || 'Server non raggiungibile');
    if (errorBox) {
      errorBox.textContent = '⚠️ ' + connMsg;
      errorBox.style.display = 'block';
    }
    showToast('Errore di connessione al server', 'error');
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = btn.closest('.modal-overlay');
    if (modal) modal.classList.remove('active');
  });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

function getTimeElapsed(dateStr) {
  if (!dateStr) return '';
  const orderTime = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - orderTime) / 1000);

  if (diffSec < 60) return 'Appena ordinato';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ${diffMin % 60}m fa`;
}

function initBottleCalcEvents() {
  const bottlePrice = document.getElementById('calc-bottle-price');
  const bottleVol = document.getElementById('calc-bottle-volume');
  const costInput = document.getElementById('ing-cost-input');
  const preview = document.getElementById('calc-result-preview');

  function calculate() {
    if (!bottlePrice || !bottleVol || !costInput) return;
    const price = parseFloat(bottlePrice.value);
    const vol = parseFloat(bottleVol.value);
    if (!isNaN(price) && price > 0 && !isNaN(vol) && vol > 0) {
      const cpu = price / vol;
      costInput.value = cpu.toFixed(4);
      if (preview) {
        preview.innerHTML = `Costo calcolato: <strong>€ ${cpu.toFixed(4)} / ml</strong> (€ ${price.toFixed(2)} per ${vol} ml)`;
      }
    }
  }

  if (bottlePrice) bottlePrice.addEventListener('input', calculate);
  if (bottleVol) bottleVol.addEventListener('input', calculate);
}

function initCustomDrinkEvents() {
  const btnOpen = document.getElementById('btn-open-custom-drink');
  if (btnOpen) {
    btnOpen.addEventListener('click', openCustomDrinkModal);
  }

  const btnAddRow = document.getElementById('btn-add-custom-recipe-row');
  if (btnAddRow) {
    btnAddRow.addEventListener('click', addCustomRecipeRow);
  }

  const btnConfirm = document.getElementById('btn-confirm-custom-drink');
  if (btnConfirm) {
    btnConfirm.addEventListener('click', submitCustomDrink);
  }

  const priceInput = document.getElementById('custom-drink-price');
  if (priceInput) {
    priceInput.addEventListener('input', updateCustomDrinkProfitCalc);
  }
}

function openCustomDrinkModal() {
  const nameInput = document.getElementById('custom-drink-name');
  const priceInput = document.getElementById('custom-drink-price');
  const descInput = document.getElementById('custom-drink-desc');
  const rowsContainer = document.getElementById('custom-drink-recipe-rows');

  if (nameInput) nameInput.value = '';
  if (priceInput) priceInput.value = '8.50';
  if (descInput) descInput.value = 'Richiesta speciale cliente fuori menu';
  if (rowsContainer) rowsContainer.innerHTML = '';

  addCustomRecipeRow();
  addCustomRecipeRow();

  updateCustomDrinkProfitCalc();
  openModal('modal-custom-drink');
  setTimeout(() => {
    if (nameInput) nameInput.focus();
  }, 100);
}

function addCustomRecipeRow() {
  const container = document.getElementById('custom-drink-recipe-rows');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'recipe-input-row';

  const ingOptions = state.ingredients.map(i =>
    `<option value="${i.id}" data-unit="${i.unit}" data-cost="${i.cost_per_unit || 0}">${escapeHtml(i.name)} (${i.stock} ${i.unit} disp.)</option>`
  ).join('');

  row.innerHTML = `
    <select class="custom-ing-select" style="flex: 2;">
      <option value="">-- Seleziona alcolico o mixer --</option>
      ${ingOptions}
    </select>
    <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
      <input type="number" class="custom-amount-input" step="any" placeholder="Dose" value="40" style="width: 100%;">
      <span class="custom-unit-badge" style="font-size: 0.75rem; color: var(--text-dim); min-width: 20px;">ml</span>
    </div>
    <button type="button" class="btn-del-mini" onclick="this.closest('.recipe-input-row').remove(); updateCustomDrinkProfitCalc();" title="Rimuovi">
      <i class="fa-solid fa-trash-can"></i>
    </button>
  `;

  const select = row.querySelector('.custom-ing-select');
  const unitBadge = row.querySelector('.custom-unit-badge');
  const amountInput = row.querySelector('.custom-amount-input');

  select.addEventListener('change', () => {
    const selectedOpt = select.options[select.selectedIndex];
    if (selectedOpt && selectedOpt.dataset.unit) {
      unitBadge.textContent = selectedOpt.dataset.unit;
    }
    updateCustomDrinkProfitCalc();
  });

  amountInput.addEventListener('input', updateCustomDrinkProfitCalc);

  container.appendChild(row);
}

function updateCustomDrinkProfitCalc() {
  const priceInput = document.getElementById('custom-drink-price');
  const costDisp = document.getElementById('custom-calc-cost');
  const priceDisp = document.getElementById('custom-calc-price');
  const profitDisp = document.getElementById('custom-calc-profit');

  const price = parseFloat(priceInput ? priceInput.value : 0) || 0.0;
  let totalCost = 0.0;

  const rows = document.querySelectorAll('#custom-drink-recipe-rows .recipe-input-row');
  rows.forEach(row => {
    const select = row.querySelector('.custom-ing-select');
    const amountInput = row.querySelector('.custom-amount-input');
    const ingId = parseInt(select.value);
    const amount = parseFloat(amountInput.value) || 0;

    if (ingId && amount > 0) {
      const ing = state.ingredients.find(i => i.id === ingId);
      if (ing) {
        totalCost += amount * (ing.cost_per_unit || 0.0);
      }
    }
  });

  const profit = Math.max(0, price - totalCost);
  const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0;

  if (costDisp) costDisp.textContent = `€ ${totalCost.toFixed(2)}`;
  if (priceDisp) priceDisp.textContent = `€ ${price.toFixed(2)}`;
  if (profitDisp) {
    profitDisp.textContent = `€ ${profit.toFixed(2)} (+${marginPct}%)`;
    profitDisp.style.color = marginPct >= 70 ? 'var(--success)' : (marginPct >= 40 ? 'var(--warning)' : 'var(--danger)');
  }
}

async function submitCustomDrink() {
  const nameInput = document.getElementById('custom-drink-name');
  const priceInput = document.getElementById('custom-drink-price');
  const descInput = document.getElementById('custom-drink-desc');

  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value) || 0.0;
  const description = descInput.value.trim();

  if (!name) {
    showToast('Inserisci il nome del drink personalizzato!', 'warning');
    nameInput.focus();
    return;
  }

  const recipe = [];
  const rows = document.querySelectorAll('#custom-drink-recipe-rows .recipe-input-row');
  rows.forEach(row => {
    const select = row.querySelector('.custom-ing-select');
    const amountInput = row.querySelector('.custom-amount-input');
    const ingId = parseInt(select.value);
    const amount = parseFloat(amountInput.value) || 0;

    if (ingId && amount > 0) {
      recipe.push({ ingredient_id: ingId, amount: amount });
    }
  });

  if (recipe.length === 0) {
    showToast('Seleziona almeno un ingrediente con dose > 0!', 'warning');
    return;
  }

  const payload = {
    name: name,
    category: 'Fuori Menu',
    price: price,
    description: description || 'Cocktail personalizzato fuori menu',
    recipe: recipe
  };

  try {
    const res = await fetch('/api/drinks/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Drink fuori menu "${name}" aggiunto alla comanda!`, 'success');
      closeModal('modal-custom-drink');

      await fetchDrinks();

      if (data.drink) {
        const addedDrink = state.drinks.find(d => d.id === data.drink.id) || data.drink;
        addToCart(addedDrink, 1);
      }
    } else {
      showToast(data.message || 'Errore durante la creazione', 'error');
    }
  } catch (err) {
    showToast('Errore di connessione', 'error');
  }
}

let currentEditOrder = null;

function initEditOrderEvents() {
  const btnSave = document.getElementById('btn-save-order-changes');
  if (btnSave) {
    btnSave.addEventListener('click', submitEditOrder);
  }

  const btnAddDrink = document.getElementById('btn-add-drink-to-edit');
  if (btnAddDrink) {
    btnAddDrink.addEventListener('click', () => {
      const select = document.getElementById('edit-order-select-drink');
      const qtyInput = document.getElementById('edit-order-add-qty');
      const drinkId = parseInt(select.value);
      const qty = parseInt(qtyInput.value) || 1;

      if (!drinkId || qty <= 0) {
        showToast('Seleziona un drink valido da aggiungere!', 'warning');
        return;
      }

      const drink = state.drinks.find(d => d.id === drinkId);
      if (!drink || !currentEditOrder) return;

      const existingItem = currentEditOrder.items.find(it => it.drink_id === drinkId);
      if (existingItem) {
        existingItem.quantity += qty;
      } else {
        currentEditOrder.items.push({
          drink_id: drink.id,
          drink_name: drink.name,
          unit_price: drink.price,
          quantity: qty
        });
      }

      select.value = '';
      qtyInput.value = '1';
      renderEditOrderItems();
    });
  }
}

function openEditOrderModal(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) {
    showToast('Ordine non trovato!', 'error');
    return;
  }

  currentEditOrder = {
    id: order.id,
    order_code: order.order_code,
    table_number: order.table_number,
    notes: order.notes || '',
    items: (order.items || []).map(it => ({
      drink_id: it.drink_id,
      drink_name: it.drink_name,
      unit_price: parseFloat(it.unit_price),
      quantity: parseInt(it.quantity)
    }))
  };

  document.getElementById('edit-order-id').value = order.id;
  document.getElementById('edit-order-table').value = order.table_number;
  document.getElementById('edit-order-notes').value = order.notes || '';

  const select = document.getElementById('edit-order-select-drink');
  if (select) {
    select.innerHTML = '<option value="">-- Seleziona un drink dal menu da aggiungere --</option>' +
      state.drinks.filter(d => d.is_active).map(d =>
        `<option value="${d.id}">${escapeHtml(d.name)} (€ ${d.price.toFixed(2)})</option>`
      ).join('');
  }

  renderEditOrderItems();
  openModal('modal-edit-order');
}

function renderEditOrderItems() {
  const container = document.getElementById('edit-order-items-container');
  const totalDisplay = document.getElementById('edit-order-total-display');
  if (!container || !currentEditOrder) return;

  if (currentEditOrder.items.length === 0) {
    container.innerHTML = '<div style="color: var(--danger); text-align: center; padding: 1rem;">Nessun drink nella comanda! Aggiungine almeno uno.</div>';
    if (totalDisplay) totalDisplay.textContent = '€ 0.00';
    return;
  }

  let total = 0.0;
  container.innerHTML = currentEditOrder.items.map((item, idx) => {
    const subtotal = item.unit_price * item.quantity;
    total += subtotal;

    return `
      <div class="edit-order-row">
        <div class="edit-order-info">
          <div>
            <div class="edit-order-name">${escapeHtml(item.drink_name)}</div>
            <div class="edit-order-unit-price">€ ${item.unit_price.toFixed(2)} cad.</div>
          </div>
        </div>
        <div class="edit-order-controls">
          <button type="button" class="btn-qty-mini" onclick="changeEditOrderQty(${idx}, -1)">-</button>
          <span class="edit-qty-display">${item.quantity}</span>
          <button type="button" class="btn-qty-mini" onclick="changeEditOrderQty(${idx}, 1)">+</button>
          <button type="button" class="btn-del-mini" onclick="removeEditOrderItem(${idx})" title="Rimuovi drink">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (totalDisplay) totalDisplay.textContent = `€ ${total.toFixed(2)}`;
}

function changeEditOrderQty(index, delta) {
  if (!currentEditOrder || !currentEditOrder.items[index]) return;
  const item = currentEditOrder.items[index];
  item.quantity += delta;
  if (item.quantity <= 0) {
    currentEditOrder.items.splice(index, 1);
  }
  renderEditOrderItems();
}

function removeEditOrderItem(index) {
  if (!currentEditOrder) return;
  currentEditOrder.items.splice(index, 1);
  renderEditOrderItems();
}

async function submitEditOrder() {
  if (!currentEditOrder) return;

  const table = document.getElementById('edit-order-table').value.trim();
  const notes = document.getElementById('edit-order-notes').value.trim();

  if (!table) {
    showToast('Inserisci il numero del tavolo!', 'warning');
    return;
  }

  if (currentEditOrder.items.length === 0) {
    showToast('La comanda deve contenere almeno un drink!', 'error');
    return;
  }

  const payload = {
    table_number: table,
    notes: notes,
    items: currentEditOrder.items.map(it => ({
      drink_id: it.drink_id,
      quantity: it.quantity
    }))
  };

  try {
    const res = await fetch(`/api/orders/${currentEditOrder.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-edit-order');
      currentEditOrder = null;
      await Promise.all([
        fetchOrders(),
        fetchDrinks(),
        fetchIngredients(),
        fetchStats()
      ]);
    } else {
      showToast(data.message || 'Errore durante la modifica', 'error');
    }
  } catch (err) {
    showToast('Errore di connessione', 'error');
  }
}
