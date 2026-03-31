import * as MailComposer from "expo-mail-composer";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../supabase";
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

const LIVRES = [
  {
    titre: "Les Misérables",
    auteur: "Victor Hugo",
    prix: 18.9,
    emoji: "📗",
    genre: "Roman",
    desc: "Une fresque humaniste inoubliable sur la misère et la rédemption.",
    pages: 1900,
    annee: 1862,
    note: 4.9,
  },
  {
    titre: "L'Étranger",
    auteur: "Albert Camus",
    prix: 8.5,
    emoji: "📘",
    genre: "Roman",
    desc: "Le roman fondateur de l'absurde, court et bouleversant.",
    pages: 186,
    annee: 1942,
    note: 4.7,
  },
  {
    titre: "Pars vite et reviens tard",
    auteur: "Fred Vargas",
    prix: 9.2,
    emoji: "🔍",
    genre: "Policier",
    desc: "Commissaire Adamsberg face à une menace mystérieuse.",
    pages: 368,
    annee: 2001,
    note: 4.8,
  },
  {
    titre: "Dune",
    auteur: "Frank Herbert",
    prix: 14.9,
    emoji: "🌑",
    genre: "Sci-Fi",
    desc: "L'épopée épique d'Arrakis, planète désertique.",
    pages: 896,
    annee: 1965,
    note: 4.9,
  },
  {
    titre: "Harry Potter T.1",
    auteur: "J.K. Rowling",
    prix: 13.9,
    emoji: "🧙",
    genre: "Jeunesse",
    desc: "Le début d'une aventure magique pour tous les âges.",
    pages: 320,
    annee: 1997,
    note: 5.0,
  },
  {
    titre: "Le Petit Prince",
    auteur: "Saint-Exupéry",
    prix: 7.5,
    emoji: "🌹",
    genre: "Jeunesse",
    desc: "Le conte philosophique le plus lu au monde.",
    pages: 96,
    annee: 1943,
    note: 4.9,
  },
  {
    titre: "Fondation",
    auteur: "Isaac Asimov",
    prix: 11.5,
    emoji: "🚀",
    genre: "Sci-Fi",
    desc: "Le cycle le plus ambitieux de la science-fiction.",
    pages: 400,
    annee: 1951,
    note: 4.9,
  },
  {
    titre: "Les Misérables T.2",
    auteur: "Victor Hugo",
    prix: 16.9,
    emoji: "📚",
    genre: "Roman",
    desc: "La suite magistrale de l'œuvre de Hugo.",
    pages: 1200,
    annee: 1862,
    note: 4.8,
  },
];

const OFFRES = [
  {
    id: 1,
    titre: "-20% sur les Romans",
    desc: "Valable tout le week-end",
    emoji: "📗",
    couleur: "#1A6FFF",
    expire: "30/03/2026",
  },
  {
    id: 2,
    titre: "Livre offert dès 2000 pts",
    desc: "Choisissez parmi notre sélection",
    emoji: "🎁",
    couleur: "#F5A623",
    expire: "15/04/2026",
  },
  {
    id: 3,
    titre: "Dédicace Fred Vargas",
    desc: "Samedi 5 avril à 14h — DSM",
    emoji: "✍️",
    couleur: "#27AE60",
    expire: "05/04/2026",
  },
  {
    id: 4,
    titre: "-15% Jeunesse",
    desc: "Pour les membres Silver et plus",
    emoji: "🧙",
    couleur: "#9B59B6",
    expire: "20/04/2026",
  },
];

function isAnniversaire(dateNaissance: string) {
  if (!dateNaissance) return false;
  const today = new Date();
  const d = new Date(dateNaissance);
  return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

async function envoyerEmailBienvenue(
  email: string,
  prenom: string,
  numCarte: string,
) {
  try {
    await MailComposer.composeAsync({
      recipients: [email],
      subject: "🎉 Bienvenue chez DSM Librairie !",
      body: `Bonjour ${prenom},\n\nVotre carte fidélité DSM est activée !\n\nN° de carte : ${numCarte}\nPoints de bienvenue : 50 pts\n\nMerci de votre confiance.\n\nL'équipe DSM Librairie`,
    });
  } catch (e) {
    console.log("Email non disponible");
  }
}

async function envoyerEmailAchat(
  email: string,
  prenom: string,
  livres: any[],
  total: number,
  pts: number,
) {
  try {
    const lignes = livres
      .map((l) => `- ${l.titre} : ${l.prix.toFixed(2)} DH`)
      .join("\n");
    await MailComposer.composeAsync({
      recipients: [email],
      subject: "✅ Confirmation de votre achat DSM",
      body: `Bonjour ${prenom},\n\nMerci pour votre achat !\n\n${lignes}\n\nTotal : ${total.toFixed(2)} DH\nPoints gagnés : +${pts} pts\n\nÀ bientôt chez DSM Librairie !`,
    });
  } catch (e) {
    console.log("Email non disponible");
  }
}

/* ══════════════════════════════════════
   QR CODE + BARCODE
══════════════════════════════════════ */
function BarcodeVisuel({
  numCarte,
  prenom,
  nom,
}: {
  numCarte: string;
  prenom: string;
  nom: string;
}) {
  const seed = (numCarte || "0000").toString();
  const bars: number[] = [];
  for (let i = 0; i < 60; i++) {
    const c = seed.charCodeAt(i % seed.length);
    bars.push(((c * (i + 3)) % 3) + 1);
  }
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 20,
        paddingHorizontal: 16,
      }}
    >
      <View style={qrStyles.qrContainer}>
        <View style={qrStyles.qrBox}>
          <QRCode
            value={numCarte}
            size={120}
            color="#05102A"
            backgroundColor="#fff"
          />
        </View>
        <View style={qrStyles.qrInfo}>
          <Text style={qrStyles.qrNom}>
            {prenom} {nom}
          </Text>
          <Text style={qrStyles.qrNum}>N° {numCarte}</Text>
          <Text style={qrStyles.qrHint}>
            Scannez en caisse pour valider vos points
          </Text>
        </View>
      </View>
      <View style={qrStyles.barcodeRow}>
        {bars.map((w, i) => (
          <View
            key={i}
            style={{
              width: w * 2,
              height: 50,
              backgroundColor: i % 2 === 0 ? "#111" : "#fff",
            }}
          />
        ))}
      </View>
      <Text style={qrStyles.barcodeNum}>•••• •••• •••• {numCarte}</Text>
    </View>
  );
}

