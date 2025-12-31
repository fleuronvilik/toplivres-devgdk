import { $, show, hide } from "../utils/dom.js";
import { apiFetch } from "../utils/api.js";
import { notify } from "../core/notifications.js";

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
    const openSettings = async (e) => {
      e.preventDefault();
      closeMenu(); hideDropdownFocus();
      // Prefill form with current user
      try {
        const me = await apiFetch('/api/users/me');
        const form = modal.querySelector('#settings-form');
        const saveBtn = modal.querySelector('#settings-save');
        form.name.value = me.name || '';
        form.email.value = me.email || '';
        if (form.phone) form.phone.value = me.phone || '';
        // Helpers for diffing with trimmed values
        const currentNormalized = () => ({
          name: (form.name?.value || '').trim(),
          email: (form.email?.value || '').trim(),
          phone: (form.phone?.value || '').trim(),
        });

        // Track original for diffing (normalized)
        const original = currentNormalized();
        form.dataset.original = JSON.stringify(original);
        // Enable save only when changed AND valid
        const computeDisabled = () => {
          const current = currentNormalized();
          const hasChanges = JSON.stringify(current) !== form.dataset.original;
          return !(hasChanges && form.checkValidity());
        };
        const onInput = () => { saveBtn.disabled = computeDisabled(); };
        saveBtn.disabled = computeDisabled();
        form.addEventListener('input', onInput);
        unbinds.push(() => form.removeEventListener('input', onInput));
      } catch (e) {
        notify('Impossible de charger le profil', 'error');
      }
      show(modal);
    };
    const hideDropdownFocus = () => settingsBtn.blur();
    settingsBtn.addEventListener('click', openSettings);
    unbinds.push(() => settingsBtn.removeEventListener('click', openSettings));

    // modal dismissal
    const dismissers = modal.querySelectorAll('[data-dismiss]');
    const onDismiss = (e) => { e.preventDefault(); hide(modal); };
    dismissers.forEach(el => el.addEventListener('click', onDismiss));
    unbinds.push(() => dismissers.forEach(el => el.removeEventListener('click', onDismiss)));

    // Save handler
    const onSave = async (e) => {
      e.preventDefault();
      const form = modal.querySelector('#settings-form');
      const saveBtn = modal.querySelector('#settings-save');
      if (!form.reportValidity()) return; // native validation messages
      const payload = {};
      const original = JSON.parse(form.dataset.original || '{}');
      const fields = ['name','email','phone'];
      fields.forEach((f) => {
        if (!form[f]) return;
        const v = (form[f].value || '').trim();
        if (v !== original[f]) payload[f] = v;
      });
      if (Object.keys(payload).length === 0) { hide(modal); return; }
      saveBtn.disabled = true;
      try {
        const updated = await apiFetch('/api/users', { method: 'PUT', body: JSON.stringify(payload) });
        // Persist locally for SPA usage
        try { localStorage.setItem('currentUser', JSON.stringify(updated)); } catch {}
        // Update greeting if present
        const nameEl = document.getElementById('customer-name');
        if (nameEl && updated.name) nameEl.textContent = updated.name;
        notify('Profil mis à jour');
        hide(modal);
      } catch (err) {
        notify('Échec de la mise à jour', 'error');
        saveBtn.disabled = false;
      }
    };
    const saveBtn = modal.querySelector('#settings-save');
    saveBtn?.addEventListener('click', onSave);
    unbinds.push(() => saveBtn?.removeEventListener('click', onSave));
  }

  // logoutBtn is handled globally in base.html script; no binding needed here

  return () => unbinds.forEach(fn => fn());
}
