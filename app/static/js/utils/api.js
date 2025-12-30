import { $, getCSRF, decodeRole } from "./dom.js";
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
    const err = new Error("API Request failed");
    err.status = res.status;
    err.payload = data;
    err.url = res.url;
    throw err;
  }

  return data;
}

export async function loadAdminOperations() {
  // loginForm.parentNode.classList.add("hidden");
  const ops = await apiFetch("/api/admin/operations");
  const tbody = document.getElementById("admin-ops-table").querySelector("tbody");
  tbody.innerHTML = "";
  ops.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.date}</td>
      <td><a href="/admin/users/${op.customer.id}">${op.customer.name || ""}</a></td>
      <td>${op.type || ''}</td>
      <td>${op.status || ''}</td>
      <td>
        <button class="viewItemsBtn btn">View items</button>
        <button data-action="delete" data-id="${op.id}" class="btn btn-danger">Delete</button>
        ${op.type === "order" && op.status === "pending" ? `<button data-action=\"confirm\" data-id=\"${op.id}\" class=\"btn btn-accent\">Confirm</button>` : ""}
      </td>
    `;
    tbody.appendChild(tr);
    tr.lastElementChild.querySelector(".viewItemsBtn").addEventListener("click", () => openItemsSheet(op.items))
  });
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
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });
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
      <td class="book-price" data-price="${price}">${fmt.format(price)}</td>
      <td class="book-qty">
        <div class="qty-control">
          <button type="button" class="qty-btn dec" aria-label="Decrease quantity" data-target="qty-${b.id}">−</button>
          <input type="number" name="qty-${b.id}" id="qty-${b.id}" min="0" step="1" value="0" data-stock="${stock}" aria-describedby="err-${b.id}">
          <button type="button" class="qty-btn inc" aria-label="Increase quantity" data-target="qty-${b.id}">+</button>
        </div>
        <div class="stock-hint">
          <button type="button" class="stock-hint-btn" aria-label="Stock info" aria-describedby="stock-${b.id}" aria-expanded="false">i</button>
          <span class="stock-tooltip" id="stock-${b.id}" role="tooltip">in stock: ${stock}</span>
        </div>
        <div class="field-error" id="err-${b.id}"></div>
      </td>
      <td class="book-subtotal" data-subtotal-for="${b.id}">${fmt.format(0)}</td>
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
      if (subCell) subCell.textContent = fmt.format(subtotal);
      if (qtyInput && errCell) {
        const inlineToggle = document.getElementById('toggle-inline-errors');
        const inlineEnabled = inlineToggle ? inlineToggle.checked : true;
        let msg = '';
        if (qty < 0) {
          msg = 'Must be greater than or equal to 0';
        } else if (qty === 0 && qtyInput.dataset.touched === 'true') {
          msg = 'Enter a positive quantity';
        } else if (qty > stock) {
          msg = `Exceeds available stock (max ${stock})`;
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
    if (totalEl) totalEl.textContent = fmt.format(total);
    const empty = document.getElementById('books-empty-state');
    if (empty) {
      empty.textContent = selected > 0 ? 'Adjust quantities as needed' : 'Enter quantity to begin';
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

export function setOrderBlockedState(blocked, message = "You already have a pending request.") {
  const box = document.getElementById("order-blocked-box");
  const btnOrder = document.querySelector('#operation-form button[data-action="order"]');
  const form = document.getElementById("operation-form");
  if (blocked) {
    if (box) {
      box.textContent = message || "You already have a pending request.";
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
    setOrderBlockedState(hasPending, hasPending ? "You already have a pending request." : "");
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
  console.log(current)
  return current?.id;
}

export async function loadInventory() {
  const customerId = resolveTargetCustomerId();
  const res = await apiFetch(`/api/users/inventory?id=${customerId}`);

  const tbody = document.querySelector("#customer-inventory-table tbody");
  tbody.innerHTML = "";
  res.data.forEach(book => {
    const tr = document.createElement("tr");
    if (book.stock) {
      tr.innerHTML = `
          <td>${book.title}</td>
          <td>${book.stock}</td>
        `;       // <td>${op.items.map(i => `${i.book_id} x${i.quantity}`).join(", ")}</td>
    }
    tbody.appendChild(tr);
  });
}

export async function loadCustomerOrders(typeFilter = "") {
  // if (loginForm) loginForm.parentNode.classList.add("hidden");
  const res = await apiFetch(`/api/operations?type=${typeFilter}`); // assumes Option A endpoints
  const tbody = document.querySelector("#orders-table tbody");
  tbody.innerHTML = "";

  res.data.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.date}</td>
      <td>${op.type || ''}</td>
      <td>${op.status || ''}</td>
      <td>
        <button class="viewItemsBtn btn">View items</button>
        ${op.type === "order" && op.status === "pending"
        ? `<button data-id="${op.id}" class="cancelBtn btn btn-danger">Cancel</button>`
        : ""}
      </td>
    `;
    tbody.appendChild(tr);
    tr.lastElementChild.querySelector(".viewItemsBtn").addEventListener("click", () => openItemsSheet(op.items))
  });
}

export async function loadStats(salesChart) {
  const customerId = resolveTargetCustomerId();
  const res = await apiFetch(`/api/users/${customerId}/stats`)
  const data = res.data;

  if (!salesChart) {
    const ctx = document.getElementById("sales-chart").getContext("2d");
    salesChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Total Sales", "Delivered"],
            datasets: [{
                label: "Sales Performance",
                data: [data.total_sales, data.total_delivered],
                backgroundColor: [
                    data.delivery_ratio < 0.7 ? "red" : "green",
                    "blue"
                ]
            }]
        }
    });
  } else {
    // 🔄 Update data only
    salesChart.data.datasets[0].data = [
        data.total_sales,
        data.total_delivered
    ];
    salesChart.data.datasets[0].backgroundColor[0] =
        data.delivery_ratio < 0.7 ? "red" : "green";
    salesChart.update();
  }

  document.getElementById("total-sales").textContent = `${data.total_sales}`; 
  document.getElementById("total-revenue").textContent = `$${data.total_amount}`;
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
