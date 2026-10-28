/* ══════════════════════════════════════
   BORNE DE PRIX — DSM Librairie
   Écran libre-service : scan d'un code-barres → nom + prix en grand
   Connexion Odoo 18 : voir app/odoo18.ts
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
import { ODOO_DB } from "./config";
import {
  ArticleOdoo,
  EtatConnexion,
  chercherArticleParCode,
  connecter,
  etatConnexion,
  onEtatConnexion,
  sessionCourante,
} from "./odoo18";

/* Durée d'affichage du résultat avant retour à l'écran d'attente */
const DELAI_RETOUR_MS = 10000;
/* Anti-rebond : même code ignoré pendant ce délai */
const ANTI_REBOND_MS = 2000;

const COULEUR_VOYANT: Record<EtatConnexion, string> = {
  connecte: "#27AE60",
  connexion: "#F5A623",
  erreur: "#E74C3C",
  deconnecte: "#8AAABF",
};

/** Message affiché au client : jamais l'erreur technique brute. */
function messagePublic(code?: string) {
  if (code === "acces" || code === "auth") return "Borne non autorisée — prévenez un libraire";
  if (code === "timeout") return "Le serveur met trop de temps à répondre";
  return "Connexion au serveur interrompue — demandez le prix à un libraire";
}

function horodatage(d: Date) {
  const n = (v: number) => String(v).padStart(2, "0");
  return `${n(d.getDate())}/${n(d.getMonth() + 1)}/${d.getFullYear()} ${n(d.getHours())}:${n(d.getMinutes())}:${n(d.getSeconds())}`;
}

/* ── Code-barres décoratif (écran d'attente) ── */
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

/* ── Logo DSM ── */
function LogoDSM({ compact }: { compact?: boolean }) {
  return (
    <View style={[st.logo, compact && { gap: 6 }]}>
      <View style={[st.logoBox, compact && { width: 26, height: 26, borderRadius: 8 }]}>
        <Text style={{ fontSize: compact ? 14 : 18 }}>📚</Text>
      </View>
      <View>
        <Text style={[st.logoDSM, compact && { fontSize: 15, letterSpacing: 3 }]}>DSM</Text>
        <Text style={st.logoSous}>CULTURE · PAPETERIE · LOISIRS</Text>
      </View>
    </View>
  );
}

