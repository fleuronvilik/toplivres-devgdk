import { $, getCSRF, decodeRole } from "./dom.js";
import { fr, formatCurrency, formatType, formatStatus } from "../i18n/fr.js";
import { openItemsSheet } from "../ui/itemsSheet.js";
import { notify } from "../core/notifications.js";

// Generic fetch with error handling & auth
// Usage: await apiFetch("/api/some-endpoint", { method: "POST", body: JSON.stringify(data) });

export async function apiFetch(path, options = {}) {
  clearErrors();

  const method = (options.method || "GET").toUpperCase();
  const needsCSRF = ["POST","PUT","PATCH","DELETE"].includes(method);
  //const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Accept": "application/json",
      ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
      "X-CSRF-TOKEN": getCSRF(),
      //...(needsCSRF ? { "X-CSRF-TOKEN": getCSRF() } : {}),
      // ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    }
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  
  if (!res.ok) {
    // Throw a *rich* error so UI can decide what to do.
    const err = new Error("Échec de la requête API");
    err.status = res.status;
    err.payload = data;
    err.url = res.url;
    throw err;
  }

  return data;
}

export async function loadAdminOperations() {
  const res = await apiFetch("/api/admin/operations");

  const actionableBody = document.getElementById("admin-ops-actionable");
  const historyBody = document.getElementById("admin-ops-history");
  const cancelLabel = fr.form.actions?.cancel || "Annuler";
  const deleteLabel = fr.form.actions?.delete || "Supprimer";

  actionableBody.innerHTML = "";
  historyBody.innerHTML = "";

  (res.actionable || []).forEach(op => renderOperationRow(op, actionableBody));
  (res.history || []).forEach(op => renderOperationRow(op, historyBody));

  function renderOperationRow(op, tbody) {
    let actionMarkup = "";
    let cancelMarkup = "";

    if (op.type === "order") {
      if (op.status === "pending") {
        actionMarkup = `<button data-action="confirm" data-id="${op.id}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-accent">${fr.form.actions.approve}</button>`;
        cancelMarkup = `<button data-action="delete" data-id="${op.id}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-danger">${fr.form.actions.reject}</button>`;
      } else if (op.status === "approved") {
        actionMarkup = `<button data-action="confirm" data-id="${op.id}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-accent">${fr.form.actions.deliver}</button>`;
        cancelMarkup = `<button data-action="delete" data-id="${op.id}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-danger">${cancelLabel}</button>`;
      }
    } else if (op.type === "report" && op.status !== "cancelled") {
      actionMarkup = `<button data-action="delete" data-id="${op.id}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-danger">${deleteLabel}</button>`;
    }

    const tr = document.createElement("tr");
    tr.dataset.client = (op.customer?.name || "").toLowerCase();
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.date}</td>
      <td><a href="/admin/users/${op.customer.id}">${op.customer.name || ""}</a></td>
      <td>${formatType(op.type || '')}</td>
      <td>${formatStatus(op.status || '')}</td>
      <td>
        <div class="table-actions">
          <button class="viewItemsBtn btn">Voir les articles</button>
          ${cancelMarkup}${actionMarkup}
        </div>
      </td>
    `;

    tbody.appendChild(tr);
    tr.querySelector(".viewItemsBtn").addEventListener("click", () => openItemsSheet(op.items));
  }
}

export async function loadAdminCustomerOperations(customerId) {
  const res = await apiFetch("/api/admin/operations");
  const actionableBody = document.getElementById("admin-customer-actionable-body");
  const historyBody = document.getElementById("admin-customer-history-body");
  const actionableTable = document.getElementById("admin-customer-actionable-table");
  const historyTable = document.getElementById("admin-customer-history-table");
  const actionableEmpty = document.getElementById("admin-customer-actionable-empty");
  const historyEmpty = document.getElementById("admin-customer-history-empty");
  const cancelLabel = fr.form.actions?.cancel || "Annuler";
  const deleteLabel = fr.form.actions?.delete || "Supprimer";

  if (!actionableBody || !historyBody) return;

  const targetId = String(customerId || "");
  const actionableOps = (res.actionable || []).filter(op => String(op.customer?.id || "") === targetId);
  const allOps = [...(res.actionable || []), ...(res.history || [])].filter(
    op => String(op.customer?.id || "") === targetId
  );

  allOps.sort((a, b) => {
    const timeA = Date.parse(a.date || "");
    const timeB = Date.parse(b.date || "");
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return timeB - timeA;
    }
    return (b.id || 0) - (a.id || 0);
  });

  const recentOps = allOps.slice(0, 10);

  actionableBody.innerHTML = "";
  historyBody.innerHTML = "";

  if (actionableEmpty) actionableEmpty.classList.toggle("hidden", actionableOps.length > 0);
  if (actionableTable) actionableTable.classList.toggle("hidden", actionableOps.length === 0);
  if (historyEmpty) historyEmpty.classList.toggle("hidden", recentOps.length > 0);
  if (historyTable) historyTable.classList.toggle("hidden", recentOps.length === 0);

  actionableOps.forEach(op => renderOperationRow(op, actionableBody, true));
  recentOps.forEach(op => renderOperationRow(op, historyBody, false));

  function renderOperationRow(op, tbody, isActionable) {
    let actionMarkup = "";
    let cancelMarkup = "";
    const opId = op?.id ?? "—";

    if (isActionable && op.type === "order") {
      if (op.status === "pending") {
        actionMarkup = `<button data-action="confirm" data-id="${opId}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-accent">${fr.form.actions.approve}</button>`;
        cancelMarkup = `<button data-action="delete" data-id="${opId}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-danger">${fr.form.actions.reject}</button>`;
      } else if (op.status === "approved") {
        actionMarkup = `<button data-action="confirm" data-id="${opId}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-accent">${fr.form.actions.deliver}</button>`;
        cancelMarkup = `<button data-action="delete" data-id="${opId}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-danger">${cancelLabel}</button>`;
      }
    } else if (isActionable && op.type === "report" && op.status !== "cancelled") {
      actionMarkup = `<button data-action="delete" data-id="${opId}" data-status="${op.status || ''}" data-type="${op.type || ''}" class="btn btn-danger">${deleteLabel}</button>`;
    }

    const tr = document.createElement("tr");
    tr.dataset.client = (op.customer?.name || "").toLowerCase();
    tr.innerHTML = `
      <td>${opId}</td>
      <td>${op.date || "—"}</td>
      <td>${formatType(op.type || '') || "—"}</td>
      <td>${formatStatus(op.status || '') || "—"}</td>
      <td>
        <div class="table-actions">
          <button class="viewItemsBtn btn">Voir les articles</button>
          ${cancelMarkup}${actionMarkup}
        </div>
      </td>
    `;

    tbody.appendChild(tr);
    tr.querySelector(".viewItemsBtn").addEventListener("click", () => openItemsSheet(op.items));
  }
}

export async function loadBooks() {
  const books = await apiFetch("/api/books");
  const container = document.getElementById("books-list");
  const table = document.getElementById("books-table");
  const tbody = table ? table.querySelector("tbody") : null;
  if (!container || !tbody) return;

  // Build a quick stock map from inventory (by title)
  let stockByTitle = {};
  try {
    const customerId = resolveTargetCustomerId();
    if (customerId) {
      const inv = await apiFetch(`/api/users/inventory?id=${customerId}`);
      (inv.data || []).forEach(row => {
        // Inventory endpoint returns title + aggregated stock
        stockByTitle[row.title] = parseInt(row.stock || 0);
      });
    }
  } catch (_) {
    // ignore inventory load failures; treat as 0 stock
  }

  // Clear and populate rows
  tbody.innerHTML = "";
  books.data.forEach(b => {
    const tr = document.createElement('tr');
    const price = Number(b.unit_price);
    const stock = stockByTitle[b.title] || 0;
    const titleText = String(b.title || '');
    tr.id = `book-row-${b.id}`;
    tr.classList.add('book-row');
    tr.dataset.title = titleText.toLowerCase();
    tr.innerHTML = `
      <td class="book-title">${titleText}</td>
      <td class="book-price" data-price="${price}">${formatCurrency(price)}</td>
      <td class="book-qty">
        <div class="qty-control">
          <button type="button" class="qty-btn dec" aria-label="Diminuer la quantité" data-target="qty-${b.id}">−</button>
          <input type="number" name="qty-${b.id}" id="qty-${b.id}" min="0" step="1" value="0" data-stock="${stock}" aria-describedby="err-${b.id}">
          <button type="button" class="qty-btn inc" aria-label="Augmenter la quantité" data-target="qty-${b.id}">+</button>
        </div>
        <div class="stock-hint">
          <button type="button" class="stock-hint-btn" aria-label="Info stock" aria-describedby="stock-${b.id}" aria-expanded="false">i</button>
          <span class="stock-tooltip" id="stock-${b.id}" role="tooltip">${fr.form.hints.inStock(stock)}</span>
        </div>
        <div class="field-error" id="err-${b.id}"></div>
      </td>
      <td class="book-subtotal" data-subtotal-for="${b.id}">${formatCurrency(0)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Recalculate subtotals and grand total on qty changes
  function recalc() {
    let total = 0;
    let selected = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
      const priceCell = tr.querySelector('.book-price');
      const qtyInput = tr.querySelector('input[type="number"]');
      const subCell = tr.querySelector('.book-subtotal');
      const errCell = tr.querySelector('.field-error');
      const price = Number(priceCell?.dataset.price || 0);
      const qty = Number(qtyInput?.value || 0);
      const stock = Number(qtyInput?.dataset.stock || 0);
      const subtotal = price * qty;
      if (subCell) subCell.textContent = formatCurrency(subtotal);
      if (qtyInput && errCell) {
        const inlineToggle = document.getElementById('toggle-inline-errors');
        const inlineEnabled = inlineToggle ? inlineToggle.checked : true;
        let msg = '';
        if (qty < 0) {
          msg = fr.form.validation.nonNegative;
        } else if (qty === 0 && qtyInput.dataset.touched === 'true') {
          msg = fr.form.validation.positive;
        } else if (qty > stock) {
          msg = fr.form.validation.exceedsStock(stock);
        }
        errCell.textContent = inlineEnabled ? msg : '';
        if (inlineEnabled && msg) qtyInput.setAttribute('aria-invalid', 'true');
        else qtyInput.removeAttribute('aria-invalid');
      }
      if (qty > 0) {
        selected++;
        tr.classList.add('show-stock-hint');
        tr.classList.add('has-qty');
      } else {
        tr.classList.remove('show-stock-hint');
        tr.classList.remove('has-qty');
      }
      total += subtotal;
    });
    const selectedToggle = document.getElementById('toggle-selected-only');
    if (selectedToggle) {
      tbody.classList.toggle('selected-only', selectedToggle.checked);
    }
    const totalEl = document.getElementById('books-total-amount');
    if (totalEl) totalEl.textContent = formatCurrency(total);
    const empty = document.getElementById('books-empty-state');
    if (empty) {
      empty.textContent = selected > 0 ? fr.form.helperSelected : fr.form.helperIdle;
    }
  }

  tbody.addEventListener('input', (e) => {
    if (e.target && e.target.matches('input[type="number"]')) {
      e.target.dataset.touched = 'true';
      recalc();
    }
  });
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;
    const current = Number(input.value || 0);
    if (btn.classList.contains('inc')) {
      input.value = String(current + 1);
    } else if (btn.classList.contains('dec')) {
      input.value = String(Math.max(0, current - 1));
    }
    input.dataset.touched = 'true';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  tbody.addEventListener('click', (e) => {
    const hintBtn = e.target.closest('.stock-hint-btn');
    if (!hintBtn) return;
    const row = hintBtn.closest('tr');
    const hintWrap = hintBtn.closest('.stock-hint');
    if (!hintWrap) return;
    tbody.querySelectorAll('.stock-hint-btn[aria-expanded="true"]').forEach(btn => {
      if (btn !== hintBtn) btn.setAttribute('aria-expanded', 'false');
    });
    tbody.querySelectorAll('.stock-hint.is-open').forEach(el => {
      if (el !== hintWrap) el.classList.remove('is-open');
    });
    const expanded = hintBtn.getAttribute('aria-expanded') === 'true';
    const nextExpanded = expanded ? 'false' : 'true';
    hintBtn.setAttribute('aria-expanded', nextExpanded);
    hintWrap.classList.toggle('is-open', nextExpanded === 'true');
    if (!row) return;
    if (nextExpanded === 'true') {
      row.classList.add('show-stock-hint');
    } else {
      const qtyInput = row.querySelector('input[type="number"]');
      const qty = Number(qtyInput?.value || 0);
      if (qty <= 0) row.classList.remove('show-stock-hint');
    }
  });
  recalc();

  const searchInput = document.getElementById('books-search');
  function applySearchFilter() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    tbody.querySelectorAll('tr').forEach(tr => {
      const title = tr.dataset.title || '';
      const match = !query || title.includes(query);
      tr.classList.toggle('search-hidden', !match);
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => applySearchFilter());
  }

  // Inline errors toggle
  const inlineToggle = document.getElementById('toggle-inline-errors');
  if (inlineToggle) {
    inlineToggle.addEventListener('change', () => recalc());
  }
  const selectedToggle = document.getElementById('toggle-selected-only');
  if (selectedToggle) {
    selectedToggle.addEventListener('change', () => recalc());
  }

  await refreshOrderBlockedState();
}

