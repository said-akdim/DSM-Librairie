/* ══════════════════════════════════════
   BORNE DE PRIX — DSM Librairie
   Scan d'un code-barres → nom + prix en grand
   Odoo 18 (product.product / product.template)
══════════════════════════════════════ */

import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ODOO_DB, ODOO_URL } from "./config";

/* Durée d'affichage du résultat avant retour à l'écran d'accueil */
const DELAI_RETOUR_MS = 10000;
/* Anti-rebond : même code ignoré pendant ce délai */
const ANTI_REBOND_MS = 2000;

let borneCookies = "";

/* ── Types ── */
export interface PrixProduit {
  id: number;
  name: string;
  prix: number;
  code: string;
}

/* ── Session Odoo (lecture seule, compte caisse) ── */
async function borneAuthAdmin(): Promise<boolean> {
  try {
    const res = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 1,
        params: { db: ODOO_DB, login: "admin", password: "admin" },
      }),
    });
    const data = await res.json();
    if (data.result?.uid) { borneCookies = res.headers.get("set-cookie") || ""; return true; }
    return false;
  } catch { return false; }
}

async function borneCall(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  try {
    const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(borneCookies ? { Cookie: borneCookies } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: Date.now(),
        params: { model, method, args, kwargs },
      }),
    });
    const data = await res.json();
    return data.result || null;
  } catch { return null; }
}

/**
 * Cherche un article par code-barres (ou référence interne / ISBN).
 * Variante d'abord (product.product), puis article modèle (product.template).
 */
export async function chercherPrixParCode(code: string): Promise<PrixProduit | null> {
  const terme = code.trim();
  if (!terme) return null;

  await borneAuthAdmin();
  const domain = ["|", ["barcode", "=", terme], ["default_code", "=", terme]];

  const variantes = await borneCall("product.product", "search_read", [domain],
    { fields: ["name", "lst_price", "list_price", "barcode", "default_code"], limit: 1 }
  );
  const v = variantes?.[0];
  if (v) {
    return {
      id: v.id,
      name: v.name,
      prix: v.lst_price ?? v.list_price ?? 0,
      code: v.barcode || v.default_code || terme,
    };
  }

  const modeles = await borneCall("product.template", "search_read", [domain],
    { fields: ["name", "list_price", "barcode", "default_code"], limit: 1 }
  );
  const m = modeles?.[0];
  if (m) {
    return {
      id: m.id,
      name: m.name,
      prix: m.list_price ?? 0,
      code: m.barcode || m.default_code || terme,
    };
  }

  return null;
}

/* ── Code-barres décoratif (écran d'accueil) ── */
function CodeBarresDeco({ chiffres }: { chiffres: string }) {
  const barres = Array.from({ length: 44 }, (_, i) => {
    const n = (i * 7 + chiffres.charCodeAt(i % chiffres.length)) % 5;
    return { largeur: n < 2 ? 3 : n < 4 ? 5 : 8, plein: n !== 2 };
  });
  return (
    <View style={st.decoBox}>
      <View style={st.decoBarres}>
        {barres.map((b, i) => (
          <View key={i} style={{ width: b.largeur, height: 86, backgroundColor: b.plein ? "#05102A" : "transparent" }} />
        ))}
      </View>
      <Text style={st.decoChiffres}>{chiffres}</Text>
    </View>
  );
}

