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
import { supabase } from "../supabase";

export default function Caisse() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [montant, setMontant] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"scan" | "confirm" | "success">("scan");
  const [ptsGagnes, setPtsGagnes] = useState(0);

  const onScan = async ({ data }: { data: string }) => {
    if (!scanning) return;
    setScanning(false);
    setLoading(true);
    try {
      // Chercher le client par numéro de carte
      const { data: clientData, error } = await supabase
        .from("clients")
        .select("*")
        .eq("num_carte", data)
        .single();
      if (error || !clientData) {
        Alert.alert("❌ Carte non reconnue", "Numéro de carte invalide.");
        setScanning(true);
      } else {
        setClient(clientData);
        setPhase("confirm");
      }
    } catch (e) {
      Alert.alert("❌ Erreur", "Impossible de lire la carte.");
    }
    setLoading(false);
  };

  const validerAchat = async () => {
    if (!montant || !client) return;
    setLoading(true);
    const m = parseFloat(montant);
    const pts = Math.round(m * 10);
    try {
      const newPoints = client.points + pts;
      const newNiveau =
        newPoints >= 2000
          ? "Platine"
          : newPoints >= 1000
            ? "Gold"
            : newPoints >= 500
              ? "Silver"
              : "Bronze";
      await supabase
        .from("clients")
        .update({ points: newPoints, niveau: newNiveau })
        .eq("id", client.id);
      await supabase.from("achats").insert({
        client_id: client.id,
        titre: "Achat en caisse",
        auteur: "DSM Librairie",
        prix: m,
        points_gagnes: pts,
      });
      await supabase.from("notifications").insert({
        client_id: client.id,
        titre: "✅ Achat validé en caisse !",
        message: `+${pts} pts pour un achat de ${m.toFixed(2)} DH`,
        lu: false,
      });
      setPtsGagnes(pts);
      setClient((c: any) => ({ ...c, points: newPoints, niveau: newNiveau }));
      setPhase("success");
    } catch (e) {
      Alert.alert("❌ Erreur", "Impossible de valider l'achat.");
    }
    setLoading(false);
  };

  const reset = () => {
    setPhase("scan");
    setClient(null);
    setMontant("");
    setPtsGagnes(0);
    setScanning(false);
  };

  // Permissions
  if (!permission)
    return (
      <View style={s.container}>
        <ActivityIndicator color="#1A6FFF" />
      </View>
    );
  if (!permission.granted)
    return (
      <View style={s.container}>
        <Text style={s.permTxt}>📷 Autorisation caméra requise</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnTxt}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitre}>📚 DSM — Caisse</Text>
        <Text style={s.headerSous}>VALIDATION CARTE FIDÉLITÉ</Text>
      </View>

      {/* PHASE SCAN */}
      {phase === "scan" && (
        <View style={s.scanContainer}>
          <Text style={s.scanTitre}>Scannez la carte du client</Text>
          <View style={s.cameraBox}>
            {scanning ? (
              <CameraView
                style={s.camera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ["qr", "code128", "code39", "ean13"],
                }}
                onBarcodeScanned={onScan}
              >
                {/* Viseur */}
                <View style={s.viseur}>
                  {[
                    ["top", "left"],
                    ["top", "right"],
                    ["bottom", "left"],
                    ["bottom", "right"],
                  ].map(([v, h], i) => (
                    <View
                      key={i}
                      style={[
                        s.coin,
                        {
                          [v]: 0,
                          [h]: 0,
                          borderTopWidth: v === "top" ? 3 : 0,
                          borderBottomWidth: v === "bottom" ? 3 : 0,
                          borderLeftWidth: h === "left" ? 3 : 0,
                          borderRightWidth: h === "right" ? 3 : 0,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={s.scanHint}>Pointez vers le code-barres</Text>
              </CameraView>
            ) : (
              <View style={s.cameraPlaceholder}>
                <Text style={{ fontSize: 60 }}>📷</Text>
                <Text style={{ color: "#8AAABF", marginTop: 12, fontSize: 14 }}>
                  {loading ? "Recherche du client..." : "Caméra prête"}
                </Text>
                {loading && (
                  <ActivityIndicator
                    color="#1A6FFF"
                    style={{ marginTop: 12 }}
                  />
                )}
              </View>
            )}
          </View>
          {!loading && (
            <TouchableOpacity
              style={s.scanBtn}
              onPress={() => setScanning(true)}
            >
              <Text style={s.scanBtnTxt}>📱 Lancer le scan</Text>
            </TouchableOpacity>
          )}
          {/* Saisie manuelle */}
          <Text style={s.ouTxt}>— ou saisie manuelle —</Text>
          <ManuelInput
            onFound={(c) => {
              setClient(c);
              setPhase("confirm");
            }}
          />
        </View>
      )}

      {/* PHASE CONFIRM */}
      {phase === "confirm" && client && (
        <View style={s.confirmContainer}>
          <View style={s.clientCard}>
            <View style={s.clientAvatar}>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }}>
                {client.prenom[0]}
                {client.nom[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.clientNom}>
                {client.prenom} {client.nom}
              </Text>
              <Text style={s.clientInfo}>
                Niveau {client.niveau} · {client.points} pts
              </Text>
              <Text style={s.clientInfo}>Carte N° {client.num_carte}</Text>
            </View>
            <View style={s.niveauBadge}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                {client.niveau}
              </Text>
            </View>
          </View>

          <Text style={s.montantLabel}>MONTANT DE L'ACHAT (DH)</Text>
          <TextInput
            style={s.montantInput}
            placeholder="Ex : 89.90"
            placeholderTextColor="#8AAABF"
            value={montant}
            onChangeText={setMontant}
            keyboardType="numeric"
            autoFocus
          />

          {montant ? (
            <View style={s.ptsPreview}>
              <Text style={s.ptsPreviewTxt}>
                Points à gagner :{" "}
                <Text style={{ color: "#F5A623", fontWeight: "bold" }}>
                  +{Math.round(parseFloat(montant || "0") * 10)} pts
                </Text>
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.validerBtn, !montant && s.validerBtnDisabled]}
            onPress={validerAchat}
            disabled={!montant || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.validerTxt}>✅ Valider l'achat</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.annulerBtn} onPress={reset}>
            <Text style={s.annulerTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PHASE SUCCESS */}
      {phase === "success" && client && (
        <View style={s.successContainer}>
          <Text style={{ fontSize: 70, marginBottom: 16 }}>🎉</Text>
          <Text style={s.successTitre}>Achat validé !</Text>
          <Text style={s.successNom}>
            {client.prenom} {client.nom}
          </Text>
          <View style={s.successPtsBox}>
            <Text style={s.successPtsLabel}>Points gagnés</Text>
            <Text style={s.successPts}>+{ptsGagnes}</Text>
            <Text style={s.successPtsUnit}>pts</Text>
          </View>
          <View style={s.successTotalBox}>
            <Text style={{ fontSize: 14, color: "#8AAABF" }}>
              Nouveau solde
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "bold",
                color: "#05102A",
                marginTop: 4,
              }}
            >
              {client.points.toLocaleString()} pts
            </Text>
            <Text style={{ fontSize: 14, color: "#1A6FFF" }}>
              = {(client.points * 0.1).toFixed(2)} DH
            </Text>
          </View>
          <TouchableOpacity style={s.nouvelAchatBtn} onPress={reset}>
            <Text style={s.nouvelAchatTxt}>📱 Nouveau scan</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* Saisie manuelle du numéro de carte */
function ManuelInput({ onFound }: { onFound: (c: any) => void }) {
  const [num, setNum] = useState("");
  const [loading, setLoading] = useState(false);

  const chercher = async () => {
    if (!num) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("num_carte", num)
        .single();
      if (error || !data) Alert.alert("❌ Carte non trouvée");
      else onFound(data);
    } catch (e) {
      Alert.alert("❌ Erreur");
    }
    setLoading(false);
  };

  return (
    <View style={s.manuelBox}>
      <TextInput
        style={s.manuelInput}
        placeholder="N° de carte (ex: 8821)"
        placeholderTextColor="#8AAABF"
        value={num}
        onChangeText={setNum}
        keyboardType="numeric"
        maxLength={4}
      />
      <TouchableOpacity
        style={s.manuelBtn}
        onPress={chercher}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={s.manuelBtnTxt}>Chercher</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FF" },
  header: {
    backgroundColor: "#05102A",
    padding: 20,
    paddingTop: 50,
    alignItems: "center",
  },
  headerTitre: {
    fontSize: 20,
    color: "#FFD080",
    fontWeight: "bold",
    letterSpacing: 2,
  },
  headerSous: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 3,
    marginTop: 4,
  },
  permTxt: { fontSize: 16, color: "#05102A", textAlign: "center", margin: 40 },
  permBtn: {
    backgroundColor: "#1A6FFF",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 40,
    alignItems: "center",
  },
  permBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  // Scan
  scanContainer: { flex: 1, padding: 20 },
  scanTitre: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#05102A",
    textAlign: "center",
    marginBottom: 16,
  },
  cameraBox: {
    height: 280,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 16,
  },
  camera: { flex: 1 },
  cameraPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a2e",
  },
  viseur: {
    position: "absolute",
    top: "20%",
    left: "20%",
    right: "20%",
    bottom: "20%",
  },
  coin: { position: "absolute", width: 30, height: 30, borderColor: "#FFD080" },
  scanHint: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  scanBtn: {
    backgroundColor: "#1A6FFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  scanBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  ouTxt: {
    textAlign: "center",
    color: "#8AAABF",
    fontSize: 12,
    marginBottom: 12,
  },
  manuelBox: { flexDirection: "row", gap: 10 },
  manuelInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: "#05102A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    textAlign: "center",
    letterSpacing: 4,
    fontWeight: "bold",
  },
  manuelBtn: {
    backgroundColor: "#05102A",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  manuelBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  // Confirm
  confirmContainer: { flex: 1, padding: 20 },
  clientCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1A6FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  clientNom: { fontSize: 18, fontWeight: "bold", color: "#05102A" },
  clientInfo: { fontSize: 12, color: "#8AAABF", marginTop: 2 },
  niveauBadge: {
    backgroundColor: "#F5A623",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  montantLabel: {
    fontSize: 11,
    color: "#8AAABF",
    letterSpacing: 1,
    marginBottom: 8,
  },
  montantInput: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    fontSize: 28,
    color: "#05102A",
    textAlign: "center",
    fontWeight: "bold",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
    letterSpacing: 2,
  },
  ptsPreview: {
    backgroundColor: "#EEF5FF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  ptsPreviewTxt: { fontSize: 14, color: "#05102A" },
  validerBtn: {
    backgroundColor: "#1A6FFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  validerBtnDisabled: { backgroundColor: "#8AAABF" },
  validerTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  annulerBtn: {
    backgroundColor: "#F5F7FF",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E8FF",
  },
  annulerTxt: { color: "#8AAABF", fontWeight: "bold", fontSize: 14 },
  // Success
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  successTitre: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#05102A",
    marginBottom: 8,
  },
  successNom: { fontSize: 16, color: "#8AAABF", marginBottom: 24 },
  successPtsBox: {
    backgroundColor: "#05102A",
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
  successPtsLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 2,
    marginBottom: 8,
  },
  successPts: {
    fontSize: 64,
    color: "#FFD080",
    fontWeight: "bold",
    lineHeight: 70,
  },
  successPtsUnit: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 2,
  },
  successTotalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  nouvelAchatBtn: {
    backgroundColor: "#1A6FFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    width: "100%",
  },
  nouvelAchatTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
