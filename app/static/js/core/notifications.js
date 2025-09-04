export function notify(message, type='success'){
  const host = document.getElementById('alerts');
  /*
  || (()=> {
    const d=document.createElement('div'); d.id='alerts'; d.setAttribute('aria-live','polite');
    d.style.position='fixed'; d.style.right='16px'; d.style.bottom='16px'; d.style.display='grid'; d.style.gap='8px'; d.style.zIndex='1000';
    document.body.appendChild(d); return d;
  })();
  */
  // const host = document.getElementById("errorBox");
  if (host) {
    const p = document.createElement("p");
    p.textContent = message;
    // p.style.color = "red";
    host.appendChild(p);
    host.classList.add("alert", type);
    host.classList.remove("hidden");
  }
  // setTimeout(()=> host.classList.add("hidden"), 3000);
}