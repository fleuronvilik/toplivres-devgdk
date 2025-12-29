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
  container.innerHTML = "";
  books.data.forEach(b => {
    const row = document.createElement("div");
    row.innerHTML = `
      <label for="qty-${b.id}">
        <span class="title">${b.title}</span>
        <span class="price">($${b.unit_price})</span>
      </label>
      Qty: <input type="number" name="qty-${b.id}" id="qty-${b.id}" min="0" value="0">
    `;
    row.classList.add("grid-row");
    container.appendChild(row);
  });

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
