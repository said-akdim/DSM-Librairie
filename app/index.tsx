import NetInfo from "@react-native-community/netinfo";
import * as MailComposer from "expo-mail-composer";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Caisse from "./caisse";
import {
  EcranValidationCommande,
  OngletBonsReduction,
  OngletCoupsCoeur,
  OngletListesScolaires,
  OngletMonCompte,
  OngletPromotions,
  OngletSuiviCommandes,
} from "./extras";

/* ══════════════════════════════════════
   ⚠️ REMPLACEZ PAR VOTRE IP MAC
══════════════════════════════════════ */
const ODOO_URL = "http://localhost:8069";
const ODOO_DB = "Dsm";
const WS_URL = "ws://localhost:8090";

/* ══════════════════════════════════════
   ODOO 18 API
══════════════════════════════════════ */
let odooCookies = "";
let odooUid = 0;
async function odooCall(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
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

async function odooCall(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  try {
    const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: odooCookies },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: Date.now(),
        params: { model, method, args, kwargs },
      }),
    });
    const data = await res.json();
    return data.result || null;
  } catch { return null; }
}

async function odooAuthAdmin(): Promise<boolean> {
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
    if (data.result?.uid) { odooCookies = res.headers.get("set-cookie") || ""; return true; }
    return false;
  } catch { return false; }
}

async function odooGetProduits(): Promise<any[]> {
  await odooAuthAdmin();
  const result = await odooCall("product.template", "search_read",
    [[["sale_ok", "=", true], ["active", "=", true]]],
    { fields: ["name", "list_price", "description_sale", "categ_id", "qty_available"], limit: 100 }
  );
  return result || [];
}

async function odooGetClient(id: number): Promise<any> {
  const result = await odooCall("res.partner", "search_read",
    [[["id", "=", id]]],
    { fields: ["name", "email", "dsm_points", "dsm_niveau", "dsm_num_carte", "dsm_genre_favori", "dsm_auteur_favori", "dsm_membre_depuis", "dsm_solde"], limit: 1 }
  );
  return result?.[0] || null;
}

async function odooGetAchats(partnerId: number): Promise<any[]> {
  const result = await odooCall("dsm.historique.points", "search_read",
    [[["partner_id", "=", partnerId]]],
    { fields: ["date", "points", "type", "description", "points_avant", "points_apres"], limit: 20, order: "date desc" }
  );
  return result || [];
}

async function odooGetNotifications(partnerId: number): Promise<any[]> {
  const result = await odooCall("dsm.notification", "search_read",
    [[["partner_id", "=", partnerId]]],
    { fields: ["titre", "message", "lu", "date_creation", "type"], limit: 30, order: "date_creation desc" }
  );
  return result || [];
}

async function odooMarquerNotifLue(notifId: number): Promise<void> {
  await odooCall("dsm.notification", "write", [[notifId], { lu: true }]);
}

async function odooGetClassement(): Promise<any[]> {
  await odooAuthAdmin();
  const result = await odooCall("res.partner", "search_read",
    [[["dsm_num_carte", "!=", false], ["customer_rank", ">", 0]]],
    { fields: ["name", "dsm_points", "dsm_niveau"], limit: 10, order: "dsm_points desc" }
  );
  return result || [];
}

async function odooAddPoints(partnerId: number, points: number, description: string): Promise<boolean> {
  await odooAuthAdmin();
  const partner = await odooCall("res.partner", "search_read",
    [[["id", "=", partnerId]]],
    { fields: ["dsm_points"], limit: 1 }
  );
  if (!partner?.[0]) return false;
  const pointsAvant = partner[0].dsm_points;
  await odooCall("res.partner", "write", [[partnerId], { dsm_points: pointsAvant + points }]);
  await odooCall("dsm.historique.points", "create", [{
    partner_id: partnerId, points, type: "achat",
    description, points_avant: pointsAvant, points_apres: pointsAvant + points,
  }]);
  await odooCall("dsm.notification", "create", [{
    partner_id: partnerId,
    titre: `+${points} points fidélité !`,
    message: description,
    type: "points",
  }]);
  return true;
}

async function odooCreateVente(partnerId: number, produits: any[]): Promise<boolean> {
  try {
    const withOdooId = produits.filter(p => p.odoo_id);
    if (withOdooId.length === 0) return false;
    await odooCall("sale.order", "create", [{
      partner_id: partnerId,
      order_line: withOdooId.map(p => [0, 0, {
        product_id: p.odoo_id,
        product_uom_qty: 1,
        price_unit: p.prix,
      }]),
    }]);
    return true;
  } catch { return false; }
}

/* ══════════════════════════════════════
   WEBSOCKET TEMPS RÉEL
══════════════════════════════════════ */
let ws: any = null;
let wsReconnectTimer: any = null;
const wsListeners: Map<string, Function[]> = new Map();

function wsConnect() {
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { clearTimeout(wsReconnectTimer); wsNotify("connexion", { ok: true }); };
    ws.onmessage = (e: any) => {
      try { const d = JSON.parse(e.data); wsNotify(d.type, d); wsNotify("*", d); } catch { }
    };
    ws.onclose = () => { wsNotify("deconnexion", {}); wsReconnectTimer = setTimeout(wsConnect, 3000); };
    ws.onerror = () => { };
  } catch { wsReconnectTimer = setTimeout(wsConnect, 3000); }
}

function wsDisconnect() { clearTimeout(wsReconnectTimer); ws?.close(); ws = null; }

function wsOn(type: string, cb: Function) {
  if (!wsListeners.has(type)) wsListeners.set(type, []);
  wsListeners.get(type)!.push(cb);
  return () => wsListeners.set(type, (wsListeners.get(type) || []).filter(f => f !== cb));
}

function wsNotify(type: string, data: any) {
  (wsListeners.get(type) || []).forEach(cb => cb(data));
}

/* ══════════════════════════════════════
   DONNÉES STATIQUES (fallback)
══════════════════════════════════════ */
const EMOJI_GENRE: Record<string, string> = {
  roman: "📗", policier: "🔍", "sci-fi": "🚀",
  jeunesse: "🧙", biographie: "⚗️", bd: "🎨",
};

const LIVRES_FALLBACK = [
  { titre: "Les Misérables", auteur: "Victor Hugo", prix: 18.9, emoji: "📗", genre: "roman", desc: "Une fresque humaniste inoubliable.", note: 4.9 },
  { titre: "L'Étranger", auteur: "Albert Camus", prix: 8.5, emoji: "📘", genre: "roman", desc: "Le roman fondateur de l'absurde.", note: 4.7 },
  { titre: "Pars vite et reviens tard", auteur: "Fred Vargas", prix: 9.2, emoji: "🔍", genre: "policier", desc: "Commissaire Adamsberg.", note: 4.8 },
  { titre: "Dune", auteur: "Frank Herbert", prix: 14.9, emoji: "🌑", genre: "sci-fi", desc: "L'épopée épique d'Arrakis.", note: 4.9 },
  { titre: "Harry Potter T.1", auteur: "J.K. Rowling", prix: 13.9, emoji: "🧙", genre: "jeunesse", desc: "Une aventure magique.", note: 5.0 },
  { titre: "Le Petit Prince", auteur: "Saint-Exupéry", prix: 7.5, emoji: "🌹", genre: "jeunesse", desc: "Le conte philosophique.", note: 4.9 },
  { titre: "Fondation", auteur: "Isaac Asimov", prix: 11.5, emoji: "🚀", genre: "sci-fi", desc: "Le cycle SF le plus ambitieux.", note: 4.9 },
];

