/* ══════════════════════════════════════
   API DE CONNEXION ODOO 18 — DSM Librairie
   Session web (/web/session/authenticate) + JSON-RPC call_kw
   - reconnexion automatique si la session expire
   - délai réseau borné (pas de borne figée en magasin)
   - état de connexion observable (voyant de la borne)
══════════════════════════════════════ */

import { ODOO_DB, ODOO_LOGIN, ODOO_PASSWORD, ODOO_URL } from "./config";

/* ── Réglages ── */
const DELAI_RESEAU_MS = 8000;

/* ── Types ── */
export type EtatConnexion = "deconnecte" | "connexion" | "connecte" | "erreur";

export interface SessionOdoo {
  uid: number | null;
  db: string;
  login: string;
  version: string;
  cookie: string;
}

export interface ArticleOdoo {
  id: number;
  modele: "product.product" | "product.template";
  nom: string;
  codeBarre: string;
  reference: string;
  prix: number;             // prix public de vente (tel qu'il est dans Odoo)
  editeur: string;
  stock: number | null;
}

export class ErreurOdoo extends Error {
  code: string;
  constructor(message: string, code = "odoo") {
    super(message);
    this.name = "ErreurOdoo";
    this.code = code;
  }
}

/* ── État interne ── */
let session: SessionOdoo = { uid: null, db: ODOO_DB, login: ODOO_LOGIN, version: "", cookie: "" };
let etat: EtatConnexion = "deconnecte";
let authEnCours: Promise<boolean> | null = null;
const abonnes = new Set<(etat: EtatConnexion, session: SessionOdoo) => void>();

function majEtat(nouvel: EtatConnexion) {
  if (etat === nouvel) return;
  etat = nouvel;
  abonnes.forEach(cb => cb(etat, { ...session }));
}

/** S'abonne aux changements d'état (retourne la fonction de désabonnement). */
export function onEtatConnexion(cb: (etat: EtatConnexion, session: SessionOdoo) => void): () => void {
  abonnes.add(cb);
  cb(etat, { ...session });
  return () => { abonnes.delete(cb); };
}

export function etatConnexion(): EtatConnexion { return etat; }
export function sessionCourante(): SessionOdoo { return { ...session }; }

