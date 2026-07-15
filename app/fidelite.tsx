import * as MailComposer from "expo-mail-composer";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { ODOO_DB, ODOO_URL } from "./config";

/* ══════════════════════════════════════
   ODOO API (local helpers)
══════════════════════════════════════ */
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
    return !!data.result?.uid;
  } catch { return false; }
}

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

/* ══════════════════════════════════════
   CATALOGUE LOCAL (fallback)
══════════════════════════════════════ */
const CATALOGUE = [
  { titre: "Les Misérables", auteur: "Victor Hugo", prix: 18.9, emoji: "📗", genre: "roman" },
  { titre: "L'Étranger", auteur: "Albert Camus", prix: 8.5, emoji: "📘", genre: "roman" },
  { titre: "Le Nom de la Rose", auteur: "Umberto Eco", prix: 12.0, emoji: "🌹", genre: "roman" },
  { titre: "Pars vite et reviens tard", auteur: "Fred Vargas", prix: 9.2, emoji: "🔍", genre: "policier" },
  { titre: "Le Chien jaune", auteur: "Georges Simenon", prix: 8.9, emoji: "🔍", genre: "policier" },
  { titre: "Dune", auteur: "Frank Herbert", prix: 14.9, emoji: "🌑", genre: "sci-fi" },
  { titre: "Fondation", auteur: "Isaac Asimov", prix: 11.5, emoji: "🚀", genre: "sci-fi" },
  { titre: "Harry Potter T.1", auteur: "J.K. Rowling", prix: 13.9, emoji: "🧙", genre: "jeunesse" },
  { titre: "Le Petit Prince", auteur: "Saint-Exupéry", prix: 7.5, emoji: "🌹", genre: "jeunesse" },
  { titre: "Tintin au Congo", auteur: "Hergé", prix: 10.0, emoji: "🎨", genre: "bd" },
];

const NIVEAUX: Record<string, { emoji: string; couleur: string }> = {
  Bronze: { emoji: "🥉", couleur: "#CD7F32" },
  Silver: { emoji: "🥈", couleur: "#A8A9AD" },
  Gold: { emoji: "🥇", couleur: "#FFD700" },
  Platinum: { emoji: "💎", couleur: "#B9F2FF" },
};

const GENRES = [
  { id: "roman", label: "Roman", emoji: "📗" },
  { id: "policier", label: "Policier", emoji: "🔍" },
  { id: "sci-fi", label: "Sci-Fi", emoji: "🚀" },
  { id: "jeunesse", label: "Jeunesse", emoji: "🧙" },
  { id: "biographie", label: "Biographie", emoji: "⚗️" },
  { id: "bd", label: "BD", emoji: "🎨" },
];

const LANGUES = [
  { id: "fr", label: "🇫🇷 Français" },
  { id: "ar", label: "🇲🇦 Arabe" },
  { id: "en", label: "🇬🇧 Anglais" },
  { id: "es", label: "🇪🇸 Espagnol" },
];

