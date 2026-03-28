import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { envoyerNotifClient, envoyerNotifLocale } from "../notifications";
import { supabase } from "../supabase";

const LIVRES = [
  { titre:"Les Misérables", auteur:"Victor Hugo", prix:18.9, emoji:"📗", genre:"Roman" },
  { titre:"L'Étranger", auteur:"Albert Camus", prix:8.5, emoji:"📘", genre:"Roman" },
  { titre:"Pars vite et reviens tard", auteur:"Fred Vargas", prix:9.2, emoji:"🔍", genre:"Policier" },
  { titre:"Dune", auteur:"Frank Herbert", prix:14.9, emoji:"🌑", genre:"Sci-Fi" },
  { titre:"Harry Potter T.1", auteur:"J.K. Rowling", prix:13.9, emoji:"🧙", genre:"Jeunesse" },
  { titre:"Le Petit Prince", auteur:"Saint-Exupéry", prix:7.5, emoji:"🌹", genre:"Jeunesse" },
];

/* ══════════════════════════════════════
   CODE-BARRES VISUEL
══════════════════════════════════════ */
function BarcodeVisuel({ numCarte }: { numCarte: string }) {
  const seed = (numCarte || "0000").toString();
  const bars: number[] = [];
  for (let i = 0; i < 60; i++) {
    const c = seed.charCodeAt(i % seed.length);
    bars.push(((c * (i + 3)) % 3) + 1);
  }
  return (
    <View style={{ alignItems:"center", paddingVertical:24 }}>
      <View style={{ flexDirection:"row", height:64, overflow:"hidden" }}>
        {bars.map((w, i) => (
          <View key={i} style={{
            width: w * 2, height: 64,
            backgroundColor: i % 2 === 0 ? "#111" : "#fff",
          }}/>
        ))}
      </View>
      <Text style={{ fontSize:13, letterSpacing:3, marginTop:8, color:"#333", fontWeight:"bold" }}>
        •••• •••• •••• {numCarte}
      </Text>
    </View>
  );
}

