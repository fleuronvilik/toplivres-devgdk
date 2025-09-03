// import "./core/router";
import { guardRouteAndRender } from "./core/router.js";

window.addEventListener('DOMContentLoaded', guardRouteAndRender);
window.addEventListener('popstate', guardRouteAndRender);