import { $, show } from "../utils/dom.js";
import { apiFetch, loadAdminOperations } from "../utils/api.js";
import { delegate } from "../utils/events.js";
import { bindAddBookForm } from "../features/addBookForm.js";

let unbindAdmin, unbindAddBook;

export async function mountAdmin(loaded) {
    const root = $("#admin-dashboard");
    const adminOpsTable = $("#admin-ops-table");
    const addBookForm = $("#add-book-form");
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
                    const status = e.target.dataset.status;
                    const type = e.target.dataset.type;
                    let message = "";
                    if (action === "confirm") {
                        if (status === "approved") {
                            message = "Marquer cette commande comme livrée ?";
                        } else {
                            message = "Approuver cette commande ?";
                        }
                    } else if (action === "delete") {
                        if (status === "delivered") {
                            message = "Annuler cette opération ?";
                        } else if (type === "report") {
                            message = "Supprimer ce rapport de vente ? Cela impactera le stock et les statistiques.";
                        } else {
                            message = "Annuler cette opération ?";
                        }
                    }
                    if (message && !window.confirm(message)) return;
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
  $("#admin-dashboard").classList.add("hidden");
}
