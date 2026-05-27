/* ══════════════════════════════════════
   API PRODUITS — Prix Achat & Éditeur
   Odoo 18 — DSM Librairie
══════════════════════════════════════ */

import { ODOO_URL, ODOO_DB } from "./config";

let sessionUid: number | null = null;
let sessionCookie = "";

/* ── Types ── */
export interface ProduitInfo {
  id: number;
  name: string;
  standard_price: number;       // Prix d'achat (coût)
  list_price: number;           // Prix de vente
  dsm_editeur: string;          // Éditeur (champ personnalisé DSM)
  categ_id: [number, string];
  default_code: string;         // Référence interne / ISBN
  barcode: string;
}

export interface UpdatePrixAchatPayload {
  productId: number;
  standard_price: number;
}

export interface UpdateEditeurPayload {
  productId: number;
  dsm_editeur: string;
}

export interface UpdateProduitPayload {
  productId: number;
  standard_price?: number;
  dsm_editeur?: string;
}

/* ── Helper RPC ── */
async function rpc(model: string, method: string, args: any[], kwargs: Record<string, any> = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: Date.now(),
      params: { model, method, args, kwargs },
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || "Erreur Odoo");
  }
  return data.result;
}

/* ── Initialiser la session (passer uid + cookie depuis l'authentification principale) ── */
export function initProduitSession(uid: number, cookie: string) {
  sessionUid = uid;
  sessionCookie = cookie;
}

/* ══════════════════════════════════════
   LECTURE
══════════════════════════════════════ */

/**
 * Récupère les produits avec prix d'achat et éditeur.
 * domain : filtre Odoo (ex. [["sale_ok","=",true]])
 */
export async function getProduits(
  domain: any[][] = [],
  limit = 80
): Promise<ProduitInfo[]> {
  return rpc("product.template", "search_read", [domain], {
    fields: [
      "name",
      "standard_price",
      "list_price",
      "dsm_editeur",
      "categ_id",
      "default_code",
      "barcode",
    ],
    limit,
    order: "name asc",
  });
}

/**
 * Récupère un produit par son ID.
 */
export async function getProduitById(productId: number): Promise<ProduitInfo> {
  const results = await rpc("product.template", "search_read", [[["id", "=", productId]]], {
    fields: [
      "name",
      "standard_price",
      "list_price",
      "dsm_editeur",
      "categ_id",
      "default_code",
      "barcode",
    ],
    limit: 1,
  });
  if (!results || results.length === 0) {
    throw new Error(`Produit #${productId} introuvable`);
  }
  return results[0];
}

/**
 * Recherche des produits par nom ou code-barres.
 */
export async function rechercherProduits(terme: string, limit = 40): Promise<ProduitInfo[]> {
  const domain = [
    "|",
    "|",
    ["name", "ilike", terme],
    ["default_code", "ilike", terme],
    ["barcode", "=", terme],
  ];
  return rpc("product.template", "search_read", [domain], {
    fields: [
      "name",
      "standard_price",
      "list_price",
      "dsm_editeur",
      "categ_id",
      "default_code",
      "barcode",
    ],
    limit,
    order: "name asc",
  });
}

/* ══════════════════════════════════════
   MISE À JOUR
══════════════════════════════════════ */

/**
 * Met à jour le prix d'achat (standard_price) d'un produit.
 * Retourne true si succès.
 */
export async function updatePrixAchat({ productId, standard_price }: UpdatePrixAchatPayload): Promise<boolean> {
  if (standard_price < 0) throw new Error("Le prix d'achat ne peut pas être négatif");
  const result = await rpc("product.template", "write", [[productId], { standard_price }]);
  return result === true;
}

/**
 * Met à jour l'éditeur d'un produit.
 * Retourne true si succès.
 */
export async function updateEditeur({ productId, dsm_editeur }: UpdateEditeurPayload): Promise<boolean> {
  const result = await rpc("product.template", "write", [[productId], { dsm_editeur }]);
  return result === true;
}

/**
 * Met à jour prix d'achat ET/OU éditeur en une seule requête.
 * Retourne true si succès.
 */
export async function updateProduit({ productId, standard_price, dsm_editeur }: UpdateProduitPayload): Promise<boolean> {
  const vals: Record<string, any> = {};
  if (standard_price !== undefined) {
    if (standard_price < 0) throw new Error("Le prix d'achat ne peut pas être négatif");
    vals.standard_price = standard_price;
  }
  if (dsm_editeur !== undefined) {
    vals.dsm_editeur = dsm_editeur;
  }
  if (Object.keys(vals).length === 0) return true;

  const result = await rpc("product.template", "write", [[productId], vals]);
  return result === true;
}

/**
 * Mise à jour en lot : plusieurs produits en une seule requête.
 * Tous les IDs reçoivent les mêmes valeurs.
 */
export async function updateProduitsBatch(
  productIds: number[],
  vals: { standard_price?: number; dsm_editeur?: string }
): Promise<boolean> {
  if (productIds.length === 0) return true;
  if (vals.standard_price !== undefined && vals.standard_price < 0) {
    throw new Error("Le prix d'achat ne peut pas être négatif");
  }
  const result = await rpc("product.template", "write", [productIds, vals]);
  return result === true;
}
