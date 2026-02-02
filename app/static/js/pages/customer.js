import { $, show, hide } from '../utils/dom.js';
import { bindTabs } from '../ui/tabs.js';
import { bindUserMenu } from '../ui/userMenu.js';
import { apiFetch, loadBooks, loadCustomerOrders, loadInventory, loadStats, refreshBooksStock, refreshOrderBlockedState } from '../utils/api.js';
import { delegate } from '../utils/events.js';
import { bindOrderForm } from '../features/orderForm.js';

let unbindHistory = [], unbindNavigation, unbindOrderForm, unbindUserMenu, statsPoller, unbindStatsHash, unbindTabRefresh;
let refreshActiveNow = null;

function startStatsAutoRefresh() {
  if (statsPoller) return;
  const refreshIfActive = async () => {
    if (document.hidden) return;
    const statsPane = document.getElementById('stats-tab');
    const historyPane = document.getElementById('history-tab');
    const inventoryPane = document.getElementById('inventory-tab');
    const opsPane = document.getElementById('ops-tab');
    const tasks = [];
    if (statsPane?.classList.contains('active')) tasks.push(loadStats({ silent: true }));
    if (historyPane?.classList.contains('active')) tasks.push(loadCustomerOrders("", { silent: true }));
    if (inventoryPane?.classList.contains('active')) tasks.push(loadInventory({ silent: true }));
    if (opsPane?.classList.contains('active')) {
      tasks.push(refreshBooksStock({ silent: true }));
      tasks.push(refreshOrderBlockedState({ silent: true }));
    }
    if (tasks.length === 0) return;
    try {
      await Promise.all(tasks);
    } catch (_) {
      // Ignore transient errors; next poll will retry.
    }
  };
  refreshActiveNow = refreshIfActive;
  if (!unbindStatsHash) {
    const onHashChange = () => refreshIfActive();
    window.addEventListener('hashchange', onHashChange);
    unbindStatsHash = () => window.removeEventListener('hashchange', onHashChange);
  }
  statsPoller = setInterval(async () => {
    await refreshIfActive();
  }, 10000);
  refreshIfActive();
}

export async function mountCustomer(loaded) {
  show($('#customer-dashboard')); show($('#customer-navigation'));
  const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const nameEl = $('#customer-name'); if (nameEl) nameEl.textContent = u.name || 'Client';
  const formElt = $('#operation-form');

  if (!loaded.custBooks)  { await loadBooks();          loaded.custBooks  = true; }
  if (!loaded.custOrders) { await loadCustomerOrders(); loaded.custOrders = true; }
  if (!loaded.inventory)  { await loadInventory();      loaded.inventory  = true; }
  if (!loaded.stats)      { await loadStats();          loaded.stats      = true; }
  startStatsAutoRefresh();

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
        await refreshBooksStock();
        await loadStats();
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
            await refreshOrderBlockedState();
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
    unbindNavigation = bindTabs(tabButtons, tabPanes, { defaultTab: 'ops' });
    if (!unbindTabRefresh && navElt) {
      const onTabClick = (e) => {
        if (!e.target.closest('.tab-link')) return;
        refreshActiveNow?.();
      };
      navElt.addEventListener('click', onTabClick);
      unbindTabRefresh = () => navElt.removeEventListener('click', onTabClick);
    }
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
  if (statsPoller) {
    clearInterval(statsPoller);
    statsPoller = null;
  }
  if (unbindStatsHash) {
    unbindStatsHash();
    unbindStatsHash = null;
  }
  if (unbindTabRefresh) {
    unbindTabRefresh();
    unbindTabRefresh = null;
  }
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