/* ── fetch avec délai maximal ── */
async function fetchOdoo(chemin: string, corps: any): Promise<any> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_RESEAU_MS);
  try {
    const res = await fetch(`${ODOO_URL}${chemin}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      credentials: "include",
      signal: controleur.signal,
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: Date.now(), params: corps }),
    });
    /* React Native expose set-cookie ; le navigateur gère le cookie seul */
    const cookie = res.headers.get("set-cookie");
    if (cookie) session.cookie = cookie;
    return { res, data: await res.json() };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new ErreurOdoo("Serveur Odoo injoignable (délai dépassé)", "timeout");
    throw new ErreurOdoo("Serveur Odoo injoignable", "reseau");
  } finally {
    clearTimeout(minuteur);
  }
}

function erreurDepuisReponse(data: any): ErreurOdoo | null {
  if (!data?.error) return null;
  const nom = data.error.data?.name || "";
  const message = data.error.data?.message || data.error.message || "Erreur Odoo";
  if (nom.includes("SessionExpired") || data.error.code === 100) {
    return new ErreurOdoo("Session Odoo expirée", "session_expiree");
  }
  if (nom.includes("AccessError") || nom.includes("AccessDenied")) {
    return new ErreurOdoo(message, "acces");
  }
  return new ErreurOdoo(message, "odoo");
}

/* ══════════════════════════════════════
   CONNEXION
══════════════════════════════════════ */

/** Version du serveur Odoo (sert aussi de test de joignabilité). */
export async function versionServeur(): Promise<string> {
  const { data } = await fetchOdoo("/web/webclient/version_info", {});
  const v = data?.result?.server_version || "";
  session.version = v;
  return v;
}

/**
 * Ouvre une session Odoo 18. Les appels simultanés partagent la même requête.
 * @param force rouvre une session même si une est déjà active.
 */
export async function connecter(force = false): Promise<boolean> {
  if (!force && session.uid) return true;
  if (authEnCours) return authEnCours;

  majEtat("connexion");
  authEnCours = (async () => {
    try {
      session.cookie = "";
      const { data } = await fetchOdoo("/web/session/authenticate", {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD,
      });
      const err = erreurDepuisReponse(data);
      if (err) throw err;

      const uid = data?.result?.uid;
      if (!uid) throw new ErreurOdoo("Identifiants Odoo refusés", "auth");

      session.uid = uid;
      session.db = data.result.db || ODOO_DB;
      session.login = data.result.username || ODOO_LOGIN;
      session.version = data.result.server_version || session.version;
      majEtat("connecte");
      return true;
    } catch (e) {
      session.uid = null;
      majEtat("erreur");
      if (e instanceof ErreurOdoo) throw e;
      throw new ErreurOdoo((e as Error)?.message || "Connexion Odoo impossible", "reseau");
    } finally {
      authEnCours = null;
    }
  })();

  return authEnCours;
}

/** Ferme la session côté serveur et remet la borne en état déconnecté. */
export async function deconnecter(): Promise<void> {
  try { await fetchOdoo("/web/session/destroy", {}); } catch { /* sans importance */ }
  session = { uid: null, db: ODOO_DB, login: ODOO_LOGIN, version: session.version, cookie: "" };
  majEtat("deconnecte");
}

/* ══════════════════════════════════════
   APPELS DE MODÈLE
══════════════════════════════════════ */

/**
 * Appelle une méthode de modèle Odoo. Reconnecte et réessaie une fois
 * si la session a expiré (borne allumée en permanence).
 */
export async function callKw(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: Record<string, any> = {},
  reessai = true
): Promise<any> {
  await connecter();

  let data: any;
  try {
    ({ data } = await fetchOdoo("/web/dataset/call_kw", { model, method, args, kwargs }));
  } catch (e) {
    majEtat("erreur");
    throw e;
  }

  const err = erreurDepuisReponse(data);
  if (err) {
    if (err.code === "session_expiree" && reessai) {
      await connecter(true);
      return callKw(model, method, args, kwargs, false);
    }
    majEtat(err.code === "acces" ? "erreur" : etat);
    throw err;
  }
  majEtat("connecte");
  return data.result;
}

export async function searchRead(
  model: string,
  domain: any[] = [],
  fields: string[] = [],
  options: { limit?: number; order?: string; context?: Record<string, any> } = {}
): Promise<any[]> {
  const { limit = 20, order, context } = options;
  const result = await callKw(model, "search_read", [domain], {
    fields,
    limit,
    ...(order ? { order } : {}),
    ...(context ? { context } : {}),
  });
  return result || [];
}

/* ══════════════════════════════════════
   ARTICLES — recherche prix pour la borne
══════════════════════════════════════ */

const CHAMPS_VARIANTE = [
  "name", "lst_price", "list_price", "barcode", "default_code",
  "qty_available", "product_tmpl_id",
];
const CHAMPS_MODELE = [
  "name", "list_price", "barcode", "default_code", "qty_available",
];

/**
 * Éditeur DSM (champ personnalisé) — absent sur une base sans le module DSM.
 */
async function lireEditeur(templateId: number | null): Promise<string> {
  if (!templateId) return "";
  try {
    const lignes = await searchRead("product.template", [["id", "=", templateId]], ["dsm_editeur"], { limit: 1 });
    return lignes[0]?.dsm_editeur || "";
  } catch { return ""; }
}

function versArticle(
  ligne: any,
  modele: "product.product" | "product.template",
  code: string,
  editeur: string
): ArticleOdoo {
  const prix = (modele === "product.product" ? ligne.lst_price ?? ligne.list_price : ligne.list_price) ?? 0;
  return {
    id: ligne.id,
    modele,
    nom: ligne.name || "",
    codeBarre: ligne.barcode || code,
    reference: ligne.default_code || "",
    prix: Math.round(prix * 100) / 100,
    editeur,
    stock: typeof ligne.qty_available === "number" ? ligne.qty_available : null,
  };
}

/**
 * Cherche un article par code-barres puis par référence interne (ISBN).
 * Variante d'abord (product.product), repli sur le modèle (product.template).
 * Retourne null si rien ne correspond.
 */
export async function chercherArticleParCode(code: string): Promise<ArticleOdoo | null> {
  const terme = (code || "").trim();
  if (!terme) return null;

  const domaine = ["|", ["barcode", "=", terme], ["default_code", "=", terme]];

  const variantes = await searchRead("product.product", domaine, CHAMPS_VARIANTE, { limit: 1 });
  if (variantes[0]) {
    const tmplId = Array.isArray(variantes[0].product_tmpl_id) ? variantes[0].product_tmpl_id[0] : null;
    const editeur = await lireEditeur(tmplId);
    return versArticle(variantes[0], "product.product", terme, editeur);
  }

  const modeles = await searchRead("product.template", domaine, CHAMPS_MODELE, { limit: 1 });
  if (modeles[0]) {
    const editeur = await lireEditeur(modeles[0].id);
    return versArticle(modeles[0], "product.template", terme, editeur);
  }

  return null;
}

export default {
  connecter,
  deconnecter,
  callKw,
  searchRead,
  versionServeur,
  chercherArticleParCode,
  onEtatConnexion,
  etatConnexion,
  sessionCourante,
};
