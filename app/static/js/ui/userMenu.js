import { $, show, hide } from "../utils/dom.js";

export function bindUserMenu(navRoot = $("#customer-navigation")) {
  if (!navRoot) return () => {};
  const toggle = navRoot.querySelector('.user-menu .menu-toggle');
  const menu   = navRoot.querySelector('.user-menu .dropdown-menu');
  const settingsBtn = navRoot.querySelector('#open-settings');
  const logoutBtn   = navRoot.querySelector('#logoutLink');
  const modal  = document.getElementById('settings-modal');
  if (!toggle || !menu) return () => {};

  function openMenu() {
    menu.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKey);
  }
  function closeMenu() {
    menu.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onKey);
  }
  function onDocumentClick(e) {
    if (!menu.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  }
  function onKey(e) { if (e.key === 'Escape') closeMenu(); }

  const onToggle = (e) => {
    e.preventDefault();
    if (menu.classList.contains('hidden')) openMenu(); else closeMenu();
  };
  toggle.addEventListener('click', onToggle);

  const unbinds = [() => toggle.removeEventListener('click', onToggle)];

  if (settingsBtn && modal) {
    const openSettings = (e) => { e.preventDefault(); closeMenu(); hideDropdownFocus(); show(modal); };
    const hideDropdownFocus = () => settingsBtn.blur();
    settingsBtn.addEventListener('click', openSettings);
    unbinds.push(() => settingsBtn.removeEventListener('click', openSettings));

    // modal dismissal
    const dismissers = modal.querySelectorAll('[data-dismiss]');
    const onDismiss = (e) => { e.preventDefault(); hide(modal); };
    dismissers.forEach(el => el.addEventListener('click', onDismiss));
    unbinds.push(() => dismissers.forEach(el => el.removeEventListener('click', onDismiss)));
  }

  // logoutBtn is handled globally in base.html script; no binding needed here

  return () => unbinds.forEach(fn => fn());
}

