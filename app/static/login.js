async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.message || res.statusText);
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  form.addEventListener("submit", async (e) => {
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
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error(err);
    }
  });
});
