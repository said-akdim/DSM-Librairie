import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { supabase } from "../supabase";

const PROMOTIONS = [
  { id:1, titre:"-30% sur la SF", desc:"Tous les livres Sci-Fi ce mois", emoji:"🚀", couleur:"#1A6FFF", expire:"31/03/2026", reduction:30 },
  { id:2, titre:"2 achetés = 1 offert", desc:"Sur toute la collection jeunesse", emoji:"🧙", couleur:"#27AE60", expire:"15/04/2026", reduction:33 },
  { id:3, titre:"-25% Romans policiers", desc:"Fred Vargas, Agatha Christie...", emoji:"🔍", couleur:"#9B59B6", expire:"20/04/2026", reduction:25 },
  { id:4, titre:"Livraison gratuite", desc:"Dès 150 DH d'achat", emoji:"🚚", couleur:"#F5A623", expire:"30/04/2026", reduction:0 },
];

const LIVRAISON_STATUTS: Record<string, { label: string; couleur: string; emoji: string; etape: number }> = {
  en_attente:   { label:"Commande reçue",      couleur:"#8AAABF", emoji:"📦", etape:1 },
  confirmee:    { label:"Commande confirmée",  couleur:"#1A6FFF", emoji:"✅", etape:2 },
  preparation:  { label:"En préparation",      couleur:"#F5A623", emoji:"📚", etape:3 },
  en_livraison: { label:"En cours de livraison", couleur:"#9B59B6", emoji:"🚚", etape:4 },
  livre:        { label:"Livré",               couleur:"#27AE60", emoji:"🎉", etape:5 },
};

