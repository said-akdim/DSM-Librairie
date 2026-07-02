import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as MailComposer from "expo-mail-composer";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ODOO_URL, ODOO_DB } from "./config";

/* ══════════════════════════════════════
   RÉCEPTION LIVRES — Scan douchette
   Lecture seule Odoo : recherche produit par code-barres.
   Aucune écriture de stock (liste à partager/appliquer manuellement).
══════════════════════════════════════ */

let recepCookies = "";

async function recepAuthAdmin(): Promise<boolean> {
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
    if (data.result?.uid) { recepCookies = res.headers.get("set-cookie") || ""; return true; }
    return false;
  } catch { return false; }
}

async function recepCall(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  try {
    const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: Date.now(),
        params: { model, method, args, kwargs },
      }),
    });
    const data = await res.json();
    return data.result ?? null;
  } catch { return null; }
}

async function rechercherProduitParCodeBarre(barcode: string): Promise<any> {
  await recepAuthAdmin();
  const result = await recepCall("product.template", "search_read",
    [[["barcode", "=", barcode]]],
    { fields: ["name", "dsm_editeur", "qty_available", "default_code"], limit: 1 }
  );
  return result?.[0] || null;
}

/* ══════════════════════════════════════
   TYPES
══════════════════════════════════════ */
type LigneReception = {
  barcode: string;
  nom: string;
  editeur: string;
  stockActuel: number | null;
  trouve: boolean;
  qte: number;
};

