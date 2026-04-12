import { Platform } from "react-native";

/* ══════════════════════════════════════
   CONFIG AUTOMATIQUE DSM
   - iPhone/Android → IP réseau local
   - Web (localhost) → localhost direct
══════════════════════════════════════ */

const IP_MAC = "192.168.100.52"; // ← Mise à jour par update-ip.sh

export const ODOO_URL = Platform.OS === "web"
  ? "http://localhost:8069"
  : `http://${IP_MAC}:8069`;

export const WS_URL = Platform.OS === "web"
  ? "ws://localhost:8090"
  : `ws://${IP_MAC}:8090`;

export const ODOO_DB = "Dsm";

export default { ODOO_URL, WS_URL, ODOO_DB };
