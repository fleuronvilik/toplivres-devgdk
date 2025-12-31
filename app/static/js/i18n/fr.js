// app/static/js/i18n/fr.js
// Simple dictionnaire + helpers (pas de framework i18n nécessaire)

export const fr = {
  locale: "fr-FR",
  currency: "EUR",

  app: {
    title: "TopLivres",
  },

  nav: {
    newOperation: "Nouvelle opération",
    history: "Historique",
    inventory: "Ton stock",
    stats: "Statistiques",
    logout: "Se déconnecter",
  },

  form: {
    title: "Sélectionne des quantités",
    helperIdle: "Saisis une quantité pour commencer.",
    helperSelected: "Vérifie la sélection puis envoie.",

    searchPlaceholder: "Rechercher un livre…",

    toggles: {
      showOnlySelected: "Afficher seulement la sélection",
      inlineErrors: "Afficher les erreurs dans la liste",
      showStock: "Afficher le stock",
    },

    hints: {
      inStock: (count) => `En stock : ${count}`,
    },

    columns: {
      book: "Livre",
      unitPrice: "Prix unitaire",
      quantity: "Quantité",
      stock: "Stock dispo",
    },

    tooltips: {
      stock: "Stock disponible d’après tes livraisons et tes ventes déclarées.",
    },

    actions: {
      submitOrder: "Envoyer la commande",
      submitSale: "Enregistrer la vente",
      cancelPending: "Annuler la demande en cours",
      cancel: "Annuler",
    },

    validation: {
      nonNegative: "Doit être supérieur ou égal à 0",
      positive: "Saisis une quantité positive",
      exceedsStock: (max) => `Dépasse le stock disponible (max ${max})`,
      exceedsCurrent: "La quantité dépasse ton stock actuel",
    },

    // Messages d’état (empty states / blocage)
    states: {
      cannotOrderPending: "Tu as déjà une demande en cours. Attends la livraison ou annule-la.",
      reportRequired: "Tu dois déclarer les ventes depuis la dernière livraison avant de recommander.",
      noItems: "Aucun article sélectionné.",
    },
  },

  history: {
    empty: "Aucune opération pour le moment.",
  },

  inventory: {
    empty: "Ton stock est vide pour l’instant.",
  },

  stats: {
    title: "Statistiques de vente",
    totalSales: "Total vendu",
    totalRevenue: "Chiffre d’affaires",
    totalDelivered: "Total livré",
    ratio: "Taux de vente",
    empty: "Pas assez de données pour afficher des stats.",
    ratioLine: (sold, delivered, ratioPct) =>
      `${sold} vendus sur ${delivered} livrés (${ratioPct}%)`,
  },

  // Types & statuts renvoyés par l’API (ou affichés dans l’UI)
  // Tu peux adapter si tu changes ton modèle côté backend.
  enums: {
    operationType: {
      order: "Commande",
      report: "Vente", // ou "Déclaration de vente"
    },
    operationStatus: {
      pending: "En attente",
      approved: "Confirmée",       // suggestion (voir note plus bas)
      delivered: "Livrée",
      cancelled: "Annulée",
      recorded: "Enregistrée",     // pour report
      rejected: "Refusée",         // optionnel
      expired: "Expirée",          // optionnel si auto-annulation
    },
  },

  // Messages (succès uniquement : pas d’erreurs en toast)
  toast: {
    orderSubmitted: "Commande envoyée.",
    saleRecorded: "Vente enregistrée.",
  },

  // Textes d’erreurs “propres” (si tu veux normaliser côté client)
  // Idéal: le backend renvoie déjà un message final en FR.
  errors: {
    generic: "Une erreur est survenue.",
    unauthorized: "Accès non autorisé.",
    forbidden: "Action non autorisée.",

    // Catégories (si tu affiches un préfixe inline)
    categories: {
      order: "Commande",
      items: "Articles",
      reports: "Rapports",
      inventory: "Stock",
    },

    // Exemples issus de tes règles actuelles (si tu veux mapper des phrases EN -> FR)
    map: {
      "Wait for delivery or cancel existing request first":
        "Attends la livraison ou annule la demande en cours.",
      "A report since last delivery is required":
        "Tu dois déclarer les ventes depuis la dernière livraison avant de recommander.",
      "At least one item is required.": "Ajoute au moins un article.",
    },
  },
};

// Helpers (optionnels mais pratiques)
export function t(path, fallback = "") {
  // t("nav.history") -> "Historique"
  const parts = String(path).split(".");
  let cur = fr;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || !(p in cur)) return fallback || path;
    cur = cur[p];
  }
  return cur ?? (fallback || path);
}

export function formatCurrency(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat(fr.locale, {
    style: "currency",
    currency: fr.currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatType(type) {
  return fr.enums.operationType[type] || type;
}

export function formatStatus(status) {
  return fr.enums.operationStatus[status] || status;
}

// Normalise des erreurs backend -> liste de messages "inline"
export function normalizeErrors(payload) {
  // attendu: { errors: { items: ["..."], order: ["..."] } }
  // ou: { errors: "..." }
  if (!payload) return [];
  const out = [];

  const errors = payload.errors ?? null;
  if (!errors) return out;

  if (typeof errors === "string") {
    out.push({ field: "general", message: errors });
    return out;
  }

  if (Array.isArray(errors)) {
    errors.forEach((m) => out.push({ field: "general", message: String(m) }));
    return out;
  }

  // object: { field: [messages...] }
  for (const [field, msgs] of Object.entries(errors)) {
    const list = Array.isArray(msgs) ? msgs : [msgs];
    list.forEach((m) => {
      const msg = String(m);
      // optionnel: mapper EN -> FR si besoin
      const mapped = fr.errors.map[msg] || msg;
      out.push({ field, message: mapped });
    });
  }
  return out;
}
