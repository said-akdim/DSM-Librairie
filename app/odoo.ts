/* ══════════════════════════════════════
   CONNEXION ODOO 18 — DSM Librairie
══════════════════════════════════════ */

const ODOO_URL = "http://localhost:8069";
const ODOO_DB = "Dsm";

let sessionCookie = "";

/* ── Authentification ── */
export async function odooLogin(login: string, password: string) {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: 1,
      params: { db: ODOO_DB, login, password },
    }),
  });
  const data = await response.json();
  if (data.result?.uid) {
    sessionCookie = response.headers.get("set-cookie") || "";
    return data.result;
  }
  throw new Error("Connexion échouée");
}

/* ── Lire les clients ── */
export async function odooGetClients() {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: 2,
      params: {
        model: "res.partner",
        method: "search_read",
        args: [[["customer_rank", ">", 0]]],
        kwargs: {
          fields: ["name", "email", "phone"],
          limit: 50,
        },
      },
    }),
  });
  const data = await response.json();
  return data.result || [];
}

/* ── Lire les produits (livres) ── */
export async function odooGetLivres() {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: 3,
      params: {
        model: "product.template",
        method: "search_read",
        args: [[["sale_ok", "=", true]]],
        kwargs: {
          fields: ["name", "list_price", "description", "categ_id"],
          limit: 50,
        },
      },
    }),
  });
  const data = await response.json();
  return data.result || [];
}

/* ── Créer une vente (points fidélité) ── */
export async function odooCreateVente(clientId: number, livres: any[]) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: 4,
      params: {
        model: "sale.order",
        method: "create",
        args: [{
          partner_id: clientId,
          order_line: livres.map(l => ([0, 0, {
            product_id: l.id,
            product_uom_qty: 1,
            price_unit: l.list_price,
          }])),
        }],
        kwargs: {},
      },
    }),
  });
  const data = await response.json();
  return data.result;
}
