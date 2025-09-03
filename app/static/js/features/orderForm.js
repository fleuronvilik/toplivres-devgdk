export function bindOrderForm(form, submitFn) {
  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(form);
    //const action = fd.get('action'); // 'order' | 'sale'
    const btn = e.submitter;
    const action = btn?.dataset?.action;

    //const items = collectItemsFromForm(form); // qty > 0 rows
    const items = [];
    for (const [key, value] of fd.entries()) {
      if (key.startsWith('qty-')) {
        const qty = parseInt(value);
        if (qty > 0) {
          const bookId = key.slice(4);
          items.push({ book_id: bookId, quantity: qty });
        }
      }
    }
    if (items.length === 0) {
      alert('Please select at least one book with quantity > 0');
      return;
    }
    // debugger
    submitFn({ action, items });


    // disable buttons during submit
    // form.querySelectorAll('button[type="submit"]').forEach(b => b.disabled = true);
    // try {
    //   await submitFn({ action, items });
    //   notify(`${action === 'order' ? 'Order' : 'Sale'} submitted`, 'success');
    // } catch (err) {
    //   notify(err.message || 'Failed to submit', 'error');
    // } finally {
    //   form.querySelectorAll('button[type="submit"]').forEach(b => b.disabled = false);
    // }
  }
  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