export function setOrderBlockedState(blocked, message = fr.form.states.cannotOrderPending) {
  const box = document.getElementById("order-blocked-box");
  const btnOrder = document.querySelector('#operation-form button[data-action="order"]');
  const form = document.getElementById("operation-form");
  if (blocked) {
    if (box) {
      box.textContent = message || fr.form.states.cannotOrderPending;
      box.classList.remove("hidden");
    }
    if (btnOrder) {
      btnOrder.disabled = true;
      btnOrder.classList.add("btn-disabled");
      btnOrder.setAttribute("aria-disabled", "true");
    }
    if (form) form.dataset.orderBlocked = "true";
    return;
  }

  if (box) {
    box.textContent = "";
    box.classList.add("hidden");
  }
  if (btnOrder) {
    btnOrder.disabled = false;
    btnOrder.classList.remove("btn-disabled");
    btnOrder.removeAttribute("aria-disabled");
  }
  if (form) form.dataset.orderBlocked = "false";
}

export async function refreshOrderBlockedState() {
  try {
    const res = await apiFetch("/api/operations?type=order");
    const hasPending = (res.data || []).some(op => op.status === "pending");
    setOrderBlockedState(hasPending, hasPending ? fr.form.states.cannotOrderPending : "");
  } catch (_) {
    // Ignore; don't block ordering on a transient fetch error.
  }
}