/* ══════════════════════════════════════
   CARTE DIGITALE
══════════════════════════════════════ */
export function CarteDigitale({ client, onFermer }: { client: any; onFermer: () => void }) {
  const numCarte = client?.dsm_num_carte || "0000";
  const points = client?.dsm_points || 0;
  const niveau = client?.dsm_niveau || "Bronze";
  const nv = NIVEAUX[niveau] || NIVEAUX.Bronze;

  const cardText =
    `🏆 Carte fidélité DSM Librairie\n` +
    `Nom : ${client?.name || ""}\n` +
    `N° carte : ${numCarte}\n` +
    `Points : ${points} pts\n` +
    `Niveau : ${nv.emoji} ${niveau}\n\n` +
    `Présentez ce message en caisse pour valider vos points !`;

  const partagerWhatsApp = () => {
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(cardText)}`).catch(() =>
      Alert.alert("WhatsApp non disponible", "Installez WhatsApp pour partager votre carte.")
    );
  };

  const partagerEmail = async () => {
    try {
      await MailComposer.composeAsync({
        subject: "Ma carte fidélité DSM Librairie",
        body: cardText,
      });
    } catch { Alert.alert("Email indisponible"); }
  };

  return (
    <View style={cS.overlay}>
      <TouchableOpacity style={cS.closeBtn} onPress={onFermer}>
        <Text style={cS.closeTxt}>✕</Text>
      </TouchableOpacity>

      <LinearGradient colors={["#05102A", "#0A2060", "#1A3A90"]} style={cS.card}>
        <View style={cS.cardHeader}>
          <Text style={cS.cardLogo}>📚 DSM LIBRAIRIE</Text>
          <View style={[cS.niveauBadge, { borderColor: nv.couleur }]}>
            <Text style={[cS.niveauTxt, { color: nv.couleur }]}>{nv.emoji} {niveau}</Text>
          </View>
        </View>

        <View style={cS.qrWrapper}>
          <QRCode value={numCarte} size={140} color="#05102A" backgroundColor="#fff" />
        </View>

        <Text style={cS.cardNom}>{client?.name || ""}</Text>
        <Text style={cS.cardNum}>N° {numCarte}</Text>

        <View style={cS.pointsRow}>
          <View style={cS.pointsBox}>
            <Text style={cS.pointsVal}>{points}</Text>
            <Text style={cS.pointsLbl}>Points</Text>
          </View>
          {client?.dsm_solde ? (
            <View style={cS.pointsBox}>
              <Text style={cS.pointsVal}>{client.dsm_solde} DH</Text>
              <Text style={cS.pointsLbl}>Solde</Text>
            </View>
          ) : null}
          {client?.dsm_membre_depuis ? (
            <View style={cS.pointsBox}>
              <Text style={cS.pointsVal}>{client.dsm_membre_depuis}</Text>
              <Text style={cS.pointsLbl}>Membre depuis</Text>
            </View>
          ) : null}
        </View>

        <Text style={cS.cardHint}>Scannez en caisse pour valider vos points</Text>
      </LinearGradient>

      <View style={cS.actions}>
        <TouchableOpacity style={[cS.actionBtn, { backgroundColor: "#25D366" }]} onPress={partagerWhatsApp}>
          <Text style={cS.actionTxt}>📱 Partager WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[cS.actionBtn, { backgroundColor: "#1A6FFF" }]} onPress={partagerEmail}>
          <Text style={cS.actionTxt}>✉️ Email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#000b", alignItems: "center", justifyContent: "center", padding: 20 },
  closeBtn: { position: "absolute", top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", zIndex: 1 },
  closeTxt: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  card: { borderRadius: 24, padding: 24, width: "100%", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 20 },
  cardLogo: { color: "#FFD080", fontWeight: "bold", fontSize: 16, letterSpacing: 1 },
  niveauBadge: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  niveauTxt: { fontSize: 12, fontWeight: "bold" },
  qrWrapper: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  cardNom: { color: "#fff", fontSize: 20, fontWeight: "bold", letterSpacing: 1, marginBottom: 4 },
  cardNum: { color: "rgba(255,255,255,0.55)", fontSize: 14, letterSpacing: 4, marginBottom: 20 },
  pointsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  pointsBox: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, minWidth: 80 },
  pointsVal: { color: "#FFD080", fontSize: 18, fontWeight: "bold" },
  pointsLbl: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 },
  cardHint: { color: "rgba(255,255,255,0.3)", fontSize: 11 },
  actions: { flexDirection: "row", gap: 12, marginTop: 20, width: "100%" },
  actionBtn: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  actionTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});

/* ══════════════════════════════════════
   HISTORIQUE DES ACHATS
══════════════════════════════════════ */
const ETAT_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "#8AAABF" },
  sent: { label: "Envoyé", color: "#F5A623" },
  sale: { label: "Confirmé", color: "#1A6FFF" },
  done: { label: "Terminé", color: "#27AE60" },
  cancel: { label: "Annulé", color: "#E74C3C" },
};

export function OngletHistoriqueAchats({ client }: { client: any }) {
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [lines, setLines] = useState<Record<number, any[]>>({});
  const [loadingLines, setLoadingLines] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      await odooAuthAdmin();
      const res = await odooCall("sale.order", "search_read",
        [[["partner_id", "=", client.id], ["state", "in", ["sale", "done"]]]],
        { fields: ["name", "date_order", "amount_total", "state", "order_line"], limit: 30, order: "date_order desc" }
      );
      setCommandes(res || []);
      setLoading(false);
    })();
  }, [client.id]);

  const toggleCommande = async (cmd: any) => {
    if (expandedId === cmd.id) { setExpandedId(null); return; }
    if (lines[cmd.id]) { setExpandedId(cmd.id); return; }
    setLoadingLines(cmd.id);
    const res = await odooCall("sale.order.line", "search_read",
      [[["id", "in", cmd.order_line || []]]],
      { fields: ["product_id", "product_uom_qty", "price_unit", "price_subtotal"], limit: 50 }
    );
    setLines(l => ({ ...l, [cmd.id]: res || [] }));
    setExpandedId(cmd.id);
    setLoadingLines(null);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#1A6FFF" size="large" />
        <Text style={{ color: "#8AAABF", marginTop: 12 }}>Chargement des commandes...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F5F7FF" }}>
      <View style={{ backgroundColor: "#05102A", padding: 20, paddingTop: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 22, color: "#FFD080", fontWeight: "bold" }}>📦 Historique des achats</Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          {commandes.length} commande(s) confirmée(s)
        </Text>
      </View>

      {commandes.length === 0 ? (
        <View style={{ alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📦</Text>
          <Text style={{ fontSize: 15, color: "#8AAABF", textAlign: "center" }}>Aucune commande trouvée.</Text>
          <Text style={{ fontSize: 13, color: "#aaa", textAlign: "center", marginTop: 8 }}>
            Vos achats confirmés apparaîtront ici.
          </Text>
        </View>
      ) : (
        commandes.map((cmd) => {
          const etat = ETAT_LABELS[cmd.state] || { label: cmd.state, color: "#8AAABF" };
          const dateStr = cmd.date_order
            ? new Date(cmd.date_order).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
            : "";
          const isExpanded = expandedId === cmd.id;
          const isLoadingThis = loadingLines === cmd.id;

          return (
            <View key={cmd.id} style={hS.card}>
              <TouchableOpacity onPress={() => toggleCommande(cmd)} activeOpacity={0.8}>
                <View style={hS.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={hS.cmdNom}>{cmd.name}</Text>
                    <Text style={hS.cmdDate}>{dateStr}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                    <Text style={hS.cmdTotal}>{(cmd.amount_total || 0).toFixed(2)} DH</Text>
                    <View style={[hS.stateBadge, { backgroundColor: etat.color + "20" }]}>
                      <Text style={[hS.stateTxt, { color: etat.color }]}>{etat.label}</Text>
                    </View>
                  </View>
                  <Text style={{ color: "#C0CCDA", fontSize: 16 }}>{isExpanded ? "▲" : "▼"}</Text>
                </View>
              </TouchableOpacity>

              {(isExpanded || isLoadingThis) && (
                <View style={hS.linesContainer}>
                  {isLoadingThis ? (
                    <ActivityIndicator color="#1A6FFF" style={{ marginVertical: 12 }} />
                  ) : (lines[cmd.id] || []).map((line, i) => (
                    <View key={i} style={hS.lineRow}>
                      <Text style={{ fontSize: 16, marginRight: 8 }}>📖</Text>
                      <Text style={hS.lineTitre} numberOfLines={2}>{line.product_id?.[1] || "—"}</Text>
                      <Text style={hS.lineQty}>×{line.product_uom_qty}</Text>
                      <Text style={hS.linePrix}>{(line.price_subtotal || 0).toFixed(2)} DH</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const hS = StyleSheet.create({
  card: { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  cmdNom: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  cmdDate: { fontSize: 12, color: "#8AAABF", marginTop: 3 },
  cmdTotal: { fontSize: 15, fontWeight: "bold", color: "#1A6FFF" },
  stateBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  stateTxt: { fontSize: 11, fontWeight: "bold" },
  linesContainer: { borderTopWidth: 1, borderTopColor: "#F0F4FF", paddingHorizontal: 16, paddingVertical: 8 },
  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7 },
  lineTitre: { flex: 1, fontSize: 13, color: "#05102A" },
  lineQty: { fontSize: 12, color: "#8AAABF", width: 28, textAlign: "center" },
  linePrix: { fontSize: 13, fontWeight: "bold", color: "#1A6FFF", width: 80, textAlign: "right" },
});

/* ══════════════════════════════════════
   RECOMMANDATIONS
══════════════════════════════════════ */
function LivreCard({ livre }: { livre: any }) {
  return (
    <View style={rS.livreCard}>
      <Text style={rS.livreEmoji}>{livre.emoji}</Text>
      <Text style={rS.livreTitre} numberOfLines={2}>{livre.titre}</Text>
      <Text style={rS.livreAuteur} numberOfLines={1}>{livre.auteur}</Text>
      <Text style={rS.livrePrix}>{livre.prix.toFixed(2)} DH</Text>
    </View>
  );
}

function RecoSection({ titre, livres }: { titre: string; livres: any[] }) {
  if (livres.length === 0) return null;
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={rS.sectionTitre}>{titre}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
        {livres.map((l, i) => <LivreCard key={i} livre={l} />)}
      </ScrollView>
    </View>
  );
}

export function OngletRecommandations({ client }: { client: any }) {
  const genre = client?.dsm_genre_favori || "";
  const auteur = client?.dsm_auteur_favori || "";
  const GENRE_EMOJI: Record<string, string> = {
    roman: "📗", policier: "🔍", "sci-fi": "🚀", jeunesse: "🧙", biographie: "⚗️", bd: "🎨",
  };

  const byGenre = CATALOGUE.filter(l => genre && l.genre === genre);
  const byAuteur = CATALOGUE.filter(l =>
    auteur && l.auteur.toLowerCase().includes(auteur.toLowerCase().split(" ")[0])
  );
  const coup_coeur = CATALOGUE.filter(l => !byGenre.includes(l) && !byAuteur.includes(l)).slice(0, 5);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F5F7FF" }}>
      <View style={{ backgroundColor: "#05102A", padding: 20, paddingTop: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 22, color: "#FFD080", fontWeight: "bold" }}>📖 Recommandations</Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>Sélectionnés pour vous</Text>
      </View>

      {genre ? (
        <RecoSection
          titre={`${GENRE_EMOJI[genre] || "📚"} Vous aimez le genre « ${genre} »`}
          livres={byGenre.length > 0 ? byGenre : CATALOGUE.slice(0, 4)}
        />
      ) : null}

      {auteur ? (
        <RecoSection
          titre={`✍️ Dans l'univers de ${auteur}`}
          livres={byAuteur.length > 0 ? byAuteur : CATALOGUE.slice(0, 3)}
        />
      ) : null}

      <RecoSection titre="🌟 Coups de cœur DSM" livres={coup_coeur.length > 0 ? coup_coeur : CATALOGUE.slice(0, 4)} />

      {!genre && !auteur && (
        <View style={{ margin: 16, padding: 16, backgroundColor: "#EAF2FF", borderRadius: 16 }}>
          <Text style={{ color: "#1A6FFF", fontWeight: "bold", marginBottom: 6 }}>
            💡 Personnalisez vos recommandations
          </Text>
          <Text style={{ color: "#05102A", fontSize: 13, lineHeight: 20 }}>
            Définissez votre genre et auteur favoris dans "Mes préférences" pour obtenir des suggestions vraiment adaptées à vos goûts.
          </Text>
        </View>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const rS = StyleSheet.create({
  sectionTitre: { fontSize: 16, fontWeight: "bold", color: "#05102A", marginBottom: 12, paddingHorizontal: 16 },
  livreCard: { width: 150, backgroundColor: "#fff", borderRadius: 18, padding: 14, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  livreEmoji: { fontSize: 34, marginBottom: 8 },
  livreTitre: { fontSize: 13, fontWeight: "bold", color: "#05102A", marginBottom: 4, lineHeight: 18 },
  livreAuteur: { fontSize: 11, color: "#8AAABF", marginBottom: 8 },
  livrePrix: { fontSize: 13, fontWeight: "bold", color: "#1A6FFF" },
});

/* ══════════════════════════════════════
   WISHLIST
══════════════════════════════════════ */
const parseWishlist = (raw: string | null): string[] => {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
};

export function OngletWishlist({ client }: { client: any }) {
  const [wishlist, setWishlist] = useState<string[]>(parseWishlist(client?.dsm_wishlist));
  const [saving, setSaving] = useState(false);
  const [showCatalogue, setShowCatalogue] = useState(false);

  const save = async (newList: string[]) => {
    setSaving(true);
    await odooAuthAdmin();
    await odooCall("res.partner", "write", [[client.id], { dsm_wishlist: JSON.stringify(newList) }]);
    setSaving(false);
  };

  const ajouter = async (titre: string) => {
    setShowCatalogue(false);
    if (wishlist.includes(titre)) return;
    const newList = [...wishlist, titre];
    setWishlist(newList);
    await save(newList);
  };

  const supprimer = async (titre: string) => {
    const newList = wishlist.filter(t => t !== titre);
    setWishlist(newList);
    await save(newList);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F5F7FF" }}>
      <View style={{ backgroundColor: "#05102A", padding: 20, paddingTop: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 22, color: "#FFD080", fontWeight: "bold" }}>❤️ Ma liste de souhaits</Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          {wishlist.length} titre(s) sauvegardé(s)
        </Text>
      </View>

      {wishlist.length === 0 ? (
        <View style={{ alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📚</Text>
          <Text style={{ fontSize: 15, color: "#8AAABF", textAlign: "center" }}>Votre liste est vide.</Text>
          <Text style={{ fontSize: 13, color: "#aaa", textAlign: "center", marginTop: 8 }}>
            Ajoutez des livres que vous souhaitez acheter.
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16 }}>
          {wishlist.map((titre, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 }}>
              <Text style={{ fontSize: 22 }}>📖</Text>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "bold", color: "#05102A" }}>{titre}</Text>
              <TouchableOpacity
                onPress={() => supprimer(titre)}
                style={{ backgroundColor: "#FEE8E8", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: "#E74C3C", fontSize: 13, fontWeight: "bold" }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={() => setShowCatalogue(true)}
        style={{ margin: 16, backgroundColor: "#1A6FFF", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>+ Ajouter depuis le catalogue</Text>
      </TouchableOpacity>

      {saving && (
        <Text style={{ textAlign: "center", color: "#8AAABF", fontSize: 12, marginBottom: 8 }}>
          💾 Sauvegarde en cours...
        </Text>
      )}

      <Modal visible={showCatalogue} animationType="slide" transparent onRequestClose={() => setShowCatalogue(false)}>
        <View style={{ flex: 1, backgroundColor: "#000a", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "72%", padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: "#05102A", marginBottom: 16 }}>
              📚 Catalogue
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CATALOGUE.map((livre, i) => {
                const deja = wishlist.includes(livre.titre);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => ajouter(livre.titre)}
                    disabled={deja}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F4FF", gap: 12, opacity: deja ? 0.45 : 1 }}>
                    <Text style={{ fontSize: 26 }}>{livre.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "bold", color: "#05102A" }}>{livre.titre}</Text>
                      <Text style={{ fontSize: 12, color: "#8AAABF", marginTop: 2 }}>{livre.auteur}</Text>
                    </View>
                    <Text style={{ fontSize: 20, color: deja ? "#27AE60" : "#1A6FFF", fontWeight: "bold" }}>
                      {deja ? "✓" : "+"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowCatalogue(false)}
              style={{ marginTop: 16, backgroundColor: "#F5F7FF", borderRadius: 14, padding: 14, alignItems: "center" }}>
              <Text style={{ color: "#05102A", fontWeight: "bold", fontSize: 15 }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   PRÉFÉRENCES
══════════════════════════════════════ */
export function OngletPreferences({ client, onUpdate }: { client: any; onUpdate: (c: any) => void }) {
  const [genre, setGenre] = useState<string>(client?.dsm_genre_favori || "");
  const [auteur, setAuteur] = useState<string>(client?.dsm_auteur_favori || "");
  const [editeur, setEditeur] = useState<string>(client?.dsm_editeur_favori || "");
  const [langue, setLangue] = useState<string>(client?.dsm_langue_pref || "fr");
  const [budget, setBudget] = useState<string>(String(client?.dsm_budget_moyen || ""));
  const [saving, setSaving] = useState(false);

  const sauvegarder = async () => {
    setSaving(true);
    await odooAuthAdmin();
    const vals: any = {
      dsm_genre_favori: genre,
      dsm_auteur_favori: auteur,
      dsm_editeur_favori: editeur,
      dsm_langue_pref: langue,
      dsm_budget_moyen: parseFloat(budget) || 0,
    };
    await odooCall("res.partner", "write", [[client.id], vals]);
    onUpdate({ ...client, ...vals });
    setSaving(false);
    Alert.alert("✅ Sauvegardé", "Vos préférences ont été mises à jour !");
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F5F7FF" }}>
      <View style={{ backgroundColor: "#05102A", padding: 20, paddingTop: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 22, color: "#FFD080", fontWeight: "bold" }}>⚙️ Mes préférences</Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Personnalisez votre expérience DSM
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16 }}>

        {/* Genre favori */}
        <View style={pS.section}>
          <Text style={pS.label}>Genre favori</Text>
          <View style={pS.pillsRow}>
            {GENRES.map(g => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setGenre(genre === g.id ? "" : g.id)}
                style={[pS.pill, genre === g.id && pS.pillActive]}>
                <Text style={[pS.pillTxt, genre === g.id && pS.pillActiveTxt]}>
                  {g.emoji} {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Auteur favori */}
        <View style={pS.section}>
          <Text style={pS.label}>Auteur favori</Text>
          <TextInput
            style={pS.input}
            value={auteur}
            onChangeText={setAuteur}
            placeholder="Ex: Victor Hugo, Agatha Christie..."
            placeholderTextColor="#B0C4D8"
          />
        </View>

        {/* Éditeur favori (nouveau) */}
        <View style={pS.section}>
          <Text style={pS.label}>Éditeur favori</Text>
          <TextInput
            style={pS.input}
            value={editeur}
            onChangeText={setEditeur}
            placeholder="Ex: Gallimard, Actes Sud, Le Seuil..."
            placeholderTextColor="#B0C4D8"
          />
        </View>

        {/* Langue préférée (nouveau) */}
        <View style={pS.section}>
          <Text style={pS.label}>Langue de lecture préférée</Text>
          <View style={pS.pillsRow}>
            {LANGUES.map(l => (
              <TouchableOpacity
                key={l.id}
                onPress={() => setLangue(l.id)}
                style={[pS.pill, langue === l.id && pS.pillActive]}>
                <Text style={[pS.pillTxt, langue === l.id && pS.pillActiveTxt]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Budget moyen (nouveau) */}
        <View style={pS.section}>
          <Text style={pS.label}>Budget mensuel moyen (DH)</Text>
          <TextInput
            style={pS.input}
            value={budget}
            onChangeText={setBudget}
            placeholder="Ex: 200"
            keyboardType="numeric"
            placeholderTextColor="#B0C4D8"
          />
          <Text style={{ fontSize: 11, color: "#8AAABF", marginTop: 4 }}>
            Nous l'utilisons pour vous proposer des offres adaptées à votre budget.
          </Text>
        </View>

        {/* Bouton sauvegarder */}
        <TouchableOpacity
          onPress={sauvegarder}
          disabled={saving}
          style={{ backgroundColor: saving ? "#9EC4FF" : "#1A6FFF", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 4, marginBottom: 32 }}>
          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
            {saving ? "⏳ Sauvegarde..." : "💾 Sauvegarder mes préférences"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const pS = StyleSheet.create({
  section: { marginBottom: 22 },
  label: { fontSize: 14, fontWeight: "bold", color: "#05102A", marginBottom: 10 },
  input: { backgroundColor: "#fff", borderRadius: 14, padding: 14, fontSize: 14, color: "#05102A", borderWidth: 1.5, borderColor: "#E0EDFF" },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderRadius: 99, borderWidth: 1.5, borderColor: "#D8E8FF", paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#fff" },
  pillActive: { backgroundColor: "#1A6FFF", borderColor: "#1A6FFF" },
  pillTxt: { fontSize: 13, color: "#4A6080", fontWeight: "600" },
  pillActiveTxt: { color: "#fff" },
});
