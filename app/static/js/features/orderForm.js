import { notify, showErrors } from "../core/notifications.js";
import { setOrderBlockedState } from "../utils/api.js";

export function bindOrderForm(form, submitFn) {
  function countSelectedItems() {
    let count = 0;
    form.querySelectorAll('input[name^="qty-"]').forEach((input) => {
      const qty = parseInt(input.value, 10);
      if (Number.isFinite(qty) && qty > 0) count += 1;
    });
    return count;
  }

  function updateEmptyState() {
    const empty = form.querySelector("#books-empty-state");
    if (!empty) return;
    empty.classList.toggle("hidden", countSelectedItems() > 0);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(form);
    //const action = fd.get('action'); // 'order' | 'sale'
    const btn = e.submitter;
    const action = btn?.dataset?.action;

    if (action === "order" && form.dataset.orderBlocked === "true") {
      setOrderBlockedState(true, "You already have a pending request.");
      return;
    }

    //const items = collectItemsFromForm(form); // qty > 0 rows
    const items = [];
    // Track inline errors for 'sale' exceeding stock
    const errors = [];
    for (const [key, value] of fd.entries()) {
      if (key.startsWith('qty-')) {
        const qty = parseInt(value);
        if (qty > 0) {
          const bookId = key.slice(4);
          // Inline validation for sales: do not allow qty > stock
          if (action === 'sale') {
            const input = form.querySelector(`#qty-${bookId}`);
            const stock = parseInt(input?.dataset?.stock || '0', 10);
            const errCell = form.querySelector(`#err-${bookId}`);
            if (qty > stock) {
              if (errCell) errCell.textContent = 'Quantity exceeds your current stock';
              input?.setAttribute('aria-invalid', 'true');
              errors.push(bookId);
              continue; // skip pushing invalid item
            } else {
              if (errCell) errCell.textContent = '';
              input?.removeAttribute('aria-invalid');
            }
          }
          items.push({ book_id: bookId, quantity: qty });
        }
      }
    }
    updateEmptyState();
    if (items.length === 0) {
      // Inline empty-state message is already present under the table
      // Focus the first qty input to guide the user
      const firstQty = form.querySelector('input[type="number"]');
      firstQty?.focus();
      return;
    }
    if (errors.length > 0) {
      // Focus the first invalid input and prevent submit
      const first = errors[0];
      form.querySelector(`#qty-${first}`)?.focus();
      return;
    }
    // debugger
    //submitFn({ action, items });


    // disable buttons during submit
    form.querySelectorAll('button[type="submit"]').forEach(b => b.disabled = true);
    try {
      await submitFn({ action, items });
      notify(`${action === 'order' ? 'Order' : 'Sale'} submitted`, 'success');
      if (action === "order") {
        setOrderBlockedState(true, "You already have a pending request.");
      }
    } catch (err) {
      const orderErrors = err?.payload?.errors?.order;
      if (orderErrors && orderErrors.length > 0) {
        setOrderBlockedState(true, orderErrors[0]);
        return;
      }
      showErrors(err);
    } finally {
      form.querySelectorAll('button[type="submit"]').forEach(b => b.disabled = false);
      if (form.dataset.orderBlocked === "true") {
        const box = document.getElementById("order-blocked-box");
        const message = box?.textContent || "You already have a pending request.";
        setOrderBlockedState(true, message);
      }
    }
  }
  const onInput = (e) => {
    if (e.target && e.target.matches('input[name^="qty-"]')) {
      updateEmptyState();
    }
  };
  form.addEventListener('submit', onSubmit);
  form.addEventListener('input', onInput);
  updateEmptyState();
  return () => {
    form.removeEventListener('submit', onSubmit);
    form.removeEventListener('input', onInput);
  };
}
