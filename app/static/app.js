// === Helpers ===
function getToken() {
  return localStorage.getItem("token");
}

function clearErrors() {
  const box = document.getElementById("errorBox");
  if (box) box.innerHTML = "";
}

function showError(message) {
  alert(message);  // quick immediate feedback

  const box = document.getElementById("errorBox");
  if (box) {
    const p = document.createElement("p");
    p.textContent = message;
    p.style.color = "red";
    box.appendChild(p);
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
        showError(data.msg || res.statusText);
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

// === Init ===
document.addEventListener("DOMContentLoaded", async () => {
  const role = decodeRole();
  if (role === "admin") {
    document.getElementById("adminDashboard").style.display = "block";
    loadAdminOperations();
  } else if (role === "customer") {
    document.getElementById("customerDashboard").style.display = "block";
    loadBooks();
    loadCustomerOrders();
    loadCustomerSales();
  }
});

// === Customer ===
async function loadBooks() {
  const books = await apiFetch("/api/books");
  const container = document.getElementById("booksList");
  container.innerHTML = "";
  books.data.forEach(b => {
    const row = document.createElement("div");
    row.innerHTML = `
      <label>
        <input type="checkbox" name="book" value="${b.id}">
        ${b.title} ($${b.unit_price})
      </label>
      Qty: <input type="number" name="qty-${b.id}" min="0" value="0">
    `;
    container.appendChild(row);
  });
}

async function loadCustomerOrders() {
  const res = await apiFetch("/api/orders"); // assumes Option A endpoints
//   console.log(res.data);
//   debugger
  const tbody = document.querySelector("#ordersTable tbody");
  tbody.innerHTML = "";
  res.data.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.date}</td>
      <td>${op.op_type}</td>
      <td>
        <button disabled class="viewItemsBtn">View items</button>
        ${op.op_type === "pending" 
          ? `<button data-id="${op.id}" class="cancelBtn">Cancel</button>` 
          : ""}
      </td>
    `;
    tbody.appendChild(tr);
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

async function loadCustomerSales() {
  const res = await apiFetch("/api/sales");
  const tbody = document.querySelector("#salesTable tbody");
  tbody.innerHTML = "";
  res.data.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.date}</td>
      <td>
        <button disabled class="viewItemsBtn">View items</button>
      </td>
    `;       // <td>${op.items.map(i => `${i.book_id} x${i.quantity}`).join(", ")}</td>

    tbody.appendChild(tr);
  });
}


// Handle customer operations
document.getElementById("operationForm")?.addEventListener("click", async (e) => {
  if (e.target.tagName !== "BUTTON") return;
  e.preventDefault();
  const action = e.target.dataset.action;
  if (action === "order") {
    await submitOperation("/api/orders");
  } else if (action === "sale") {
    await submitOperation("/api/sales");
  }
//    else if (action === "cancel") {
//     const id = prompt("Enter pending order ID to cancel:");
//     if (id) await apiFetch(`/api/orders/${id}`, { method: "DELETE" });
//   }
  loadBooks();
  loadCustomerOrders();
  loadCustomerSales();
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
  // alert(`Operation created: ${JSON.stringify(res)}`);
}

// === Admin ===
async function loadAdminOperations() {
  const ops = await apiFetch("/api/admin/operations");
  const tbody = document.getElementById("adminOpsTable").querySelector("tbody");
  tbody.innerHTML = "";
  ops.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.id}</td>
      <td>${op.op_type}</td>
      <td>${op.date}</td>
      <td>${op.customer.name || ""}</td>
      <td>
        <button disabled class="viewItemsBtn">View items</button>
        ${op.op_type === "pending" ? `<button data-action="confirm" data-id="${op.id}">Confirm</button>` : ""}
        <button data-action="delete" data-id="${op.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Handle admin actions
document.getElementById("adminOpsTable")?.addEventListener("click", async (e) => {
  if (e.target.tagName !== "BUTTON") return;
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
document.getElementById("addBookForm")?.addEventListener("submit", async (e) => {
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