const OFFRES = [
  { id: 1, titre: "-20% sur les Romans", desc: "Valable tout le week-end", emoji: "📗", couleur: "#1A6FFF", expire: "30/03/2026" },
  { id: 2, titre: "Livre offert dès 2000 pts", desc: "Choisissez parmi notre sélection", emoji: "🎁", couleur: "#F5A623", expire: "15/04/2026" },
  { id: 3, titre: "Dédicace Fred Vargas", desc: "Samedi 5 avril à 14h — DSM", emoji: "✍️", couleur: "#27AE60", expire: "05/04/2026" },
  { id: 4, titre: "-15% Jeunesse", desc: "Pour les membres Silver et plus", emoji: "🧙", couleur: "#9B59B6", expire: "20/04/2026" },
];

/* ══════════════════════════════════════
   EMAIL
══════════════════════════════════════ */
async function envoyerEmailBienvenue(email: string, prenom: string, numCarte: string) {
  try {
    await MailComposer.composeAsync({
      recipients: [email],
      subject: "🎉 Bienvenue chez DSM Librairie !",
      body: `Bonjour ${prenom},\n\nVotre carte fidélité DSM est activée !\nN° : ${numCarte}\n+50 pts de bienvenue !\n\nL'équipe DSM Librairie`,
    });
  } catch { }
}

async function envoyerEmailAchat(email: string, prenom: string, livres: any[], total: number, pts: number) {
  try {
    const lignes = livres.map(l => `- ${l.titre} : ${l.prix.toFixed(2)} DH`).join("\n");
    await MailComposer.composeAsync({
      recipients: [email],
      subject: "✅ Confirmation achat DSM",
      body: `Bonjour ${prenom},\n\n${lignes}\n\nTotal : ${total.toFixed(2)} DH\nPoints : +${pts} pts\n\nÀ bientôt chez DSM !`,
    });
  } catch { }
}

/* ══════════════════════════════════════
   COMPOSANTS UI
══════════════════════════════════════ */
function WSBadge({ ok }: { ok: boolean }) {
  return (
    <View style={{ backgroundColor: ok ? "#27AE6020" : "#E74C3C20", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10, color: ok ? "#27AE60" : "#E74C3C", fontWeight: "bold" }}>
        {ok ? "⚡ Temps réel" : "📵 Hors ligne"}
      </Text>
    </View>
  );
}

function SourceBadge({ src }: { src: string }) {
  const c = src === "odoo" ? { label: "🟢 Odoo 18 Live", color: "#27AE60" } : { label: "⚪ Données locales", color: "#8AAABF" };
  return (
    <View style={{ backgroundColor: c.color + "20", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10, color: c.color, fontWeight: "bold" }}>{c.label}</Text>
    </View>
  );
}

function BarcodeVisuel({ numCarte, prenom, nom }: { numCarte: string; prenom: string; nom: string }) {
  const seed = (numCarte || "0000").toString();
  const bars: number[] = [];
  for (let i = 0; i < 60; i++) bars.push(((seed.charCodeAt(i % seed.length) * (i + 3)) % 3) + 1);
  return (
    <View style={{ alignItems: "center", paddingVertical: 20, paddingHorizontal: 16 }}>
      <View style={qrS.container}>
        <View style={qrS.box}><QRCode value={numCarte || "DSM"} size={120} color="#05102A" backgroundColor="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={qrS.nom}>{prenom} {nom}</Text>
          <Text style={qrS.num}>N° {numCarte}</Text>
          <Text style={qrS.hint}>Scannez en caisse pour valider vos points</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", height: 50, overflow: "hidden" }}>
        {bars.map((w, i) => <View key={i} style={{ width: w * 2, height: 50, backgroundColor: i % 2 === 0 ? "#111" : "#fff" }} />)}
      </View>
      <Text style={{ fontSize: 12, letterSpacing: 3, marginTop: 8, color: "#333", fontWeight: "bold" }}>•••• •••• •••• {numCarte}</Text>
    </View>
  );
}

const qrS = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, width: "100%" },
  box: { padding: 8, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E0EDFF" },
  nom: { fontSize: 14, fontWeight: "bold", color: "#05102A", marginBottom: 4 },
  num: { fontSize: 13, color: "#1A6FFF", fontWeight: "bold", letterSpacing: 2, marginBottom: 6 },
  hint: { fontSize: 10, color: "#8AAABF", lineHeight: 14 },
});