function resolveTargetCustomerId() {
  const role = $("main.container").dataset.role; // decodeRole();
  const current = JSON.parse(localStorage.getItem("currentUser") || "null");
  if (role === "admin") {
    const detailRoot = document.getElementById("customer-detail");
    const cid = detailRoot?.dataset?.customerId;
    if (cid) return cid;
  }
  return current?.id;
}

export async function loadInventory() {
  const customerId = resolveTargetCustomerId();
  const res = await apiFetch(`/api/users/inventory?id=${customerId}`);

  const tbody = document.querySelector("#customer-inventory-table tbody");
  const table = document.getElementById("customer-inventory-table");
  const empty = document.getElementById("inventory-empty-state");
  tbody.innerHTML = "";
  let count = 0;
  (res.data || []).forEach(book => {
    if (!book.stock) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${book.title}</td>
        <td>${book.stock}</td>
      `;       // <td>${op.items.map(i => `${i.book_id} x${i.quantity}`).join(", ")}</td>
    count += 1;
    tbody.appendChild(tr);
  });
  if (count === 0) {
    if (empty) empty.classList.remove("hidden");
    if (table) table.classList.add("hidden");
  } else {
    if (empty) empty.classList.add("hidden");
    if (table) table.classList.remove("hidden");
  }
}

export async function loadCustomerOrders(typeFilter = "") {
  // if (loginForm) loginForm.parentNode.classList.add("hidden");
  const res = await apiFetch(`/api/operations?type=${typeFilter}`); // assumes Option A endpoints
  const table = document.getElementById("orders-table");
  const tbody = document.querySelector("#orders-table tbody");
  const empty = document.getElementById("history-empty-state");
  tbody.innerHTML = "";

  const rows = res.data || [];
  if (rows.length === 0) {
    if (empty) empty.classList.remove("hidden");
    if (table) table.classList.add("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");
  if (table) table.classList.remove("hidden");

  rows.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.date}</td>
      <td>${formatType(op.type || '')}</td>
      <td>${formatStatus(op.status || '')}</td>
      <td>
        <button class="viewItemsBtn btn">Voir les articles</button>
        ${op.status === "pending"
        ? `<button data-id="${op.id}" class="cancelBtn btn btn-danger">Annuler</button>`
        : ""}
      </td>
    `;
    tbody.appendChild(tr);
    tr.lastElementChild.querySelector(".viewItemsBtn").addEventListener("click", () => openItemsSheet(op.items))
  });
}

