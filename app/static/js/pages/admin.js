import { $, show } from "../utils/dom.js";
import { apiFetch, loadAdminOperations } from "../utils/api.js";
import { notify, showErrors } from "../core/notifications.js";
import { delegate } from "../utils/events.js";
import { bindAddBookForm } from "../features/addBookForm.js";

let unbindAdmin, unbindAddBook, unbindAdminSearch;

export async function mountAdmin(loaded) {
    const root = $("#admin-dashboard");
    const adminOpsTable = $("#admin-ops-table");
    const addBookForm = $("#add-book-form");
    const adminOpsSearch = $("#admin-ops-search");
    show(root);
    const filterAdminOps = () => {
        const query = adminOpsSearch?.value.trim().toLowerCase() || "";
        const rows = adminOpsTable?.querySelectorAll("tbody tr") || [];
        rows.forEach((row) => {
            if (row.classList.contains("ops-separator")) return;
            const clientName = row.dataset.client || "";
            const matches = !query || clientName.includes(query);
            row.classList.toggle("search-hidden", !matches);
        });
    };

    if (!loaded.adminOps) {
        await loadAdminOperations();
        loaded.adminOps = true;
        if (adminOpsSearch?.value) filterAdminOps();
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
                            message = "Refuser cette commande ?";
                        }
                    }
                    if (message && !window.confirm(message)) return;
                    try {
                        let successMessage = "";
                        if (action === "confirm") {
                            await apiFetch(`/api/admin/orders/${id}/confirm`, { method: "PUT" });
                            successMessage = status === "approved" ? "Commande livrée" : "Commande approuvée";
                        } else if (action === "delete") {
                            await apiFetch(`/api/admin/operations/${id}`, { method: "DELETE" });
                            successMessage = type === "report" ? "Rapport de vente supprimé" : "Commande refusée";
                        }
                        await loadAdminOperations();
                        if (adminOpsSearch?.value) filterAdminOps();
                        if (successMessage) notify(successMessage, "success");
                    } catch (err) {
                        showErrors(err);
                    }
            })
        )
    }

    if (!unbindAdminSearch && adminOpsSearch) {
        adminOpsSearch.addEventListener("input", filterAdminOps);
        unbindAdminSearch = () => adminOpsSearch.removeEventListener("input", filterAdminOps);
    }

    if (!unbindAddBook && addBookForm) unbindAddBook = bindAddBookForm(addBookForm);
}

export function unmountAdmin() {
  unbindAdmin();
  unbindAdmin = null;
  if (unbindAdminSearch) unbindAdminSearch();
  unbindAdminSearch = null;
  unbindAddBook();
  unbindAddBook = null;
  $("#admin-dashboard").classList.add("hidden");
}
