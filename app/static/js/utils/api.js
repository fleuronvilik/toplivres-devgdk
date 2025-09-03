import { getToken, decodeRole } from "./dom.js";

// Generic fetch with error handling & auth
// Usage: await apiFetch("/api/some-endpoint", { method: "POST", body: JSON.stringify(data) });

export async function apiFetch(path, options = {}) {
  clearErrors();
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...options.headers,
    }
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    // Standardized error format: { "errors": { category: [messages...] } }
    if (data.errors) {
      for (const [category, messages] of Object.entries(data.errors)) {
        messages.forEach(msg => showError(`[${category}] ${msg}`));
      }
    } else {
      showError(data.msg || res.statusText);
      logout();
    }
    throw new Error("API Request failed"); //new Error(await res.text());
  }
  return data;
}

export async function loadAdminOperations() {
  // loginForm.parentNode.classList.add("hidden");
  const ops = await apiFetch("/api/admin/operations");
  const tbody = document.getElementById("adminOpsTable").querySelector("tbody");
  tbody.innerHTML = "";
  ops.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.op_type}</td>
      <td>${op.date}</td>
      <td><a href="/admin/users/${op.customer.id}">${op.customer.name || ""}</a></td>
      <td>
        <button class="viewItemsBtn btn">View items</button>
        <button data-action="delete" data-id="${op.id}" class="btn btn-danger">Delete</button>
        ${op.op_type === "pending" ? `<button data-action="confirm" data-id="${op.id}" class="btn btn-accent">Confirm</button>` : ""}
      </td>
    `;
    tbody.appendChild(tr);
    tr.lastElementChild.querySelector(".viewItemsBtn").addEventListener("click", viewItems(op.items))
  });
}

export async function loadBooks() {
  const books = await apiFetch("/api/books");
  const container = document.getElementById("booksList");
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
}

export async function loadInventory() {
  let customerId = JSON.parse(localStorage.getItem("currentUser")).id;
  if (decodeRole() === "admin") customerId = window.PAGE_CONTEXT.customerId;
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
  const tbody = document.querySelector("#ordersTable tbody");
  tbody.innerHTML = "";

  res.data.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.date}</td>
      <td>${op.op_type}</td>
      <td>
        <button class="viewItemsBtn btn">View items</button>
        ${op.op_type === "pending"
        ? `<button data-id="${op.id}" class="cancelBtn btn btn-danger">Cancel</button>`
        : ""}
      </td>
    `;
    tbody.appendChild(tr);
    tr.lastElementChild.querySelector(".viewItemsBtn").addEventListener("click", viewItems(op.items))
  });
}

export async function loadStats(salesChart) {
  let customerId = JSON.parse(localStorage.getItem("currentUser")).id;
  if (decodeRole() == "admin") customerId = window.PAGE_CONTEXT.customerId;
  const res = await apiFetch(`/api/users/${customerId}/stats`)
  const data = res.data;

  if (!salesChart) {
    const ctx = document.getElementById("salesChart").getContext("2d");
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
  const box = document.getElementById("errorBox");
  if (box) {
    box.classList.add("hidden");
    box.innerHTML = "";
  }
}

function showError(message) {
  alert(message);  // quick immediate feedback

  const box = document.getElementById("errorBox");
  if (box) {
    const p = document.createElement("p");
    p.textContent = message;
    // p.style.color = "red";
    box.appendChild(p);
    box.classList.remove("hidden");
  }
}// missing helpers from /static/app.js needed here

function viewItems(items) {
  return function () {
    const itemsList = items.map(i => {
      let qty = i.quantity
      if (qty < 0) qty = -qty;
      return `${qty}x ${i.book}`
    })
    alert(itemsList.join("\n"));
  }
}