/* ══════════════════════════════════════
   ÉCRAN CONNEXION
══════════════════════════════════════ */
function EcranConnexion({ onLogin }: { onLogin: (c: any) => void }) {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(false);

  const connexion = async () => {
    if (!email || !mdp) { setErreur("❌ Remplissez tous les champs"); return; }
    setLoading(true); setErreur("");
    try {
      const { data, error } = await supabase.from("clients").select("*")
        .eq("email", email).eq("mdp", mdp).single();
      if (error || !data) setErreur("❌ Email ou mot de passe incorrect");
      else onLogin(data);
    } catch (e) { setErreur("❌ Erreur de connexion"); }
    setLoading(false);
  };

  return (
    <View style={s.loginContainer}>
      <View style={s.logoBox}><Text style={s.logoEmoji}>📚</Text></View>
      <Text style={s.logoTitre}>DSM</Text>
      <Text style={s.logoSous}>LIBRAIRIE</Text>
      <View style={s.form}>
        <TextInput style={s.input} placeholder="Email" placeholderTextColor="#7AAAD0"
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/>
        <TextInput style={s.input} placeholder="Mot de passe" placeholderTextColor="#7AAAD0"
          value={mdp} onChangeText={setMdp} secureTextEntry/>
        {erreur ? <Text style={s.erreur}>{erreur}</Text> : null}
        <TouchableOpacity style={s.bouton} onPress={connexion} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff"/> : <Text style={s.boutonTxt}>Se connecter →</Text>}
        </TouchableOpacity>
        <Text style={s.demo}>Demo : sophie@dsm.fr / 1234</Text>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════
   ONGLET ACCUEIL — STYLE MARJANE
══════════════════════════════════════ */
function OngletAccueil({ client }: { client: any }) {
  const [achats, setAchats] = useState<any[]>([]);
  const [showHistorique, setShowHistorique] = useState(false);

  useEffect(() => {
    supabase.from("achats").select("*").eq("client_id", client.id)
      .order("date_achat", { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setAchats(data); });
  }, [client.id]);

  const gains6mois = achats.reduce((sum, a) => sum + (a.points_gagnes || 0), 0);
  const solde = (client.points * 0.1).toFixed(2).replace(".", ",");
  const gainsDH = (gains6mois * 0.1).toFixed(2).replace(".", ",");

  return (
    <ScrollView style={s.ongletContainer} showsVerticalScrollIndicator={false}>
      {/* Bloc Solde */}
      <View style={s.soldeBloc}>
        <View style={s.soldeTopRow}>
          <View style={{ flex:1 }}>
            <Text style={s.soldeLbl}>Solde disponible ⓘ</Text>
            <Text style={s.soldeVal}>{solde} DH</Text>
            <View style={s.soldeUnderline}/>
          </View>
          <View style={s.dsmCircle}>
            <Text style={s.dsmCircleTxt}>DSM</Text>
          </View>
        </View>
        <View style={s.soldeSep}/>
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
        <TouchableOpacity style={s.historiqueBtn} onPress={() => setShowHistorique(!showHistorique)}>
          <Text style={s.historiqueBtnTxt}>Mon historique</Text>
          <Text style={s.historiqueIco}>🕐</Text>
        </TouchableOpacity>
      </View>

      {/* Historique */}
      {showHistorique && (
        <View style={{ paddingHorizontal:16, paddingBottom:8 }}>
          {achats.length === 0
            ? <Text style={{ textAlign:"center", color:"#7AAAD0", padding:16 }}>Aucun achat enregistré</Text>
            : achats.map((a, i) => (
              <View key={i} style={s.achatCard}>
                <Text style={s.achatEmoji}>📕</Text>
                <View style={{ flex:1 }}>
                  <Text style={s.achatTitre}>{a.titre}</Text>
                  <Text style={s.achatAuteur}>{a.auteur}</Text>
                </View>
                <Text style={s.achatPts}>+{a.points_gagnes} pts</Text>
              </View>
            ))
          }
        </View>
      )}

      {/* Code-barres */}
      <View style={s.barcodeBloc}>
        <BarcodeVisuel numCarte={client.num_carte}/>
      </View>

      {/* Menu actions */}
      {[
        { icon:"🎁", label:"Avantages Carte DSM" },
        { icon:"⭐", label:"Mes offres en cours" },
        { icon:"🏆", label:"Mon niveau fidélité" },
        { icon:"🤝", label:"Parrainer un proche" },
      ].map((item, i) => (
        <TouchableOpacity key={i} style={s.menuItem}>
          <View style={s.menuIconWrap}>
            <Text style={{ fontSize:20 }}>{item.icon}</Text>
          </View>
          <Text style={s.menuLbl}>{item.label}</Text>
          <Text style={s.menuArrow}>›</Text>
        </TouchableOpacity>
      ))}
      <View style={{ height:20 }}/>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   ONGLET BOUTIQUE
══════════════════════════════════════ */
function OngletBoutique({ client, onAchat }: { client: any; onAchat: (pts: number) => void }) {
  const [panier, setPanier] = useState<any[]>([]);
  const [showPanier, setShowPanier] = useState(false);
  const [loading, setLoading] = useState(false);
  const total = panier.reduce((a, b) => a + b.prix, 0);
  const pts = Math.round(total * 10);

  const valider = async () => {
    if (panier.length === 0) return;
    setLoading(true);
    try {
      await supabase.from("achats").insert(panier.map(l => ({
        client_id: client.id, titre: l.titre, auteur: l.auteur,
        prix: l.prix, points_gagnes: Math.round(l.prix * 10),
      })));
      const newPoints = client.points + pts;
      const newNiveau = newPoints >= 2000 ? "Platine" : newPoints >= 1000 ? "Gold" : newPoints >= 500 ? "Silver" : "Bronze";
      await supabase.from("clients").update({ points: newPoints, niveau: newNiveau }).eq("id", client.id);
      onAchat(pts);
      setPanier([]); setShowPanier(false);
      alert(`✅ Commande validée ! +${pts} points fidélité !`);
    } catch (e) { alert("❌ Erreur lors de la commande"); }
    setLoading(false);
  };

  return (
    <View style={s.ongletContainer}>
      <View style={s.boutiqueHeader}>
        <Text style={s.boutiqueTitre}>🛍️ Boutique DSM</Text>
        <TouchableOpacity style={s.panierBtn} onPress={() => setShowPanier(!showPanier)}>
          <Text style={s.panierBtnTxt}>🛒 {panier.length}</Text>
        </TouchableOpacity>
      </View>
      {showPanier && (
        <View style={s.panierBox}>
          {panier.length === 0 ? <Text style={s.panierVide}>Panier vide</Text> : <>
            {panier.map((livre, i) => (
              <View key={i} style={s.panierItem}>
                <Text style={s.panierEmoji}>{livre.emoji}</Text>
                <Text style={{ flex:1, color:"#040D2A", fontSize:13 }}>{livre.titre}</Text>
                <Text style={{ color:"#0A2463", fontWeight:"bold" }}>{livre.prix.toFixed(2)} DH</Text>
              </View>
            ))}
            <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:10 }}>
              <Text style={{ fontSize:15, fontWeight:"bold", color:"#0A2463" }}>Total : {total.toFixed(2)} DH</Text>
              <Text style={{ fontSize:13, color:"#2E86FF", fontWeight:"bold" }}>+{pts} pts</Text>
            </View>
            <TouchableOpacity style={s.validerBtn} onPress={valider} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff"/> : <Text style={s.validerTxt}>✅ Valider la commande</Text>}
            </TouchableOpacity>
          </>}
        </View>
      )}
      <ScrollView>
        <View style={s.livresGrid}>
          {LIVRES.map((livre, i) => (
            <View key={i} style={s.livreCard}>
              <Text style={s.livreEmoji}>{livre.emoji}</Text>
              <Text style={s.livreTitre}>{livre.titre}</Text>
              <Text style={s.livreAuteur}>{livre.auteur}</Text>
              <Text style={s.livrePrix}>{livre.prix.toFixed(2)} DH</Text>
              <Text style={s.livrePts}>+{Math.round(livre.prix * 10)} pts</Text>
              <TouchableOpacity style={s.ajouterBtn} onPress={() => setPanier(p => [...p, livre])}>
                <Text style={s.ajouterTxt}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ══════════════════════════════════════
   ONGLET NOTIFICATIONS
══════════════════════════════════════ */
function OngletNotifs({ client }: { client: any }) {
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("notifications").select("*").eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setNotifs(data); });
  }, [client.id]);

  const lire = async (id: number) => {
    await supabase.from("notifications").update({ lu: true }).eq("id", id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, lu: true } : x));
  };

  const lireTout = async () => {
    await supabase.from("notifications").update({ lu: true }).eq("client_id", client.id);
    setNotifs(n => n.map(x => ({ ...x, lu: true })));
  };

  const nonLus = notifs.filter(n => !n.lu).length;

  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.notifsHeader}>
        <Text style={s.notifsTitre}>🔔 Notifications</Text>
        {nonLus > 0 && <TouchableOpacity onPress={lireTout}><Text style={s.lireTout}>Tout lire ({nonLus})</Text></TouchableOpacity>}
      </View>
      <View style={{ padding:12 }}>
        {notifs.length === 0
          ? <Text style={{ textAlign:"center", color:"#7AAAD0", padding:30 }}>Aucune notification</Text>
          : notifs.map(n => (
            <TouchableOpacity key={n.id} onPress={() => lire(n.id)} style={[s.notifCard, !n.lu && s.notifCardNonLu]}>
              <Text style={s.notifIcon}>🔔</Text>
              <View style={{ flex:1 }}>
                <Text style={[s.notifTitre, !n.lu && { color:"#040D2A" }]}>{n.titre}</Text>
                <Text style={s.notifMsg}>{n.message}</Text>
              </View>
              {!n.lu && <View style={s.notifDot}/>}
            </TouchableOpacity>
          ))
        }
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   ONGLET PARRAINAGE
══════════════════════════════════════ */
function OngletParrain({ client }: { client: any }) {
  const [copie, setCopie] = useState(false);
  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.parrainHeader}>
        <Text style={s.parrainTitre}>🤝 Parrainage DSM</Text>
        <Text style={s.parrainSous}>Invitez vos proches et gagnez des points !</Text>
      </View>
      <View style={{ padding:16 }}>
        <View style={s.codeBox}>
          <Text style={s.codeLabel}>MON CODE PARRAIN</Text>
          <Text style={s.codeVal}>{client.num_carte}</Text>
          <TouchableOpacity style={s.copierBtn} onPress={() => { setCopie(true); setTimeout(() => setCopie(false), 2000); }}>
            <Text style={s.copierTxt}>{copie ? "✓ Copié !" : "📋 Copier le code"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.sectionTitre}>🎁 Vos avantages</Text>
        {[
          { icon:"👤", titre:"Par filleul parrainé", val:"+200 pts pour vous" },
          { icon:"🎉", titre:"Bonus pour le filleul", val:"+100 pts offerts" },
          { icon:"🏆", titre:"3 filleuls = cadeau", val:"1 livre offert" },
        ].map((av, i) => (
          <View key={i} style={s.avantageCard}>
            <Text style={s.avantageIcon}>{av.icon}</Text>
            <View style={{ flex:1 }}>
              <Text style={s.avantageTitre}>{av.titre}</Text>
              <Text style={s.avantageVal}>{av.val}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   ONGLET PROFIL
══════════════════════════════════════ */
function OngletProfil({ client, onDeconnexion }: { client: any; onDeconnexion: () => void }) {
  return (
    <ScrollView style={s.ongletContainer}>
      <View style={s.profilHeader}>
        <View style={s.avatar}><Text style={s.avatarTxt}>{client.prenom[0]}{client.nom[0]}</Text></View>
        <Text style={s.profilNom}>{client.prenom} {client.nom}</Text>
        <Text style={s.profilSous}>Membre {client.niveau} · {client.points} pts</Text>
      </View>
      <View style={{ padding:16 }}>
        {[
          { icon:"📚", label:"Genre favori", val: client.genre_favori },
          { icon:"✍️", label:"Auteur favori", val: client.auteur_favori },
          { icon:"💳", label:"N° carte", val:`•••• ${client.num_carte}` },
          { icon:"🏆", label:"Niveau", val: client.niveau },
          { icon:"⭐", label:"Points", val:`${client.points} pts` },
          { icon:"💰", label:"Solde", val:`${(client.points * 0.1).toFixed(2)} DH` },
        ].map((info, i) => (
          <View key={i} style={s.profilItem}>
            <Text style={s.profilIcon}>{info.icon}</Text>
            <View style={{ flex:1 }}>
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
  const notifListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!client) return;
    try {
      notifListener.current = Notifications.addNotificationReceivedListener(
        notif => console.log("Notification reçue:", notif)
      );
      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        () => setOnglet("notifs")
      );
    } catch(e) { console.log("Notifications non disponibles sur web"); }
    return () => {
      try {
        if (notifListener.current) Notifications.removeNotificationSubscription(notifListener.current);
        if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
      } catch(e) {}
    };
  }, [client?.id]);

  const addPoints = (pts: number) => {
    setClient((c: any) => ({ ...c, points: c.points + pts }));
    try { envoyerNotifLocale("🎉 Points ajoutés !", `+${pts} points fidélité ajoutés à votre carte DSM !`); } catch(e) {}
    if (client) envoyerNotifClient(client.id, "🎉 Points ajoutés !", `+${pts} points fidélité ajoutés à votre carte DSM !`);
  };

  if (!client) return <EcranConnexion onLogin={setClient}/>;

  return (
    <View style={{ flex:1, backgroundColor:"#F4F8FF" }}>
      <View style={s.header}>
        <View style={s.headerLogo}><Text style={s.headerLogoTxt}>📚</Text></View>
        <View>
          <Text style={s.headerDSM}>DSM</Text>
          <Text style={s.headerSous}>LIBRAIRIE</Text>
        </View>
        <View style={{ flex:1 }}/>
        <View style={s.headerPts}>
          <Text style={s.headerPtsTxt}>⭐ {client.points} pts</Text>
        </View>
      </View>

      {onglet === "accueil"  && <OngletAccueil client={client}/>}
      {onglet === "boutique" && <OngletBoutique client={client} onAchat={addPoints}/>}
      {onglet === "notifs"   && <OngletNotifs client={client}/>}
      {onglet === "parrain"  && <OngletParrain client={client}/>}
      {onglet === "profil"   && <OngletProfil client={client} onDeconnexion={() => setClient(null)}/>}

      <View style={s.navBar}>
        {[
          { id:"accueil",  icon:"🏠", label:"Accueil"  },
          { id:"boutique", icon:"🛍️", label:"Boutique" },
          { id:"notifs",   icon:"🔔", label:"Alertes"  },
          { id:"parrain",  icon:"🤝", label:"Parrain"  },
          { id:"profil",   icon:"👤", label:"Profil"   },
        ].map(tab => (
          <TouchableOpacity key={tab.id} style={s.navBtn} onPress={() => setOnglet(tab.id)}>
            <Text style={s.navIcon}>{tab.icon}</Text>
            <Text style={[s.navLabel, onglet === tab.id && s.navLabelActif]}>{tab.label}</Text>
            {onglet === tab.id && <View style={s.navIndicator}/>}
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
  loginContainer: { flex:1, backgroundColor:"#061440", alignItems:"center", justifyContent:"center", padding:24 },
  logoBox: { width:80, height:80, borderRadius:22, backgroundColor:"#2E86FF", alignItems:"center", justifyContent:"center", marginBottom:14 },
  logoEmoji: { fontSize:40 },
  logoTitre: { fontSize:40, color:"#FFD080", letterSpacing:8, fontWeight:"bold" },
  logoSous: { fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:5, marginBottom:32 },
  form: { width:"100%", maxWidth:340 },
  input: { backgroundColor:"#0A1A3A", borderWidth:1.5, borderColor:"#1A3A6A", borderRadius:12, padding:14, fontSize:14, color:"#E8F4FF", marginBottom:12 },
  bouton: { backgroundColor:"#2E86FF", borderRadius:14, padding:15, alignItems:"center", marginTop:4 },
  boutonTxt: { color:"#fff", fontSize:16, fontWeight:"bold", letterSpacing:1 },
  erreur: { color:"#FFD080", fontSize:13, textAlign:"center", marginBottom:10 },
  demo: { color:"rgba(255,255,255,0.3)", fontSize:11, textAlign:"center", marginTop:16 },
  header: { backgroundColor:"#061440", paddingTop:44, paddingBottom:12, paddingHorizontal:16, flexDirection:"row", alignItems:"center", gap:10 },
  headerLogo: { width:32, height:32, borderRadius:9, backgroundColor:"#2E86FF", alignItems:"center", justifyContent:"center" },
  headerLogoTxt: { fontSize:16 },
  headerDSM: { fontSize:16, color:"#FFD080", fontWeight:"bold", letterSpacing:3, lineHeight:18 },
  headerSous: { fontSize:7, color:"rgba(255,255,255,0.4)", letterSpacing:3 },
  headerPts: { backgroundColor:"rgba(255,255,255,0.1)", borderRadius:99, paddingHorizontal:12, paddingVertical:5 },
  headerPtsTxt: { color:"#FFD080", fontSize:12, fontWeight:"bold" },
  ongletContainer: { flex:1 },
  sectionTitre: { fontSize:17, fontWeight:"bold", color:"#0A2463", marginHorizontal:16, marginBottom:10 },
  achatCard: { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", marginBottom:10, borderRadius:14, padding:14, borderWidth:1, borderColor:"#E0EDFF", gap:12 },
  achatEmoji: { fontSize:28 },
  achatTitre: { fontSize:13, fontWeight:"bold", color:"#040D2A" },
  achatAuteur: { fontSize:11, color:"#7AAAD0", marginTop:2 },
  achatPts: { fontSize:15, fontWeight:"bold", color:"#F5A623" },
  boutiqueHeader: { backgroundColor:"#061440", padding:16, paddingTop:12, flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  boutiqueTitre: { fontSize:18, color:"#FFD080", fontWeight:"bold" },
  panierBtn: { backgroundColor:"#2E86FF", borderRadius:12, paddingHorizontal:14, paddingVertical:8 },
  panierBtnTxt: { color:"#fff", fontWeight:"bold", fontSize:14 },
  panierBox: { backgroundColor:"#fff", margin:12, borderRadius:16, padding:16, borderWidth:1, borderColor:"#E0EDFF" },
  panierVide: { fontSize:13, color:"#7AAAD0", textAlign:"center", padding:10 },
  panierItem: { flexDirection:"row", alignItems:"center", paddingVertical:6, borderBottomWidth:1, borderBottomColor:"#E0EDFF", gap:10 },
  panierEmoji: { fontSize:20 },
  validerBtn: { backgroundColor:"#0A2463", borderRadius:12, padding:13, alignItems:"center", marginTop:10 },
  validerTxt: { color:"#fff", fontWeight:"bold", fontSize:14 },
  livresGrid: { flexDirection:"row", flexWrap:"wrap", gap:10, padding:12 },
  livreCard: { width:"47%", backgroundColor:"#fff", borderRadius:16, padding:14, borderWidth:1, borderColor:"#E0EDFF" },
  livreEmoji: { fontSize:32, textAlign:"center", marginBottom:8 },
  livreTitre: { fontSize:12, fontWeight:"bold", color:"#040D2A", textAlign:"center", marginBottom:2 },
  livreAuteur: { fontSize:10, color:"#7AAAD0", textAlign:"center", marginBottom:6 },
  livrePrix: { fontSize:16, fontWeight:"bold", color:"#0A2463", textAlign:"center" },
  livrePts: { fontSize:10, color:"#2E86FF", textAlign:"center", marginBottom:8 },
  ajouterBtn: { backgroundColor:"#0A2463", borderRadius:10, padding:9, alignItems:"center" },
  ajouterTxt: { color:"#fff", fontSize:12, fontWeight:"bold" },
  profilHeader: { backgroundColor:"#061440", padding:30, alignItems:"center" },
  avatar: { width:72, height:72, borderRadius:36, backgroundColor:"#2E86FF", alignItems:"center", justifyContent:"center", marginBottom:12 },
  avatarTxt: { fontSize:24, color:"#fff", fontWeight:"bold" },
  profilNom: { fontSize:22, color:"#fff", fontWeight:"bold" },
  profilSous: { fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:4 },
  profilItem: { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderRadius:14, padding:14, marginBottom:10, borderWidth:1, borderColor:"#E0EDFF", gap:12 },
  profilIcon: { fontSize:22 },
  profilLabel: { fontSize:10, color:"#7AAAD0", letterSpacing:0.5 },
  profilVal: { fontSize:14, fontWeight:"bold", color:"#0A2463", marginTop:2 },
  decoBtn: { backgroundColor:"#061440", borderRadius:14, padding:15, alignItems:"center", marginTop:10 },
  decoBtnTxt: { color:"#fff", fontSize:15, fontWeight:"bold" },
  navBar: { flexDirection:"row", backgroundColor:"#061440", borderTopWidth:2, borderTopColor:"rgba(46,134,255,0.2)", paddingBottom:20, paddingTop:8 },
  navBtn: { flex:1, alignItems:"center", gap:2, position:"relative" },
  navIcon: { fontSize:20 },
  navLabel: { fontSize:9, color:"rgba(255,255,255,0.4)", fontWeight:"600", letterSpacing:0.5 },
  navLabelActif: { color:"#FFD080", fontWeight:"bold" },
  navIndicator: { position:"absolute", top:-8, width:30, height:2, backgroundColor:"#2E86FF", borderRadius:99 },
  notifsHeader: { backgroundColor:"#061440", padding:16, paddingTop:12, flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  notifsTitre: { fontSize:18, color:"#FFD080", fontWeight:"bold" },
  lireTout: { color:"#2E86FF", fontSize:12, fontWeight:"bold" },
  notifCard: { backgroundColor:"#fff", borderRadius:14, padding:14, marginBottom:10, flexDirection:"row", gap:12, borderWidth:1, borderColor:"#E0EDFF" },
  notifCardNonLu: { backgroundColor:"#EEF5FF", borderColor:"#2E86FF" },
  notifIcon: { fontSize:22 },
  notifTitre: { fontSize:13, fontWeight:"bold", color:"#4A6080", marginBottom:2 },
  notifMsg: { fontSize:12, color:"#7AAAD0", lineHeight:18 },
  notifDot: { width:8, height:8, borderRadius:4, backgroundColor:"#2E86FF", alignSelf:"flex-start", marginTop:4 },
  parrainHeader: { backgroundColor:"#061440", padding:20, paddingTop:12 },
  parrainTitre: { fontSize:20, color:"#FFD080", fontWeight:"bold" },
  parrainSous: { fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:4 },
  codeBox: { backgroundColor:"#0A2463", borderRadius:18, padding:20, alignItems:"center", marginBottom:20 },
  codeLabel: { fontSize:10, color:"rgba(255,255,255,0.5)", letterSpacing:2, marginBottom:8 },
  codeVal: { fontSize:28, color:"#FFD080", fontWeight:"bold", letterSpacing:6, marginBottom:14 },
  copierBtn: { backgroundColor:"rgba(255,255,255,0.1)", borderRadius:99, paddingHorizontal:20, paddingVertical:8, borderWidth:1, borderColor:"rgba(255,255,255,0.2)" },
  copierTxt: { color:"#fff", fontWeight:"bold", fontSize:13 },
  avantageCard: { backgroundColor:"#fff", borderRadius:14, padding:14, marginBottom:10, flexDirection:"row", gap:12, borderWidth:1, borderColor:"#E0EDFF", alignItems:"center" },
  avantageIcon: { fontSize:24 },
  avantageTitre: { fontSize:13, color:"#040D2A", fontWeight:"600" },
  avantageVal: { fontSize:12, color:"#2E86FF", fontWeight:"bold", marginTop:2 },
  // Style Marjane
  soldeBloc: { margin:16, backgroundColor:"#0A2463", borderRadius:20, padding:22 },
  soldeTopRow: { flexDirection:"row", alignItems:"flex-start", marginBottom:16 },
  soldeLbl: { fontSize:13, color:"rgba(255,255,255,0.8)", marginBottom:4 },
  soldeVal: { fontSize:32, color:"#FFD080", fontWeight:"bold" },
  soldeUnderline: { height:3, width:80, backgroundColor:"#FFD080", borderRadius:2, marginTop:4 },
  dsmCircle: { width:50, height:50, borderRadius:25, backgroundColor:"#FFD080", alignItems:"center", justifyContent:"center" },
  dsmCircleTxt: { fontSize:11, fontWeight:"bold", color:"#0A2463", letterSpacing:1 },
  soldeSep: { height:1, backgroundColor:"rgba(255,255,255,0.15)", marginBottom:12 },
  gainsRow: { flexDirection:"row", justifyContent:"space-between", marginBottom:6 },
  gainsLbl: { fontSize:13, color:"rgba(255,255,255,0.9)", fontWeight:"bold", flex:1 },
  gainsVal: { fontSize:13, color:"#fff", fontWeight:"bold" },
  dontTxt: { fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:"bold", marginBottom:4 },
  gainsSubLbl: { fontSize:12, color:"rgba(255,255,255,0.7)", flex:1 },
  historiqueBtn: { backgroundColor:"#F5A623", borderRadius:30, paddingVertical:13, paddingHorizontal:24, flexDirection:"row", alignItems:"center", justifyContent:"center", marginTop:18, gap:8 },
  historiqueBtnTxt: { fontSize:15, fontWeight:"bold", color:"#1a1a00" },
  historiqueIco: { fontSize:18 },
  barcodeBloc: { marginHorizontal:16, backgroundColor:"#EAF2FF", borderRadius:16, borderWidth:1, borderColor:"#C0D8F0", overflow:"hidden", marginBottom:16 },
  menuItem: { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", marginHorizontal:16, marginBottom:10, borderRadius:14, padding:16, borderWidth:1, borderColor:"#E0EDFF", gap:14 },
  menuIconWrap: { width:42, height:42, borderRadius:12, backgroundColor:"#EAF2FF", alignItems:"center", justifyContent:"center" },
  menuLbl: { flex:1, fontSize:15, fontWeight:"bold", color:"#0A2463" },
  menuArrow: { fontSize:24, color:"#7AAAD0", fontWeight:"bold" },
});