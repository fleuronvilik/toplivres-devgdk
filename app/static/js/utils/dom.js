// Query & show/hide
export const $ = (s) => document.querySelector(s);
export const show = (el) => el && el.classList.remove("hidden");
export const hide = (el) => el && el.classList.add("hidden");

// Soft redirect (optional: could do location.assign)
export function redirect(path, { hard = false } = {}) {
  if (hard) {
    location.assign(path);     // full reload to get the correct shell
    return;
  }
  history.pushState({}, "", path);
  // guardRouteAndRender(); // re-evaluate after route change
}

export function getToken() {
  return localStorage.getItem("token");
}

export function decodeRole() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch (e) {
    return null;
  }
}

export function getCurrentUser() {
  const userStr = localStorage.getItem("currentUser");
  return userStr ? JSON.parse(userStr) : null;
}

export function getUserRole() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch (e) {
    return null;
  }
}