export default function BornePrix() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<"attente" | "recherche" | "trouve" | "introuvable" | "panne">("attente");
  const [article, setArticle] = useState<ArticleOdoo | null>(null);
  const [codeIntrouvable, setCodeIntrouvable] = useState("");
  const [messagePanne, setMessagePanne] = useState("");
  const [saisie, setSaisie] = useState("");
  const [camera, setCamera] = useState(Platform.OS !== "web");
  const [etat, setEtat] = useState<EtatConnexion>(etatConnexion());
  const [version, setVersion] = useState(sessionCourante().version);
  const [heure, setHeure] = useState("");

  const dernierScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const timerRetour = useRef<ReturnType<typeof setTimeout> | null>(null);
  const champDouchette = useRef<TextInput>(null);

  /* Connexion Odoo au démarrage + voyant d'état */
  useEffect(() => {
    const desabonner = onEtatConnexion((e, s) => { setEtat(e); setVersion(s.version); });
    connecter().catch(() => { /* le voyant passe au rouge */ });
    return desabonner;
  }, []);

  /* Horloge de la barre technique */
  useEffect(() => {
    setHeure(horodatage(new Date()));
    const t = setInterval(() => setHeure(horodatage(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  const retourAttente = useCallback(() => {
    if (timerRetour.current) clearTimeout(timerRetour.current);
    timerRetour.current = null;
    setArticle(null);
    setCodeIntrouvable("");
    setMessagePanne("");
    setSaisie("");
    setPhase("attente");
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

    try {
      const trouve = await chercherArticleParCode(terme);
      if (trouve) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setArticle(trouve);
        setPhase("trouve");
      } else {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setCodeIntrouvable(terme);
        setPhase("introuvable");
      }
    } catch (e: any) {
      setMessagePanne(messagePublic(e?.code));
      setPhase("panne");
    }
    timerRetour.current = setTimeout(retourAttente, DELAI_RETOUR_MS);
  }, [retourAttente]);

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

  /* Champ invisible qui capte la douchette (clavier) */
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
        <View style={st.cadreInterieur}>
          {champInvisible}

          {phase === "attente" && (
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
              <LogoDSM />
              <ActivityIndicator size="large" color="#1A6FFF" style={{ marginTop: 28 }} />
              <Text style={st.consigne}>Recherche du prix…</Text>
            </View>
          )}

          {phase === "trouve" && article && (
            <TouchableOpacity activeOpacity={1} style={st.centre} onPress={retourAttente}>
              <LogoDSM />
              <Text style={st.nomArticle} numberOfLines={3} adjustsFontSizeToFit>{article.nom}</Text>
              <Text style={st.prix}>{article.prix.toFixed(2)} DH</Text>
              {!!article.editeur && <Text style={st.editeur}>{article.editeur}</Text>}
              <Text style={st.codeArticle}>{article.codeBarre || article.reference}</Text>
            </TouchableOpacity>
          )}

          {phase === "introuvable" && (
            <TouchableOpacity activeOpacity={1} style={st.centre} onPress={retourAttente}>
              <LogoDSM />
              <Text style={st.erreurEmoji}>❓</Text>
              <Text style={st.erreurTitre}>Article non reconnu</Text>
              <Text style={st.erreurCode}>{codeIntrouvable}</Text>
              <Text style={st.consigne}>Demandez le prix à un libraire</Text>
            </TouchableOpacity>
          )}

          {phase === "panne" && (
            <TouchableOpacity activeOpacity={1} style={st.centre} onPress={retourAttente}>
              <LogoDSM />
              <Text style={st.erreurEmoji}>⚠️</Text>
              <Text style={st.erreurTitre}>Borne momentanément indisponible</Text>
              <Text style={st.consigne}>{messagePanne}</Text>
            </TouchableOpacity>
          )}

          {/* Logo en bas à gauche, comme sur une borne magasin */}
          {phase === "attente" && (
            <View style={st.logoCoin}><LogoDSM compact /></View>
          )}
        </View>
      </View>

      {/* Barre technique (personnel magasin) */}
      <View style={st.barreTech}>
        <Text style={st.techTxt}>{heure}</Text>
        <View style={st.techCentre}>
          <View style={[st.voyant, { backgroundColor: COULEUR_VOYANT[etat] }]} />
          <Text style={st.techTxt}>
            {etat === "connecte" ? "DIRECTE" : etat === "connexion" ? "CONNEXION…" : etat === "erreur" ? "HORS LIGNE" : "ARRÊT"}
            {" · "}{ODOO_DB}{version ? ` · Odoo ${version}` : ""}
          </Text>
        </View>
        <TouchableOpacity onPress={() => { setCamera(c => !c); retourAttente(); }}>
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
    backgroundColor: "#F5A623",
    borderRadius: 10,
    padding: 10,
  },
  cadreInterieur: {
    flex: 1,
    backgroundColor: "#F7FAFF",
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#FFD080",
    overflow: "hidden",
  },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },

  logo: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#1A6FFF", alignItems: "center", justifyContent: "center" },
  logoDSM: { fontSize: 20, color: "#05102A", fontWeight: "bold", letterSpacing: 4 },
  logoSous: { fontSize: 7, color: "#8AAABF", letterSpacing: 2 },
  logoCoin: { position: "absolute", left: 16, bottom: 14 },

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

  nomArticle: { fontSize: 38, fontWeight: "bold", color: "#05102A", textAlign: "center", marginTop: 18, lineHeight: 46 },
  prix: { fontSize: 72, fontWeight: "bold", color: "#05102A", marginTop: 18 },
  editeur: { fontSize: 15, color: "#1A6FFF", marginTop: 10 },
  codeArticle: { fontSize: 13, color: "#8AAABF", letterSpacing: 3, marginTop: 14 },

  erreurEmoji: { fontSize: 56, marginTop: 20 },
  erreurTitre: { fontSize: 30, fontWeight: "bold", color: "#05102A", marginTop: 12, textAlign: "center" },
  erreurCode: { fontSize: 18, color: "#1A6FFF", letterSpacing: 3, marginTop: 10 },

  champInvisible: { position: "absolute", opacity: 0, height: 1, width: 1 },

  barreTech: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 8, gap: 10 },
  techCentre: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  voyant: { width: 8, height: 8, borderRadius: 4 },
  techTxt: { fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1 },
  techBtn: { fontSize: 11, color: "#FFD080", fontWeight: "bold" },
});
