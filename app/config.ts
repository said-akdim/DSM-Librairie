import { Platform } from "react-native";

/* ══════════════════════════════════════
   CONFIG AUTOMATIQUE DSM
   - iPhone/Android → IP réseau local
   - Web (localhost) → localhost direct
══════════════════════════════════════ */

const ODOO_PROD = "http://94.130.90.253:9069";

/* EXPO_PUBLIC_ODOO_URL : à définir sur chaque borne (.env ou variable de build).
   Valeur vide = même origine que la page : les appels partent en /web/...
   C'est le réglage des bornes Windows, derrière le serveur local qui
   relaie Odoo (voir kiosque/ et docs/BORNE.md) : ni CORS, ni cookie bloqué.
   Sans la variable, on garde le comportement de développement. */
export const ODOO_URL = process.env.EXPO_PUBLIC_ODOO_URL
  ?? (Platform.OS === "web" ? "http://localhost:8069" : ODOO_PROD);

export const WS_URL = Platform.OS === "web"
  ? "ws://localhost:8090"
  : "ws://94.130.90.253:8090";

export const ODOO_DB = process.env.EXPO_PUBLIC_ODOO_DB || "agora-prod";

/* Compte de service Odoo (borne de prix, caisse).
   À définir dans .env : EXPO_PUBLIC_ODOO_LOGIN / EXPO_PUBLIC_ODOO_PASSWORD
   Prévoir un utilisateur Odoo en lecture seule pour la borne en libre-service. */
export const ODOO_LOGIN = process.env.EXPO_PUBLIC_ODOO_LOGIN || "admin";
export const ODOO_PASSWORD = process.env.EXPO_PUBLIC_ODOO_PASSWORD || "admin";

export default { ODOO_URL, WS_URL, ODOO_DB, ODOO_LOGIN, ODOO_PASSWORD };