/* ══════════════════════════════════════
   COUPS DE CŒUR
══════════════════════════════════════ */
export function OngletCoupsCoeur({ client, livres, onAjouterPanier }: { client: any; livres: any[]; onAjouterPanier: (l: any) => void }) {
  const [coupsCoeur, setCoupsCoeur] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("coups_coeur").select("*").eq("client_id", client.id)
      .order("created_at", { ascending:false })
      .then(({ data }) => { if (data) setCoupsCoeur(data); setLoading(false); });
  }, [client.id]);

  const ajouterCoupCoeur = async (livre: any) => {
    const existe = coupsCoeur.find(c => c.livre_titre === livre.titre);
    if (existe) { Alert.alert("Déjà dans vos coups de cœur !"); return; }
    const { data } = await supabase.from("coups_coeur").insert({
      client_id:client.id, livre_titre:livre.titre,
      livre_auteur:livre.auteur, livre_emoji:livre.emoji, livre_prix:livre.prix,
    }).select().single();
    if (data) setCoupsCoeur(c => [data, ...c]);
    Alert.alert("❤️ Ajouté aux coups de cœur !");
  };

  const supprimerCoupCoeur = async (id: number) => {
    await supabase.from("coups_coeur").delete().eq("id", id);
    setCoupsCoeur(c => c.filter(x => x.id !== id));
  };

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>❤️ Mes Coups de Cœur</Text>
        <Text style={es.headerSous}>Vos livres favoris sauvegardés</Text>
      </View>

      {/* Ajouter depuis catalogue */}
      <Text style={es.sectionTitre}>📚 Ajouter depuis le catalogue</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft:16, marginBottom:20 }}>
        {livres.map((livre, i) => (
          <TouchableOpacity key={i} style={es.livreHCard} onPress={() => ajouterCoupCoeur(livre)}>
            <Text style={{ fontSize:32, textAlign:"center", marginBottom:6 }}>{livre.emoji}</Text>
            <Text style={es.livreHCardTitre}>{livre.titre}</Text>
            <Text style={es.livreHCardAuteur}>{livre.auteur}</Text>
            <Text style={es.livreHCardPrix}>{livre.prix.toFixed(2)} DH</Text>
            <View style={es.heartBtn}><Text style={{ color:"#fff", fontSize:12, fontWeight:"bold" }}>❤️ Ajouter</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mes coups de cœur */}
      <Text style={es.sectionTitre}>❤️ Ma liste ({coupsCoeur.length})</Text>
      {loading ? <ActivityIndicator color="#1A6FFF" style={{ marginTop:20 }}/> :
        coupsCoeur.length === 0
          ? <View style={es.emptyBox}>
              <Text style={{ fontSize:40 }}>💔</Text>
              <Text style={es.emptyTxt}>Aucun coup de cœur encore</Text>
              <Text style={es.emptySous}>Ajoutez vos livres favoris ci-dessus</Text>
            </View>
          : coupsCoeur.map((c, i) => (
            <View key={i} style={es.coupCoeurCard}>
              <Text style={{ fontSize:32 }}>{c.livre_emoji}</Text>
              <View style={{ flex:1 }}>
                <Text style={es.coupCoeurTitre}>{c.livre_titre}</Text>
                <Text style={es.coupCoeurAuteur}>{c.livre_auteur}</Text>
                <Text style={es.coupCoeurPrix}>{c.livre_prix?.toFixed(2)} DH</Text>
              </View>
              <View style={{ gap:6 }}>
                <TouchableOpacity style={es.ajouterPanierBtn}
                  onPress={() => onAjouterPanier({ titre:c.livre_titre, auteur:c.livre_auteur, emoji:c.livre_emoji, prix:c.livre_prix })}>
                  <Text style={{ color:"#fff", fontSize:11, fontWeight:"bold" }}>🛒 Panier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={es.supprimerBtn} onPress={() => supprimerCoupCoeur(c.id)}>
                  <Text style={{ color:"#fff", fontSize:11 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
      }
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   BONS DE RÉDUCTION
══════════════════════════════════════ */
export function OngletBonsReduction({ client }: { client: any }) {
  const [bons, setBons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string|null>(null);

  useEffect(() => {
    supabase.from("bons_reduction").select("*").eq("client_id", client.id)
      .order("created_at", { ascending:false })
      .then(({ data }) => { if (data) setBons(data); setLoading(false); });
  }, [client.id]);

  const copier = (code: string) => {
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
    Alert.alert("📋 Code copié !", `Le code ${code} est prêt à être utilisé.`);
  };

  const bonsActifs = bons.filter(b => !b.utilise);
  const bonsUtilises = bons.filter(b => b.utilise);

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>🎟️ Mes Bons de Réduction</Text>
        <Text style={es.headerSous}>{bonsActifs.length} bon(s) disponible(s)</Text>
      </View>

      {loading ? <ActivityIndicator color="#1A6FFF" style={{ marginTop:40 }}/> : <>
        <Text style={es.sectionTitre}>✅ Bons actifs</Text>
        {bonsActifs.length === 0
          ? <View style={es.emptyBox}>
              <Text style={{ fontSize:40 }}>🎟️</Text>
              <Text style={es.emptyTxt}>Aucun bon disponible</Text>
              <Text style={es.emptySous}>Continuez vos achats pour en gagner !</Text>
            </View>
          : bonsActifs.map((bon, i) => (
            <View key={i} style={es.bonCard}>
              <View style={es.bonGauche}>
                <Text style={es.bonValeur}>{bon.valeur}%</Text>
                <Text style={es.bonType}>de réduction</Text>
              </View>
              <View style={{ flex:1, paddingHorizontal:14 }}>
                <Text style={es.bonCode}>{bon.code}</Text>
                <Text style={es.bonExpire}>
                  Expire le {bon.expire_le ? new Date(bon.expire_le).toLocaleDateString("fr-FR") : "—"}
                </Text>
              </View>
              <TouchableOpacity style={[es.copierBtn, copied===bon.code && es.copierBtnActif]}
                onPress={() => copier(bon.code)}>
                <Text style={{ color:"#fff", fontSize:11, fontWeight:"bold" }}>
                  {copied===bon.code ? "✓ Copié" : "📋 Copier"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        }

        {bonsUtilises.length > 0 && <>
          <Text style={[es.sectionTitre, { marginTop:8 }]}>✗ Bons utilisés</Text>
          {bonsUtilises.map((bon, i) => (
            <View key={i} style={[es.bonCard, { opacity:0.5 }]}>
              <View style={[es.bonGauche, { backgroundColor:"#ccc" }]}>
                <Text style={es.bonValeur}>{bon.valeur}%</Text>
                <Text style={es.bonType}>utilisé</Text>
              </View>
              <View style={{ flex:1, paddingHorizontal:14 }}>
                <Text style={[es.bonCode, { color:"#8AAABF" }]}>{bon.code}</Text>
                <Text style={es.bonExpire}>Bon utilisé</Text>
              </View>
            </View>
          ))}
        </>}
      </>}
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   SUIVI COMMANDES + EXPÉDITION
══════════════════════════════════════ */
export function OngletSuiviCommandes({ client }: { client: any }) {
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandeDetail, setCommandeDetail] = useState<any>(null);

  useEffect(() => {
    supabase.from("commandes").select("*").eq("client_id", client.id)
      .order("created_at", { ascending:false })
      .then(({ data }) => { if (data) setCommandes(data); setLoading(false); });
  }, [client.id]);

  if (commandeDetail) {
    const statut = LIVRAISON_STATUTS[commandeDetail.statut] || LIVRAISON_STATUTS.en_attente;
    const etapes = Object.values(LIVRAISON_STATUTS).sort((a,b) => a.etape - b.etape);
    return (
      <ScrollView style={es.container}>
        <TouchableOpacity style={es.backBtn} onPress={() => setCommandeDetail(null)}>
          <Text style={es.backBtnTxt}>‹ Retour</Text>
        </TouchableOpacity>
        <View style={es.header}>
          <Text style={es.headerTitre}>🚚 Suivi en temps réel</Text>
          <Text style={es.headerSous}>Commande #{commandeDetail.tracking_code}</Text>
        </View>

        {/* Statut actuel */}
        <View style={[es.statutBox, { borderLeftColor:statut.couleur }]}>
          <Text style={{ fontSize:40, marginBottom:8 }}>{statut.emoji}</Text>
          <Text style={[es.statutLabel, { color:statut.couleur }]}>{statut.label}</Text>
          {commandeDetail.date_livraison_prevue && (
            <Text style={es.statutDate}>
              Livraison prévue le {new Date(commandeDetail.date_livraison_prevue).toLocaleDateString("fr-FR")}
            </Text>
          )}
        </View>

        {/* Timeline */}
        <View style={{ padding:16 }}>
          <Text style={es.sectionTitre}>📍 Progression</Text>
          {etapes.map((etape, i) => {
            const atteint = etape.etape <= statut.etape;
            const courant = etape.etape === statut.etape;
            return (
              <View key={i} style={es.timelineItem}>
                <View style={[es.timelineDot, { backgroundColor:atteint?etape.couleur:"#E0EDFF" }, courant && es.timelineDotCourant]}>
                  <Text style={{ fontSize:14 }}>{atteint ? etape.emoji : "○"}</Text>
                </View>
                {i < etapes.length-1 && <View style={[es.timelineLine, { backgroundColor:atteint?"#1A6FFF":"#E0EDFF" }]}/>}
                <View style={{ flex:1, marginLeft:12 }}>
                  <Text style={[es.timelineLabel, { color:atteint?"#05102A":"#8AAABF", fontWeight:courant?"bold":"normal" }]}>
                    {etape.label}
                  </Text>
                  {courant && <Text style={{ fontSize:11, color:"#1A6FFF", marginTop:2 }}>← Position actuelle</Text>}
                </View>
              </View>
            );
          })}
        </View>

        {/* Infos livraison */}
        <View style={{ padding:16 }}>
          <Text style={es.sectionTitre}>📦 Détails</Text>
          {[
            {icon:"📍", label:"Adresse", val:commandeDetail.adresse_livraison||"Non définie"},
            {icon:"🚚", label:"Type", val:commandeDetail.type_livraison==="express"?"Express 24h":"Standard 3-5j"},
            {icon:"💰", label:"Total", val:`${commandeDetail.total?.toFixed(2)} DH`},
            {icon:"🔖", label:"Tracking", val:commandeDetail.tracking_code||"—"},
          ].map((item, i) => (
            <View key={i} style={es.detailRow}>
              <Text style={{ fontSize:20, marginRight:12 }}>{item.icon}</Text>
              <View style={{ flex:1 }}>
                <Text style={es.detailLabel}>{item.label}</Text>
                <Text style={es.detailVal}>{item.val}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>📦 Mes Commandes</Text>
        <Text style={es.headerSous}>{commandes.length} commande(s)</Text>
      </View>
      {loading ? <ActivityIndicator color="#1A6FFF" style={{ marginTop:40 }}/> :
        commandes.length === 0
          ? <View style={es.emptyBox}>
              <Text style={{ fontSize:40 }}>📭</Text>
              <Text style={es.emptyTxt}>Aucune commande</Text>
              <Text style={es.emptySous}>Vos commandes apparaîtront ici</Text>
            </View>
          : commandes.map((cmd, i) => {
            const statut = LIVRAISON_STATUTS[cmd.statut] || LIVRAISON_STATUTS.en_attente;
            return (
              <TouchableOpacity key={i} style={es.commandeCard} onPress={() => setCommandeDetail(cmd)}>
                <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom:8 }}>
                  <Text style={es.commandeCode}>#{cmd.tracking_code}</Text>
                  <View style={[es.statutBadge, { backgroundColor:statut.couleur+"20", borderColor:statut.couleur }]}>
                    <Text style={[es.statutBadgeTxt, { color:statut.couleur }]}>{statut.emoji} {statut.label}</Text>
                  </View>
                </View>
                <Text style={es.commandeTotal}>{cmd.total?.toFixed(2)} DH</Text>
                <Text style={es.commandeDate}>
                  {new Date(cmd.created_at).toLocaleDateString("fr-FR")} · {cmd.type_livraison==="express"?"🚀 Express":"📮 Standard"}
                </Text>
                <Text style={{ fontSize:12, color:"#1A6FFF", marginTop:6, fontWeight:"bold" }}>Voir le suivi →</Text>
              </TouchableOpacity>
            );
          })
      }
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   LISTES SCOLAIRES
══════════════════════════════════════ */
export function OngletListesScolaires({ onAjouterPanier }: { onAjouterPanier: (livres: any[]) => void }) {
  const [listes, setListes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listeOuverte, setListeOuverte] = useState<number|null>(null);

  useEffect(() => {
    supabase.from("listes_scolaires").select("*").order("niveau")
      .then(({ data }) => { if (data) setListes(data); setLoading(false); });
  }, []);

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>🎒 Listes Scolaires</Text>
        <Text style={es.headerSous}>Rentrée {new Date().getFullYear()}-{new Date().getFullYear()+1}</Text>
      </View>
      {loading ? <ActivityIndicator color="#1A6FFF" style={{ marginTop:40 }}/> :
        listes.map((liste, i) => {
          const livres = typeof liste.livres === "string" ? JSON.parse(liste.livres) : liste.livres;
          const ouvert = listeOuverte === i;
          const totalListe = livres?.reduce((a: number, l: any) => a + l.prix, 0) || 0;
          return (
            <View key={i} style={es.listeCard}>
              <TouchableOpacity style={es.listeHeader} onPress={() => setListeOuverte(ouvert ? null : i)}>
                <Text style={{ fontSize:28 }}>🎒</Text>
                <View style={{ flex:1, marginLeft:12 }}>
                  <Text style={es.listeTitre}>{liste.nom}</Text>
                  <Text style={es.listeSous}>{liste.niveau} · {livres?.length} livres · {totalListe.toFixed(2)} DH</Text>
                </View>
                <Text style={{ fontSize:20, color:"#1A6FFF" }}>{ouvert ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {ouvert && <>
                {livres?.map((livre: any, j: number) => (
                  <View key={j} style={es.listeLivreRow}>
                    <Text style={{ fontSize:22 }}>{livre.emoji}</Text>
                    <View style={{ flex:1, marginLeft:10 }}>
                      <Text style={es.listeLivreTitre}>{livre.titre}</Text>
                      <Text style={es.listeLivreAuteur}>{livre.auteur}</Text>
                    </View>
                    <Text style={es.listeLivrePrix}>{livre.prix.toFixed(2)} DH</Text>
                  </View>
                ))}
                <TouchableOpacity style={es.ajouterListeBtn} onPress={() => { onAjouterPanier(livres); Alert.alert("✅ Liste ajoutée au panier !"); }}>
                  <Text style={es.ajouterListeBtnTxt}>🛒 Ajouter toute la liste au panier</Text>
                </TouchableOpacity>
              </>}
            </View>
          );
        })
      }
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   PROMOTIONS EN COURS
══════════════════════════════════════ */
export function OngletPromotions({ client }: { client: any }) {
  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>🔥 Promotions en cours</Text>
        <Text style={es.headerSous}>Offres exclusives DSM</Text>
      </View>
      <View style={{ padding:16 }}>
        {PROMOTIONS.map((promo, i) => (
          <View key={i} style={[es.promoCard, { borderTopColor:promo.couleur }]}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:12, marginBottom:10 }}>
              <View style={[es.promoIconBox, { backgroundColor:promo.couleur }]}>
                <Text style={{ fontSize:28 }}>{promo.emoji}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={es.promoTitre}>{promo.titre}</Text>
                <Text style={es.promoDesc}>{promo.desc}</Text>
              </View>
              {promo.reduction > 0 && (
                <View style={[es.promoBadge, { backgroundColor:promo.couleur }]}>
                  <Text style={es.promoBadgeTxt}>-{promo.reduction}%</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
              <Text style={{ fontSize:11, color:"#8AAABF" }}>⏰ Expire le {promo.expire}</Text>
              <TouchableOpacity style={[es.promoBtn, { backgroundColor:promo.couleur }]}>
                <Text style={es.promoBtnTxt}>J'en profite →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Compte à rebours */}
        <View style={es.countdownBox}>
          <Text style={es.countdownTitre}>⏱️ Offre flash du jour</Text>
          <Text style={es.countdownDesc}>-40% sur une sélection de 50 livres</Text>
          <View style={es.countdownRow}>
            {[["02","h"],["45","m"],["30","s"]].map(([val, unit], i) => (
              <View key={i} style={es.countdownItem}>
                <Text style={es.countdownVal}>{val}</Text>
                <Text style={es.countdownUnit}>{unit}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={es.countdownBtn}>
            <Text style={es.countdownBtnTxt}>🔥 Voir les livres flash</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   VALIDATION COMMANDE
══════════════════════════════════════ */
export function EcranValidationCommande({
  panier, client, fraisLivraison, onConfirmer, onAnnuler
}: {
  panier: any[]; client: any; fraisLivraison: number;
  onConfirmer: (commande: any) => void; onAnnuler: () => void;
}) {
  const [typeLivraison, setTypeLivraison] = useState<"standard"|"express">("standard");
  const [modePaiement, setModePaiement] = useState<"espece"|"tpe"|null>(null);
  const [codePromo, setCodePromo] = useState("");
  const [promoAppliquee, setPromoAppliquee] = useState<any>(null);
  const [showPromo, setShowPromo] = useState(false);
  const [montantDonne, setMontantDonne] = useState("");
  const [adresseLivraison, setAdresseLivraison] = useState(client.adresse || "");
  const [loading, setLoading] = useState(false);

  const sousTotal = panier.reduce((a, b) => a + b.prix, 0);
  const fraisStandard = fraisLivraison || 15;
  const fraisExpress = Math.round(fraisStandard * 1.5 * 10) / 10;
  const fraisActuels = typeLivraison === "express" ? fraisExpress : fraisStandard;
  const fraisLivraisonGratuit = sousTotal >= 150;
  const fraisFinaux = fraisLivraisonGratuit ? 0 : fraisActuels;
  const remise = promoAppliquee ? (sousTotal * promoAppliquee.valeur / 100) : 0;
  const total = Math.max(0, sousTotal - remise + fraisFinaux);
  const monnaie = montantDonne ? Math.max(0, parseFloat(montantDonne) - total) : null;
  const pts = Math.round(sousTotal * 10);

  const appliquerPromo = async () => {
    if (!codePromo) return;
    const { data } = await supabase.from("bons_reduction")
      .select("*").eq("code", codePromo).eq("client_id", client.id)
      .eq("utilise", false).single();
    if (data) {
      setPromoAppliquee(data);
      Alert.alert("✅ Code appliqué !", `-${data.valeur}% de réduction !`);
    } else {
      Alert.alert("❌ Code invalide", "Ce code n'existe pas ou a déjà été utilisé.");
    }
  };

  const confirmerCommande = async () => {
    if (!modePaiement) { Alert.alert("❌", "Choisissez un moyen de paiement"); return; }
    if (!adresseLivraison) { Alert.alert("❌", "Ajoutez une adresse de livraison"); return; }
    if (modePaiement === "espece" && (!montantDonne || parseFloat(montantDonne) < total)) {
      Alert.alert("❌", `Le montant doit être au moins ${total.toFixed(2)} DH`); return;
    }
    setLoading(true);
    try {
      const trackingCode = `DSM-${Date.now().toString().slice(-6)}`;
      const { data: commande } = await supabase.from("commandes").insert({
        client_id: client.id,
        statut: "confirmee",
        total,
        adresse_livraison: adresseLivraison,
        type_livraison: typeLivraison,
        tracking_code: trackingCode,
        date_livraison_prevue: new Date(Date.now() + (typeLivraison==="express" ? 1 : 4) * 24*60*60*1000),
      }).select().single();

      if (commande) {
        await supabase.from("commande_items").insert(
          panier.map(l => ({ commande_id:commande.id, titre:l.titre, auteur:l.auteur, prix:l.prix, emoji:l.emoji, quantite:1 }))
        );
        if (promoAppliquee) {
          await supabase.from("bons_reduction").update({ utilise:true }).eq("id", promoAppliquee.id);
        }
        await supabase.from("notifications").insert({
          client_id: client.id,
          titre: "✅ Commande confirmée !",
          message: `Votre commande #${trackingCode} est confirmée. +${pts} pts fidélité !`,
          lu: false,
        });
        onConfirmer({ ...commande, monnaie, pts });
      }
    } catch(e) { Alert.alert("❌ Erreur", "Impossible de confirmer la commande"); }
    setLoading(false);
  };

  return (
    <ScrollView style={es.container}>
      {/* Header */}
      <View style={[es.header, { flexDirection:"row", alignItems:"center", gap:12 }]}>
        <TouchableOpacity onPress={onAnnuler}>
          <Text style={{ color:"#FFD080", fontSize:22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={es.headerTitre}>Passage en caisse</Text>
      </View>

      <View style={{ padding:16 }}>

        {/* Récapitulatif articles */}
        <Text style={es.sectionTitre}>🛒 Articles ({panier.length})</Text>
        <View style={es.commandeCard}>
          {panier.map((livre, i) => (
            <View key={i} style={[es.listeLivreRow, i>0 && { borderTopWidth:1, borderTopColor:"#F0F4FF" }]}>
              <Text style={{ fontSize:22 }}>{livre.emoji}</Text>
              <View style={{ flex:1, marginLeft:10 }}>
                <Text style={es.listeLivreTitre}>{livre.titre}</Text>
                <Text style={es.listeLivreAuteur}>{livre.auteur}</Text>
              </View>
              <Text style={es.listeLivrePrix}>{livre.prix.toFixed(2)} DH</Text>
            </View>
          ))}
        </View>

        {/* Adresse livraison */}
        <Text style={es.sectionTitre}>📍 Adresse de livraison</Text>
        <View style={es.compteCard}>
          <TextInput style={[es.compteInput, { marginBottom:0 }]}
            value={adresseLivraison} onChangeText={setAdresseLivraison}
            placeholder="Votre adresse complète" placeholderTextColor="#8AAABF" multiline/>
        </View>

        {/* Type livraison */}
        <Text style={es.sectionTitre}>🚚 Type de livraison</Text>
        <View style={{ flexDirection:"row", gap:10, marginHorizontal:16, marginBottom:16 }}>
          {[
            { id:"standard", label:"📮 Standard", desc:`3-5 jours · ${fraisLivraisonGratuit ? "Gratuit" : fraisStandard+" DH"}` },
            { id:"express", label:"⚡ Express", desc:`24h · ${fraisLivraisonGratuit ? "Gratuit" : fraisExpress+" DH"}` },
          ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTypeLivraison(t.id as any)}
              style={[es.livraisonTypeBtn, typeLivraison===t.id && es.livraisonTypeBtnActif]}>
              <Text style={[es.livraisonTypeLbl, typeLivraison===t.id && { color:"#fff" }]}>{t.label}</Text>
              <Text style={[{ fontSize:11, color:"#8AAABF", marginTop:2 }, typeLivraison===t.id && { color:"rgba(255,255,255,0.8)" }]}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Code promo */}
        <TouchableOpacity style={es.promoRow} onPress={() => setShowPromo(!showPromo)}>
          <Text style={{ fontSize:20 }}>🏷️</Text>
          <Text style={es.promoRowTxt}>
            {promoAppliquee ? `Code "${promoAppliquee.code}" appliqué ✅` : "Vous avez un code promo ?"}
          </Text>
          <Text style={{ color:"#1A6FFF", fontSize:18 }}>{showPromo ? "▲" : "›"}</Text>
        </TouchableOpacity>
        {showPromo && !promoAppliquee && (
          <View style={[es.compteCard, { flexDirection:"row", gap:10 }]}>
            <TextInput style={[es.compteInput, { flex:1, marginBottom:0 }]}
              value={codePromo} onChangeText={setCodePromo}
              placeholder="Ex: DSM-FIDELITE-20" placeholderTextColor="#8AAABF"
              autoCapitalize="characters"/>
            <TouchableOpacity style={es.appliquerBtn} onPress={appliquerPromo}>
              <Text style={es.appliquerBtnTxt}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Moyen de paiement */}
        <Text style={es.sectionTitre}>💳 Moyen de paiement</Text>
        <View style={{ flexDirection:"row", gap:10, marginHorizontal:16, marginBottom:16 }}>
          {[
            { id:"espece", label:"💵 Espèces", desc:"Paiement à la livraison" },
            { id:"tpe", label:"💳 TPE", desc:"Carte bancaire" },
          ].map(p => (
            <TouchableOpacity key={p.id} onPress={() => setModePaiement(p.id as any)}
              style={[es.paiementBtn, modePaiement===p.id && es.paiementBtnActif]}>
              <Text style={[es.paiementLbl, modePaiement===p.id && { color:"#fff" }]}>{p.label}</Text>
              <Text style={[{ fontSize:11, color:"#8AAABF", marginTop:2 }, modePaiement===p.id && { color:"rgba(255,255,255,0.8)" }]}>{p.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Montant donné (espèces uniquement) */}
        {modePaiement === "espece" && (
          <View style={es.especeBox}>
            <Text style={es.especeTitre}>💵 Combien vous donnez au livreur ?</Text>
            <Text style={es.especeSous}>Le livreur préparera la monnaie exacte</Text>
            <View style={{ flexDirection:"row", gap:10, flexWrap:"wrap", marginBottom:12 }}>
              {[Math.ceil(total/10)*10, Math.ceil(total/50)*50, Math.ceil(total/100)*100, Math.ceil(total/200)*200].filter((v,i,a)=>a.indexOf(v)===i).map(val => (
                <TouchableOpacity key={val} onPress={() => setMontantDonne(val.toString())}
                  style={[es.montantBtn, montantDonne===val.toString() && es.montantBtnActif]}>
                  <Text style={[es.montantBtnTxt, montantDonne===val.toString() && { color:"#fff" }]}>{val} DH</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={es.compteInput} value={montantDonne} onChangeText={setMontantDonne}
              keyboardType="numeric" placeholder="Ou saisissez le montant exact"
              placeholderTextColor="#8AAABF"/>
            {monnaie !== null && monnaie >= 0 && (
              <View style={es.monnaieBox}>
                <Text style={es.monnaieLbl}>Monnaie à rendre</Text>
                <Text style={es.monnaieVal}>{monnaie.toFixed(2)} DH</Text>
              </View>
            )}
          </View>
        )}

        {/* Récapitulatif financier */}
        <View style={es.recapBox}>
          <Text style={[es.sectionTitre, { marginHorizontal:0, marginBottom:14 }]}>📋 Récapitulatif</Text>
          <View style={es.recapRow}>
            <Text style={es.recapLbl}>Produits</Text>
            <Text style={es.recapVal}>{sousTotal.toFixed(2)} DH</Text>
          </View>
          {promoAppliquee && (
            <View style={es.recapRow}>
              <Text style={[es.recapLbl, { color:"#27AE60" }]}>Réduction -{promoAppliquee.valeur}%</Text>
              <Text style={[es.recapVal, { color:"#27AE60" }]}>-{remise.toFixed(2)} DH</Text>
            </View>
          )}
          <View style={es.recapRow}>
            <Text style={es.recapLbl}>Livraison {typeLivraison==="express" ? "⚡" : "📮"}</Text>
            {fraisLivraisonGratuit
              ? <View style={{ flexDirection:"row", gap:6, alignItems:"center" }}>
                  <View style={es.gratuitBadge}><Text style={es.gratuitBadgeTxt}>GRATUIT</Text></View>
                  <Text style={[es.recapVal, { textDecorationLine:"line-through", color:"#8AAABF" }]}>{fraisActuels.toFixed(2)} DH</Text>
                </View>
              : <Text style={es.recapVal}>{fraisActuels.toFixed(2)} DH</Text>
            }
          </View>
          <View style={es.recapRow}>
            <Text style={es.recapLbl}>Points fidélité gagnés</Text>
            <Text style={[es.recapVal, { color:"#F5A623" }]}>+{pts} pts</Text>
          </View>
          {sousTotal < 150 && (
            <View style={es.franchisSeuil}>
              <Text style={{ fontSize:16 }}>⚠️</Text>
              <Text style={{ fontSize:12, color:"#8AAABF", flex:1, marginLeft:8 }}>
                Atteignez 150,00 DH pour la livraison gratuite
              </Text>
            </View>
          )}
          <View style={[es.recapRow, es.recapTotal]}>
            <Text style={es.recapTotalLbl}>Total à payer</Text>
            <Text style={es.recapTotalVal}>{total.toFixed(2)} DH</Text>
          </View>
        </View>

        {/* Bouton confirmer */}
        <TouchableOpacity style={[es.confirmerBtn, !modePaiement && es.confirmerBtnDisabled]}
          onPress={confirmerCommande} disabled={loading || !modePaiement}>
          {loading ? <ActivityIndicator color="#fff"/>
            : <Text style={es.confirmerBtnTxt}>✅ Confirmer la commande · {total.toFixed(2)} DH</Text>}
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   MON COMPTE (Détails)
══════════════════════════════════════ */

const DSM_LIBRAIRIE = {
  lat: 33.5912,
  lng: -7.6356,
  adresse: "Casablanca, Maroc"
};

const GOOGLE_MAPS_KEY = "AIzaSyCV3d2W-DvJPEnbi9Mw6N9KKXTfH9-nXvg";

async function calculerFraisLivraison(lat: number, lng: number): Promise<{ distance: string; duree: string; frais: number }> {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat},${lng}&destinations=${DSM_LIBRAIRIE.lat},${DSM_LIBRAIRIE.lng}&mode=driving&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const element = data.rows[0].elements[0];
    if (element.status === "OK") {
      const distanceMetres = element.distance.value;
      const distanceKm = distanceMetres / 1000;
      const frais = Math.round(distanceKm * 2 * 10) / 10;
      return {
        distance: element.distance.text,
        duree: element.duration.text,
        frais: Math.max(frais, 10),
      };
    }
    return { distance:"—", duree:"—", frais:15 };
  } catch(e) {
    return { distance:"—", duree:"—", frais:15 };
  }
}

export function OngletMonCompte({ client, onUpdate }: { client: any; onUpdate: (c: any) => void }) {
  const [prenom, setPrenom] = useState(client.prenom || "");
  const [nom, setNom] = useState(client.nom || "");
  const [email, setEmail] = useState(client.email || "");
  const [telephone, setTelephone] = useState(client.telephone || "");
  const [adresse, setAdresse] = useState(client.adresse || "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [calcul, setCalcul] = useState<any>(null);
  const [calculLoading, setCalculLoading] = useState(false);
  const [position, setPosition] = useState<any>(null);

  const sauvegarder = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("clients")
        .update({ prenom, nom, email, telephone, adresse })
        .eq("id", client.id).select().single();
      if (data) { onUpdate(data); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch(e) { Alert.alert("❌ Erreur lors de la sauvegarde"); }
    setLoading(false);
  };

  const localiserEtCalculer = async () => {
    setCalculLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("❌ Permission refusée", "Activez la localisation pour calculer les frais.");
        setCalculLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPosition(loc.coords);
      const result = await calculerFraisLivraison(loc.coords.latitude, loc.coords.longitude);
      setCalcul(result);
    } catch(e) { Alert.alert("❌ Erreur de localisation"); }
    setCalculLoading(false);
  };

  const ouvrirGoogleMaps = () => {
    if (!position) return;
    Linking.openURL(`https://www.google.com/maps/dir/${position.latitude},${position.longitude}/${DSM_LIBRAIRIE.lat},${DSM_LIBRAIRIE.lng}`);
  };

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>👤 Mon Compte</Text>
        <Text style={es.headerSous}>Gérez vos informations personnelles</Text>
      </View>

      {/* Avatar */}
      <View style={es.avatarBox}>
        <View style={es.avatarGrand}>
          <Text style={{ fontSize:36, color:"#fff", fontWeight:"bold" }}>{prenom[0]}{nom[0]}</Text>
        </View>
        <Text style={es.avatarNom}>{prenom} {nom}</Text>
        <Text style={es.avatarNiveau}>Membre {client.niveau} · {client.points} pts</Text>
      </View>

      <View style={{ padding:16 }}>
        {/* Infos personnelles */}
        <Text style={es.sectionTitre}>📝 Informations personnelles</Text>
        <View style={es.compteCard}>
          <View style={es.rowInputs}>
            <View style={{ flex:1, marginRight:8 }}>
              <Text style={es.inputLabel}>Prénom</Text>
              <TextInput style={es.compteInput} value={prenom} onChangeText={setPrenom} placeholderTextColor="#8AAABF"/>
            </View>
            <View style={{ flex:1 }}>
              <Text style={es.inputLabel}>Nom</Text>
              <TextInput style={es.compteInput} value={nom} onChangeText={setNom} placeholderTextColor="#8AAABF"/>
            </View>
          </View>
          <Text style={es.inputLabel}>Email</Text>
          <TextInput style={es.compteInput} value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#8AAABF"/>
          <Text style={es.inputLabel}>📱 Numéro de téléphone</Text>
          <TextInput style={es.compteInput} value={telephone} onChangeText={setTelephone}
            keyboardType="phone-pad" placeholder="+212 6XX XXX XXX" placeholderTextColor="#8AAABF"/>
          <Text style={es.inputLabel}>📍 Adresse de livraison</Text>
          <TextInput style={[es.compteInput, { height:80, textAlignVertical:"top" }]}
            value={adresse} onChangeText={setAdresse} multiline
            placeholder="Votre adresse complète" placeholderTextColor="#8AAABF"/>
        </View>

        {/* Calcul frais livraison */}
        <Text style={es.sectionTitre}>🗺️ Frais de livraison</Text>
        <View style={es.livraisonCard}>
          <Text style={es.livraisonTitre}>📍 DSM Librairie — Casablanca</Text>
          <Text style={es.livraisonSous}>Tarif : 2 DH / km</Text>

          {calcul && (
            <View style={es.calculBox}>
              <View style={es.calculRow}>
                <Text style={es.calculIcon}>📏</Text>
                <View style={{ flex:1 }}>
                  <Text style={es.calculLabel}>Distance</Text>
                  <Text style={es.calculVal}>{calcul.distance}</Text>
                </View>
              </View>
              <View style={es.calculRow}>
                <Text style={es.calculIcon}>⏱️</Text>
                <View style={{ flex:1 }}>
                  <Text style={es.calculLabel}>Durée estimée</Text>
                  <Text style={es.calculVal}>{calcul.duree}</Text>
                </View>
              </View>
              <View style={[es.calculRow, { backgroundColor:"#EAF2FF", borderRadius:12, padding:12 }]}>
                <Text style={es.calculIcon}>💰</Text>
                <View style={{ flex:1 }}>
                  <Text style={es.calculLabel}>Frais de livraison</Text>
                  <Text style={[es.calculVal, { fontSize:24, color:"#1A6FFF" }]}>{calcul.frais} DH</Text>
                </View>
              </View>
              {position && (
                <TouchableOpacity style={es.mapsBtn} onPress={ouvrirGoogleMaps}>
                  <Text style={es.mapsBtnTxt}>🗺️ Voir l'itinéraire sur Google Maps</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity style={es.localiserBtn} onPress={localiserEtCalculer} disabled={calculLoading}>
            {calculLoading
              ? <ActivityIndicator color="#fff"/>
              : <Text style={es.localiserBtnTxt}>
                  {calcul ? "🔄 Recalculer" : "📍 Calculer mes frais de livraison"}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Infos carte */}
        <Text style={es.sectionTitre}>💳 Ma carte fidélité</Text>
        <View style={es.compteCard}>
          {[
            {icon:"🏆", label:"Niveau", val:client.niveau},
            {icon:"⭐", label:"Points", val:`${client.points} pts`},
            {icon:"💰", label:"Solde", val:`${(client.points*0.1).toFixed(2)} DH`},
            {icon:"🔢", label:"N° carte", val:`•••• ${client.num_carte}`},
            {icon:"📅", label:"Membre depuis", val:client.depuis},
          ].map((item, i) => (
            <View key={i} style={[es.infoRow, i>0 && { borderTopWidth:1, borderTopColor:"#F0F4FF" }]}>
              <Text style={{ fontSize:20, marginRight:12 }}>{item.icon}</Text>
              <Text style={es.infoLabel}>{item.label}</Text>
              <Text style={es.infoVal}>{item.val}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[es.sauvegarderBtn, saved && es.sauvegarderBtnSaved]}
          onPress={sauvegarder} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff"/>
            : <Text style={es.sauvegarderBtnTxt}>{saved ? "✅ Sauvegardé !" : "💾 Sauvegarder"}</Text>}
        </TouchableOpacity>

        {/* Livraison express */}
        <Text style={es.sectionTitre}>🚀 Livraison Express</Text>
        <View style={es.expressCard}>
          <Text style={{ fontSize:40, marginBottom:10 }}>⚡</Text>
          <Text style={es.expressTitre}>Livraison en 24h</Text>
          <Text style={es.expressDesc}>Recevez vos livres le lendemain avant 18h</Text>
          <View style={{ flexDirection:"row", gap:10, marginTop:14, flexWrap:"wrap", justifyContent:"center" }}>
            <View style={es.expressFeature}><Text style={{ color:"#fff", fontSize:12 }}>✅ Suivi GPS</Text></View>
            <View style={es.expressFeature}><Text style={{ color:"#fff", fontSize:12 }}>✅ SMS alertes</Text></View>
            <View style={es.expressFeature}><Text style={{ color:"#fff", fontSize:12 }}>✅ Retour facile</Text></View>
          </View>
          {calcul && (
            <Text style={{ color:"rgba(255,255,255,0.6)", fontSize:12, marginTop:10, textAlign:"center" }}>
              Frais express : {(calcul.frais * 1.5).toFixed(1)} DH (×1.5 standard)
            </Text>
          )}
          <TouchableOpacity style={es.expressBtn}
            onPress={() => Alert.alert("🚀 Livraison Express", `Frais : ${calcul ? (calcul.frais * 1.5).toFixed(1) : "~25"} DH\nLivraison le lendemain avant 18h !`)}>
            <Text style={es.expressBtnTxt}>Activer la livraison express →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   STYLES
══════════════════════════════════════ */
const es = StyleSheet.create({
  container: { flex:1, backgroundColor:"#F5F7FF" },
  header: { backgroundColor:"#05102A", padding:20, paddingTop:14 },
  headerTitre: { fontSize:22, color:"#FFD080", fontWeight:"bold" },
  headerSous: { fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:4 },
  sectionTitre: { fontSize:16, fontWeight:"bold", color:"#05102A", marginHorizontal:16, marginBottom:10, marginTop:6 },
  emptyBox: { alignItems:"center", padding:40 },
  emptyTxt: { fontSize:16, fontWeight:"bold", color:"#05102A", marginTop:12 },
  emptySous: { fontSize:12, color:"#8AAABF", marginTop:4, textAlign:"center" },
  backBtn: { backgroundColor:"#05102A", padding:14, paddingTop:50 },
  backBtnTxt: { color:"#FFD080", fontSize:16, fontWeight:"bold" },
  rowInputs: { flexDirection:"row" },
  // Coups de cœur
  livreHCard: { backgroundColor:"#fff", borderRadius:16, padding:14, marginRight:12, width:140, shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  livreHCardTitre: { fontSize:11, fontWeight:"bold", color:"#05102A", textAlign:"center", marginBottom:2 },
  livreHCardAuteur: { fontSize:9, color:"#8AAABF", textAlign:"center", marginBottom:4 },
  livreHCardPrix: { fontSize:14, fontWeight:"bold", color:"#05102A", textAlign:"center", marginBottom:8 },
  heartBtn: { backgroundColor:"#E74C3C", borderRadius:8, padding:6, alignItems:"center" },
  coupCoeurCard: { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", marginHorizontal:16, marginBottom:10, borderRadius:18, padding:16, shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2, gap:12 },
  coupCoeurTitre: { fontSize:13, fontWeight:"bold", color:"#05102A" },
  coupCoeurAuteur: { fontSize:11, color:"#8AAABF", marginTop:2 },
  coupCoeurPrix: { fontSize:14, fontWeight:"bold", color:"#1A6FFF", marginTop:4 },
  ajouterPanierBtn: { backgroundColor:"#1A6FFF", borderRadius:8, padding:6, alignItems:"center" },
  supprimerBtn: { backgroundColor:"#E74C3C", borderRadius:8, padding:6, alignItems:"center" },
  // Bons réduction
  bonCard: { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", marginHorizontal:16, marginBottom:12, borderRadius:18, overflow:"hidden", shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  bonGauche: { backgroundColor:"#1A6FFF", padding:16, alignItems:"center", minWidth:70 },
  bonValeur: { fontSize:24, fontWeight:"bold", color:"#fff" },
  bonType: { fontSize:9, color:"rgba(255,255,255,0.8)", letterSpacing:0.5 },
  bonCode: { fontSize:14, fontWeight:"bold", color:"#05102A", letterSpacing:1 },
  bonExpire: { fontSize:11, color:"#8AAABF", marginTop:4 },
  copierBtn: { backgroundColor:"#05102A", borderRadius:10, padding:10, marginRight:12 },
  copierBtnActif: { backgroundColor:"#27AE60" },
  // Suivi commandes
  commandeCard: { backgroundColor:"#fff", marginHorizontal:16, marginBottom:12, borderRadius:18, padding:16, shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  commandeCode: { fontSize:13, fontWeight:"bold", color:"#05102A" },
  commandeTotal: { fontSize:20, fontWeight:"bold", color:"#05102A", marginTop:4 },
  commandeDate: { fontSize:11, color:"#8AAABF", marginTop:4 },
  statutBadge: { borderRadius:99, paddingHorizontal:10, paddingVertical:4, borderWidth:1 },
  statutBadgeTxt: { fontSize:11, fontWeight:"bold" },
  statutBox: { margin:16, backgroundColor:"#fff", borderRadius:18, padding:24, alignItems:"center", borderLeftWidth:4, shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:12, elevation:4 },
  statutLabel: { fontSize:20, fontWeight:"bold", marginBottom:6 },
  statutDate: { fontSize:13, color:"#8AAABF" },
  timelineItem: { flexDirection:"row", alignItems:"flex-start", marginBottom:0, position:"relative" },
  timelineDot: { width:44, height:44, borderRadius:22, alignItems:"center", justifyContent:"center", zIndex:1 },
  timelineDotCourant: { shadowColor:"#1A6FFF", shadowOffset:{width:0,height:0}, shadowOpacity:0.5, shadowRadius:8, elevation:4 },
  timelineLine: { position:"absolute", left:21, top:44, width:2, height:32, zIndex:0 },
  timelineLabel: { fontSize:14, paddingTop:12, paddingBottom:32 },
  detailRow: { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderRadius:14, padding:14, marginBottom:10, shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:6, elevation:1 },
  detailLabel: { fontSize:10, color:"#8AAABF", letterSpacing:0.5 },
  detailVal: { fontSize:14, fontWeight:"bold", color:"#05102A", marginTop:2 },
  // Listes scolaires
  listeCard: { backgroundColor:"#fff", marginHorizontal:16, marginBottom:12, borderRadius:18, overflow:"hidden", shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  listeHeader: { flexDirection:"row", alignItems:"center", padding:16 },
  listeTitre: { fontSize:15, fontWeight:"bold", color:"#05102A" },
  listeSous: { fontSize:11, color:"#8AAABF", marginTop:2 },
  listeLivreRow: { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:10, borderTopWidth:1, borderTopColor:"#F0F4FF" },
  listeLivreTitre: { fontSize:13, fontWeight:"bold", color:"#05102A" },
  listeLivreAuteur: { fontSize:11, color:"#8AAABF" },
  listeLivrePrix: { fontSize:13, fontWeight:"bold", color:"#1A6FFF" },
  ajouterListeBtn: { backgroundColor:"#05102A", margin:16, borderRadius:14, padding:14, alignItems:"center" },
  ajouterListeBtnTxt: { color:"#fff", fontWeight:"bold", fontSize:14 },
  // Promotions
  promoCard: { backgroundColor:"#fff", borderRadius:18, padding:16, marginBottom:14, borderTopWidth:4, shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  promoIconBox: { width:52, height:52, borderRadius:16, alignItems:"center", justifyContent:"center" },
  promoTitre: { fontSize:15, fontWeight:"bold", color:"#05102A" },
  promoDesc: { fontSize:12, color:"#8AAABF", marginTop:2 },
  promoBadge: { borderRadius:99, paddingHorizontal:10, paddingVertical:6, alignSelf:"flex-start" },
  promoBadgeTxt: { color:"#fff", fontSize:14, fontWeight:"bold" },
  promoBtn: { borderRadius:99, paddingHorizontal:16, paddingVertical:8 },
  promoBtnTxt: { color:"#fff", fontWeight:"bold", fontSize:12 },
  countdownBox: { backgroundColor:"#05102A", borderRadius:20, padding:22, alignItems:"center" },
  countdownTitre: { fontSize:18, color:"#FFD080", fontWeight:"bold", marginBottom:6 },
  countdownDesc: { fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:16, textAlign:"center" },
  countdownRow: { flexDirection:"row", gap:12, marginBottom:16 },
  countdownItem: { backgroundColor:"rgba(255,255,255,0.1)", borderRadius:12, padding:14, alignItems:"center", minWidth:60 },
  countdownVal: { fontSize:28, color:"#FFD080", fontWeight:"bold" },
  countdownUnit: { fontSize:11, color:"rgba(255,255,255,0.5)" },
  countdownBtn: { backgroundColor:"#F5A623", borderRadius:14, paddingVertical:12, paddingHorizontal:24 },
  countdownBtnTxt: { color:"#1a1a00", fontWeight:"bold", fontSize:14 },
  // Mon compte
  avatarBox: { backgroundColor:"#05102A", paddingBottom:24, alignItems:"center" },
  avatarGrand: { width:80, height:80, borderRadius:40, backgroundColor:"#1A6FFF", alignItems:"center", justifyContent:"center", marginBottom:10 },
  avatarNom: { fontSize:20, color:"#fff", fontWeight:"bold" },
  avatarNiveau: { fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:4 },
  compteCard: { backgroundColor:"#fff", borderRadius:18, padding:16, marginHorizontal:16, marginBottom:16, shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  inputLabel: { fontSize:11, color:"#8AAABF", marginBottom:6, letterSpacing:0.5 },
  compteInput: { backgroundColor:"#F5F7FF", borderRadius:12, padding:12, fontSize:14, color:"#05102A", marginBottom:12, borderWidth:1, borderColor:"#E0EDFF" },
  infoRow: { flexDirection:"row", alignItems:"center", paddingVertical:10 },
  infoLabel: { flex:1, fontSize:13, color:"#8AAABF" },
  infoVal: { fontSize:13, fontWeight:"bold", color:"#05102A" },
  sauvegarderBtn: { backgroundColor:"#1A6FFF", borderRadius:16, padding:16, alignItems:"center", marginHorizontal:16, marginBottom:16 },
  sauvegarderBtnSaved: { backgroundColor:"#27AE60" },
  sauvegarderBtnTxt: { color:"#fff", fontWeight:"bold", fontSize:15 },
  expressCard: { backgroundColor:"#05102A", borderRadius:20, padding:22, marginHorizontal:16, marginBottom:20, alignItems:"center" },
  expressTitre: { fontSize:20, color:"#FFD080", fontWeight:"bold", marginBottom:8 },
  expressDesc: { fontSize:13, color:"rgba(255,255,255,0.6)", textAlign:"center", lineHeight:20 },
  expressFeature: { backgroundColor:"rgba(255,255,255,0.1)", borderRadius:8, padding:8 },
  expressBtn: { backgroundColor:"#F5A623", borderRadius:14, paddingVertical:12, paddingHorizontal:20, marginTop:14 },
  expressBtnTxt: { color:"#1a1a00", fontWeight:"bold", fontSize:13 },
  livraisonCard: { backgroundColor:"#fff", borderRadius:18, padding:18, marginHorizontal:16, marginBottom:16, shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  livraisonTitre: { fontSize:15, fontWeight:"bold", color:"#05102A", marginBottom:4 },
  livraisonSous: { fontSize:12, color:"#8AAABF", marginBottom:14 },
  calculBox: { backgroundColor:"#F5F7FF", borderRadius:14, padding:14, marginBottom:14, gap:10 },
  calculRow: { flexDirection:"row", alignItems:"center", gap:12 },
  calculIcon: { fontSize:22 },
  calculLabel: { fontSize:11, color:"#8AAABF" },
  calculVal: { fontSize:16, fontWeight:"bold", color:"#05102A", marginTop:2 },
  localiserBtn: { backgroundColor:"#1A6FFF", borderRadius:14, padding:14, alignItems:"center" },
  localiserBtnTxt: { color:"#fff", fontWeight:"bold", fontSize:14 },
  mapsBtn: { backgroundColor:"#25D366", borderRadius:12, padding:12, alignItems:"center", marginTop:6 }, 
  mapsBtnTxt: { color:"#fff", fontWeight:"bold", fontSize:13 },
  commandeCard: { backgroundColor:"#fff", borderRadius:18, marginHorizontal:16, marginBottom:16, overflow:"hidden", shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  livraisonTypeBtn: { flex:1, backgroundColor:"#fff", borderRadius:16, padding:14, alignItems:"center", borderWidth:2, borderColor:"#E0EDFF" },
  livraisonTypeBtnActif: { backgroundColor:"#1A6FFF", borderColor:"#1A6FFF" },
  livraisonTypeLbl: { fontSize:14, fontWeight:"bold", color:"#05102A" },
  promoRow: { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", marginHorizontal:16, marginBottom:10, borderRadius:16, padding:16, gap:12, shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:6, elevation:1 },
  promoRowTxt: { flex:1, fontSize:14, color:"#05102A" },
  appliquerBtn: { backgroundColor:"#1A6FFF", borderRadius:12, padding:12, alignItems:"center", justifyContent:"center" },
  appliquerBtnTxt: { color:"#fff", fontWeight:"bold", fontSize:13 },
  paiementBtn: { flex:1, backgroundColor:"#fff", borderRadius:16, padding:14, alignItems:"center", borderWidth:2, borderColor:"#E0EDFF" },
  paiementBtnActif: { backgroundColor:"#05102A", borderColor:"#05102A" },
  paiementLbl: { fontSize:14, fontWeight:"bold", color:"#05102A" },
  especeBox: { backgroundColor:"#FFF9F0", borderRadius:18, padding:16, marginHorizontal:16, marginBottom:16, borderWidth:1, borderColor:"#F5A623" },
  especeTitre: { fontSize:15, fontWeight:"bold", color:"#05102A", marginBottom:4 },
  especeSous: { fontSize:12, color:"#8AAABF", marginBottom:12 },
  montantBtn: { backgroundColor:"#fff", borderRadius:12, paddingHorizontal:16, paddingVertical:10, borderWidth:2, borderColor:"#E0EDFF" },
  montantBtnActif: { backgroundColor:"#F5A623", borderColor:"#F5A623" },
  montantBtnTxt: { fontSize:14, fontWeight:"bold", color:"#05102A" },
  monnaieBox: { backgroundColor:"#fff", borderRadius:12, padding:14, alignItems:"center", borderWidth:2, borderColor:"#27AE60" },
  monnaieLbl: { fontSize:12, color:"#8AAABF" },
  monnaieVal: { fontSize:28, fontWeight:"bold", color:"#27AE60", marginTop:4 },
  recapBox: { backgroundColor:"#fff", borderRadius:18, padding:16, marginHorizontal:16, marginBottom:16, shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  recapRow: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingVertical:10, borderBottomWidth:1, borderBottomColor:"#F0F4FF" },
  recapLbl: { fontSize:14, color:"#8AAABF" },
  recapVal: { fontSize:14, fontWeight:"bold", color:"#05102A" },
  recapTotal: { borderBottomWidth:0, marginTop:6 },
  recapTotalLbl: { fontSize:18, fontWeight:"bold", color:"#05102A" },
  recapTotalVal: { fontSize:22, fontWeight:"bold", color:"#05102A" },
  gratuitBadge: { backgroundColor:"#F5A623", borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  gratuitBadgeTxt: { color:"#fff", fontSize:10, fontWeight:"bold" },
  franchisSeuil: { flexDirection:"row", alignItems:"center", backgroundColor:"#F5F7FF", borderRadius:10, padding:10, marginTop:6 },
  confirmerBtn: { backgroundColor:"#1A6FFF", borderRadius:18, padding:18, alignItems:"center", marginBottom:30 },
  confirmerBtnDisabled: { backgroundColor:"#8AAABF" },
  confirmerBtnTxt: { color:"#fff", fontWeight:"bold", fontSize:16 },
});
