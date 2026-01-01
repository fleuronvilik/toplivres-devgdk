import { $, show, hide } from '../utils/dom.js';
import { bindTabs } from '../ui/tabs.js';
import { bindUserMenu } from '../ui/userMenu.js';
import { apiFetch, loadBooks, loadCustomerOrders, loadInventory, loadStats } from '../utils/api.js';
import { delegate } from '../utils/events.js';
import { bindOrderForm } from '../features/orderForm.js';

let unbindHistory = [], unbindNavigation, unbindOrderForm, unbindUserMenu;

export async function mountCustomer(loaded) {
  show($('#customer-dashboard')); show($('#customer-navigation'));
  const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const nameEl = $('#customer-name'); if (nameEl) nameEl.textContent = u.name || 'Client';
  const formElt = $('#operation-form');

  if (!loaded.custBooks)  { await loadBooks();          loaded.custBooks  = true; }
  if (!loaded.custOrders) { await loadCustomerOrders(); loaded.custOrders = true; }
  if (!loaded.inventory)  { await loadInventory();      loaded.inventory  = true; }
  if (!loaded.stats)      { await loadStats();          loaded.stats      = true; }

  if (!unbindOrderForm && formElt) {
    unbindOrderForm = bindOrderForm(formElt, async function ({action, items}) {
      console.count('orderForm:submit')
      if (action === 'order') {
        await apiFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify({items})
        });
        await loadCustomerOrders();
      } else if (action === 'sale') {
        await apiFetch('/api/sales', {
          method: 'POST',
          body: JSON.stringify({items})
        });
        await loadCustomerOrders();
        await loadInventory();
      }
    })
  }

  if (unbindHistory.length === 0) {
    const customerHistory = $('#history-tab');
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

  if (!unbindNavigation) {
    const navElt = $('#customer-navigation');
    const tabButtons = navElt ? navElt.querySelectorAll('.tab-link') : [];
    const tabPanes = document.querySelectorAll('.tab-pane');
    unbindNavigation = bindTabs(tabButtons, tabPanes, { defaultTab: 'orders' });
  }

  if (!unbindUserMenu) {
    unbindUserMenu = bindUserMenu($('#customer-navigation'));
  }
}

export function unmountCustomer() {
  unbindNavigation?.();
  unbindNavigation = null;
  unbindHistory.forEach(off => off());
  unbindHistory = [];
  unbindOrderForm();
  unbindOrderForm = null;
  unbindUserMenu?.();
  unbindUserMenu = null;
  hide($('#customer-dashboard')); //).classList.add('hidden');
  hide($('#customer-navigation')); //.classList.add('hidden');
}

export async function mountCustomerDetailForAdmin(loaded) {
  const root = document.querySelector('#customer-detail');
  if (!root) {
    console.warn('mountCustomerDetailForAdmin: #customer-detail introuvable');
    return;
  }
  show(root);
  if (!loaded.inventory) { await loadInventory(); loaded.inventory = true; }
  if (!loaded.stats) { await loadStats(); loaded.stats = true; }
}
