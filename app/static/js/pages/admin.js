import { $, show } from "../utils/dom.js";
import { apiFetch, loadAdminOperations } from "../utils/api.js";
import { delegate } from "../utils/events.js";

let unbindAdmin = [];

export async function mountAdmin(loaded) {
    const root = $("#adminDashboard");
    const adminOpsTable = $("#adminOpsTable");
    show(root);
    if (!loaded.adminOps) {
        await loadAdminOperations();
        loaded.adminOps = true;
    }

    if (unbindAdmin.length === 0) {
        unbindAdmin.push(
            delegate(
                adminOpsTable, 'click', 'button[data-action]', async (e) => {
                    const id = e.target.dataset.id;
                    const action = e.target.dataset.action;
                    if (action === "confirm") {
                        await apiFetch(`/api/admin/orders/${id}/confirm`, { method: "PUT" });
                    } else if (action === "delete") {
                        await apiFetch(`/api/admin/operations/${id}`, { method: "DELETE" });
                    }
                    await loadAdminOperations();
            })
        )
    }
}

export function unmountAdmin() {
  unbindAdmin.forEach(off => off());
  unbindAdmin = [];
}