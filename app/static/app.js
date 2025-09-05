const loginForm = document.getElementById("loginForm");
const customerDashboardElt = document.getElementById("customer-dashboard");
const adminDashboardElt = document.getElementById("admin-dashboard");
const customerNavigationElt = document.getElementById("customer-navigation");

let currentUser;
let salesChart; // persist chart instance for updates


/* 
1. page shows login form only
2. user login, token and user stored localStorage
3. page shows dashboard according to role and user info
4. user logout remove token and user and reload the page so that
5. with token being null
   * we display
*/

// === Helpers ===
function getToken() {
  return localStorage.getItem("token");
}

function logout() {
  localStorage.removeItem("token"); // clear token
  localStorage.removeItem("currentUser");  // clear user info
  loginForm.reset();
  renderPage(true);
}

function clearErrors() {
  const box = document.getElementById("error-box");
  if (box) {
    box.classList.add("hidden");
    box.innerHTML = "";
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
}

async function apiFetch(path, options = {}) {
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
      logout(); // showError(data.msg || res.statusText);
    }
    throw new Error("API Request failed"); //new Error(await res.text());
  }
  return data;
}

function decodeRole() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch (e) {
    return null;
  }
}

function viewItems(items) {
  return function () {
    itemsList = items.map(i => {
      let qty = i.quantity
      if (qty < 0) qty = -qty;
      return `${qty}x ${i.book}`
    })
    alert(itemsList.join("\n"));
  }
}

async function renderPage(asLogout = false) {
  const role = decodeRole();
  if (role === "admin" && adminDashboardElt) {
    adminDashboardElt.classList.remove("hidden");
    loadAdminOperations();
  } else if (role == "admin" && customerDashboardElt) {
    currentUser = JSON.parse(localStorage.getItem("currentUser"));
    loadInventory();
    loadStats();
    customerDashboardElt.classList.remove("hidden");
    customerNavigationElt.classList.remove("hidden");
  } else if (role == "customer" && adminDashboardElt) {
    window.location = "/";
  } else if (role === "customer" && customerDashboardElt) {
    // if (customerDashboardElt)
    currentUser = JSON.parse(localStorage.getItem("currentUser"));
    loadBooks();
    loadCustomerOrders();
    loadInventory();
    loadStats();
    document.getElementById("customer-name").textContent = `${currentUser["name"]}`;
    customerDashboardElt.classList.remove("hidden");
    customerNavigationElt.classList.remove("hidden");
  } else {
    if (asLogout) {
      if (adminDashboardElt) adminDashboardElt.classList.add("hidden");
      if (customerDashboardElt) customerDashboardElt.classList.add("hidden");
      if (customerNavigationElt) customerNavigationElt.classList.add("hidden");

      loginForm.parentNode.classList.remove("hidden");
      loginForm.removeEventListener("submit", loginHandler);
      return;
    }
    loginForm.addEventListener("submit", loginHandler);
  }

  async function loginHandler(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      // Expect backend returns { token: "..." }
      localStorage.setItem("token", data.access_token);

      const userData = await apiFetch("/api/users/me");
      localStorage.setItem("currentUser", JSON.stringify(userData));
      renderPage();
    } catch (err) {
      console.error(err);
    }
  }
}

// === Init ===
renderPage()// document.addEventListener("DOMContentLoaded", renderPage);

// === Customer ===
async function loadBooks() {
  const books = await apiFetch("/api/books");
  const container = document.getElementById("books-list");
  container.innerHTML = "";
  books.data.forEach(b => {
    const row = document.createElement("div");
    row.innerHTML = `
      <label>
        <input type="checkbox" name="book" value="${b.id}">
        <span class="title">${b.title}</span>
        <span class="price">($${b.unit_price})</span>
      </label>
      Qty: <input type="number" name="qty-${b.id}" min="0" value="0">
    `;
    row.classList.add("grid-row");
    container.appendChild(row);
  });
}

async function loadCustomerOrders(typeFilter = "") {
  // debugger
  if (loginForm) loginForm.parentNode.classList.add("hidden");
  const res = await apiFetch(`/api/operations?type=${typeFilter}`); // assumes Option A endpoints
  const tbody = document.querySelector("#orders-table tbody");
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

  // Attach cancel handlers
  document.querySelectorAll(".cancelBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await apiFetch(`/api/orders/${btn.dataset.id}`, { method: "DELETE" });
        alert("Order cancelled");
        loadCustomerOrders(); // reload table
      } catch (err) { /* showError already handles */ }
    });
  });
}

