import { $, show, hide, redirect, getToken, decodeRole } from '../utils/dom.js';
import { apiFetch } from '../utils/api.js';
import { mountAdmin } from '../pages/admin.js';
import { mountCustomer, mountCustomerDetailForAdmin } from '../pages/customer.js';

// cache elements once
const adminDashboardElt     = $("#admin-dashboard");
const customerDashboardElt  = $("#customer-dashboard");
const customerNavigationElt = $("#customer-navigation");
const customerDetailElt     = $("#customer-detail");
const loginForm             = $("#loginForm");

// use flags so you don't reload data twice
let loaded = {
  adminOps: false,
  customerBooks: false,
  customerOrders: false,
  inventory: false,
  stats: false,
};

// Shell detection (what page shell am I on?)
function getPageKind() {
  if (adminDashboardElt) return "admin";
  if (customerDetailElt) return "customer-detail"; // admin looking at a user
  if (customerNavigationElt) return "customer";      // homepage
  return "unknown";
}

function hideAll() {
  hide(adminDashboardElt);
  hide(customerDashboardElt);
  hide(customerNavigationElt);
  hide($(".site-header"));
  hide(customerDetailElt);
  if (loginForm) hide(loginForm.parentNode); // or wrapper
}

function renderLoginOnly() {
  hideAll();
  if (loginForm) {
    show(loginForm.parentNode);
    // attach once to avoid duplicate submits
    loginForm.removeEventListener("submit", loginHandler);
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
      guardRouteAndRender();
    } catch (err) {
      console.error(err);
    }
  }
}

// local helper; do NOT export
function navigate(path, opts) {
  const didChange = redirect(path, opts);
  if (!opts?.hard && didChange) {
    // only re-render after soft nav
    guardRouteAndRender();
  }
}

export async function guardRouteAndRender() {
  const role = decodeRole();
  const page = getPageKind();

  if (!role) return renderLoginOnly();

  if (role === 'admin') {
    if (page === 'customer') return navigate('/admin', {hard:true});
  } else {
    if (page === 'admin' || page === 'customer-detail') return navigate('/', {hard:true});
  }

  hideAll();
  if (role === 'admin') {
    if (page === 'admin') return mountAdmin(loaded);
    if (page === 'customer-detail') return mountCustomerDetailForAdmin(loaded);
    return redirect('/admin', {hard:true});
  } else {
    if (page === 'customer') return mountCustomer(loaded);
    return redirect('/', {hard:true});
  }
}
