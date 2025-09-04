import { $, show } from "../utils/dom.js";
import { apiFetch, loadAdminOperations } from "../utils/api.js";
import { delegate } from "../utils/events.js";
import { bindAddBookForm } from "../features/addBookForm.js";

let unbindAdmin, unbindAddBook;

export async function mountAdmin(loaded) {
    const root = $("#adminDashboard");
    const adminOpsTable = $("#adminOpsTable");
    const addBookForm = $("#addBookForm");
    show(root);
    if (!loaded.adminOps) {
        await loadAdminOperations();
        loaded.adminOps = true;
    }

    if (!unbindAdmin) {
        unbindAdmin = (
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

    if (!unbindAddBook && addBookForm) unbindAddBook = bindAddBookForm(addBookForm);
}

export function unmountAdmin() {
  unbindAdmin();
  unbindAdmin = null;
  unbindAddBook();
  unbindAddBook = null;
  $("#adminDashboard").classList.add("hidden");
}