const qrStyles = StyleSheet.create({
  qrContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  qrBox: {
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0EDFF",
  },
  qrInfo: { flex: 1 },
  qrNom: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#05102A",
    marginBottom: 4,
  },
  qrNum: {
    fontSize: 13,
    color: "#1A6FFF",
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 6,
  },
  qrHint: { fontSize: 10, color: "#8AAABF", lineHeight: 14 },
  barcodeRow: { flexDirection: "row", height: 50, overflow: "hidden" },
  barcodeNum: {
    fontSize: 12,
    letterSpacing: 3,
    marginTop: 8,
    color: "#333",
    fontWeight: "bold",
  },
});

/* ══════════════════════════════════════
   ÉCRAN CONNEXION
══════════════════════════════════════ */
function EcranConnexion({ onLogin }: { onLogin: (c: any) => void }) {
  const [mode, setMode] = useState<"login" | "inscription">("login");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [genre, setGenre] = useState("roman");
  const [anniversaire, setAnniversaire] = useState("");
  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(false);

  const connexion = async () => {
    if (!email || !mdp) {
      setErreur("❌ Remplissez tous les champs");
      return;
    }
    setLoading(true);
    setErreur("");
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("email", email)
        .eq("mdp", mdp)
        .single();
      if (error || !data) setErreur("❌ Email ou mot de passe incorrect");
      else onLogin(data);
    } catch (e) {
      setErreur("❌ Erreur de connexion");
    }
    setLoading(false);
  };

  const inscription = async () => {
    if (!prenom || !nom || !email || !mdp) {
      setErreur("❌ Remplissez tous les champs");
      return;
    }
    setLoading(true);
    setErreur("");
    try {
      const { data: exist } = await supabase
        .from("clients")
        .select("id")
        .eq("email", email)
        .single();
      if (exist) {
        setErreur("❌ Cet email est déjà utilisé");
        setLoading(false);
        return;
      }
      const numCarte = String(Math.floor(1000 + Math.random() * 9000));
      const depuis = new Date().getFullYear().toString();
      const { data, error } = await supabase
        .from("clients")
        .insert({
          prenom,
          nom,
          email,
          mdp,
          niveau: "Bronze",
          points: 50,
          num_carte: numCarte,
          genre_favori: genre,
          auteur_favori: "",
          depuis,
          date_naissance: anniversaire || null,
        })
        .select()
        .single();
      if (error || !data) {
        setErreur("❌ Erreur lors de l'inscription");
      } else {
        await supabase.from("notifications").insert({
          client_id: data.id,
          titre: "🎉 Bienvenue chez DSM !",
          message: `Bonjour ${prenom} ! Votre carte est prête. +50 pts de bienvenue !`,
          lu: false,
        });
        await envoyerEmailBienvenue(email, prenom, numCarte);
        Alert.alert(
          "🎉 Bienvenue !",
          `Votre carte DSM est activée !\nN° ${numCarte}\n+50 pts offerts !`,
        );
        onLogin(data);
      }
    } catch (e) {
      setErreur("❌ Erreur de connexion");
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={s.loginContainer}>
      <View style={s.logoBox}>
        <Text style={s.logoEmoji}>📚</Text>
      </View>
      <Text style={s.logoTitre}>DSM</Text>
      <Text style={s.logoSous}>LIBRAIRIE</Text>
      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.toggleBtn, mode === "login" && s.toggleBtnActif]}
          onPress={() => {
            setMode("login");
            setErreur("");
          }}
        >
          <Text style={[s.toggleTxt, mode === "login" && s.toggleTxtActif]}>
            Connexion
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, mode === "inscription" && s.toggleBtnActif]}
          onPress={() => {
            setMode("inscription");
            setErreur("");
          }}
        >
          <Text
            style={[s.toggleTxt, mode === "inscription" && s.toggleTxtActif]}
          >
            Inscription
          </Text>
        </TouchableOpacity>
      </View>
      <View style={s.form}>
        {mode === "login" && (
          <>
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor="#7AAAD0"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={s.input}
              placeholder="Mot de passe"
              placeholderTextColor="#7AAAD0"
              value={mdp}
              onChangeText={setMdp}
              secureTextEntry
            />
            {erreur ? <Text style={s.erreur}>{erreur}</Text> : null}
            <TouchableOpacity
              style={s.bouton}
              onPress={connexion}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.boutonTxt}>Se connecter →</Text>
              )}
            </TouchableOpacity>
            <Text style={s.demo}>Demo : sophie@dsm.fr / 1234</Text>
          </>
        )}
        {mode === "inscription" && (
          <>
            <View style={s.rowInputs}>
              <TextInput
                style={[s.input, { flex: 1, marginRight: 8 }]}
                placeholder="Prénom"
                placeholderTextColor="#7AAAD0"
                value={prenom}
                onChangeText={setPrenom}
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Nom"
                placeholderTextColor="#7AAAD0"
                value={nom}
                onChangeText={setNom}
              />
            </View>
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor="#7AAAD0"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={s.input}
              placeholder="Mot de passe"
              placeholderTextColor="#7AAAD0"
              value={mdp}
              onChangeText={setMdp}
              secureTextEntry
            />
            <TextInput
              style={s.input}
              placeholder="Date de naissance (JJ/MM/AAAA)"
              placeholderTextColor="#7AAAD0"
              value={anniversaire}
              onChangeText={setAnniversaire}
            />
            <Text style={s.genreLabel}>Genre littéraire favori</Text>
            <View style={s.genreGrid}>
              {[
                { id: "roman", label: "Roman", icon: "📗" },
                { id: "policier", label: "Policier", icon: "🔍" },
                { id: "sci-fi", label: "Sci-Fi", icon: "🚀" },
                { id: "jeunesse", label: "Jeunesse", icon: "🧙" },
                { id: "biographie", label: "Bio", icon: "⚗️" },
                { id: "bd", label: "BD", icon: "🎨" },
              ].map((g) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setGenre(g.id)}
                  style={[s.genreBtn, genre === g.id && s.genreBtnActif]}
                >
                  <Text style={s.genreEmoji}>{g.icon}</Text>
                  <Text style={[s.genreTxt, genre === g.id && s.genreTxtActif]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {erreur ? <Text style={s.erreur}>{erreur}</Text> : null}
            <TouchableOpacity
              style={s.bouton}
              onPress={inscription}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.boutonTxt}>Créer mon compte →</Text>
              )}
            </TouchableOpacity>
            <Text style={s.demo}>50 points offerts à l'inscription 🎁</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   PAGE DÉTAILS LIVRE
══════════════════════════════════════ */
function DetailLivre({
  livre,
  client,
  onAchat,
  onBack,
}: {
  livre: any;
  client: any;
  onAchat: () => void;
  onBack: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FF" }}>
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={{ color: "#FFD080", fontSize: 18 }}>‹ Retour</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }}>
        <View style={s.detailHero}>
          <Text style={s.detailEmoji}>{livre.emoji}</Text>
          <Text style={s.detailTitre}>{livre.titre}</Text>
          <Text style={s.detailAuteur}>{livre.auteur}</Text>
          <View style={s.detailBadgeRow}>
            <View style={s.detailBadge}>
              <Text style={s.detailBadgeTxt}>{livre.genre}</Text>
            </View>
            <View style={s.detailBadge}>
              <Text style={s.detailBadgeTxt}>{livre.pages} pages</Text>
            </View>
            <View style={s.detailBadge}>
              <Text style={s.detailBadgeTxt}>{livre.annee}</Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 8,
            }}
          >
            {"★★★★★".split("").map((_, i) => (
              <Text
                key={i}
                style={{
                  color: i < Math.floor(livre.note) ? "#F5A623" : "#ccc",
                  fontSize: 20,
                }}
              >
                ★
              </Text>
            ))}
            <Text style={{ color: "#8AAABF", fontSize: 14, marginLeft: 4 }}>
              {livre.note}/5
            </Text>
          </View>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={s.detailDescTitre}>Description</Text>
          <Text style={s.detailDesc}>{livre.desc}</Text>
          <View style={s.detailPrixBox}>
            <View>
              <Text style={{ fontSize: 12, color: "#8AAABF" }}>Prix</Text>
              <Text style={s.detailPrix}>{livre.prix.toFixed(2)} DH</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 12, color: "#8AAABF" }}>
                Points gagnés
              </Text>
              <Text
                style={{ fontSize: 20, color: "#F5A623", fontWeight: "bold" }}
              >
                +{Math.round(livre.prix * 10)} pts
              </Text>
            </View>
          </View>
          <TouchableOpacity style={s.detailAcheterBtn} onPress={onAchat}>
            <Text style={s.detailAcheterTxt}>🛍️ Ajouter au panier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.detailWhatsappBtn}
            onPress={() =>
              Linking.openURL(
                `whatsapp://send?text=Je recommande "${livre.titre}" de ${livre.auteur} disponible à la Librairie DSM pour ${livre.prix.toFixed(2)} DH 📚`,
              )
            }
          >
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
function OngletAccueil({
  client,
  onAnniversaire,
}: {
  client: any;
  onAnniversaire: () => void;
}) {
  const [achats, setAchats] = useState<any[]>([]);
  const [showHistorique, setShowHistorique] = useState(false);
  const [showTicket, setShowTicket] = useState(false);

  useEffect(() => {
    supabase
      .from("achats")
      .select("*")
      .eq("client_id", client.id)
      .order("date_achat", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setAchats(data);
      });
    if (client.date_naissance && isAnniversaire(client.date_naissance)) {
      onAnniversaire();
    }
  }, [client.id]);

  const gains6mois = achats.reduce((sum, a) => sum + (a.points_gagnes || 0), 0);
  const solde = (client.points * 0.1).toFixed(2).replace(".", ",");
  const gainsDH = (gains6mois * 0.1).toFixed(2).replace(".", ",");

  return (
    <ScrollView style={s.ongletContainer} showsVerticalScrollIndicator={false}>
      {client.date_naissance && isAnniversaire(client.date_naissance) && (
        <View style={s.anniversaireBanner}>
          <Text style={s.anniversaireEmoji}>🎂</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.anniversaireTitre}>
              Joyeux anniversaire {client.prenom} !
            </Text>
            <Text style={s.anniversaireSous}>
              +100 pts offerts aujourd'hui 🎁
            </Text>
          </View>
        </View>
      )}
      <View style={s.soldeBloc}>
        <View style={s.soldeTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.soldeLbl}>Solde disponible ⓘ</Text>
            <Text style={s.soldeVal}>{solde} DH</Text>
            <View style={s.soldeUnderline} />
          </View>
          <View style={s.dsmCircle}>
            <Text style={s.dsmCircleTxt}>DSM</Text>
          </View>
        </View>
        <View style={s.soldeSep} />
        <View style={s.gainsRow}>
          <Text style={s.gainsLbl}>Gains sur les 6 derniers mois :</Text>
          <Text style={s.gainsVal}>{gainsDH} DH</Text>
        </View>
        <Text style={s.dontTxt}>Dont</Text>
        <View style={s.gainsRow}>
          <Text style={s.gainsSubLbl}>Remises Immédiates :</Text>
          <Text style={s.gainsVal}>0,00 DH</Text>
        </View>
        <View style={s.gainsRow}>
          <Text style={s.gainsSubLbl}>Gains sur carte DSM :</Text>
          <Text style={s.gainsVal}>{gainsDH} DH</Text>
        </View>
        <TouchableOpacity
          style={s.historiqueBtn}
          onPress={() => setShowHistorique(!showHistorique)}
        >
          <Text style={s.historiqueBtnTxt}>Mon historique</Text>
          <Text style={s.historiqueIco}>🕐</Text>
        </TouchableOpacity>
      </View>

      {showHistorique && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {achats.length === 0 ? (
            <Text
              style={{ textAlign: "center", color: "#7AAAD0", padding: 16 }}
            >
              Aucun achat enregistré
            </Text>
          ) : (
            achats.map((a, i) => (
              <View key={i} style={s.achatCard}>
                <Text style={s.achatEmoji}>📕</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.achatTitre}>{a.titre}</Text>
                  <Text style={s.achatAuteur}>{a.auteur}</Text>
                </View>
                <Text style={s.achatPts}>+{a.points_gagnes} pts</Text>
              </View>
            ))
          )}
        </View>
      )}

      <View style={s.barcodeBloc}>
        <BarcodeVisuel
          numCarte={client.num_carte}
          prenom={client.prenom}
          nom={client.nom}
        />
      </View>

      {[
        { icon: "🧾", label: "Dernier ticket d'achat" },
        { icon: "🎁", label: "Avantages Carte DSM" },
        { icon: "⭐", label: "Mes offres en cours" },
        { icon: "🏆", label: "Mon niveau fidélité" },
        { icon: "🤝", label: "Parrainer un proche" },
      ].map((item, i) => (
        <TouchableOpacity
          key={i}
          style={s.menuItem}
          onPress={() => {
            if (item.label === "Dernier ticket d'achat") setShowTicket(true);
          }}
        >
          <View style={s.menuIconWrap}>
            <Text style={{ fontSize: 20 }}>{item.icon}</Text>
          </View>
          <Text style={s.menuLbl}>{item.label}</Text>
          <Text style={s.menuArrow}>›</Text>
        </TouchableOpacity>
      ))}

      {showTicket && achats.length > 0 && (
        <View style={s.ticketModal}>
          <View style={s.ticketContainer}>
            <View style={s.ticketHeader}>
              <Text style={s.ticketLogo}>📚 DSM LIBRAIRIE</Text>
              <Text style={s.ticketSous}>TICKET DE CAISSE</Text>
              <Text style={s.ticketDate}>
                {new Date().toLocaleDateString("fr-FR")}
              </Text>
            </View>
            <View style={s.ticketSep} />
            {achats.slice(0, 1).map((a, i) => (
              <View key={i}>
                <View style={s.ticketItem}>
                  <Text style={s.ticketNom}>{a.titre}</Text>
                  <Text style={s.ticketPrix}>{a.prix?.toFixed(2)} DH</Text>
                </View>
                <Text style={s.ticketAuteur}>{a.auteur}</Text>
              </View>
            ))}
            <View style={s.ticketSep} />
            <View style={s.ticketTotal}>
              <Text style={s.ticketTotalLbl}>TOTAL</Text>
              <Text style={s.ticketTotalVal}>
                {achats[0]?.prix?.toFixed(2)} DH
              </Text>
            </View>
            <View style={s.ticketPtsRow}>
              <Text style={s.ticketPtsLbl}>Points gagnés</Text>
              <Text style={s.ticketPtsVal}>
                +{achats[0]?.points_gagnes} pts
              </Text>
            </View>
            <View style={s.ticketSep} />
            <View style={{ alignItems: "center", marginVertical: 12 }}>
              <QRCode
                value={client.num_carte}
                size={80}
                color="#05102A"
                backgroundColor="#fff"
              />
              <Text
                style={{
                  fontSize: 10,
                  color: "#666",
                  letterSpacing: 2,
                  marginTop: 6,
                }}
              >
                •••• •••• •••• {client.num_carte}
              </Text>
            </View>
            <Text style={s.ticketMerci}>Merci de votre visite !</Text>
            <TouchableOpacity
              style={s.ticketFermer}
              onPress={() => setShowTicket(false)}
            >
              <Text style={s.ticketFermerTxt}>Fermer ✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   ONGLET BOUTIQUE
══════════════════════════════════════ */
function OngletBoutique({
  client,
  onAchat,
  onValider,
}: {
  client: any;
  onAchat: (pts: number, livres: any[], total: number) => void;
  onValider: (panier: any[]) => void;
}) {
  const [panier, setPanier] = useState<any[]>([]);
  const [showPanier, setShowPanier] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [livreDetail, setLivreDetail] = useState<any>(null);
  const total = panier.reduce((a, b) => a + b.prix, 0);
  const pts = Math.round(total * 10);

  const livresFiltres = LIVRES.filter(
    (l) =>
      l.titre.toLowerCase().includes(recherche.toLowerCase()) ||
      l.auteur.toLowerCase().includes(recherche.toLowerCase()) ||
      l.genre.toLowerCase().includes(recherche.toLowerCase()),
  );

  if (livreDetail) {
    return (
      <DetailLivre
        livre={livreDetail}
        client={client}
        onAchat={() => {
          setPanier((p) => [...p, livreDetail]);
          setLivreDetail(null);
        }}
        onBack={() => setLivreDetail(null)}
      />
    );
  }

  return (
    <View style={s.ongletContainer}>
      <View style={s.boutiqueHeader}>
        <Text style={s.boutiqueTitre}>🛍️ Boutique DSM</Text>
        <TouchableOpacity
          style={s.panierBtn}
          onPress={() => setShowPanier(!showPanier)}
        >
          <Text style={s.panierBtnTxt}>🛒 {panier.length}</Text>
        </TouchableOpacity>
      </View>
      <View style={s.rechercheBox}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput
          style={s.rechercheInput}
          placeholder="Rechercher un livre, auteur, genre..."
          placeholderTextColor="#8AAABF"
          value={recherche}
          onChangeText={setRecherche}
        />
        {recherche.length > 0 && (
          <TouchableOpacity onPress={() => setRecherche("")}>
            <Text style={{ color: "#8AAABF", fontSize: 18, marginLeft: 8 }}>
              ✕
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {showPanier && (
        <View style={s.panierBox}>
          {panier.length === 0 ? (
            <Text style={s.panierVide}>Panier vide</Text>
          ) : (
            <>
              {panier.map((livre, i) => (
                <View key={i} style={s.panierItem}>
                  <Text style={s.panierEmoji}>{livre.emoji}</Text>
                  <Text style={{ flex: 1, color: "#040D2A", fontSize: 13 }}>
                    {livre.titre}
                  </Text>
                  <Text style={{ color: "#05102A", fontWeight: "bold" }}>
                    {livre.prix.toFixed(2)} DH
                  </Text>
                </View>
              ))}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 10,
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "bold", color: "#05102A" }}
                >
                  Total : {total.toFixed(2)} DH
                </Text>
                <Text
                  style={{ fontSize: 13, color: "#1A6FFF", fontWeight: "bold" }}
                >
                  +{pts} pts
                </Text>
              </View>
              <TouchableOpacity
                style={s.validerBtn}
                onPress={() => onValider(panier)}
              >
                <Text style={s.validerTxt}>🛍️ Passer la commande</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
      <ScrollView>
        {recherche.length > 0 && (
          <Text style={{ padding: 12, color: "#8AAABF", fontSize: 12 }}>
            {livresFiltres.length} résultat(s) pour "{recherche}"
          </Text>
        )}
        <View style={s.livresGrid}>
          {livresFiltres.map((livre, i) => (
            <TouchableOpacity
              key={i}
              style={s.livreCard}
              onPress={() => setLivreDetail(livre)}
            >
              <Text style={s.livreEmoji}>{livre.emoji}</Text>
              <Text style={s.livreTitre}>{livre.titre}</Text>
              <Text style={s.livreAuteur}>{livre.auteur}</Text>
              <Text style={s.livrePrix}>{livre.prix.toFixed(2)} DH</Text>
              <Text style={s.livrePts}>+{Math.round(livre.prix * 10)} pts</Text>
              <TouchableOpacity
                style={s.ajouterBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setPanier((p) => [...p, livre]);
                }}
              >
                <Text style={s.ajouterTxt}>+ Ajouter</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
        {livresFiltres.length === 0 && (
          <View style={{ alignItems: "center", padding: 40 }}>
            <Text style={{ fontSize: 40 }}>📭</Text>
            <Text style={{ color: "#8AAABF", marginTop: 12, fontSize: 15 }}>
              Aucun livre trouvé
            </Text>
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
  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.offresHeader}>
        <Text style={s.offresTitre}>🎁 Offres & Promotions</Text>
        <Text style={s.offresSous}>Personnalisées pour vous</Text>
      </View>
      <View style={{ padding: 16 }}>
        {OFFRES.map((offre, i) => (
          <View
            key={i}
            style={[s.offreCard, { borderLeftColor: offre.couleur }]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <View
                style={[
                  s.offreIconBox,
                  { backgroundColor: offre.couleur + "20" },
                ]}
              >
                <Text style={{ fontSize: 24 }}>{offre.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.offreTitre}>{offre.titre}</Text>
                <Text style={s.offreDesc}>{offre.desc}</Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 11, color: "#8AAABF" }}>
                Expire le {offre.expire}
              </Text>
              <TouchableOpacity
                style={[s.offreBtn, { backgroundColor: offre.couleur }]}
              >
                <Text style={s.offreBtnTxt}>Utiliser →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <Text style={[s.sectionTitre, { marginTop: 8 }]}>🏆 Mon niveau</Text>
        <View style={s.niveauCard}>
          {[
            { label: "Bronze", seuil: 0, icon: "🥉" },
            { label: "Silver", seuil: 500, icon: "🥈" },
            { label: "Gold", seuil: 1000, icon: "🥇" },
            { label: "Platine", seuil: 2000, icon: "💎" },
          ].map((niv, i) => {
            const atteint = client.points >= niv.seuil;
            const courant = client.niveau === niv.label;
            return (
              <View key={i} style={s.niveauRow}>
                <Text style={{ fontSize: 22 }}>{niv.icon}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: courant ? "bold" : "normal",
                      color: atteint ? "#05102A" : "#8AAABF",
                    }}
                  >
                    {niv.label}
                  </Text>
                  <Text style={{ fontSize: 10, color: "#8AAABF" }}>
                    {niv.seuil} pts requis
                  </Text>
                </View>
                {courant && (
                  <View style={s.niveauBadge}>
                    <Text style={s.niveauBadgeTxt}>Actuel</Text>
                  </View>
                )}
                {atteint && !courant && (
                  <Text style={{ color: "#27AE60", fontSize: 18 }}>✓</Text>
                )}
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
    supabase
      .from("clients")
      .select("id,prenom,nom,points,niveau")
      .order("points", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setClassement(data);
        setLoading(false);
      });
  }, []);

  const medailles = ["🥇", "🥈", "🥉"];

  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.classementHeader}>
        <Text style={s.classementTitre}>🏆 Top Fidèles DSM</Text>
        <Text style={s.classementSous}>Les clients les plus fidèles</Text>
      </View>
      <View style={{ padding: 16 }}>
        {loading ? (
          <ActivityIndicator color="#1A6FFF" style={{ marginTop: 40 }} />
        ) : (
          classement.map((c, i) => {
            const isMe = c.id === client.id;
            return (
              <View
                key={i}
                style={[s.classementItem, isMe && s.classementItemMe]}
              >
                <Text style={s.classementRang}>
                  {medailles[i] || `${i + 1}`}
                </Text>
                <View style={s.classementAvatar}>
                  <Text
                    style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}
                  >
                    {c.prenom[0]}
                    {c.nom[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.classementNom, isMe && { color: "#1A6FFF" }]}>
                    {c.prenom} {c.nom} {isMe ? "(Moi)" : ""}
                  </Text>
                  <Text style={s.classementNiveau}>{c.niveau}</Text>
                </View>
                <Text style={s.classementPts}>
                  {c.points.toLocaleString()} pts
                </Text>
              </View>
            );
          })
        )}
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
    supabase
      .from("notifications")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setNotifs(data);
      });
  }, [client.id]);

  const lire = async (id: number) => {
    await supabase.from("notifications").update({ lu: true }).eq("id", id);
    setNotifs((n) => n.map((x) => (x.id === id ? { ...x, lu: true } : x)));
  };
  const lireTout = async () => {
    await supabase
      .from("notifications")
      .update({ lu: true })
      .eq("client_id", client.id);
    setNotifs((n) => n.map((x) => ({ ...x, lu: true })));
  };
  const nonLus = notifs.filter((n) => !n.lu).length;

  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.notifsHeader}>
        <Text style={s.notifsTitre}>🔔 Notifications</Text>
        {nonLus > 0 && (
          <TouchableOpacity onPress={lireTout}>
            <Text style={s.lireTout}>Tout lire ({nonLus})</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ padding: 12 }}>
        {notifs.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#7AAAD0", padding: 30 }}>
            Aucune notification
          </Text>
        ) : (
          notifs.map((n) => (
            <TouchableOpacity
              key={n.id}
              onPress={() => lire(n.id)}
              style={[s.notifCard, !n.lu && s.notifCardNonLu]}
            >
              <Text style={s.notifIcon}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.notifTitre, !n.lu && { color: "#040D2A" }]}>
                  {n.titre}
                </Text>
                <Text style={s.notifMsg}>{n.message}</Text>
              </View>
              {!n.lu && <View style={s.notifDot} />}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   ONGLET PROFIL
══════════════════════════════════════ */
function OngletProfil({
  client,
  onDeconnexion,
}: {
  client: any;
  onDeconnexion: () => void;
}) {
  const partagerCarte = async () => {
    try {
      await Linking.openURL(
        `whatsapp://send?text=Ma carte fidélité DSM Librairie 📚%0AN° : ${client.num_carte}%0ANiveau : ${client.niveau}%0APoints : ${client.points} pts`,
      );
    } catch (e) {
      Alert.alert("WhatsApp non disponible");
    }
  };

  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.profilHeader}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>
            {client.prenom[0]}
            {client.nom[0]}
          </Text>
        </View>
        <Text style={s.profilNom}>
          {client.prenom} {client.nom}
        </Text>
        <Text style={s.profilSous}>
          Membre {client.niveau} · {client.points} pts
        </Text>
        <TouchableOpacity style={s.whatsappBtn} onPress={partagerCarte}>
          <Text style={s.whatsappBtnTxt}>
            📱 Partager ma carte sur WhatsApp
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ padding: 16 }}>
        {[
          { icon: "📚", label: "Genre favori", val: client.genre_favori },
          {
            icon: "✍️",
            label: "Auteur favori",
            val: client.auteur_favori || "Non défini",
          },
          { icon: "💳", label: "N° carte", val: `•••• ${client.num_carte}` },
          { icon: "🏆", label: "Niveau", val: client.niveau },
          { icon: "⭐", label: "Points", val: `${client.points} pts` },
          {
            icon: "💰",
            label: "Solde",
            val: `${(client.points * 0.1).toFixed(2)} DH`,
          },
        ].map((info, i) => (
          <View key={i} style={s.profilItem}>
            <Text style={s.profilIcon}>{info.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.profilLabel}>{info.label}</Text>
              <Text style={s.profilVal}>{info.val}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.decoBtn} onPress={onDeconnexion}>
          <Text style={s.decoBtnTxt}>🚪 Se déconnecter</Text>
        </TouchableOpacity>
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
  const [showValidation, setShowValidation] = useState(false);
  const [panierValidation, setPanierValidation] = useState<any[]>([]);
  const notifListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!client) return;
    try {
      notifListener.current = Notifications.addNotificationReceivedListener(
        (notif) => console.log("Notification reçue:", notif),
      );
      responseListener.current =
        Notifications.addNotificationResponseReceivedListener(() =>
          setOnglet("notifs"),
        );
    } catch (e) {}
    return () => {
      try {
        if (notifListener.current)
          Notifications.removeNotificationSubscription(notifListener.current);
        if (responseListener.current)
          Notifications.removeNotificationSubscription(
            responseListener.current,
          );
      } catch (e) {}
    };
  }, [client?.id]);

  const handleAnniversaire = async () => {
    if (!client) return;
    const newPoints = client.points + 100;
    await supabase
      .from("clients")
      .update({ points: newPoints })
      .eq("id", client.id);
    setClient((c: any) => ({ ...c, points: newPoints }));
    await supabase.from("notifications").insert({
      client_id: client.id,
      titre: "🎂 Joyeux anniversaire !",
      message: `Bon anniversaire ${client.prenom} ! +100 pts offerts aujourd'hui !`,
      lu: false,
    });
    Alert.alert(
      "🎂 Joyeux anniversaire !",
      `+100 pts offerts ${client.prenom} !`,
    );
  };

  const addPoints = async (pts: number, livres: any[], total: number) => {
    setClient((c: any) => ({ ...c, points: c.points + pts }));
    if (client?.email) {
      await envoyerEmailAchat(client.email, client.prenom, livres, total, pts);
    }
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
      {/* Écran validation commande */}
      {showValidation && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
        >
          <EcranValidationCommande
            panier={panierValidation}
            client={client}
            fraisLivraison={15}
            onConfirmer={(cmd: any) => {
              setShowValidation(false);
              setClient((c: any) => ({
                ...c,
                points: c.points + (cmd.pts || 0),
              }));
              Alert.alert(
                "🎉 Commande confirmée !",
                `+${cmd.pts || 0} pts fidélité !`,
              );
            }}
            onAnnuler={() => setShowValidation(false)}
          />
        </View>
      )}

      <View style={s.header}>
        <View style={s.headerLogo}>
          <Text style={s.headerLogoTxt}>📚</Text>
        </View>
        <View>
          <Text style={s.headerDSM}>DSM</Text>
          <Text style={s.headerSous}>LIBRAIRIE</Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => setOnglet("notifs")}
          style={{ marginRight: 8 }}
        >
          <Text style={s.headerPtsTxt}>🔔</Text>
        </TouchableOpacity>
        <View style={s.headerPts}>
          <Text style={s.headerPtsTxt}>⭐ {client.points} pts</Text>
        </View>
      </View>

      {onglet === "accueil" && (
        <OngletAccueil client={client} onAnniversaire={handleAnniversaire} />
      )}
      {onglet === "boutique" && (
        <OngletBoutique
          client={client}
          onAchat={addPoints}
          onValider={(panier) => {
            setPanierValidation(panier);
            setShowValidation(true);
          }}
        />
      )}
      {onglet === "offres" && <OngletOffres client={client} />}
      {onglet === "classement" && <OngletClassement client={client} />}
      {onglet === "notifs" && <OngletNotifs client={client} />}
      {onglet === "profil" && (
        <OngletProfil client={client} onDeconnexion={() => setClient(null)} />
      )}
      {onglet === "caisse" && <Caisse />}
      {onglet === "coups_coeur" && (
        <OngletCoupsCoeur
          client={client}
          livres={LIVRES}
          onAjouterPanier={(l) => {}}
        />
      )}
      {onglet === "bons" && <OngletBonsReduction client={client} />}
      {onglet === "commandes" && <OngletSuiviCommandes client={client} />}
      {onglet === "scolaires" && (
        <OngletListesScolaires onAjouterPanier={(livres) => {}} />
      )}
      {onglet === "promotions" && <OngletPromotions client={client} />}
      {onglet === "mon_compte" && (
        <OngletMonCompte client={client} onUpdate={setClient} />
      )}

      {onglet === "plus" && (
        <ScrollView style={{ flex: 1, backgroundColor: "#F5F7FF" }}>
          <View
            style={{
              backgroundColor: "#05102A",
              padding: 20,
              paddingTop: 14,
              marginBottom: 16,
            }}
          >
            <Text
              style={{ fontSize: 22, color: "#FFD080", fontWeight: "bold" }}
            >
              ⊕ Plus de services
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.45)",
                marginTop: 4,
              }}
            >
              Tous vos outils DSM
            </Text>
          </View>
          {[
            {
              id: "coups_coeur",
              icon: "❤️",
              label: "Coups de cœur",
              desc: "Vos livres favoris sauvegardés",
            },
            {
              id: "bons",
              icon: "🎟️",
              label: "Bons de réduction",
              desc: "Vos codes promo disponibles",
            },
            {
              id: "commandes",
              icon: "📦",
              label: "Suivi des commandes",
              desc: "Statut et expédition en temps réel",
            },
            {
              id: "scolaires",
              icon: "🎒",
              label: "Listes scolaires",
              desc: "Rentrée 2025-2026",
            },
            {
              id: "promotions",
              icon: "🔥",
              label: "Promotions en cours",
              desc: "Offres exclusives du moment",
            },
            {
              id: "mon_compte",
              icon: "👤",
              label: "Mon compte",
              desc: "Téléphone, adresse, livraison express",
            },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setOnglet(item.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#fff",
                marginHorizontal: 16,
                marginBottom: 10,
                borderRadius: 18,
                padding: 18,
                shadowColor: "#0A2463",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: "#EAF2FF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: "bold", color: "#05102A" }}
                >
                  {item.label}
                </Text>
                <Text style={{ fontSize: 12, color: "#8AAABF", marginTop: 2 }}>
                  {item.desc}
                </Text>
              </View>
              <Text style={{ fontSize: 22, color: "#8AAABF" }}>›</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      <View style={s.navBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={s.navBtn}
            onPress={() => setOnglet(tab.id)}
          >
            <Text style={s.navIcon}>{tab.icon}</Text>
            <Text style={[s.navLabel, onglet === tab.id && s.navLabelActif]}>
              {tab.label}
            </Text>
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
  loginContainer: {
    flexGrow: 1,
    backgroundColor: "#05102A",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: "#1A6FFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoEmoji: { fontSize: 42 },
  logoTitre: {
    fontSize: 44,
    color: "#FFD080",
    letterSpacing: 10,
    fontWeight: "bold",
  },
  logoSous: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 6,
    marginBottom: 32,
  },
  form: { width: "100%", maxWidth: 360 },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 15,
    fontSize: 14,
    color: "#E8F4FF",
    marginBottom: 12,
  },
  bouton: {
    backgroundColor: "#1A6FFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  boutonTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  erreur: {
    color: "#FFD080",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
  demo: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 16,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    width: "100%",
    maxWidth: 360,
  },
  toggleBtn: { flex: 1, padding: 11, borderRadius: 14, alignItems: "center" },
  toggleBtnActif: { backgroundColor: "#1A6FFF" },
  toggleTxt: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600",
  },
  toggleTxtActif: { color: "#fff", fontWeight: "bold" },
  rowInputs: { flexDirection: "row" },
  genreLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 10,
    letterSpacing: 1,
  },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  genreBtn: {
    width: "30%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  genreBtnActif: { backgroundColor: "#1A6FFF", borderColor: "#1A6FFF" },
  genreEmoji: { fontSize: 22, marginBottom: 4 },
  genreTxt: { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "600" },
  genreTxtActif: { color: "#fff" },
  header: {
    backgroundColor: "#05102A",
    paddingTop: Platform.OS === "ios" ? 54 : 44,
    paddingBottom: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#1A6FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogoTxt: { fontSize: 17 },
  headerDSM: {
    fontSize: 17,
    color: "#FFD080",
    fontWeight: "bold",
    letterSpacing: 3,
    lineHeight: 19,
  },
  headerSous: {
    fontSize: 7,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 3,
  },
  headerPts: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerPtsTxt: { color: "#FFD080", fontSize: 12, fontWeight: "bold" },
  ongletContainer: { flex: 1, backgroundColor: "#F5F7FF" },
  sectionTitre: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#05102A",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  achatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginBottom: 10,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#0A2463",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  achatEmoji: { fontSize: 28 },
  achatTitre: { fontSize: 13, fontWeight: "bold", color: "#05102A" },
  achatAuteur: { fontSize: 11, color: "#8AAABF", marginTop: 2 },
  achatPts: { fontSize: 15, fontWeight: "bold", color: "#F5A623" },
  boutiqueHeader: {
    backgroundColor: "#05102A",
    padding: 16,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  boutiqueTitre: { fontSize: 19, color: "#FFD080", fontWeight: "bold" },
  panierBtn: {
    backgroundColor: "#1A6FFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  panierBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  rechercheBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rechercheInput: { flex: 1, fontSize: 14, color: "#05102A" },
  panierBox: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  panierVide: {
    fontSize: 13,
    color: "#8AAABF",
    textAlign: "center",
    padding: 10,
  },
  panierItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4FF",
    gap: 10,
  },
  panierEmoji: { fontSize: 20 },
  validerBtn: {
    backgroundColor: "#1A6FFF",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  validerTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  livresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 14 },
  livreCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0A2463",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  livreEmoji: { fontSize: 34, textAlign: "center", marginBottom: 10 },
  livreTitre: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#05102A",
    textAlign: "center",
    marginBottom: 2,
  },
  livreAuteur: {
    fontSize: 10,
    color: "#8AAABF",
    textAlign: "center",
    marginBottom: 6,
  },
  livrePrix: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#05102A",
    textAlign: "center",
  },
  livrePts: {
    fontSize: 10,
    color: "#1A6FFF",
    textAlign: "center",
    marginBottom: 10,
  },
  ajouterBtn: {
    backgroundColor: "#05102A",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  ajouterTxt: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  detailHeader: {
    backgroundColor: "#05102A",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 44,
  },
  backBtn: { alignSelf: "flex-start" },
  detailHero: {
    backgroundColor: "#05102A",
    padding: 24,
    alignItems: "center",
    paddingBottom: 30,
  },
  detailEmoji: { fontSize: 64, marginBottom: 12 },
  detailTitre: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  detailAuteur: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 12,
  },
  detailBadgeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  detailBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  detailBadgeTxt: { fontSize: 11, color: "rgba(255,255,255,0.8)" },
  detailDescTitre: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#05102A",
    marginBottom: 8,
  },
  detailDesc: {
    fontSize: 14,
    color: "#8AAABF",
    lineHeight: 22,
    marginBottom: 20,
  },
  detailPrixBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  detailPrix: { fontSize: 26, fontWeight: "bold", color: "#05102A" },
  detailAcheterBtn: {
    backgroundColor: "#05102A",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  detailAcheterTxt: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  detailWhatsappBtn: {
    backgroundColor: "#25D366",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  detailWhatsappTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  anniversaireBanner: {
    backgroundColor: "#F5A623",
    margin: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  anniversaireEmoji: { fontSize: 32 },
  anniversaireTitre: { fontSize: 15, fontWeight: "bold", color: "#1a1a00" },
  anniversaireSous: { fontSize: 12, color: "rgba(0,0,0,0.6)", marginTop: 2 },
  offresHeader: { backgroundColor: "#05102A", padding: 20, paddingTop: 14 },
  offresTitre: { fontSize: 22, color: "#FFD080", fontWeight: "bold" },
  offresSous: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 },
  offreCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  offreIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  offreTitre: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  offreDesc: { fontSize: 12, color: "#8AAABF", marginTop: 2 },
  offreBtn: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 7 },
  offreBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  niveauCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  niveauRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4FF",
  },
  niveauBadge: {
    backgroundColor: "#1A6FFF",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  niveauBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  classementHeader: { backgroundColor: "#05102A", padding: 20, paddingTop: 14 },
  classementTitre: { fontSize: 22, color: "#FFD080", fontWeight: "bold" },
  classementSous: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    marginTop: 4,
  },
  classementItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  classementItemMe: {
    backgroundColor: "#EEF5FF",
    borderWidth: 2,
    borderColor: "#1A6FFF",
  },
  classementRang: { fontSize: 22, width: 36, textAlign: "center" },
  classementAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A6FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  classementNom: { fontSize: 14, fontWeight: "bold", color: "#05102A" },
  classementNiveau: { fontSize: 11, color: "#8AAABF", marginTop: 2 },
  classementPts: { fontSize: 15, fontWeight: "bold", color: "#F5A623" },
  profilHeader: {
    backgroundColor: "#05102A",
    padding: 32,
    alignItems: "center",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#1A6FFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarTxt: { fontSize: 26, color: "#fff", fontWeight: "bold" },
  profilNom: { fontSize: 24, color: "#fff", fontWeight: "bold" },
  profilSous: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 },
  whatsappBtn: {
    backgroundColor: "#25D366",
    borderRadius: 99,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 14,
  },
  whatsappBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  profilItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0A2463",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  profilIcon: { fontSize: 22 },
  profilLabel: { fontSize: 10, color: "#8AAABF", letterSpacing: 0.5 },
  profilVal: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#05102A",
    marginTop: 2,
  },
  decoBtn: {
    backgroundColor: "#05102A",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  decoBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  navBar: {
    flexDirection: "row",
    backgroundColor: "#05102A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    paddingTop: 10,
  },
  navBtn: { flex: 1, alignItems: "center", gap: 3, position: "relative" },
  navIcon: { fontSize: 20 },
  navLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  navLabelActif: { color: "#FFD080" },
  navIndicator: {
    position: "absolute",
    top: -10,
    width: 32,
    height: 2,
    backgroundColor: "#1A6FFF",
    borderRadius: 99,
  },
  notifsHeader: {
    backgroundColor: "#05102A",
    padding: 16,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notifsTitre: { fontSize: 19, color: "#FFD080", fontWeight: "bold" },
  lireTout: { color: "#1A6FFF", fontSize: 12, fontWeight: "bold" },
  notifCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  notifCardNonLu: {
    backgroundColor: "#EEF5FF",
    borderLeftWidth: 3,
    borderLeftColor: "#1A6FFF",
  },
  notifIcon: { fontSize: 22 },
  notifTitre: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#8AAABF",
    marginBottom: 2,
  },
  notifMsg: { fontSize: 12, color: "#8AAABF", lineHeight: 18 },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1A6FFF",
    alignSelf: "flex-start",
    marginTop: 4,
  },
  soldeBloc: {
    margin: 16,
    backgroundColor: "#05102A",
    borderRadius: 22,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  soldeTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  soldeLbl: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 4 },
  soldeVal: { fontSize: 34, color: "#FFD080", fontWeight: "bold" },
  soldeUnderline: {
    height: 3,
    width: 80,
    backgroundColor: "#FFD080",
    borderRadius: 2,
    marginTop: 4,
  },
  dsmCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFD080",
    alignItems: "center",
    justifyContent: "center",
  },
  dsmCircleTxt: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#05102A",
    letterSpacing: 1,
  },
  soldeSep: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  gainsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  gainsLbl: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "bold",
    flex: 1,
  },
  gainsVal: { fontSize: 13, color: "#fff", fontWeight: "bold" },
  dontTxt: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "bold",
    marginBottom: 4,
  },
  gainsSubLbl: { fontSize: 12, color: "rgba(255,255,255,0.6)", flex: 1 },
  historiqueBtn: {
    backgroundColor: "#F5A623",
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    gap: 8,
  },
  historiqueBtnTxt: { fontSize: 15, fontWeight: "bold", color: "#1a1a00" },
  historiqueIco: { fontSize: 18 },
  barcodeBloc: {
    marginHorizontal: 16,
    backgroundColor: "#EAF2FF",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    padding: 18,
    shadowColor: "#0A2463",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  menuIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLbl: { flex: 1, fontSize: 15, fontWeight: "bold", color: "#05102A" },
  menuArrow: { fontSize: 22, color: "#8AAABF", fontWeight: "bold" },
  ticketModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  ticketContainer: {
    backgroundColor: "#fff",
    width: 290,
    borderRadius: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  ticketHeader: {
    backgroundColor: "#05102A",
    padding: 18,
    alignItems: "center",
  },
  ticketLogo: {
    fontSize: 14,
    color: "#FFD080",
    fontWeight: "bold",
    letterSpacing: 2,
  },
  ticketSous: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 3,
    marginTop: 2,
  },
  ticketDate: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 },
  ticketSep: {
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginVertical: 8,
    marginHorizontal: 16,
  },
  ticketItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  ticketNom: { fontSize: 13, fontWeight: "bold", color: "#05102A", flex: 1 },
  ticketPrix: { fontSize: 13, fontWeight: "bold", color: "#05102A" },
  ticketAuteur: {
    fontSize: 11,
    color: "#8AAABF",
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  ticketTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  ticketTotalLbl: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  ticketTotalVal: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  ticketPtsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  ticketPtsLbl: { fontSize: 12, color: "#8AAABF" },
  ticketPtsVal: { fontSize: 12, color: "#F5A623", fontWeight: "bold" },
  ticketMerci: {
    textAlign: "center",
    fontSize: 12,
    color: "#8AAABF",
    fontStyle: "italic",
    marginVertical: 10,
  },
  ticketFermer: {
    backgroundColor: "#05102A",
    margin: 16,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
  },
  ticketFermerTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
