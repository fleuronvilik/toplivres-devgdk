// import "./core/router";
import { guardRouteAndRender } from "./core/router.js";
import { bindItemsSheet } from "./ui/itemsSheet.js";

window.addEventListener('DOMContentLoaded', () => {
  bindItemsSheet();
  guardRouteAndRender();
});
window.addEventListener('popstate', guardRouteAndRender); 
