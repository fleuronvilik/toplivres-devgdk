export function delegate(root, type, selector, handler, options) {
  function wrapped(e) {
    console.count(`${selector}:${type}`)
    const target = e.target.closest(selector);
    if (!target || !root.contains(target)) return;
    handler(e, target);
  }
  root.addEventListener(type, wrapped, options);
  return () => root.removeEventListener(type, wrapped, options);
}
