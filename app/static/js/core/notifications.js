export function notify(message, type = 'success') {
  const host = document.getElementById('alerts');
  if (!host) return;

  // Ensure container is visible
  host.classList.remove('hidden');

  // Build alert item with close button
  const item = document.createElement('div');
  item.className = `alert ${type}`;
  const text = document.createElement('span');
  text.textContent = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'alert-close';
  close.setAttribute('aria-label', 'Close alert');
  close.textContent = '×';
  close.addEventListener('click', () => {
    item.remove();
    // Hide host if empty
    if (host.children.length === 0) host.classList.add('hidden');
  });

  item.appendChild(text);
  item.appendChild(close);
  host.appendChild(item);
}
