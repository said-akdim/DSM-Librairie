import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const ODOO_URL = "http://192.168.100.49:8069";
const ODOO_DB = "Dsm";

let caissCookies = "";

async function caissAuthAdmin(): Promise<boolean> {
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
    if (data.result?.uid) { caissCookies = res.headers.get("set-cookie") || ""; return true; }
    return false;
  } catch { return false; }
}

async function caissCall(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
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
    return data.result || null;
  } catch { return null; }
}

async function rechercherClientParCarte(numCarte: string): Promise<any> {
  await caissAuthAdmin();
  const result = await caissCall("res.partner", "search_read",
    [[["dsm_num_carte", "=", numCarte]]],
    { fields: ["name", "email", "dsm_points", "dsm_niveau", "dsm_num_carte", "dsm_solde"], limit: 1 }
  );
  return result?.[0] || null;
}

async function ajouterPointsClient(partnerId: number, points: number, montant: number): Promise<boolean> {
  const partner = await caissCall("res.partner", "search_read",
    [[["id", "=", partnerId]]],
    { fields: ["dsm_points"], limit: 1 }
  );
  if (!partner?.[0]) return false;
  const pointsAvant = partner[0].dsm_points;
  const pointsApres = pointsAvant + points;

  await caissCall("res.partner", "write", [[partnerId], { dsm_points: pointsApres }]);

  await caissCall("dsm.historique.points", "create", [{
    partner_id: partnerId,
    points: points,
    type: "achat",
    description: `Achat en caisse DSM - ${montant.toFixed(2)} DH`,
    points_avant: pointsAvant,
    points_apres: pointsApres,
  }]);

  await caissCall("dsm.notification", "create", [{
    partner_id: partnerId,
    titre: `+${points} points fidélité !`,
    message: `Achat en caisse : ${montant.toFixed(2)} DH — Total : ${pointsApres} pts`,
    type: "points",
  }]);

  return true;
}

