import { Platform } from "react-native";

/* ══════════════════════════════════════
   CONFIG AUTOMATIQUE DSM
   - iPhone/Android → instance TEST (8069 / agora-dev)
   - Web (localhost) → instance TEST (8069 / agora-dev)
   Changer ENV à "prod" pour basculer en production
══════════════════════════════════════ */

const ENV: "test" | "prod" = "test";

const ODOO_TEST = "http://94.130.90.253:8069";
const ODOO_PROD = "http://94.130.90.253:9069";

const DB_TEST = "agora-dev";
const DB_PROD = "agora-prod";

export const ODOO_URL = ENV === "test" ? ODOO_TEST : ODOO_PROD;
export const ODOO_DB  = ENV === "test" ? DB_TEST   : DB_PROD;

export const WS_URL = Platform.OS === "web"
  ? "ws://localhost:8090"
  : "ws://94.130.90.253:8090";

export default { ODOO_URL, WS_URL, ODOO_DB };