/* ══════════════════════════════════════
   ÉCRAN CONNEXION
══════════════════════════════════════ */
function EcranConnexion({ onLogin }: { onLogin: (c: any) => void }) {
  const [mode, setMode] = useState<"login" | "inscription">("login");
  const [email, setEmail] = useState(""); const [mdp, setMdp] = useState("");
  const [prenom, setPrenom] = useState(""); const [nom, setNom] = useState("");
  const [genre, setGenre] = useState("roman");
  const [erreur, setErreur] = useState(""); const [loading, setLoading] = useState(false);

  const connexion = async () => {
    if (!email || !mdp) { setErreur("❌ Remplissez tous les champs"); return; }
    setLoading(true); setErreur("");
    try {
      // Essayer avec email, puis avec login direct
      let result = await odooAuth(email, mdp);
      // Si echec, chercher le login par email
      if (!result) {
        await odooAuthAdmin();
        const users = await odooCall("res.users", "search_read",
          [[["login", "=", email]]],
          { fields: ["login", "partner_id"], limit: 1 }
        );
        if (users?.length > 0) {
          result = await odooAuth(users[0].login, mdp);
        }
      }
      if (result?.uid) {
        await odooAuthAdmin();
        const partner = await odooGetClient(result.partner_id);
        if (partner) {
          onLogin({ ...partner, odoo_uid: result.uid, email, mdp });
        } else {
          setErreur("❌ Profil client introuvable dans Odoo");
        }
      } else {
        setErreur("❌ Email ou mot de passe incorrect");
      }
    } catch { setErreur("❌ Erreur de connexion"); }
    setLoading(false);
  };

  const inscription = async () => {
    if (!prenom || !nom || !email || !mdp) { setErreur("❌ Remplissez tous les champs"); return; }
    setLoading(true); setErreur("");
    try {
      await odooAuthAdmin();
      const existing = await odooCall("res.partner", "search_read",
        [[["email", "=", email]]],
        { fields: ["id"], limit: 1 }
      );
      if (existing?.length > 0) { setErreur("❌ Email déjà utilisé"); setLoading(false); return; }
      const numCarte = String(Math.floor(1000 + Math.random() * 9000));
      const partnerId = await odooCall("res.partner", "create", [{
        name: `${prenom} ${nom}`,
        email, customer_rank: 1,
        dsm_num_carte: numCarte,
        dsm_points: 50,
        dsm_genre_favori: genre,
        dsm_membre_depuis: new Date().toISOString().split("T")[0],
      }]);
      if (partnerId) {
        const partner = await odooGetClient(partnerId);
        await envoyerEmailBienvenue(email, prenom, numCarte);
        Alert.alert("🎉 Bienvenue !", `Carte DSM activée !\nN° ${numCarte}\n+50 pts offerts !`);
        onLogin({ ...partner, email, mdp });
      } else {
        setErreur("❌ Erreur lors de l'inscription");
      }
    } catch { setErreur("❌ Erreur de connexion"); }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={s.loginContainer}>
      <View style={s.logoBox}><Text style={s.logoEmoji}>📚</Text></View>
      <Text style={s.logoTitre}>DSM</Text>
      <Text style={s.logoSous}>LIBRAIRIE</Text>
      <View style={s.toggleRow}>
        {[["login", "Connexion"], ["inscription", "Inscription"]].map(([id, label]) => (
          <TouchableOpacity key={id} style={[s.toggleBtn, mode === id && s.toggleBtnActif]}
            onPress={() => { setMode(id as any); setErreur(""); }}>
            <Text style={[s.toggleTxt, mode === id && s.toggleTxtActif]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.form}>
        {mode === "login" && <>
          <TextInput style={s.input} placeholder="Email" placeholderTextColor="#7AAAD0"
            value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={s.input} placeholder="Mot de passe" placeholderTextColor="#7AAAD0"
            value={mdp} onChangeText={setMdp} secureTextEntry />
          {erreur ? <Text style={s.erreur}>{erreur}</Text> : null}
          <TouchableOpacity style={s.bouton} onPress={connexion} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.boutonTxt}>Se connecter →</Text>}
          </TouchableOpacity>
          <Text style={s.demo}>Connectez-vous avec votre compte Odoo</Text>
        </>}
        {mode === "inscription" && <>
          <View style={s.rowInputs}>
            <TextInput style={[s.input, { flex: 1, marginRight: 8 }]} placeholder="Prénom" placeholderTextColor="#7AAAD0" value={prenom} onChangeText={setPrenom} />
            <TextInput style={[s.input, { flex: 1 }]} placeholder="Nom" placeholderTextColor="#7AAAD0" value={nom} onChangeText={setNom} />
          </View>
          <TextInput style={s.input} placeholder="Email" placeholderTextColor="#7AAAD0"
            value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={s.input} placeholder="Mot de passe" placeholderTextColor="#7AAAD0"
            value={mdp} onChangeText={setMdp} secureTextEntry />
          <Text style={s.genreLabel}>Genre littéraire favori</Text>
          <View style={s.genreGrid}>
            {[{ id: "roman", label: "Roman", icon: "📗" }, { id: "policier", label: "Policier", icon: "🔍" },
              { id: "sci-fi", label: "Sci-Fi", icon: "🚀" }, { id: "jeunesse", label: "Jeunesse", icon: "🧙" },
              { id: "biographie", label: "Bio", icon: "⚗️" }, { id: "bd", label: "BD", icon: "🎨" }].map(g => (
              <TouchableOpacity key={g.id} onPress={() => setGenre(g.id)} style={[s.genreBtn, genre === g.id && s.genreBtnActif]}>
                <Text style={s.genreEmoji}>{g.icon}</Text>
                <Text style={[s.genreTxt, genre === g.id && s.genreTxtActif]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {erreur ? <Text style={s.erreur}>{erreur}</Text> : null}
          <TouchableOpacity style={s.bouton} onPress={inscription} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.boutonTxt}>Créer mon compte →</Text>}
          </TouchableOpacity>
          <Text style={s.demo}>50 points offerts à l'inscription 🎁</Text>
        </>}
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   DÉTAIL LIVRE
══════════════════════════════════════ */
function DetailLivre({ livre, onAchat, onBack }: { livre: any; onAchat: () => void; onBack: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FF" }}>
      <View style={s.detailHeader}><TouchableOpacity onPress={onBack}><Text style={{ color: "#FFD080", fontSize: 18 }}>‹ Retour</Text></TouchableOpacity></View>
      <ScrollView>
        <View style={s.detailHero}>
          <Text style={s.detailEmoji}>{livre.emoji}</Text>
          <Text style={s.detailTitre}>{livre.titre}</Text>
          <Text style={s.detailAuteur}>{livre.auteur}</Text>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
            {"★★★★★".split("").map((_, i) => <Text key={i} style={{ color: i < Math.floor(livre.note || 4) ? "#F5A623" : "#ccc", fontSize: 20 }}>★</Text>)}
          </View>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={s.detailDescTitre}>Description</Text>
          <Text style={s.detailDesc}>{livre.desc || "Aucune description."}</Text>
          <View style={s.detailPrixBox}>
            <View><Text style={{ fontSize: 12, color: "#8AAABF" }}>Prix</Text><Text style={s.detailPrix}>{livre.prix?.toFixed(2)} DH</Text></View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 12, color: "#8AAABF" }}>Points gagnés</Text>
              <Text style={{ fontSize: 20, color: "#F5A623", fontWeight: "bold" }}>+{Math.round((livre.prix || 0) * 10)} pts</Text>
            </View>
          </View>
          <TouchableOpacity style={s.detailAcheterBtn} onPress={onAchat}><Text style={s.detailAcheterTxt}>🛍️ Ajouter au panier</Text></TouchableOpacity>
          <TouchableOpacity style={s.detailWhatsappBtn} onPress={() => Linking.openURL(`whatsapp://send?text=Je recommande "${livre.titre}" à la Librairie DSM — ${livre.prix?.toFixed(2)} DH 📚`)}>
            <Text style={s.detailWhatsappTxt}>📱 Partager sur WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ══════════════════════════════════════
   ONGLET ACCUEIL
══════════════════════════════════════ */
function OngletAccueil({ client, wsOk, onRefresh }: { client: any; wsOk: boolean; onRefresh: () => void }) {
  const [achats, setAchats] = useState<any[]>([]);
  const [showHistorique, setShowHistorique] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [filtreMois, setFiltreMois] = useState(0);
  const [estEnLigne, setEstEnLigne] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setEstEnLigne(s.isConnected ?? true));
    odooGetAchats(client.id).then(data => setAchats(data));
    return () => unsub();
  }, [client.id]);

  const niveaux = [
    { nom: "Bronze", min: 0, max: 500, couleur: "#CD7F32", emoji: "🥉" },
    { nom: "Silver", min: 500, max: 1000, couleur: "#C0C0C0", emoji: "🥈" },
    { nom: "Gold", min: 1000, max: 2000, couleur: "#FFD080", emoji: "🥇" },
    { nom: "Platine", min: 2000, max: 2000, couleur: "#E5E4E2", emoji: "💎" },
  ];
  const pts = client.dsm_points || 0;
  const actuel = niveaux.find(n => pts < n.max) || niveaux[3];
  const suivant = niveaux[niveaux.indexOf(actuel) + 1];
  const progress = actuel.nom === "Platine" ? 1 : (pts - actuel.min) / (actuel.max - actuel.min);
  const solde = ((client.dsm_solde || pts * 0.1)).toFixed(2).replace(".", ",");
  const gains = achats.reduce((a, b) => a + (b.points || 0), 0);
  const gainsDH = (gains * 0.1).toFixed(2).replace(".", ",");

  return (
    <ScrollView style={s.ongletContainer} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8, margin: 12, marginBottom: 4 }}>
        <WSBadge ok={wsOk} />
        {!estEnLigne && <View style={{ backgroundColor: "#FF6B3520", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ fontSize: 10, color: "#FF6B35", fontWeight: "bold" }}>📵 Hors ligne</Text></View>}
      </View>

      {/* Solde */}
      <View style={s.soldeBloc}>
        <View style={s.soldeTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.soldeLbl}>Solde disponible</Text>
            <Text style={s.soldeVal}>{solde} DH</Text>
            <View style={s.soldeUnderline} />
          </View>
          <View style={s.dsmCircle}><Text style={s.dsmCircleTxt}>DSM</Text></View>
        </View>
        <View style={s.soldeSep} />
        <View style={s.gainsRow}><Text style={s.gainsLbl}>Gains récents :</Text><Text style={s.gainsVal}>{gainsDH} DH</Text></View>
        <Text style={s.dontTxt}>Dont</Text>
        <View style={s.gainsRow}><Text style={s.gainsSubLbl}>Points fidélité :</Text><Text style={s.gainsVal}>{pts} pts</Text></View>
        <TouchableOpacity style={s.historiqueBtn} onPress={() => setShowHistorique(true)}>
          <Text style={s.historiqueBtnTxt}>Mon historique</Text>
          <Text style={s.historiqueIco}>🕐</Text>
        </TouchableOpacity>
      </View>

      {/* Progression */}
      <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: "#05102A", borderRadius: 16, padding: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          {niveaux.map((n, i) => (
            <View key={i} style={{ alignItems: "center", opacity: pts >= n.min ? 1 : 0.3 }}>
              <Text style={{ fontSize: 18 }}>{n.emoji}</Text>
              <Text style={{ fontSize: 9, color: pts >= n.min ? n.couleur : "rgba(255,255,255,0.3)", fontWeight: "bold", marginTop: 2 }}>{n.nom}</Text>
            </View>
          ))}
        </View>
        <View style={{ height: 10, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden" }}>
          <View style={{ height: 10, borderRadius: 10, width: `${Math.min(progress * 100, 100)}%`, backgroundColor: actuel.couleur }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{pts} pts</Text>
          {actuel.nom === "Platine"
            ? <Text style={{ fontSize: 11, color: "#E5E4E2", fontWeight: "bold" }}>💎 Niveau maximum !</Text>
            : <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>encore <Text style={{ color: actuel.couleur, fontWeight: "bold" }}>{Math.max(0, actuel.max - pts)} pts</Text> pour {suivant?.emoji} {suivant?.nom}</Text>
          }
        </View>
      </View>

      {/* QR */}
      <View style={s.barcodeBloc}>
        <BarcodeVisuel numCarte={client.dsm_num_carte || "0000"} prenom={client.name?.split(" ")[0] || ""} nom={client.name?.split(" ").slice(1).join(" ") || ""} />
      </View>

      {/* Menu */}
      {[
        { icon: "🧾", label: "Dernier ticket d'achat" },
        { icon: "🎁", label: "Avantages Carte DSM" },
        { icon: "⭐", label: "Mes offres en cours" },
        { icon: "🏆", label: "Mon niveau fidélité" },
        { icon: "🔄", label: "Rafraîchir mes données" },
      ].map((item, i) => (
        <TouchableOpacity key={i} style={s.menuItem} onPress={() => {
          if (item.label === "Dernier ticket d'achat") setShowTicket(true);
          if (item.label === "Rafraîchir mes données") onRefresh();
        }}>
          <View style={s.menuIconWrap}><Text style={{ fontSize: 20 }}>{item.icon}</Text></View>
          <Text style={s.menuLbl}>{item.label}</Text>
          <Text style={s.menuArrow}>›</Text>
        </TouchableOpacity>
      ))}

      {/* Ticket */}
      {showTicket && achats.length > 0 && (
        <View style={s.ticketModal}>
          <View style={s.ticketContainer}>
            <View style={s.ticketHeader}>
              <Text style={s.ticketLogo}>📚 DSM LIBRAIRIE</Text>
              <Text style={s.ticketSous}>TICKET DE CAISSE</Text>
              <Text style={s.ticketDate}>{new Date().toLocaleDateString("fr-FR")}</Text>
            </View>
            <View style={s.ticketSep} />
            <View style={s.ticketItem}><Text style={s.ticketNom}>{achats[0]?.description}</Text><Text style={s.ticketPrix}>{achats[0]?.points} pts</Text></View>
            <View style={s.ticketSep} />
            <View style={s.ticketTotal}><Text style={s.ticketTotalLbl}>POINTS</Text><Text style={s.ticketTotalVal}>{achats[0]?.points_apres} pts</Text></View>
            <View style={s.ticketSep} />
            <View style={{ alignItems: "center", marginVertical: 12 }}>
              <QRCode value={client.dsm_num_carte || "DSM"} size={80} color="#05102A" backgroundColor="#fff" />
              <Text style={{ fontSize: 10, color: "#666", letterSpacing: 2, marginTop: 6 }}>•••• •••• •••• {client.dsm_num_carte}</Text>
            </View>
            <Text style={s.ticketMerci}>Merci de votre visite !</Text>
            <TouchableOpacity style={s.ticketFermer} onPress={() => setShowTicket(false)}><Text style={s.ticketFermerTxt}>Fermer ✕</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Historique Modal */}
      <Modal visible={showHistorique} animationType="slide" onRequestClose={() => setShowHistorique(false)}>
        <View style={{ flex: 1, backgroundColor: "#05102A" }}>
          <View style={{ backgroundColor: "#0A1F4E", padding: 20, paddingTop: 50, flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => setShowHistorique(false)} style={{ marginRight: 12 }}>
              <Text style={{ fontSize: 22, color: "#FFD080" }}>←</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, color: "#fff", fontWeight: "bold" }}>Historique des points</Text>
          </View>
          <View style={{ flexDirection: "row", margin: 16, gap: 10 }}>
            {[
              { val: achats.reduce((s, a) => s + (a.points || 0), 0) + " pts", lbl: "Total gagné", color: "#FFD080" },
              { val: String(achats.length), lbl: "Opérations", color: "#2E86FF" },
            ].map((item, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: "#0A1F4E", borderRadius: 14, padding: 14, alignItems: "center" }}>
                <Text style={{ fontSize: 20, color: item.color, fontWeight: "bold" }}>{item.val}</Text>
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{item.lbl}</Text>
              </View>
            ))}
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {achats.map((a, i) => (
              <View key={i} style={{ backgroundColor: "#0A1F4E", borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(46,134,255,0.15)", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                  <Text style={{ fontSize: 24 }}>📚</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }} numberOfLines={1}>{a.description || a.type}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{a.type}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: "#FFD080", fontWeight: "bold", fontSize: 15 }}>+{a.points} pts</Text>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{a.points_apres} total</Text>
                </View>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   ONGLET BOUTIQUE
══════════════════════════════════════ */
function OngletBoutique({ client, onAchat, onValider }: { client: any; onAchat: (pts: number, livres: any[], total: number) => void; onValider: (panier: any[]) => void }) {
  const [livres, setLivres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState("local");
  const [panier, setPanier] = useState<any[]>([]);
  const [showPanier, setShowPanier] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [genreActif, setGenreActif] = useState("tous");
  const [detail, setDetail] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const produits = await odooGetProduits();
      if (produits.length > 0) {
        setLivres(produits.map(p => ({
          titre: p.name, auteur: p.categ_id?.[1] || "DSM",
          prix: p.list_price || 0,
          emoji: EMOJI_GENRE[p.categ_id?.[1]?.toLowerCase()] || "📚",
          genre: p.categ_id?.[1]?.toLowerCase() || "roman",
          desc: p.description_sale || p.name,
          note: 4.5, odoo_id: p.id, stock: p.qty_available || 0,
        })));
        setSrc("odoo"); setLastUpdate(new Date().toLocaleTimeString("fr-FR"));
      } else {
        setLivres(LIVRES_FALLBACK); setSrc("local");
      }
    } catch {
      setLivres(LIVRES_FALLBACK); setSrc("local");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    charger();
    const unsub = wsOn("produit_modifie", (data: any) => {
      setLastUpdate(new Date().toLocaleTimeString("fr-FR"));
      setLivres(prev => {
        if (data.action === "create") return [...prev, { titre: data.name, auteur: data.categ_id || "DSM", prix: data.list_price || 0, emoji: EMOJI_GENRE[data.categ_id?.toLowerCase()] || "📚", genre: data.categ_id?.toLowerCase() || "roman", desc: data.description_sale || "", note: 4.5, odoo_id: data.id, stock: data.qty_available || 0 }];
        if (data.action === "update") return prev.map(l => l.odoo_id === data.id ? { ...l, titre: data.name, prix: data.list_price, stock: data.qty_available } : l);
        if (data.action === "delete") return prev.filter(l => l.odoo_id !== data.id);
        return prev;
      });
    });
    return () => unsub();
  }, []);

  const total = panier.reduce((a, b) => a + (b.prix || 0), 0);
  const pts = Math.round(total * 10);
  const genres = ["tous", ...Array.from(new Set(livres.map(l => l.genre)))];
  const filtres = livres.filter(l =>
    (genreActif === "tous" || l.genre === genreActif) &&
    (!recherche || l.titre?.toLowerCase().includes(recherche.toLowerCase()) || l.auteur?.toLowerCase().includes(recherche.toLowerCase()))
  );

  if (detail) return <DetailLivre livre={detail} onAchat={() => { setPanier(p => [...p, detail]); setDetail(null); }} onBack={() => setDetail(null)} />;

  return (
    <View style={s.ongletContainer}>
      <View style={s.boutiqueHeader}>
        <View>
          <Text style={s.boutiqueTitre}>🛍️ Boutique DSM</Text>
          {!loading && <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            <SourceBadge src={src} />
            {lastUpdate ? <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", alignSelf: "center" }}>MàJ {lastUpdate}</Text> : null}
          </View>}
        </View>
        <TouchableOpacity style={s.panierBtn} onPress={() => setShowPanier(!showPanier)}>
          <Text style={s.panierBtnTxt}>🛒 {panier.length}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.rechercheBox}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput style={s.rechercheInput} placeholder="Rechercher..." placeholderTextColor="#8AAABF" value={recherche} onChangeText={setRecherche} />
        {recherche.length > 0 && <TouchableOpacity onPress={() => setRecherche("")}><Text style={{ color: "#8AAABF", fontSize: 18 }}>✕</Text></TouchableOpacity>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, paddingLeft: 12, marginBottom: 4 }}>
        {genres.map(g => (
          <TouchableOpacity key={g} onPress={() => setGenreActif(g)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: genreActif === g ? "#05102A" : "#EAF2FF", marginRight: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: genreActif === g ? "#FFD080" : "#4A6080" }}>{EMOJI_GENRE[g] || "📚"} {g.charAt(0).toUpperCase() + g.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showPanier && (
        <View style={s.panierBox}>
          {panier.length === 0 ? <Text style={s.panierVide}>Panier vide</Text> : <>
            {panier.map((l, i) => (
              <View key={i} style={s.panierItem}>
                <Text style={s.panierEmoji}>{l.emoji}</Text>
                <Text style={{ flex: 1, color: "#040D2A", fontSize: 13 }}>{l.titre}</Text>
                <TouchableOpacity onPress={() => setPanier(p => p.filter((_, idx) => idx !== i))}>
                  <Text style={{ color: "#E74C3C", fontSize: 16, marginRight: 8 }}>✕</Text>
                </TouchableOpacity>
                <Text style={{ color: "#05102A", fontWeight: "bold" }}>{l.prix?.toFixed(2)} DH</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: "bold", color: "#05102A" }}>Total : {total.toFixed(2)} DH</Text>
              <Text style={{ fontSize: 13, color: "#1A6FFF", fontWeight: "bold" }}>+{pts} pts</Text>
            </View>
            <TouchableOpacity style={s.validerBtn} onPress={() => onValider(panier)}><Text style={s.validerTxt}>🛍️ Passer la commande</Text></TouchableOpacity>
          </>}
        </View>
      )}

      <ScrollView>
        {loading ? (
          <View style={{ alignItems: "center", padding: 60 }}>
            <ActivityIndicator color="#1A6FFF" size="large" />
            <Text style={{ color: "#8AAABF", marginTop: 16 }}>Chargement Odoo 18...</Text>
          </View>
        ) : (
          <View style={s.livresGrid}>
            {filtres.map((l, i) => (
              <TouchableOpacity key={i} style={s.livreCard} onPress={() => setDetail(l)}>
                <Text style={s.livreEmoji}>{l.emoji}</Text>
                <Text style={s.livreTitre} numberOfLines={2}>{l.titre}</Text>
                <Text style={s.livreAuteur} numberOfLines={1}>{l.auteur}</Text>
                {l.stock !== undefined && l.stock <= 3 && l.stock > 0 && <Text style={{ fontSize: 9, color: "#E74C3C", textAlign: "center" }}>⚠️ Plus que {l.stock} en stock</Text>}
                <Text style={s.livrePrix}>{l.prix?.toFixed(2)} DH</Text>
                <Text style={s.livrePts}>+{Math.round((l.prix || 0) * 10)} pts</Text>
                <TouchableOpacity style={s.ajouterBtn} onPress={() => setPanier(p => [...p, l])}><Text style={s.ajouterTxt}>+ Ajouter</Text></TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {!loading && filtres.length === 0 && (
          <View style={{ alignItems: "center", padding: 40 }}>
            <Text style={{ fontSize: 40 }}>📭</Text>
            <Text style={{ color: "#8AAABF", marginTop: 12 }}>Aucun livre trouvé</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ══════════════════════════════════════
   ONGLET OFFRES
══════════════════════════════════════ */
function OngletOffres({ client }: { client: any }) {
  const pts = client.dsm_points || 0;
  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.offresHeader}><Text style={s.offresTitre}>🎁 Offres & Promotions</Text><Text style={s.offresSous}>Personnalisées pour vous</Text></View>
      <View style={{ padding: 16 }}>
        {OFFRES.map((o, i) => (
          <View key={i} style={[s.offreCard, { borderLeftColor: o.couleur }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <View style={[s.offreIconBox, { backgroundColor: o.couleur + "20" }]}><Text style={{ fontSize: 24 }}>{o.emoji}</Text></View>
              <View style={{ flex: 1 }}><Text style={s.offreTitre}>{o.titre}</Text><Text style={s.offreDesc}>{o.desc}</Text></View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, color: "#8AAABF" }}>Expire le {o.expire}</Text>
              <TouchableOpacity style={[s.offreBtn, { backgroundColor: o.couleur }]}><Text style={s.offreBtnTxt}>Utiliser →</Text></TouchableOpacity>
            </View>
          </View>
        ))}
        <Text style={[s.sectionTitre, { marginTop: 8 }]}>🏆 Mon niveau</Text>
        <View style={s.niveauCard}>
          {[{ label: "Bronze", seuil: 0, icon: "🥉" }, { label: "Silver", seuil: 500, icon: "🥈" }, { label: "Gold", seuil: 1000, icon: "🥇" }, { label: "Platine", seuil: 2000, icon: "💎" }].map((niv, i) => {
            const atteint = pts >= niv.seuil;
            const courant = client.dsm_niveau === niv.label.toLowerCase();
            return (
              <View key={i} style={s.niveauRow}>
                <Text style={{ fontSize: 22 }}>{niv.icon}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: courant ? "bold" : "normal", color: atteint ? "#05102A" : "#8AAABF" }}>{niv.label}</Text>
                  <Text style={{ fontSize: 10, color: "#8AAABF" }}>{niv.seuil} pts requis</Text>
                </View>
                {courant && <View style={s.niveauBadge}><Text style={s.niveauBadgeTxt}>Actuel</Text></View>}
                {atteint && !courant && <Text style={{ color: "#27AE60", fontSize: 18 }}>✓</Text>}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   ONGLET CLASSEMENT
══════════════════════════════════════ */
function OngletClassement({ client }: { client: any }) {
  const [classement, setClassement] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    odooGetClassement().then(data => { setClassement(data); setLoading(false); });
  }, []);

  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.classementHeader}><Text style={s.classementTitre}>🏆 Top Fidèles DSM</Text><Text style={s.classementSous}>Les clients les plus fidèles</Text></View>
      <View style={{ padding: 16 }}>
        {loading ? <ActivityIndicator color="#1A6FFF" style={{ marginTop: 40 }} /> :
          classement.map((c, i) => {
            const isMe = c.id === client.id;
            const initiales = c.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "??";
            return (
              <View key={i} style={[s.classementItem, isMe && s.classementItemMe]}>
                <Text style={s.classementRang}>{["🥇", "🥈", "🥉"][i] || `${i + 1}`}</Text>
                <View style={s.classementAvatar}><Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>{initiales}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.classementNom, isMe && { color: "#1A6FFF" }]}>{c.name} {isMe ? "(Moi)" : ""}</Text>
                  <Text style={s.classementNiveau}>{c.dsm_niveau}</Text>
                </View>
                <Text style={s.classementPts}>{c.dsm_points?.toLocaleString()} pts</Text>
              </View>
            );
          })
        }
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   ONGLET NOTIFICATIONS
══════════════════════════════════════ */
function OngletNotifs({ client }: { client: any }) {
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    odooGetNotifications(client.id).then(data => setNotifs(data));
    const unsub = wsOn("notification", (data: any) => {
      if (data.partner_id === client.id || data.dsm_num_carte === client.dsm_num_carte) {
        setNotifs(n => [{ id: Date.now(), titre: data.titre, message: data.message, lu: false, date_creation: new Date().toISOString() }, ...n]);
      }
    });
    return () => unsub();
  }, [client.id]);

  const lire = async (id: number) => {
    await odooMarquerNotifLue(id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, lu: true } : x));
  };

  const lireTout = async () => {
    for (const n of notifs.filter(n => !n.lu)) await odooMarquerNotifLue(n.id);
    setNotifs(n => n.map(x => ({ ...x, lu: true })));
  };

  const nonLus = notifs.filter(n => !n.lu).length;

  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.notifsHeader}>
        <Text style={s.notifsTitre}>🔔 Notifications</Text>
        {nonLus > 0 && <TouchableOpacity onPress={lireTout}><Text style={s.lireTout}>Tout lire ({nonLus})</Text></TouchableOpacity>}
      </View>
      <View style={{ padding: 12 }}>
        {notifs.length === 0
          ? <Text style={{ textAlign: "center", color: "#7AAAD0", padding: 30 }}>Aucune notification</Text>
          : notifs.map((n, i) => (
            <TouchableOpacity key={n.id || i} onPress={() => lire(n.id)} style={[s.notifCard, !n.lu && s.notifCardNonLu]}>
              <Text style={s.notifIcon}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.notifTitre, !n.lu && { color: "#040D2A" }]}>{n.titre}</Text>
                <Text style={s.notifMsg}>{n.message}</Text>
              </View>
              {!n.lu && <View style={s.notifDot} />}
            </TouchableOpacity>
          ))
        }
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   ONGLET PROFIL
══════════════════════════════════════ */
function OngletProfil({ client, onDeconnexion, wsOk }: { client: any; onDeconnexion: () => void; wsOk: boolean }) {
  const partagerCarte = async () => {
    try { await Linking.openURL(`whatsapp://send?text=Ma carte DSM 📚%0AN° : ${client.dsm_num_carte}%0ANiveau : ${client.dsm_niveau}%0APoints : ${client.dsm_points} pts`); }
    catch { Alert.alert("WhatsApp non disponible"); }
  };

  const prenom = client.name?.split(" ")[0] || "";
  const nom = client.name?.split(" ").slice(1).join(" ") || "";
  const initiales = (prenom[0] || "") + (nom[0] || "");

  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.profilHeader}>
        <View style={s.avatar}><Text style={s.avatarTxt}>{initiales}</Text></View>
        <Text style={s.profilNom}>{client.name}</Text>
        <Text style={s.profilSous}>Membre {client.dsm_niveau} · {client.dsm_points} pts</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8, justifyContent: "center" }}>
          <WSBadge ok={wsOk} />
          <View style={{ backgroundColor: "#27AE6020", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, color: "#27AE60", fontWeight: "bold" }}>🟢 Odoo 18</Text>
          </View>
        </View>
        <TouchableOpacity style={s.whatsappBtn} onPress={partagerCarte}><Text style={s.whatsappBtnTxt}>📱 Partager ma carte sur WhatsApp</Text></TouchableOpacity>
      </View>
      <View style={{ padding: 16 }}>
        {[
          { icon: "👤", label: "Nom complet", val: client.name },
          { icon: "📧", label: "Email", val: client.email || "Non défini" },
          { icon: "📚", label: "Genre favori", val: client.dsm_genre_favori || "Non défini" },
          { icon: "💳", label: "N° carte", val: `•••• ${client.dsm_num_carte || "????"}` },
          { icon: "🏆", label: "Niveau", val: client.dsm_niveau },
          { icon: "⭐", label: "Points", val: `${client.dsm_points} pts` },
          { icon: "💰", label: "Solde", val: `${(client.dsm_solde || client.dsm_points * 0.1).toFixed(2)} DH` },
          { icon: "🔗", label: "ID Odoo", val: `#${client.id}` },
        ].map((info, i) => (
          <View key={i} style={s.profilItem}>
            <Text style={s.profilIcon}>{info.icon}</Text>
            <View style={{ flex: 1 }}><Text style={s.profilLabel}>{info.label}</Text><Text style={s.profilVal}>{info.val}</Text></View>
          </View>
        ))}
        <TouchableOpacity style={s.decoBtn} onPress={onDeconnexion}><Text style={s.decoBtnTxt}>🚪 Se déconnecter</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   APP PRINCIPALE
══════════════════════════════════════ */
export default function App() {
  const [client, setClient] = useState<any>(null);
  const [onglet, setOnglet] = useState("accueil");
  const [wsOk, setWsOk] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [panierValidation, setPanierValidation] = useState<any[]>([]);
  const toastTimer = useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 3000);
  }, []);

  // WebSocket
  useEffect(() => {
    wsConnect();
    const u1 = wsOn("connexion", () => setWsOk(true));
    const u2 = wsOn("deconnexion", () => setWsOk(false));
    return () => { u1(); u2(); wsDisconnect(); };
  }, []);

  // Écouter événements WS
  useEffect(() => {
    if (!client) return;
    const unsub = wsOn("*", (data: any) => {
      if (data.type === "points_mis_a_jour" && data.dsm_num_carte === client.dsm_num_carte) {
        setClient((c: any) => ({ ...c, dsm_points: data.points_apres }));
        showToast(`⭐ +${data.points_gagnes} points fidélité !`);
      }
      if (data.type === "notification") showToast(`🔔 ${data.titre}`);
      if (data.type === "produit_modifie") showToast(`📦 Catalogue mis à jour : ${data.name}`);
    });
    return () => unsub();
  }, [client?.dsm_num_carte]);

  const refreshClient = useCallback(async () => {
    if (!client) return;
    const updated = await odooGetClient(client.id);
    if (updated) { setClient((c: any) => ({ ...c, ...updated })); showToast("✅ Données mises à jour !"); }
  }, [client?.id]);

  const addPoints = async (pts: number, livres: any[], total: number) => {
    if (!client) return;
    await odooAddPoints(client.id, pts, `Achat boutique - ${total.toFixed(2)} DH`);
    if (client.odoo_uid) await odooCreateVente(client.id, livres);
    setClient((c: any) => ({ ...c, dsm_points: (c.dsm_points || 0) + pts }));
    if (client.email) await envoyerEmailAchat(client.email, client.name?.split(" ")[0] || "", livres, total, pts);
    showToast(`🛍️ +${pts} points fidélité ajoutés !`);
  };

  if (!client) return <EcranConnexion onLogin={setClient} />;

  const tabs = [
    { id: "accueil", icon: "🏠", label: "Accueil" },
    { id: "boutique", icon: "🛍️", label: "Boutique" },
    { id: "offres", icon: "🎁", label: "Offres" },
    { id: "classement", icon: "🏆", label: "Top" },
    { id: "plus", icon: "⊕", label: "Plus" },
    { id: "caisse", icon: "🏪", label: "Caisse" },
    { id: "profil", icon: "👤", label: "Profil" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FF" }}>
      {/* Toast */}
      {toastMsg ? (
        <View style={{ position: "absolute", top: Platform.OS === "ios" ? 60 : 40, left: 16, right: 16, backgroundColor: "#05102A", borderRadius: 14, padding: 14, zIndex: 999, borderWidth: 1, borderColor: "rgba(46,134,255,0.3)" }}>
          <Text style={{ color: "#FFD080", fontSize: 13, fontWeight: "bold", textAlign: "center" }}>{toastMsg}</Text>
        </View>
      ) : null}

      {showValidation && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
          <EcranValidationCommande panier={panierValidation} client={client} fraisLivraison={15}
            onConfirmer={(cmd: any) => {
              setShowValidation(false);
              setClient((c: any) => ({ ...c, dsm_points: (c.dsm_points || 0) + (cmd.pts || 0) }));
              Alert.alert("🎉 Commande confirmée !", `+${cmd.pts || 0} pts fidélité !`);
            }}
            onAnnuler={() => setShowValidation(false)} />
        </View>
      )}

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLogo}><Text style={s.headerLogoTxt}>📚</Text></View>
        <View><Text style={s.headerDSM}>DSM</Text><Text style={s.headerSous}>LIBRAIRIE</Text></View>
        <View style={{ flex: 1 }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: wsOk ? "#27AE60" : "#E74C3C", marginRight: 8 }} />
        <TouchableOpacity onPress={() => setOnglet("notifs")} style={{ marginRight: 8 }}>
          <Text style={s.headerPtsTxt}>🔔</Text>
        </TouchableOpacity>
        <View style={s.headerPts}>
          <Text style={s.headerPtsTxt}>⭐ {client.dsm_points || 0} pts</Text>
        </View>
      </View>

      {onglet === "accueil" && <OngletAccueil client={client} wsOk={wsOk} onRefresh={refreshClient} />}
      {onglet === "boutique" && <OngletBoutique client={client} onAchat={addPoints} onValider={p => { setPanierValidation(p); setShowValidation(true); }} />}
      {onglet === "offres" && <OngletOffres client={client} />}
      {onglet === "classement" && <OngletClassement client={client} />}
      {onglet === "notifs" && <OngletNotifs client={client} />}
      {onglet === "profil" && <OngletProfil client={client} onDeconnexion={() => { setClient(null); wsDisconnect(); }} wsOk={wsOk} />}
      {onglet === "caisse" && <Caisse />}
      {onglet === "coups_coeur" && <OngletCoupsCoeur client={client} livres={LIVRES_FALLBACK} onAjouterPanier={(l: any) => { }} />}
      {onglet === "bons" && <OngletBonsReduction client={client} />}
      {onglet === "commandes" && <OngletSuiviCommandes client={client} />}
      {onglet === "scolaires" && <OngletListesScolaires onAjouterPanier={(_: any) => { }} />}
      {onglet === "promotions" && <OngletPromotions client={client} />}
      {onglet === "mon_compte" && <OngletMonCompte client={client} onUpdate={setClient} />}

      {onglet === "plus" && (
        <ScrollView style={{ flex: 1, backgroundColor: "#F5F7FF" }}>
          <View style={{ backgroundColor: "#05102A", padding: 20, paddingTop: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 22, color: "#FFD080", fontWeight: "bold" }}>⊕ Plus de services</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>Tous vos outils DSM</Text>
          </View>
          {[
            { id: "coups_coeur", icon: "❤️", label: "Coups de cœur", desc: "Vos livres favoris" },
            { id: "bons", icon: "🎟️", label: "Bons de réduction", desc: "Vos codes promo" },
            { id: "commandes", icon: "📦", label: "Suivi commandes", desc: "Statut en temps réel" },
            { id: "scolaires", icon: "🎒", label: "Listes scolaires", desc: "Rentrée 2025-2026" },
            { id: "promotions", icon: "🔥", label: "Promotions", desc: "Offres du moment" },
            { id: "mon_compte", icon: "👤", label: "Mon compte", desc: "Adresse, livraison" },
          ].map((item, i) => (
            <TouchableOpacity key={i} onPress={() => setOnglet(item.id)} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 18, padding: 18, gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24 }}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "bold", color: "#05102A" }}>{item.label}</Text>
                <Text style={{ fontSize: 12, color: "#8AAABF", marginTop: 2 }}>{item.desc}</Text>
              </View>
              <Text style={{ fontSize: 22, color: "#8AAABF" }}>›</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* Nav */}
      <View style={s.navBar}>
        {tabs.map(tab => (
          <TouchableOpacity key={tab.id} style={s.navBtn} onPress={() => setOnglet(tab.id)}>
            <Text style={s.navIcon}>{tab.icon}</Text>
            <Text style={[s.navLabel, onglet === tab.id && s.navLabelActif]}>{tab.label}</Text>
            {onglet === tab.id && <View style={s.navIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ══════════════════════════════════════
   STYLES
══════════════════════════════════════ */
const s = StyleSheet.create({
  loginContainer: { flexGrow: 1, backgroundColor: "#05102A", alignItems: "center", justifyContent: "center", padding: 24 },
  logoBox: { width: 88, height: 88, borderRadius: 26, backgroundColor: "#1A6FFF", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logoEmoji: { fontSize: 42 },
  logoTitre: { fontSize: 44, color: "#FFD080", letterSpacing: 10, fontWeight: "bold" },
  logoSous: { fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 6, marginBottom: 32 },
  form: { width: "100%", maxWidth: 360 },
  input: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)", borderRadius: 16, padding: 15, fontSize: 14, color: "#E8F4FF", marginBottom: 12 },
  bouton: { backgroundColor: "#1A6FFF", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 4 },
  boutonTxt: { color: "#fff", fontSize: 16, fontWeight: "bold", letterSpacing: 1 },
  erreur: { color: "#FFD080", fontSize: 13, textAlign: "center", marginBottom: 10 },
  demo: { color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "center", marginTop: 16 },
  toggleRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 4, marginBottom: 24, width: "100%", maxWidth: 360 },
  toggleBtn: { flex: 1, padding: 11, borderRadius: 14, alignItems: "center" },
  toggleBtnActif: { backgroundColor: "#1A6FFF" },
  toggleTxt: { fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: "600" },
  toggleTxtActif: { color: "#fff", fontWeight: "bold" },
  rowInputs: { flexDirection: "row" },
  genreLabel: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 10, letterSpacing: 1 },
  genreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  genreBtn: { width: "30%", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  genreBtnActif: { backgroundColor: "#1A6FFF", borderColor: "#1A6FFF" },
  genreEmoji: { fontSize: 22, marginBottom: 4 },
  genreTxt: { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "600" },
  genreTxtActif: { color: "#fff" },
  header: { backgroundColor: "#05102A", paddingTop: Platform.OS === "ios" ? 54 : 44, paddingBottom: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  headerLogo: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#1A6FFF", alignItems: "center", justifyContent: "center" },
  headerLogoTxt: { fontSize: 17 },
  headerDSM: { fontSize: 17, color: "#FFD080", fontWeight: "bold", letterSpacing: 3, lineHeight: 19 },
  headerSous: { fontSize: 7, color: "rgba(255,255,255,0.35)", letterSpacing: 3 },
  headerPts: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  headerPtsTxt: { color: "#FFD080", fontSize: 12, fontWeight: "bold" },
  ongletContainer: { flex: 1, backgroundColor: "#F5F7FF" },
  sectionTitre: { fontSize: 18, fontWeight: "bold", color: "#05102A", marginHorizontal: 16, marginBottom: 12 },
  boutiqueHeader: { backgroundColor: "#05102A", padding: 16, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boutiqueTitre: { fontSize: 19, color: "#FFD080", fontWeight: "bold" },
  panierBtn: { backgroundColor: "#1A6FFF", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 9 },
  panierBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  rechercheBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", margin: 12, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  rechercheInput: { flex: 1, fontSize: 14, color: "#05102A" },
  panierBox: { backgroundColor: "#fff", margin: 12, borderRadius: 20, padding: 18 },
  panierVide: { fontSize: 13, color: "#8AAABF", textAlign: "center", padding: 10 },
  panierItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F0F4FF", gap: 10 },
  panierEmoji: { fontSize: 20 },
  validerBtn: { backgroundColor: "#1A6FFF", borderRadius: 14, padding: 14, alignItems: "center", marginTop: 12 },
  validerTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  livresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 14 },
  livreCard: { width: "47%", backgroundColor: "#fff", borderRadius: 20, padding: 16 },
  livreEmoji: { fontSize: 34, textAlign: "center", marginBottom: 10 },
  livreTitre: { fontSize: 12, fontWeight: "bold", color: "#05102A", textAlign: "center", marginBottom: 2 },
  livreAuteur: { fontSize: 10, color: "#8AAABF", textAlign: "center", marginBottom: 6 },
  livrePrix: { fontSize: 17, fontWeight: "bold", color: "#05102A", textAlign: "center" },
  livrePts: { fontSize: 10, color: "#1A6FFF", textAlign: "center", marginBottom: 10 },
  ajouterBtn: { backgroundColor: "#05102A", borderRadius: 12, padding: 10, alignItems: "center" },
  ajouterTxt: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  detailHeader: { backgroundColor: "#05102A", padding: 16, paddingTop: Platform.OS === "ios" ? 54 : 44 },
  detailHero: { backgroundColor: "#05102A", padding: 24, alignItems: "center", paddingBottom: 30 },
  detailEmoji: { fontSize: 64, marginBottom: 12 },
  detailTitre: { fontSize: 22, color: "#fff", fontWeight: "bold", textAlign: "center", marginBottom: 6 },
  detailAuteur: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 12 },
  detailDescTitre: { fontSize: 16, fontWeight: "bold", color: "#05102A", marginBottom: 8 },
  detailDesc: { fontSize: 14, color: "#8AAABF", lineHeight: 22, marginBottom: 20 },
  detailPrixBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14 },
  detailPrix: { fontSize: 26, fontWeight: "bold", color: "#05102A" },
  detailAcheterBtn: { backgroundColor: "#05102A", borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 10 },
  detailAcheterTxt: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  detailWhatsappBtn: { backgroundColor: "#25D366", borderRadius: 16, padding: 14, alignItems: "center" },
  detailWhatsappTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  offresHeader: { backgroundColor: "#05102A", padding: 20, paddingTop: 14 },
  offresTitre: { fontSize: 22, color: "#FFD080", fontWeight: "bold" },
  offresSous: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 },
  offreCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12, borderLeftWidth: 4 },
  offreIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  offreTitre: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  offreDesc: { fontSize: 12, color: "#8AAABF", marginTop: 2 },
  offreBtn: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 7 },
  offreBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  niveauCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16 },
  niveauRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4FF" },
  niveauBadge: { backgroundColor: "#1A6FFF", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  niveauBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  classementHeader: { backgroundColor: "#05102A", padding: 20, paddingTop: 14 },
  classementTitre: { fontSize: 22, color: "#FFD080", fontWeight: "bold" },
  classementSous: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 },
  classementItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 10, gap: 12 },
  classementItemMe: { backgroundColor: "#EEF5FF", borderWidth: 2, borderColor: "#1A6FFF" },
  classementRang: { fontSize: 22, width: 36, textAlign: "center" },
  classementAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1A6FFF", alignItems: "center", justifyContent: "center" },
  classementNom: { fontSize: 14, fontWeight: "bold", color: "#05102A" },
  classementNiveau: { fontSize: 11, color: "#8AAABF", marginTop: 2 },
  classementPts: { fontSize: 15, fontWeight: "bold", color: "#F5A623" },
  profilHeader: { backgroundColor: "#05102A", padding: 32, alignItems: "center" },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#1A6FFF", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  avatarTxt: { fontSize: 26, color: "#fff", fontWeight: "bold" },
  profilNom: { fontSize: 24, color: "#fff", fontWeight: "bold" },
  profilSous: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 },
  whatsappBtn: { backgroundColor: "#25D366", borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10, marginTop: 14 },
  whatsappBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  profilItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12, gap: 14 },
  profilIcon: { fontSize: 22 },
  profilLabel: { fontSize: 10, color: "#8AAABF", letterSpacing: 0.5 },
  profilVal: { fontSize: 15, fontWeight: "bold", color: "#05102A", marginTop: 2 },
  decoBtn: { backgroundColor: "#05102A", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 12 },
  decoBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  navBar: { flexDirection: "row", backgroundColor: "#05102A", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingBottom: Platform.OS === "ios" ? 24 : 10, paddingTop: 10 },
  navBtn: { flex: 1, alignItems: "center", gap: 3, position: "relative" },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: "600", letterSpacing: 0.5 },
  navLabelActif: { color: "#FFD080" },
  navIndicator: { position: "absolute", top: -10, width: 32, height: 2, backgroundColor: "#1A6FFF", borderRadius: 99 },
  notifsHeader: { backgroundColor: "#05102A", padding: 16, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  notifsTitre: { fontSize: 19, color: "#FFD080", fontWeight: "bold" },
  lireTout: { color: "#1A6FFF", fontSize: 12, fontWeight: "bold" },
  notifCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 10, flexDirection: "row", gap: 12 },
  notifCardNonLu: { backgroundColor: "#EEF5FF", borderLeftWidth: 3, borderLeftColor: "#1A6FFF" },
  notifIcon: { fontSize: 22 },
  notifTitre: { fontSize: 13, fontWeight: "bold", color: "#8AAABF", marginBottom: 2 },
  notifMsg: { fontSize: 12, color: "#8AAABF", lineHeight: 18 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1A6FFF", alignSelf: "flex-start", marginTop: 4 },
  soldeBloc: { margin: 16, backgroundColor: "#05102A", borderRadius: 22, padding: 22 },
  soldeTopRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  soldeLbl: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 4 },
  soldeVal: { fontSize: 34, color: "#FFD080", fontWeight: "bold" },
  soldeUnderline: { height: 3, width: 80, backgroundColor: "#FFD080", borderRadius: 2, marginTop: 4 },
  dsmCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#FFD080", alignItems: "center", justifyContent: "center" },
  dsmCircleTxt: { fontSize: 11, fontWeight: "bold", color: "#05102A", letterSpacing: 1 },
  soldeSep: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 12 },
  gainsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  gainsLbl: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "bold", flex: 1 },
  gainsVal: { fontSize: 13, color: "#fff", fontWeight: "bold" },
  dontTxt: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: "bold", marginBottom: 4 },
  gainsSubLbl: { fontSize: 12, color: "rgba(255,255,255,0.6)", flex: 1 },
  historiqueBtn: { backgroundColor: "#F5A623", borderRadius: 32, paddingVertical: 14, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 18, gap: 8 },
  historiqueBtnTxt: { fontSize: 15, fontWeight: "bold", color: "#1a1a00" },
  historiqueIco: { fontSize: 18 },
  barcodeBloc: { marginHorizontal: 16, backgroundColor: "#EAF2FF", borderRadius: 18, overflow: "hidden", marginBottom: 16 },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 18, padding: 18, gap: 14 },
  menuIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center" },
  menuLbl: { flex: 1, fontSize: 15, fontWeight: "bold", color: "#05102A" },
  menuArrow: { fontSize: 22, color: "#8AAABF", fontWeight: "bold" },
  ticketModal: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", zIndex: 100 },
  ticketContainer: { backgroundColor: "#fff", width: 290, borderRadius: 6, overflow: "hidden" },
  ticketHeader: { backgroundColor: "#05102A", padding: 18, alignItems: "center" },
  ticketLogo: { fontSize: 14, color: "#FFD080", fontWeight: "bold", letterSpacing: 2 },
  ticketSous: { fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 3, marginTop: 2 },
  ticketDate: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 },
  ticketSep: { borderStyle: "dashed", borderWidth: 1, borderColor: "#e0e0e0", marginVertical: 8, marginHorizontal: 16 },
  ticketItem: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 6 },
  ticketNom: { fontSize: 13, fontWeight: "bold", color: "#05102A", flex: 1 },
  ticketPrix: { fontSize: 13, fontWeight: "bold", color: "#05102A" },
  ticketTotal: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 8 },
  ticketTotalLbl: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  ticketTotalVal: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  ticketMerci: { textAlign: "center", fontSize: 12, color: "#8AAABF", fontStyle: "italic", marginVertical: 10 },
  ticketFermer: { backgroundColor: "#05102A", margin: 16, borderRadius: 14, padding: 13, alignItems: "center" },
  ticketFermerTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