export async function loadStats() {
  const customerId = resolveTargetCustomerId();
  const res = await apiFetch(`/api/users/${customerId}/stats`);
  const data = res.data || {};

  // Safe numbers
  const totalSales = Number(data.total_sales ?? 0);
  const totalDelivered = Number(data.total_delivered ?? 0);
  const totalAmount = Number(data.total_amount ?? 0);
  const ratio = Number(data.delivery_ratio ?? 0); // 0.3 means 30%

  // Helpers
  const ratioPct = Math.round(ratio * 100); // 30
  const clampedPct = Math.max(0, Math.min(100, ratioPct));

  const formattedAmount = formatCurrency(totalAmount);

  const empty = document.getElementById("stats-empty-state");
  const grid = document.getElementById("stats-grid");
  const footer = document.getElementById("stats-footer");
  const hasData = totalSales > 0 || totalDelivered > 0 || totalAmount > 0;
  if (!hasData) {
    if (empty) empty.classList.remove("hidden");
    if (grid) grid.classList.add("hidden");
    if (footer) footer.classList.add("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");
  if (grid) grid.classList.remove("hidden");
  if (footer) footer.classList.remove("hidden");

  // Update KPIs
  const elSales = document.getElementById("total-sales");
  if (elSales) elSales.textContent = String(totalSales);

  const elDelivered = document.getElementById("total-delivered");
  if (elDelivered) elDelivered.textContent = String(totalDelivered);

  const elRevenue = document.getElementById("total-revenue");
  if (elRevenue) elRevenue.textContent = formattedAmount;

  const elRatio = document.getElementById("delivery-ratio");
  if (elRatio) elRatio.textContent = `${ratioPct}%`;

  // Helper line
  const elHelper = document.getElementById("stats-helper");
  if (elHelper) elHelper.textContent = fr.stats.ratioLine(totalSales, totalDelivered, ratioPct);

  // Progress bar
  const elProgress = document.getElementById("stats-progress");
  if (elProgress) elProgress.style.width = `${clampedPct}%`;

  // Status pill
  const elStatus = document.getElementById("stats-status");
  if (elStatus) {
    // reset classes
    elStatus.classList.remove("ok", "warn", "bad");

    // Avoid weird messaging when delivered is 0
    if (totalDelivered === 0) {
      elStatus.classList.add("warn");
      elStatus.textContent = "Aucune livraison enregistrée pour l’instant.";
      return;
    }

    const target = 0.30; // 30%
    if (ratio >= target) {
      elStatus.classList.add("ok");
      elStatus.textContent = `Bon rythme de vente ✅ (objectif ${Math.round(target * 100)}%)`;
    } else if (ratio >= 0.15) {
      elStatus.classList.add("warn");
      elStatus.textContent = `Rythme moyen ⚠️ (objectif ${Math.round(target * 100)}%)`;
    } else {
      elStatus.classList.add("bad");
      elStatus.textContent = `Rythme à améliorer ⛔ (objectif ${Math.round(target * 100)}%)`;
    }
  }
}



function logout() {
  localStorage.removeItem("token"); // clear token
  localStorage.removeItem("currentUser");  // clear user info
  loginForm.reset();
  renderPage(true);
}

function clearErrors() {
  const host = document.getElementById("alerts");
  if (host) {
    host.className = "hidden";
    host.innerHTML = "";
  }
}

function showError(message) {
  alert(message);  // quick immediate feedback

  const box = document.getElementById("error-box");
  if (box) {
    const p = document.createElement("p");
    p.textContent = message;
    // p.style.color = "red";
    box.appendChild(p);
    box.classList.remove("hidden");
  }
}// missing helpers from /static/app.js needed here

// replaced by openItemsSheet()