export default function Caisse() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [montant, setMontant] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"scan" | "saisie" | "confirm" | "success">("scan");
  const [numCarteManuel, setNumCarteManuel] = useState("");

  const handleScan = async (data: string) => {
    setScanning(false);
    setLoading(true);
    const found = await rechercherClientParCarte(data.trim());
    if (found) {
      setClient(found);
      setPhase("confirm");
    } else {
      Alert.alert("❌ Carte introuvable", `Numéro ${data} non trouvé dans Odoo`);
      setPhase("scan");
    }
    setLoading(false);
  };

  const handleSaisieManuelle = async () => {
    if (!numCarteManuel) { Alert.alert("Entrez un numéro de carte"); return; }
    setLoading(true);
    const found = await rechercherClientParCarte(numCarteManuel.trim());
    if (found) {
      setClient(found);
      setPhase("confirm");
    } else {
      Alert.alert("❌ Carte introuvable", `Numéro ${numCarteManuel} non trouvé`);
    }
    setLoading(false);
  };

  const handleValider = async () => {
    if (!montant || isNaN(parseFloat(montant))) {
      Alert.alert("Entrez un montant valide");
      return;
    }
    setLoading(true);
    const total = parseFloat(montant);
    const points = Math.round(total * 10);
    const ok = await ajouterPointsClient(client.id, points, total);
    if (ok) {
      setPhase("success");
    } else {
      Alert.alert("❌ Erreur", "Impossible d'ajouter les points");
    }
    setLoading(false);
  };

  const reset = () => {
    setClient(null);
    setMontant("");
    setNumCarteManuel("");
    setPhase("scan");
    setScanning(false);
  };

  if (loading) return (
    <View style={st.centered}>
      <ActivityIndicator size="large" color="#1A6FFF" />
      <Text style={{ color: "#8AAABF", marginTop: 12 }}>Connexion Odoo...</Text>
    </View>
  );

  if (phase === "success") return (
    <View style={st.centered}>
      <Text style={{ fontSize: 60 }}>🎉</Text>
      <Text style={st.successTitre}>Points ajoutés !</Text>
      <Text style={st.successNom}>{client?.name}</Text>
      <Text style={st.successPts}>+{Math.round(parseFloat(montant) * 10)} pts</Text>
      <Text style={st.successTotal}>Total : {(client?.dsm_points || 0) + Math.round(parseFloat(montant) * 10)} pts</Text>
      <TouchableOpacity style={st.btnPrimary} onPress={reset}>
        <Text style={st.btnTxt}>✅ Nouvelle transaction</Text>
      </TouchableOpacity>
    </View>
  );

  if (phase === "confirm") return (
    <View style={st.container}>
      <View style={st.clientCard}>
        <Text style={st.cardEmoji}>👤</Text>
        <Text style={st.cardNom}>{client?.name}</Text>
        <Text style={st.cardNiveau}>{client?.dsm_niveau} — {client?.dsm_points} pts</Text>
        <Text style={st.cardCarte}>Carte N° {client?.dsm_num_carte}</Text>
      </View>
      <Text style={st.label}>Montant de l'achat (DH)</Text>
      <TextInput
        style={st.input}
        placeholder="Ex: 150.00"
        placeholderTextColor="#8AAABF"
        value={montant}
        onChangeText={setMontant}
        keyboardType="numeric"
      />
      {montant.length > 0 && !isNaN(parseFloat(montant)) && (
        <View style={st.ptsPreview}>
          <Text style={st.ptsPreviewTxt}>Points à gagner : +{Math.round(parseFloat(montant) * 10)} pts</Text>
        </View>
      )}
      <TouchableOpacity style={st.btnPrimary} onPress={handleValider}>
        <Text style={st.btnTxt}>✅ Valider et ajouter les points</Text>
      </TouchableOpacity>
      <TouchableOpacity style={st.btnSecondary} onPress={reset}>
        <Text style={st.btnSecTxt}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={st.container}>
      <Text style={st.titre}>🏪 Caisse DSM</Text>
      <Text style={st.sous}>Identifiez le client par sa carte fidélité</Text>

      {/* Saisie manuelle */}
      <View style={st.manuelBox}>
        <Text style={st.label}>Saisir le numéro de carte</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[st.input, { flex: 1 }]}
            placeholder="Ex: 8821"
            placeholderTextColor="#8AAABF"
            value={numCarteManuel}
            onChangeText={setNumCarteManuel}
            keyboardType="number-pad"
            maxLength={10}
          />
          <TouchableOpacity style={st.btnSearch} onPress={handleSaisieManuelle}>
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={st.ouTxt}>— ou —</Text>

      {/* Scanner QR */}
      {!scanning ? (
        <TouchableOpacity style={st.btnScan} onPress={async () => {
          if (!permission?.granted) await requestPermission();
          setScanning(true);
        }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📷</Text>
          <Text style={st.btnScanTxt}>Scanner la carte QR</Text>
        </TouchableOpacity>
      ) : (
        <View style={st.cameraBox}>
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={({ data }) => handleScan(data)}
            barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39"] }}
          />
          <TouchableOpacity style={st.btnAnnulerScan} onPress={() => setScanning(false)}>
            <Text style={st.btnSecTxt}>✕ Annuler le scan</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FF", padding: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FF", padding: 20 },
  titre: { fontSize: 24, fontWeight: "bold", color: "#05102A", marginBottom: 6, marginTop: 20 },
  sous: { fontSize: 13, color: "#8AAABF", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "bold", color: "#05102A", marginBottom: 8 },
  input: { backgroundColor: "#fff", borderRadius: 14, padding: 14, fontSize: 16, color: "#05102A", borderWidth: 1.5, borderColor: "#E0EDFF", marginBottom: 12 },
  manuelBox: { backgroundColor: "#fff", borderRadius: 18, padding: 18, marginBottom: 16 },
  btnSearch: { backgroundColor: "#1A6FFF", borderRadius: 14, padding: 14, alignItems: "center", justifyContent: "center" },
  ouTxt: { textAlign: "center", color: "#8AAABF", fontSize: 13, marginVertical: 12 },
  btnScan: { backgroundColor: "#05102A", borderRadius: 18, padding: 30, alignItems: "center", justifyContent: "center" },
  btnScanTxt: { color: "#FFD080", fontSize: 16, fontWeight: "bold" },
  cameraBox: { flex: 1, borderRadius: 18, overflow: "hidden", minHeight: 300 },
  btnAnnulerScan: { backgroundColor: "#fff", padding: 14, alignItems: "center" },
  btnPrimary: { backgroundColor: "#1A6FFF", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 8 },
  btnTxt: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  btnSecondary: { backgroundColor: "#F0F4FF", borderRadius: 16, padding: 14, alignItems: "center", marginTop: 10 },
  btnSecTxt: { color: "#05102A", fontSize: 14, fontWeight: "600" },
  clientCard: { backgroundColor: "#05102A", borderRadius: 18, padding: 20, alignItems: "center", marginBottom: 20 },
  cardEmoji: { fontSize: 40, marginBottom: 8 },
  cardNom: { fontSize: 20, color: "#fff", fontWeight: "bold", marginBottom: 4 },
  cardNiveau: { fontSize: 13, color: "#FFD080", marginBottom: 4 },
  cardCarte: { fontSize: 12, color: "rgba(255,255,255,0.5)", letterSpacing: 2 },
  ptsPreview: { backgroundColor: "#EAF2FF", borderRadius: 12, padding: 12, marginBottom: 12, alignItems: "center" },
  ptsPreviewTxt: { color: "#1A6FFF", fontWeight: "bold", fontSize: 15 },
  successTitre: { fontSize: 26, fontWeight: "bold", color: "#05102A", marginTop: 16 },
  successNom: { fontSize: 18, color: "#1A6FFF", marginTop: 8 },
  successPts: { fontSize: 36, color: "#F5A623", fontWeight: "bold", marginTop: 8 },
  successTotal: { fontSize: 14, color: "#8AAABF", marginTop: 4, marginBottom: 24 },
});
