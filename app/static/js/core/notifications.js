import { fr } from "../i18n/fr.js";

const DEFAULT_TIMEOUT_MS = 6000;
const MAX_TOASTS = 4; // Keep the stack readable by limiting visible toasts.
// Persist toast state across module re-evaluations (e.g., hot reloads).
const toastState = window.__toastState || {
  nextId: 0,
  toasts: [],
  elements: new Map(),
};
window.__toastState = toastState;

function renderToasts() {
  const host = document.getElementById('alerts');
  if (!host) return;

  host.textContent = '';
  toastState.elements.clear();

  toastState.toasts.forEach((toast) => {
    const item = document.createElement('div');
    item.className = `alert ${toast.type}`;
    item.dataset.toastId = String(toast.id);
    const content = document.createElement('div');
    const text = document.createElement('span');
    text.textContent = toast.message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'alert-close';
    close.setAttribute('aria-label', 'Fermer l’alerte');
    close.textContent = '×';
    close.addEventListener('click', () => {
      // Manual dismiss removes immediately.
      removeToast(toast.id);
    });

    content.appendChild(text);
    content.appendChild(close);
    item.appendChild(content);
    host.appendChild(item);
    toastState.elements.set(toast.id, item);
  });
}

function removeToast(id) {
  const index = toastState.toasts.findIndex((toast) => toast.id === id);
  if (index === -1) return;

  const [toast] = toastState.toasts.splice(index, 1);
  if (toast.timeoutId) window.clearTimeout(toast.timeoutId);

  renderToasts();

  const host = document.getElementById('alerts');
  if (host && host.children.length === 0) host.classList.add('hidden');
}

export function notify(message, type = 'success', timeoutMs = DEFAULT_TIMEOUT_MS) {
  const host = document.getElementById('alerts');
  if (!host) return;

  // Ensure container is visible for new toasts.
  host.classList.remove('hidden');

  const msg = (message ?? "").toString().trim();
  if (!msg) return;

  // ✅ GLOBAL DEDUPE: don’t add duplicates already visible
  const key = `${type}::${msg}`;
  const already = toastState.toasts.some(t => `${t.type}::${t.message}` === key);
  if (already) return;

  const id = ++toastState.nextId;
  const resolvedTimeout = Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const toast = { id, type, message, timeoutMs: resolvedTimeout, timeoutId: null };
  toastState.toasts.push(toast);

  // Drop the oldest toast when exceeding the max stack size.
  if (toastState.toasts.length > MAX_TOASTS) removeToast(toastState.toasts[0].id);

  renderToasts();

  // Auto-dismiss each toast after its timeout.
  // toast.timeoutId = window.setTimeout(() => removeToast(id), resolvedTimeout);
}

function asMessageString(x) {
  if (x == null) return ""; // null/undefined
  if (typeof x === "string") return x.trim();
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  // If backend returns objects in arrays, don't toast "[object Object]"
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

export function normalizeErrors(payload) {
  // Accept: { errors: { field: [...] } } OR { msg: "..." } OR anything
  const out = [];

  if (!payload) return out;

  if (payload.errors && typeof payload.errors === "object") {
    for (const [field, messages] of Object.entries(payload.errors)) {
      const arr = Array.isArray(messages) ? messages : [messages];
      for (const m of arr) {
        const msg = asMessageString(m);
        if (!msg) continue;
        out.push({ field, message: msg });
      }
    }
    return out;
  }

  // fallback single message
  const fallback = asMessageString(payload.msg || payload.message || payload.error);
  if (fallback) out.push({ field: "general", message: fallback });

  return out;
}

export function showErrors(err) {
  const payload = err?.payload ?? err; // support passing either Error or payload
  const status = err?.status;

  const errors = normalizeErrors(payload);

  // If nothing parsed, give one safe toast.
  if (errors.length === 0) {
    const msg = status ? `Échec de la requête (${status})` : fr.errors.generic;
    notify(msg, "error");
    return;
  }

  // Deduplicate identical toasts within this call.
  const seen = new Set();
  for (const { field, message } of errors) {
    const key = `${field}::${message}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Decide formatting: only show category prefix for errors
    // (and keep your bracket style)
    notify(field === "general" ? message : `[${field}] ${message}`, "error");
  }
}