/* ══════════════════════════════════════
   ÉCRAN RÉCEPTION
══════════════════════════════════════ */
export default function Reception() {
  const [permission, requestPermission] = useCameraPermissions();
  const [camActive, setCamActive] = useState(false);
  const [lignes, setLignes] = useState<LigneReception[]>([]);
  const [loading, setLoading] = useState(false);
  const [saisie, setSaisie] = useState("");
  const inputRef = useRef<TextInput>(null);

  // Garde le champ toujours prêt à recevoir le flux clavier de la douchette
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const traiterCode = async (codeBrut: string) => {
    const code = codeBrut.trim();
    if (!code) return;
    setSaisie("");

    const dejaLa = lignes.find(l => l.barcode === code);
    if (dejaLa) {
      setLignes(prev => prev.map(l => l.barcode === code ? { ...l, qte: l.qte + 1 } : l));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    const produit = await rechercherProduitParCodeBarre(code);
    setLoading(false);

    if (produit) {
      setLignes(prev => [{
        barcode: code,
        nom: produit.name,
        editeur: produit.dsm_editeur || "—",
        stockActuel: produit.qty_available ?? null,
        trouve: true,
        qte: 1,
      }, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      setLignes(prev => [{
        barcode: code,
        nom: "Produit introuvable dans Odoo",
        editeur: "—",
        stockActuel: null,
        trouve: false,
        qte: 1,
      }, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    inputRef.current?.focus();
  };

  const modifierQte = (barcode: string, delta: number) => {
    setLignes(prev => prev
      .map(l => l.barcode === barcode ? { ...l, qte: Math.max(0, l.qte + delta) } : l)
      .filter(l => l.qte > 0));
  };

  const supprimerLigne = (barcode: string) => {
    Alert.alert("Retirer cette ligne ?", "", [
      { text: "Annuler", style: "cancel" },
      { text: "Retirer", style: "destructive", onPress: () => setLignes(prev => prev.filter(l => l.barcode !== barcode)) },
    ]);
  };

  const totalTitres = lignes.length;
  const totalExemplaires = lignes.reduce((a, l) => a + l.qte, 0);

  const genererTexte = () => {
    const date = new Date().toLocaleDateString("fr-FR");
    const corps = lignes.map((l, i) =>
      `${i + 1}. ${l.nom}${l.editeur !== "—" ? " — " + l.editeur : ""}\n   Code-barres : ${l.barcode} | Reçu : ${l.qte}${l.stockActuel !== null ? ` | Stock actuel : ${l.stockActuel} → nouveau : ${l.stockActuel + l.qte}` : ""}`
    ).join("\n\n");
    return `📦 RÉCEPTION LIVRES DSM — ${date}\n\n${corps}\n\n─────────────\nTitres distincts : ${totalTitres}\nExemplaires reçus : ${totalExemplaires}\n\n⚠️ Cette liste n'a PAS mis à jour le stock Odoo — à appliquer manuellement.`;
  };

  const partager = async () => {
    if (lignes.length === 0) { Alert.alert("Liste vide", "Scannez au moins un livre d'abord."); return; }
    try { await Share.share({ message: genererTexte() }); } catch {}
  };

  const envoyerEmail = async () => {
    if (lignes.length === 0) { Alert.alert("Liste vide", "Scannez au moins un livre d'abord."); return; }
    try {
      await MailComposer.composeAsync({
        recipients: ["librairie.dsm@gmail.com"],
        subject: `Réception livres DSM — ${new Date().toLocaleDateString("fr-FR")}`,
        body: genererTexte(),
      });
    } catch { Alert.alert("❌ Erreur", "Impossible d'ouvrir l'email"); }
  };

  const toutEffacer = () => {
    if (lignes.length === 0) return;
    Alert.alert("Nouvelle réception ?", "La liste actuelle sera effacée.", [
      { text: "Annuler", style: "cancel" },
      { text: "Effacer", style: "destructive", onPress: () => setLignes([]) },
    ]);
  };

  return (
    <View style={st.container}>
      <View style={st.header}>
        <Text style={st.titre}>📦 Réception livres</Text>
        <Text style={st.sous}>Scannez avec la douchette Honeywell ou la caméra</Text>
      </View>

      {/* Résumé */}
      <View style={st.resumeRow}>
        <View style={st.resumeCard}>
          <Text style={st.resumeVal}>{totalTitres}</Text>
          <Text style={st.resumeLbl}>titres</Text>
        </View>
        <View style={st.resumeCard}>
          <Text style={st.resumeVal}>{totalExemplaires}</Text>
          <Text style={st.resumeLbl}>exemplaires</Text>
        </View>
      </View>

      {/* Champ de saisie — reçoit le flux de la douchette (mode clavier) */}
      <View style={st.saisieBox}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>🔫</Text>
        <TextInput
          ref={inputRef}
          style={st.saisieInput}
          placeholder="Scannez un code-barres ou tapez-le ici…"
          placeholderTextColor="#8AAABF"
          value={saisie}
          onChangeText={setSaisie}
          onSubmitEditing={({ nativeEvent }) => traiterCode(nativeEvent.text)}
          blurOnSubmit={false}
          keyboardType="default"
          autoFocus
          showSoftInputOnFocus={true}
        />
        {loading && <ActivityIndicator color="#1A6FFF" />}
      </View>

      {/* Scan caméra (secours si le scanner intégré n'est pas en mode clavier) */}
      {!camActive ? (
        <TouchableOpacity style={st.btnCam} onPress={async () => {
          if (!permission?.granted) await requestPermission();
          Keyboard.dismiss();
          setCamActive(true);
        }}>
          <Text style={st.btnCamTxt}>📷 Scanner avec la caméra</Text>
        </TouchableOpacity>
      ) : (
        <View style={st.cameraBox}>
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={({ data }) => { setCamActive(false); traiterCode(data); }}
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"] }}
          />
          <TouchableOpacity style={st.btnFermerCam} onPress={() => setCamActive(false)}>
            <Text style={st.btnFermerCamTxt}>✕ Fermer la caméra</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Liste des lignes scannées */}
      <View style={st.liste}>
        {lignes.length === 0 ? (
          <View style={st.vide}>
            <Text style={{ fontSize: 40 }}>📚</Text>
            <Text style={st.videTxt}>Aucun livre scanné pour l'instant</Text>
          </View>
        ) : (
          <>
            {lignes.map(l => (
              <View key={l.barcode} style={[st.ligneCard, !l.trouve && st.ligneCardWarning]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.ligneNom} numberOfLines={2}>{l.nom}</Text>
                  <Text style={st.ligneMeta}>{l.editeur !== "—" ? `${l.editeur} · ` : ""}{l.barcode}</Text>
                  {l.stockActuel !== null && (
                    <Text style={st.ligneStock}>Stock actuel : {l.stockActuel} → {l.stockActuel + l.qte}</Text>
                  )}
                </View>
                <View style={st.qteBox}>
                  <TouchableOpacity style={st.qteBtn} onPress={() => modifierQte(l.barcode, -1)}>
                    <Text style={st.qteBtnTxt}>–</Text>
                  </TouchableOpacity>
                  <Text style={st.qteVal}>{l.qte}</Text>
                  <TouchableOpacity style={st.qteBtn} onPress={() => modifierQte(l.barcode, 1)}>
                    <Text style={st.qteBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={st.supprimerBtn} onPress={() => supprimerLigne(l.barcode)}>
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={{ height: 12 }} />
          </>
        )}
      </View>

      {/* Actions */}
      {lignes.length > 0 && (
        <View style={st.actionsBar}>
          <TouchableOpacity style={st.btnSecondaire} onPress={toutEffacer}>
            <Text style={st.btnSecondaireTxt}>🗑️ Effacer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.btnSecondaire} onPress={envoyerEmail}>
            <Text style={st.btnSecondaireTxt}>✉️ Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.btnPrimaire} onPress={partager}>
            <Text style={st.btnPrimaireTxt}>📤 Partager la liste</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FF" },
  header: { backgroundColor: "#05102A", padding: 20, paddingTop: 50 },
  titre: { fontSize: 22, color: "#FFD080", fontWeight: "bold" },
  sous: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 },
  resumeRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 14 },
  resumeCard: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#E0EDFF" },
  resumeVal: { fontSize: 22, fontWeight: "bold", color: "#05102A" },
  resumeLbl: { fontSize: 11, color: "#8AAABF", marginTop: 2 },
  saisieBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 16, marginTop: 14, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "#1A6FFF" },
  saisieInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: "#05102A" },
  btnCam: { backgroundColor: "#05102A", marginHorizontal: 16, marginTop: 10, borderRadius: 14, padding: 14, alignItems: "center" },
  btnCamTxt: { color: "#FFD080", fontWeight: "bold", fontSize: 13 },
  cameraBox: { marginHorizontal: 16, marginTop: 10, height: 260, borderRadius: 14, overflow: "hidden" },
  btnFermerCam: { backgroundColor: "#fff", padding: 12, alignItems: "center" },
  btnFermerCamTxt: { color: "#05102A", fontWeight: "600", fontSize: 13 },
  liste: { flex: 1, paddingHorizontal: 16, marginTop: 14 },
  vide: { alignItems: "center", padding: 40 },
  videTxt: { color: "#8AAABF", marginTop: 10, fontSize: 13 },
  ligneCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E0EDFF" },
  ligneCardWarning: { borderColor: "#F5A623", backgroundColor: "#FFF9F0" },
  ligneNom: { fontSize: 13, fontWeight: "bold", color: "#05102A" },
  ligneMeta: { fontSize: 11, color: "#8AAABF", marginTop: 2 },
  ligneStock: { fontSize: 11, color: "#1A6FFF", marginTop: 2, fontWeight: "600" },
  qteBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 8 },
  qteBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center" },
  qteBtnTxt: { fontSize: 16, fontWeight: "bold", color: "#1A6FFF" },
  qteVal: { fontSize: 15, fontWeight: "bold", color: "#05102A", marginHorizontal: 10, minWidth: 20, textAlign: "center" },
  supprimerBtn: { padding: 6 },
  actionsBar: { flexDirection: "row", gap: 8, padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E0EDFF" },
  btnSecondaire: { flex: 1, backgroundColor: "#F0F4FF", borderRadius: 14, padding: 13, alignItems: "center" },
  btnSecondaireTxt: { color: "#05102A", fontWeight: "700", fontSize: 12 },
  btnPrimaire: { flex: 1.4, backgroundColor: "#1A6FFF", borderRadius: 14, padding: 13, alignItems: "center" },
  btnPrimaireTxt: { color: "#fff", fontWeight: "bold", fontSize: 12 },
});
