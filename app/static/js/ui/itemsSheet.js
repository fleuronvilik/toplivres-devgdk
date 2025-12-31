import { show, hide } from "../utils/dom.js";

const SHEET_ID = 'items-sheet';
const LIST_ID = 'items-sheet-list';

export function openItemsSheet(items = []) {
  const sheet = document.getElementById(SHEET_ID);
  const list = document.getElementById(LIST_ID);
  if (!sheet || !list) return alert(items.map(pretty).join('\n'));

  // populate
  list.innerHTML = '';
  items.forEach(it => {
    const li = document.createElement('li');
    li.className = 'items-list-row';
    const qty = it.quantity < 0 ? -it.quantity : it.quantity;
    const title = it.book || it.title || `Livre #${it.book_id}`;
    li.textContent = `${qty}× ${title}`;
    list.appendChild(li);
  });

  show(sheet);
}

export function bindItemsSheet() {
  const sheet = document.getElementById(SHEET_ID);
  if (!sheet) return () => {};
  const dismissers = sheet.querySelectorAll('[data-dismiss]');
  const onDismiss = (e) => { e.preventDefault(); hide(sheet); };
  dismissers.forEach(el => el.addEventListener('click', onDismiss));
  return () => dismissers.forEach(el => el.removeEventListener('click', onDismiss));
}

function pretty(i) {
  const qty = i.quantity < 0 ? -i.quantity : i.quantity;
  const title = i.book || i.title || `Livre #${i.book_id}`;
  return `${qty}× ${title}`;
}