export default function BornePrix() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<"accueil" | "recherche" | "trouve" | "introuvable">("accueil");
  const [produit, setProduit] = useState<PrixProduit | null>(null);
  const [codeIntrouvable, setCodeIntrouvable] = useState("");
  const [saisie, setSaisie] = useState("");
  const [camera, setCamera] = useState(Platform.OS !== "web");

  const dernierScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const timerRetour = useRef<ReturnType<typeof setTimeout> | null>(null);
  const champDouchette = useRef<TextInput>(null);

  const retourAccueil = useCallback(() => {
    if (timerRetour.current) clearTimeout(timerRetour.current);
    timerRetour.current = null;
    setProduit(null);
    setCodeIntrouvable("");
    setSaisie("");
    setPhase("accueil");
  }, []);

  const traiterCode = useCallback(async (code: string) => {
    const terme = code.trim();
    if (!terme) return;

    /* Anti-rebond : la caméra renvoie le même code en continu */
    const now = Date.now();
    if (dernierScan.current.code === terme && now - dernierScan.current.at < ANTI_REBOND_MS) return;
    dernierScan.current = { code: terme, at: now };

    if (timerRetour.current) clearTimeout(timerRetour.current);
    setSaisie("");
    setPhase("recherche");

    const trouve = await chercherPrixParCode(terme);
    if (trouve) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setProduit(trouve);
      setPhase("trouve");
    } else {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setCodeIntrouvable(terme);
      setPhase("introuvable");
    }
    timerRetour.current = setTimeout(retourAccueil, DELAI_RETOUR_MS);
  }, [retourAccueil]);

  /* Caméra : demander l'autorisation au montage */
  useEffect(() => {
    if (camera && !permission?.granted) requestPermission();
  }, [camera, permission?.granted, requestPermission]);

  /* Douchette USB/Bluetooth : garder le champ invisible toujours actif */
  useEffect(() => {
    if (camera) return;
    const t = setTimeout(() => champDouchette.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [camera, phase]);

  useEffect(() => () => { if (timerRetour.current) clearTimeout(timerRetour.current); }, []);

  const enTete = (
    <View style={st.enTete}>
      <View style={st.logoBox}><Text style={st.logoEmoji}>📚</Text></View>
      <View>
        <Text style={st.logoDSM}>DSM</Text>
        <Text style={st.logoSous}>LIBRAIRIE</Text>
      </View>
    </View>
  );

  /* Champ invisible qui capte la douchette (clavier virtuel) */
  const champInvisible = !camera ? (
    <TextInput
      ref={champDouchette}
      style={st.champInvisible}
      value={saisie}
      onChangeText={setSaisie}
      onSubmitEditing={() => traiterCode(saisie)}
      blurOnSubmit={false}
      autoFocus
      autoCorrect={false}
      showSoftInputOnFocus={false}
    />
  ) : null;

  return (
    <View style={st.ecran}>
      <View style={st.cadre}>
        {champInvisible}

        {phase === "accueil" && (
          <View style={st.centre}>
            <Text style={st.titre}>BORNE DE PRIX</Text>
            <Text style={st.sousTitre}>Scannez pour afficher le prix</Text>

            {camera ? (
              <View style={st.viseur}>
                {permission?.granted ? (
                  <CameraView
                    style={{ flex: 1 }}
                    onBarcodeScanned={({ data }) => traiterCode(data)}
                    barcodeScannerSettings={{
                      barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
                    }}
                  />
                ) : (
                  <TouchableOpacity style={st.viseurVide} onPress={requestPermission}>
                    <Text style={{ fontSize: 34, marginBottom: 8 }}>📷</Text>
                    <Text style={st.viseurVideTxt}>Autoriser la caméra</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <CodeBarresDeco chiffres="6583 3254" />
            )}

            <Text style={st.fleches}>⬇︎  ⬇︎</Text>
            <Text style={st.consigne}>Présentez le code-barres de l&apos;article</Text>
          </View>
        )}

        {phase === "recherche" && (
          <View style={st.centre}>
            {enTete}
            <ActivityIndicator size="large" color="#1A6FFF" style={{ marginTop: 28 }} />
            <Text style={st.consigne}>Recherche du prix…</Text>
          </View>
        )}

        {phase === "trouve" && produit && (
          <TouchableOpacity activeOpacity={1} style={st.centre} onPress={retourAccueil}>
            {enTete}
            <Text style={st.nomProduit} numberOfLines={3} adjustsFontSizeToFit>{produit.name}</Text>
            <Text style={st.prix}>{produit.prix.toFixed(2)} DH</Text>
            <Text style={st.codeProduit}>{produit.code}</Text>
          </TouchableOpacity>
        )}

        {phase === "introuvable" && (
          <TouchableOpacity activeOpacity={1} style={st.centre} onPress={retourAccueil}>
            {enTete}
            <Text style={st.erreurEmoji}>❓</Text>
            <Text style={st.erreurTitre}>Article non reconnu</Text>
            <Text style={st.erreurCode}>{codeIntrouvable}</Text>
            <Text style={st.consigne}>Demandez le prix à un libraire</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Barre technique discrète (personnel magasin) */}
      <View style={st.barreTech}>
        <Text style={st.techTxt}>DIRECTE · {ODOO_DB}</Text>
        <TouchableOpacity onPress={() => { setCamera(c => !c); retourAccueil(); }}>
          <Text style={st.techBtn}>{camera ? "📷 Caméra" : "⌨︎ Douchette"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: "#05102A", padding: 10 },
  cadre: {
    flex: 1,
    backgroundColor: "#F7FAFF",
    borderRadius: 10,
    borderWidth: 10,
    borderColor: "#F5A623",
    overflow: "hidden",
  },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },

  enTete: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  logoBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#1A6FFF", alignItems: "center", justifyContent: "center" },
  logoEmoji: { fontSize: 18 },
  logoDSM: { fontSize: 20, color: "#05102A", fontWeight: "bold", letterSpacing: 4 },
  logoSous: { fontSize: 8, color: "#8AAABF", letterSpacing: 3 },

  titre: { fontSize: 34, fontWeight: "bold", color: "#05102A", letterSpacing: 2, textAlign: "center" },
  sousTitre: { fontSize: 18, fontWeight: "600", color: "#05102A", marginTop: 8, marginBottom: 22, textAlign: "center" },

  decoBox: { alignItems: "center", marginBottom: 10 },
  decoBarres: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 86 },
  decoChiffres: { fontSize: 22, color: "#05102A", letterSpacing: 6, marginTop: 6, fontWeight: "600" },

  viseur: { width: "80%", maxWidth: 420, height: 180, borderRadius: 14, overflow: "hidden", backgroundColor: "#05102A" },
  viseurVide: { flex: 1, alignItems: "center", justifyContent: "center" },
  viseurVideTxt: { color: "#FFD080", fontSize: 14, fontWeight: "bold" },

  fleches: { fontSize: 36, color: "#E74C3C", marginTop: 14, letterSpacing: 10 },
  consigne: { fontSize: 14, color: "#8AAABF", marginTop: 10, textAlign: "center" },

  nomProduit: { fontSize: 38, fontWeight: "bold", color: "#05102A", textAlign: "center", marginTop: 18, lineHeight: 46 },
  prix: { fontSize: 72, fontWeight: "bold", color: "#05102A", marginTop: 18 },
  codeProduit: { fontSize: 13, color: "#8AAABF", letterSpacing: 3, marginTop: 14 },

  erreurEmoji: { fontSize: 56, marginTop: 20 },
  erreurTitre: { fontSize: 30, fontWeight: "bold", color: "#05102A", marginTop: 12, textAlign: "center" },
  erreurCode: { fontSize: 18, color: "#1A6FFF", letterSpacing: 3, marginTop: 10 },

  champInvisible: { position: "absolute", opacity: 0, height: 1, width: 1 },

  barreTech: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 8 },
  techTxt: { fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1 },
  techBtn: { fontSize: 11, color: "#FFD080", fontWeight: "bold" },
});
