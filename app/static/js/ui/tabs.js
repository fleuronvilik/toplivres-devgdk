export function bindTabs(tabButtons, tabPanes, { defaultTab = 'order' } = {}) {
  const VALID = new Set(
    Array.from(tabButtons).map(b => b.dataset.tab)
  );

  function applyActive(name, { push=true } = {}) {
    if (!VALID.has(name)) name = defaultTab;
    tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
    tabPanes.forEach(p => p.classList.toggle('active', p.id === `${name}-tab`));
    if (push && location.hash !== `#${name}`) history.pushState(null, '', `#${name}`);
  }

  function fromHash() {
    const name = (location.hash || '').slice(1) || defaultTab;
    applyActive(name, { push:false });
  }

  // click → activate + update hash
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      applyActive(btn.dataset.tab);
    });
  });

  // back/forward or manual hash change
  window.addEventListener('hashchange', fromHash);

  // initial
  fromHash();

  return () => {
    window.removeEventListener('hashchange', fromHash);
    tabButtons.forEach(btn => btn.replaceWith(btn.cloneNode(true))); // crude unbind
  };
}
