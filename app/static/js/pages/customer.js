import { $, show } from '../utils/dom.js';
import { apiFetch, loadBooks, loadCustomerOrders, loadInventory, loadStats } from '../utils/api.js';
import { delegate } from '../utils/events.js';
import { bindOrderForm } from '../features/orderForm.js';

let unbindHistory = [];

export async function mountCustomer(loaded) {
  show($('#customerDashboard')); show($('#customerNavigation'));
  const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const nameEl = $('#customer-name'); if (nameEl) nameEl.textContent = u.name || 'Customer';
  const formElt = $('#operationForm');
  //let salesChart;

  if (!loaded.custBooks)  { await loadBooks();          loaded.custBooks  = true; }
  if (!loaded.custOrders) { await loadCustomerOrders(); loaded.custOrders = true; }
  if (!loaded.inventory)  { await loadInventory();      loaded.inventory  = true; }
  if (!loaded.stats)      { await loadStats();          loaded.stats      = true; }

  bindOrderForm(formElt, async function ({action, items}) {
    console.log(action, items);
    let data;
    if (action === 'order') {
      data = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({items})
      });
      await loadCustomerOrders();
    } else if (action === 'sale') {
      data = await apiFetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify({items})
      });
      await loadCustomerOrders();
      await loadInventory();
    }
    alert('Operation submitted', data);
  })

  if (unbindHistory.length === 0) {
    const customerHistory = $('#customerHistory');
    unbindHistory.push(
      delegate(
        customerHistory, 'click', 'button.cancelBtn', async (e) => {
          const id = e.target.dataset.id;
          if (e.target.classList.contains('cancelBtn')) {
            await apiFetch(`/api/orders/${id}`, { method: 'DELETE' });
            await loadCustomerOrders();
            //await loadInventory();
          }
        }
      ),
      delegate(
        customerHistory, 'click', 'button.filter-btn', async (e) => {
          await loadCustomerOrders(e.target.dataset.filter || '');
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
        }
      )
    );
  }

  // Tabs       

  

  document.querySelectorAll(".tab-link").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-link").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

export function unmountCustomer() {
  unbindHistory.forEach(off => off());
  unbindHistory = [];
}

export async function mountCustomerDetailForAdmin(loaded) {
  const root = document.querySelector('#customerDetail');
  const nav = document.querySelector('#customerNavigation');
  if (nav) show(nav);
  show(root);
  if (!loaded.inventory) { await loadInventory(); loaded.inventory = true; }
  if (!loaded.stats) { await loadStats(); loaded.stats = true; }

  // Activate Inventory tab by default
  const allLinks = document.querySelectorAll('.tab-link');
  const allPanes = document.querySelectorAll('.tab-pane');
  allLinks.forEach(b => b.classList.remove('active'));
  allPanes.forEach(p => p.classList.remove('active'));
  const invBtn = document.querySelector('.tab-link[data-tab="customerInventory"]');
  const invPane = document.getElementById('customerInventory');
  if (invBtn) invBtn.classList.add('active');
  if (invPane) invPane.classList.add('active');

  // Tabs handler (duplicate of customer tabs setup)
  document.querySelectorAll('.tab-link').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-link').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = document.getElementById(btn.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });
}