// Attach filter handlers
document.querySelectorAll("#history-tab .filter-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    document.querySelector("header .btn-accent").classList.remove("btn-accent");
    e.target.classList.add("btn-accent");
    loadCustomerOrders(e.target.dataset.filter)
  });
})

document.querySelectorAll(".tab-link").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-link").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    const paneId = `${btn.dataset.tab}-tab`;
    const pane = document.getElementById(paneId);
    if (pane) pane.classList.add("active");
  });
});

// Logout button
const logoutElt = document.getElementById("logout-link");
if (logoutElt) logoutElt.onclick = logout;

async function loadInventory() {
  loginForm.parentNode.classList.add("hidden");

  let customerId = currentUser.id;
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


// Handle customer operations
document.getElementById("operation-form")?.addEventListener("click", async (e) => {
  if (e.target.tagName !== "BUTTON") return;
  e.preventDefault();
  const action = e.target.dataset.action;
  if (action === "order") {
    await submitOperation("/api/orders");
    alert("New pending otder");
  } else if (action === "sale") {
    await submitOperation("/api/sales");
    alert("Sales report sent");
  }
  // debugger
  // renderPage();
  //    else if (action === "cancel") {
  //     const id = prompt("Enter pending order ID to cancel:");
  //     if (id) await apiFetch(`/api/orders/${id}`, { method: "DELETE" });
  //   }
  // loadBooks();
  
});

async function submitOperation(endpoint) {
  const checked = Array.from(document.querySelectorAll("input[name=book]:checked"));
  const items = checked.map(cb => {
    const qty = document.querySelector(`input[name=qty-${cb.value}]`).value;
    return { book_id: parseInt(cb.value), quantity: parseInt(qty) };
  }).filter(it => it.quantity > 0);
  if (items.length === 0) return alert("Select at least one book with quantity > 0");

  const res = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify({ items })
  });
  loadCustomerOrders();
  loadInventory();
  loadStats();
  // alert(`Operation created: ${JSON.stringify(res)}`);
}

// === Admin ===
async function loadAdminOperations() {
  loginForm.parentNode.classList.add("hidden");
  const ops = await apiFetch("/api/admin/operations");
  const tbody = document.getElementById("admin-ops-table").querySelector("tbody");
  tbody.innerHTML = "";
  ops.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.op_type}</td>
      <td>${op.date}</td>
      <td><a href="/users/${op.customer.id}">${op.customer.name || ""}</a></td>
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

// Handle admin actions
document.getElementById("admin-ops-table")?.addEventListener("click", async (e) => {
  if (e.target.tagName !== "BUTTON") return;
  if (e.target.classList[0] == "viewItemsBtn") return;
  const id = e.target.dataset.id;
  const action = e.target.dataset.action;
  if (action === "confirm") {
    await apiFetch(`/api/admin/orders/${id}/confirm`, { method: "PUT" });
  } else if (action === "delete") {
    await apiFetch(`/api/admin/operations/${id}`, { method: "DELETE" });
  }
  await loadAdminOperations();
});

// Add book
document.getElementById("add-book-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = e.target.title.value;
  const unit_price = parseFloat(e.target.unit_price.value);
  await apiFetch("/api/admin/books", {
    method: "POST",
    body: JSON.stringify({ title, unit_price })
  });
  alert("Book added");
  e.target.reset();
});

// collapsible

// const toggleBtn = document.querySelector(".collapse-toggle");
// const form = document.querySelector(".collapsible-content");

// toggleBtn.addEventListener("click", () => {
//   form.classList.toggle("collapsed");
//   if (form.classList.contains("collapsed")) {
//     toggleBtn.textContent = "New Order / Sale ►";
//   } else {
//     toggleBtn.textContent = "New Order / Sale ▼";
//   }
// });

async function loadStats() {
  let customerId = currentUser.id;
  if (decodeRole() == "admin") customerId = window.PAGE_CONTEXT.customerId;
  const res = await apiFetch(`/api/users/${customerId}/stats`)
  const data = res.data;
  // const { data } = await res.json();

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
