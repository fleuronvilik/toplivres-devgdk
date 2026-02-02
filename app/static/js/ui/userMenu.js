import { $, show, hide } from "../utils/dom.js";
import { apiFetch } from "../utils/api.js";
import { notify } from "../core/notifications.js";
import { t } from "../i18n/fr.js";

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
    const applySettingsI18n = () => {
      const title = modal.querySelector('#settings-title');
      const cancelBtn = modal.querySelector('.modal-footer [data-dismiss]');
      const saveBtn = modal.querySelector('#settings-save');
      if (title) title.textContent = t("settings.title", title.textContent);
      if (cancelBtn) cancelBtn.textContent = t("settings.cancel", cancelBtn.textContent);
      if (saveBtn) saveBtn.textContent = t("settings.save", saveBtn.textContent);

      const currentLabel = modal.querySelector('label[for="current-password"] span');
      const newLabel = modal.querySelector('label[for="new-password"] span');
      const confirmLabel = modal.querySelector('label[for="confirm-password"] span');
      if (currentLabel) currentLabel.textContent = t("settings.currentPasswordLabel", currentLabel.textContent);
      if (newLabel) newLabel.textContent = t("settings.newPasswordLabel", newLabel.textContent);
      if (confirmLabel) confirmLabel.textContent = t("settings.confirmPasswordLabel", confirmLabel.textContent);

      const currentInput = modal.querySelector('input[name="current_password"]');
      const newInput = modal.querySelector('input[name="new_password"]');
      const confirmInput = modal.querySelector('input[name="confirm_password"]');
      if (currentInput) currentInput.placeholder = t("settings.currentPasswordPlaceholder", currentInput.placeholder);
      if (newInput) newInput.placeholder = t("settings.newPasswordPlaceholder", newInput.placeholder);
      if (confirmInput) confirmInput.placeholder = t("settings.confirmPasswordPlaceholder", confirmInput.placeholder);
    };

    const openSettings = async (e) => {
      e.preventDefault();
      closeMenu(); hideDropdownFocus();
      applySettingsI18n();
      try {
        const form = modal.querySelector('#settings-form');
        const saveBtn = modal.querySelector('#settings-save');
        form.reset();

        const currentInput = form.querySelector('input[name="current_password"]');
        const newInput = form.querySelector('input[name="new_password"]');
        const confirmInput = form.querySelector('input[name="confirm_password"]');
        const currentError = form.querySelector('#current-password-error');
        const newError = form.querySelector('#new-password-error');
        const confirmError = form.querySelector('#confirm-password-error');

        const setFieldError = (input, errorEl, message) => {
          if (!input) return;
          if (message) {
            input.setCustomValidity(message);
            input.setAttribute("aria-invalid", "true");
            if (errorEl) errorEl.textContent = message;
          } else {
            input.setCustomValidity("");
            input.removeAttribute("aria-invalid");
            if (errorEl) errorEl.textContent = "";
          }
        };

        const validateLength = (input, errorEl) => {
          if (!input) return true;
          if (input.validity.tooShort) {
            setFieldError(input, errorEl, t("settings.passwordTooShort", ""));
            return false;
          }
          setFieldError(input, errorEl, "");
          return true;
        };

        const validateMatch = () => {
          if (!newInput || !confirmInput) return true;
          const matches = newInput.value === confirmInput.value;
          if (!matches && confirmInput.value) {
            setFieldError(confirmInput, confirmError, t("settings.passwordMismatch", ""));
          } else {
            setFieldError(confirmInput, confirmError, "");
          }
          return matches;
        };

        const computeDisabled = () => {
          const hasValues = [currentInput, newInput, confirmInput].every((el) => el?.value);
          const currentOk = validateLength(currentInput, currentError);
          const newOk = validateLength(newInput, newError);
          const matches = validateMatch();
          return !(hasValues && currentOk && newOk && matches && form.checkValidity());
        };

        const onInput = () => { saveBtn.disabled = computeDisabled(); };
        const onBlur = () => { saveBtn.disabled = computeDisabled(); };
        saveBtn.disabled = true;
        if (currentError) currentError.textContent = "";
        if (newError) newError.textContent = "";
        if (confirmError) confirmError.textContent = "";
        form.addEventListener('input', onInput);
        form.addEventListener('blur', onBlur, true);
        unbinds.push(() => form.removeEventListener('input', onInput));
        unbinds.push(() => form.removeEventListener('blur', onBlur, true));
      } catch (e) {
        notify(t("settings.loadError", "Impossible d’ouvrir le changement de mot de passe."), 'error');
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
      const currentInput = form.querySelector('input[name="current_password"]');
      const newInput = form.querySelector('input[name="new_password"]');
      const confirmInput = form.querySelector('input[name="confirm_password"]');
      const currentError = form.querySelector('#current-password-error');
      const newError = form.querySelector('#new-password-error');
      const confirmError = form.querySelector('#confirm-password-error');
      if (!currentInput || !newInput || !confirmInput) return;
      if (currentInput.validity.tooShort) {
        const msg = t("settings.passwordTooShort", "");
        currentInput.setCustomValidity(msg);
        currentInput.setAttribute("aria-invalid", "true");
        if (currentError) currentError.textContent = msg;
        form.reportValidity();
        return;
      }
      if (newInput.validity.tooShort) {
        const msg = t("settings.passwordTooShort", "");
        newInput.setCustomValidity(msg);
        newInput.setAttribute("aria-invalid", "true");
        if (newError) newError.textContent = msg;
        form.reportValidity();
        return;
      }
      if (newInput.value !== confirmInput.value) {
        const msg = t("settings.passwordMismatch", "");
        confirmInput.setCustomValidity(msg);
        confirmInput.setAttribute("aria-invalid", "true");
        if (confirmError) confirmError.textContent = msg;
        form.reportValidity();
        return;
      }
      const payload = {
        current_password: currentInput.value,
        new_password: newInput.value,
      };
      saveBtn.disabled = true;
      try {
        await apiFetch('/api/users/password', { method: 'PUT', body: JSON.stringify(payload) });
        notify(t("settings.saveSuccess", "Mot de passe mis à jour."));
        hide(modal);
      } catch (err) {
        notify(t("settings.saveError", "Échec de la mise à jour du mot de passe."), 'error');
        saveBtn.disabled = false;
      }
    };
    const form = modal.querySelector('#settings-form');
    if (form) {
      form.addEventListener('submit', onSave);
      unbinds.push(() => form.removeEventListener('submit', onSave));
    }
  }

  // logoutBtn is handled globally in base.html script; no binding needed here

  return () => unbinds.forEach(fn => fn());
}
