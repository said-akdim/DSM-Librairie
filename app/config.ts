import { Platform } from "react-native";

/* ══════════════════════════════════════
   CONFIG AUTOMATIQUE DSM
   - iPhone/Android → IP réseau local
   - Web (localhost) → localhost direct
══════════════════════════════════════ */

const ODOO_PROD = "http://94.130.90.253:9069";

export const ODOO_URL = Platform.OS === "web"
  ? "http://localhost:8069"
  : ODOO_PROD;

export const WS_URL = Platform.OS === "web"
  ? "ws://localhost:8090"
  : "ws://94.130.90.253:8090";

export const ODOO_DB = "Dsm";

export default { ODOO_URL, WS_URL, ODOO_DB };
