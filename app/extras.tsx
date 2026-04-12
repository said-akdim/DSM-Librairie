import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

/* ══════════════════════════════════════
   CONFIG ODOO
══════════════════════════════════════ */
const ODOO_URL = "http://192.168.100.49:8069";
const ODOO_DB = "Dsm";

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
   DONNÉES STATIQUES
══════════════════════════════════════ */
const PROMOTIONS = [
  { id: 1, titre: "-30% sur la SF", desc: "Tous les livres Sci-Fi ce mois", emoji: "🚀", couleur: "#1A6FFF", expire: "31/03/2026", reduction: 30 },
  { id: 2, titre: "2 achetés = 1 offert", desc: "Sur toute la collection jeunesse", emoji: "🧙", couleur: "#27AE60", expire: "15/04/2026", reduction: 33 },
  { id: 3, titre: "-25% Romans policiers", desc: "Fred Vargas, Agatha Christie...", emoji: "🔍", couleur: "#9B59B6", expire: "20/04/2026", reduction: 25 },
  { id: 4, titre: "Livraison gratuite", desc: "Dès 150 DH d'achat", emoji: "🚚", couleur: "#F5A623", expire: "30/04/2026", reduction: 0 },
];

const LISTES_SCOLAIRES = [
  {
    nom: "Collège - 1ère année", niveau: "Collège",
    livres: [
      { titre: "Grammaire Française", auteur: "Lagane", prix: 45, emoji: "📗" },
      { titre: "Mathématiques 1AC", auteur: "Collectif", prix: 55, emoji: "📐" },
      { titre: "Histoire-Géo 1AC", auteur: "Collectif", prix: 48, emoji: "🌍" },
    ]
  },
  {
    nom: "Lycée - 2ème année", niveau: "Lycée",
    livres: [
      { titre: "Physique-Chimie 2BAC", auteur: "Collectif", prix: 65, emoji: "⚗️" },
      { titre: "Philosophie Terminale", auteur: "Collectif", prix: 52, emoji: "🤔" },
      { titre: "Français Littérature", auteur: "Collectif", prix: 58, emoji: "📚" },
    ]
  },
];

/* ══════════════════════════════════════
   COUPS DE CŒUR
══════════════════════════════════════ */
export function OngletCoupsCoeur({ client, livres, onAjouterPanier }: { client: any; livres: any[]; onAjouterPanier: (l: any) => void }) {
  const [coupsCoeur, setCoupsCoeur] = useState<any[]>([]);

  const ajouterCoupCoeur = (livre: any) => {
    const existe = coupsCoeur.find(c => c.titre === livre.titre);
    if (existe) { Alert.alert("Déjà dans vos coups de cœur !"); return; }
    setCoupsCoeur(c => [{ ...livre, id: Date.now() }, ...c]);
    Alert.alert("❤️ Ajouté aux coups de cœur !");
  };

  const supprimerCoupCoeur = (id: number) => {
    setCoupsCoeur(c => c.filter(x => x.id !== id));
  };

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>❤️ Mes Coups de Cœur</Text>
        <Text style={es.headerSous}>Vos livres favoris sauvegardés</Text>
      </View>
      <Text style={es.sectionTitre}>📚 Ajouter depuis le catalogue</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16, marginBottom: 20 }}>
        {livres.map((livre, i) => (
          <TouchableOpacity key={i} style={es.livreHCard} onPress={() => ajouterCoupCoeur(livre)}>
            <Text style={{ fontSize: 32, textAlign: "center", marginBottom: 6 }}>{livre.emoji}</Text>
            <Text style={es.livreHCardTitre}>{livre.titre}</Text>
            <Text style={es.livreHCardAuteur}>{livre.auteur}</Text>
            <Text style={es.livreHCardPrix}>{livre.prix?.toFixed(2)} DH</Text>
            <View style={es.heartBtn}><Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>❤️ Ajouter</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={es.sectionTitre}>❤️ Ma liste ({coupsCoeur.length})</Text>
      {coupsCoeur.length === 0
        ? <View style={es.emptyBox}>
            <Text style={{ fontSize: 40 }}>💔</Text>
            <Text style={es.emptyTxt}>Aucun coup de cœur encore</Text>
          </View>
        : coupsCoeur.map((c, i) => (
          <View key={i} style={es.coupCoeurCard}>
            <Text style={{ fontSize: 32 }}>{c.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={es.coupCoeurTitre}>{c.titre}</Text>
              <Text style={es.coupCoeurAuteur}>{c.auteur}</Text>
              <Text style={es.coupCoeurPrix}>{c.prix?.toFixed(2)} DH</Text>
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity style={es.ajouterPanierBtn} onPress={() => onAjouterPanier(c)}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>🛒 Panier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={es.supprimerBtn} onPress={() => supprimerCoupCoeur(c.id)}>
                <Text style={{ color: "#fff", fontSize: 11 }}>🗑️</Text>
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
  const [bons] = useState<any[]>([]);

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>🎟️ Mes Bons de Réduction</Text>
        <Text style={es.headerSous}>0 bon disponible</Text>
      </View>
      <View style={es.emptyBox}>
        <Text style={{ fontSize: 40 }}>🎟️</Text>
        <Text style={es.emptyTxt}>Aucun bon disponible</Text>
        <Text style={es.emptySous}>Continuez vos achats pour en gagner !</Text>
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   SUIVI COMMANDES
══════════════════════════════════════ */
export function OngletSuiviCommandes({ client }: { client: any }) {
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      await odooAuthAdmin();
      const result = await odooCall("sale.order", "search_read",
        [[["partner_id", "=", client.id]]],
        { fields: ["name", "amount_total", "state", "date_order"], limit: 20, order: "date_order desc" }
      );
      if (result) setCommandes(result);
      setLoading(false);
    };
    charger();
  }, [client.id]);

  const statutLabel: Record<string, { label: string; couleur: string; emoji: string }> = {
    draft: { label: "Brouillon", couleur: "#8AAABF", emoji: "📝" },
    sent: { label: "Envoyé", couleur: "#1A6FFF", emoji: "📨" },
    sale: { label: "Confirmé", couleur: "#27AE60", emoji: "✅" },
    done: { label: "Terminé", couleur: "#F5A623", emoji: "🎉" },
    cancel: { label: "Annulé", couleur: "#E74C3C", emoji: "❌" },
  };

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>📦 Mes Commandes</Text>
        <Text style={es.headerSous}>{commandes.length} commande(s) dans Odoo</Text>
      </View>
      {loading ? <ActivityIndicator color="#1A6FFF" style={{ marginTop: 40 }} /> :
        commandes.length === 0
          ? <View style={es.emptyBox}>
              <Text style={{ fontSize: 40 }}>📭</Text>
              <Text style={es.emptyTxt}>Aucune commande</Text>
            </View>
          : commandes.map((cmd, i) => {
            const statut = statutLabel[cmd.state] || { label: cmd.state, couleur: "#8AAABF", emoji: "📦" };
            return (
              <View key={i} style={es.commandeCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={es.commandeCode}>{cmd.name}</Text>
                  <View style={[es.statutBadge, { backgroundColor: statut.couleur + "20", borderColor: statut.couleur }]}>
                    <Text style={[es.statutBadgeTxt, { color: statut.couleur }]}>{statut.emoji} {statut.label}</Text>
                  </View>
                </View>
                <Text style={es.commandeTotal}>{cmd.amount_total?.toFixed(2)} DH</Text>
                <Text style={es.commandeDate}>{new Date(cmd.date_order).toLocaleDateString("fr-FR")}</Text>
              </View>
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
  const [listeOuverte, setListeOuverte] = useState<number | null>(null);

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>🎒 Listes Scolaires</Text>
        <Text style={es.headerSous}>Rentrée {new Date().getFullYear()}-{new Date().getFullYear() + 1}</Text>
      </View>
      {LISTES_SCOLAIRES.map((liste, i) => {
        const ouvert = listeOuverte === i;
        const total = liste.livres.reduce((a, l) => a + l.prix, 0);
        return (
          <View key={i} style={es.listeCard}>
            <TouchableOpacity style={es.listeHeader} onPress={() => setListeOuverte(ouvert ? null : i)}>
              <Text style={{ fontSize: 28 }}>🎒</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={es.listeTitre}>{liste.nom}</Text>
                <Text style={es.listeSous}>{liste.niveau} · {liste.livres.length} livres · {total.toFixed(2)} DH</Text>
              </View>
              <Text style={{ fontSize: 20, color: "#1A6FFF" }}>{ouvert ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {ouvert && <>
              {liste.livres.map((livre, j) => (
                <View key={j} style={es.listeLivreRow}>
                  <Text style={{ fontSize: 22 }}>{livre.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={es.listeLivreTitre}>{livre.titre}</Text>
                    <Text style={es.listeLivreAuteur}>{livre.auteur}</Text>
                  </View>
                  <Text style={es.listeLivrePrix}>{livre.prix.toFixed(2)} DH</Text>
                </View>
              ))}
              <TouchableOpacity style={es.ajouterListeBtn}
                onPress={() => { onAjouterPanier(liste.livres); Alert.alert("✅ Liste ajoutée au panier !"); }}>
                <Text style={es.ajouterListeBtnTxt}>🛒 Ajouter toute la liste</Text>
              </TouchableOpacity>
            </>}
          </View>
        );
      })}
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   PROMOTIONS
══════════════════════════════════════ */
export function OngletPromotions({ client }: { client: any }) {
  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>🔥 Promotions en cours</Text>
        <Text style={es.headerSous}>Offres exclusives DSM</Text>
      </View>
      <View style={{ padding: 16 }}>
        {PROMOTIONS.map((promo, i) => (
          <View key={i} style={[es.promoCard, { borderTopColor: promo.couleur }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <View style={[es.promoIconBox, { backgroundColor: promo.couleur }]}>
                <Text style={{ fontSize: 28 }}>{promo.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={es.promoTitre}>{promo.titre}</Text>
                <Text style={es.promoDesc}>{promo.desc}</Text>
              </View>
              {promo.reduction > 0 && (
                <View style={[es.promoBadge, { backgroundColor: promo.couleur }]}>
                  <Text style={es.promoBadgeTxt}>-{promo.reduction}%</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, color: "#8AAABF" }}>⏰ Expire le {promo.expire}</Text>
              <TouchableOpacity style={[es.promoBtn, { backgroundColor: promo.couleur }]}>
                <Text style={es.promoBtnTxt}>J'en profite →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
  const [typeLivraison, setTypeLivraison] = useState<"standard" | "express">("standard");
  const [modePaiement, setModePaiement] = useState<string | null>(null);
  const [adresse, setAdresse] = useState(client.adresse || "");
  const [loading, setLoading] = useState(false);
  const [montantDonne, setMontantDonne] = useState("");

  const sousTotal = panier.reduce((a, b) => a + (b.prix || 0), 0);
  const fraisStd = fraisLivraison || 15;
  const fraisExp = Math.round(fraisStd * 1.5 * 10) / 10;
  const fraisActuels = typeLivraison === "express" ? fraisExp : fraisStd;
  const gratuit = sousTotal >= 150;
  const total = sousTotal + (gratuit ? 0 : fraisActuels);
  const pts = Math.round(sousTotal * 10);
  const monnaie = montantDonne ? Math.max(0, parseFloat(montantDonne) - total) : null;

  const confirmer = async () => {
    if (!modePaiement) { Alert.alert("❌", "Choisissez un moyen de paiement"); return; }
    setLoading(true);
    try {
      await odooAuthAdmin();
      const trackingCode = `DSM-${Date.now().toString().slice(-6)}`;

      // Créer commande dans Odoo
      const orderId = await odooCall("sale.order", "create", [{
        partner_id: client.id,
        order_line: panier.filter(p => p.odoo_id).map(p => [0, 0, {
          product_id: p.odoo_id,
          product_uom_qty: 1,
          price_unit: p.prix,
        }]),
      }]);

      // Ajouter points fidélité
      if (orderId) {
        const partnerData = await odooCall("res.partner", "search_read",
          [[["id", "=", client.id]]],
          { fields: ["dsm_points"], limit: 1 }
        );
        if (partnerData?.[0]) {
          const pointsAvant = partnerData[0].dsm_points;
          await odooCall("res.partner", "write", [[client.id], { dsm_points: pointsAvant + pts }]);
          await odooCall("dsm.historique.points", "create", [{
            partner_id: client.id, points: pts, type: "achat",
            description: `Commande ${trackingCode}`,
            points_avant: pointsAvant, points_apres: pointsAvant + pts,
          }]);
          await odooCall("dsm.notification", "create", [{
            partner_id: client.id,
            titre: `✅ Commande confirmée - +${pts} pts !`,
            message: `Votre commande ${trackingCode} est confirmée. Total : ${total.toFixed(2)} DH`,
            type: "points",
          }]);
        }
      }

      onConfirmer({ tracking: trackingCode, monnaie, pts, total });
    } catch { Alert.alert("❌ Erreur", "Impossible de confirmer"); }
    setLoading(false);
  };

  return (
    <ScrollView style={es.container}>
      <View style={[es.header, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
        <TouchableOpacity onPress={onAnnuler}><Text style={{ color: "#FFD080", fontSize: 22 }}>‹</Text></TouchableOpacity>
        <Text style={es.headerTitre}>Passage en caisse</Text>
      </View>
      <View style={{ padding: 16 }}>

        {/* Articles */}
        <Text style={es.sectionTitre}>🛒 Articles ({panier.length})</Text>
        <View style={es.commandeCard}>
          {panier.map((l, i) => (
            <View key={i} style={[es.listeLivreRow, i > 0 && { borderTopWidth: 1, borderTopColor: "#F0F4FF" }]}>
              <Text style={{ fontSize: 22 }}>{l.emoji}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={es.listeLivreTitre}>{l.titre}</Text>
                <Text style={es.listeLivreAuteur}>{l.auteur}</Text>
              </View>
              <Text style={es.listeLivrePrix}>{l.prix?.toFixed(2)} DH</Text>
            </View>
          ))}
        </View>

        {/* Adresse */}
        <Text style={es.sectionTitre}>📍 Adresse de livraison</Text>
        <TextInput style={[es.compteInput, { marginHorizontal: 16 }]}
          value={adresse} onChangeText={setAdresse}
          placeholder="Votre adresse complète" placeholderTextColor="#8AAABF" multiline />

        {/* Livraison */}
        <Text style={es.sectionTitre}>🚚 Type de livraison</Text>
        <View style={{ flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 16 }}>
          {[
            { id: "standard", label: "📮 Standard", desc: `3-5 jours · ${gratuit ? "Gratuit" : fraisStd + " DH"}` },
            { id: "express", label: "⚡ Express", desc: `24h · ${gratuit ? "Gratuit" : fraisExp + " DH"}` },
          ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTypeLivraison(t.id as any)}
              style={[es.livraisonTypeBtn, typeLivraison === t.id && es.livraisonTypeBtnActif]}>
              <Text style={[es.livraisonTypeLbl, typeLivraison === t.id && { color: "#fff" }]}>{t.label}</Text>
              <Text style={[{ fontSize: 11, color: "#8AAABF", marginTop: 2 }, typeLivraison === t.id && { color: "rgba(255,255,255,0.8)" }]}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Paiement */}
        <Text style={es.sectionTitre}>💳 Moyen de paiement</Text>
        <View style={{ flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 16 }}>
          {[
            { id: "espece", label: "💵 Espèces", desc: "À la livraison" },
            { id: "tpe", label: "💳 TPE", desc: "Carte bancaire" },
            { id: "virement", label: "🏦 Virement", desc: "Virement bancaire" },
          ].map(p => (
            <TouchableOpacity key={p.id} onPress={() => setModePaiement(p.id)}
              style={[es.paiementBtn, modePaiement === p.id && es.paiementBtnActif]}>
              <Text style={[es.paiementLbl, modePaiement === p.id && { color: "#fff" }]}>{p.label}</Text>
              <Text style={[{ fontSize: 11, color: "#8AAABF", marginTop: 2 }, modePaiement === p.id && { color: "rgba(255,255,255,0.8)" }]}>{p.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {modePaiement === "espece" && (
          <View style={es.especeBox}>
            <Text style={es.especeTitre}>💵 Montant donné au livreur</Text>
            <TextInput style={[es.compteInput, { marginTop: 8 }]} value={montantDonne}
              onChangeText={setMontantDonne} keyboardType="numeric"
              placeholder={`Minimum ${total.toFixed(2)} DH`} placeholderTextColor="#8AAABF" />
            {monnaie !== null && monnaie >= 0 && (
              <View style={es.monnaieBox}>
                <Text style={es.monnaieLbl}>Monnaie à rendre</Text>
                <Text style={es.monnaieVal}>{monnaie.toFixed(2)} DH</Text>
              </View>
            )}
          </View>
        )}

        {/* Récapitulatif */}
        <View style={es.recapBox}>
          <Text style={[es.sectionTitre, { marginHorizontal: 0, marginBottom: 14 }]}>📋 Récapitulatif</Text>
          <View style={es.recapRow}>
            <Text style={es.recapLbl}>Produits</Text>
            <Text style={es.recapVal}>{sousTotal.toFixed(2)} DH</Text>
          </View>
          <View style={es.recapRow}>
            <Text style={es.recapLbl}>Livraison</Text>
            <Text style={[es.recapVal, gratuit && { color: "#27AE60" }]}>{gratuit ? "Gratuit" : fraisActuels.toFixed(2) + " DH"}</Text>
          </View>
          <View style={es.recapRow}>
            <Text style={es.recapLbl}>Points fidélité</Text>
            <Text style={[es.recapVal, { color: "#F5A623" }]}>+{pts} pts</Text>
          </View>
          <View style={[es.recapRow, { borderBottomWidth: 0, marginTop: 6 }]}>
            <Text style={es.recapTotalLbl}>Total</Text>
            <Text style={es.recapTotalVal}>{total.toFixed(2)} DH</Text>
          </View>
        </View>

        <TouchableOpacity style={[es.confirmerBtn, !modePaiement && es.confirmerBtnDisabled]}
          onPress={confirmer} disabled={loading || !modePaiement}>
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={es.confirmerBtnTxt}>✅ Confirmer · {total.toFixed(2)} DH</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   MON COMPTE
══════════════════════════════════════ */
export function OngletMonCompte({ client, onUpdate }: { client: any; onUpdate: (c: any) => void }) {
  const [nom, setNom] = useState(client.name || "");
  const [email, setEmail] = useState(client.email || "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const sauvegarder = async () => {
    setLoading(true);
    try {
      await odooAuthAdmin();
      await odooCall("res.partner", "write", [[client.id], { name: nom, email }]);
      onUpdate({ ...client, name: nom, email });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { Alert.alert("❌ Erreur lors de la sauvegarde"); }
    setLoading(false);
  };

  return (
    <ScrollView style={es.container}>
      <View style={es.header}>
        <Text style={es.headerTitre}>👤 Mon Compte</Text>
        <Text style={es.headerSous}>Informations personnelles</Text>
      </View>
      <View style={es.avatarBox}>
        <View style={es.avatarGrand}>
          <Text style={{ fontSize: 36, color: "#fff", fontWeight: "bold" }}>
            {(client.name || "?")[0]}
          </Text>
        </View>
        <Text style={es.avatarNom}>{client.name}</Text>
        <Text style={es.avatarNiveau}>Membre {client.dsm_niveau} · {client.dsm_points} pts</Text>
      </View>
      <View style={{ padding: 16 }}>
        <Text style={es.sectionTitre}>📝 Informations</Text>
        <View style={es.compteCard}>
          <Text style={es.inputLabel}>Nom complet</Text>
          <TextInput style={es.compteInput} value={nom} onChangeText={setNom} placeholderTextColor="#8AAABF" />
          <Text style={es.inputLabel}>Email</Text>
          <TextInput style={es.compteInput} value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#8AAABF" />
        </View>

        <Text style={es.sectionTitre}>💳 Ma carte fidélité</Text>
        <View style={es.compteCard}>
          {[
            { icon: "🏆", label: "Niveau", val: client.dsm_niveau },
            { icon: "⭐", label: "Points", val: `${client.dsm_points} pts` },
            { icon: "💰", label: "Solde", val: `${((client.dsm_points || 0) * 0.1).toFixed(2)} DH` },
            { icon: "🔢", label: "N° carte", val: `•••• ${client.dsm_num_carte || "????"}` },
            { icon: "🔗", label: "ID Odoo", val: `#${client.id}` },
          ].map((item, i) => (
            <View key={i} style={[es.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: "#F0F4FF" }]}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{item.icon}</Text>
              <Text style={es.infoLabel}>{item.label}</Text>
              <Text style={es.infoVal}>{item.val}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[es.sauvegarderBtn, saved && es.sauvegarderBtnSaved]}
          onPress={sauvegarder} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={es.sauvegarderBtnTxt}>{saved ? "✅ Sauvegardé !" : "💾 Sauvegarder"}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ══════════════════════════════════════
   STYLES
══════════════════════════════════════ */
const es = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FF" },
  header: { backgroundColor: "#05102A", padding: 20, paddingTop: 14 },
  headerTitre: { fontSize: 22, color: "#FFD080", fontWeight: "bold" },
  headerSous: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 },
  sectionTitre: { fontSize: 16, fontWeight: "bold", color: "#05102A", marginHorizontal: 16, marginBottom: 10, marginTop: 6 },
  emptyBox: { alignItems: "center", padding: 40 },
  emptyTxt: { fontSize: 16, fontWeight: "bold", color: "#05102A", marginTop: 12 },
  emptySous: { fontSize: 12, color: "#8AAABF", marginTop: 4, textAlign: "center" },
  livreHCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginRight: 12, width: 140 },
  livreHCardTitre: { fontSize: 11, fontWeight: "bold", color: "#05102A", textAlign: "center", marginBottom: 2 },
  livreHCardAuteur: { fontSize: 9, color: "#8AAABF", textAlign: "center", marginBottom: 4 },
  livreHCardPrix: { fontSize: 14, fontWeight: "bold", color: "#05102A", textAlign: "center", marginBottom: 8 },
  heartBtn: { backgroundColor: "#E74C3C", borderRadius: 8, padding: 6, alignItems: "center" },
  coupCoeurCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 18, padding: 16, gap: 12 },
  coupCoeurTitre: { fontSize: 13, fontWeight: "bold", color: "#05102A" },
  coupCoeurAuteur: { fontSize: 11, color: "#8AAABF", marginTop: 2 },
  coupCoeurPrix: { fontSize: 14, fontWeight: "bold", color: "#1A6FFF", marginTop: 4 },
  ajouterPanierBtn: { backgroundColor: "#1A6FFF", borderRadius: 8, padding: 6, alignItems: "center" },
  supprimerBtn: { backgroundColor: "#E74C3C", borderRadius: 8, padding: 6, alignItems: "center" },
  commandeCard: { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 16 },
  commandeCode: { fontSize: 13, fontWeight: "bold", color: "#05102A" },
  commandeTotal: { fontSize: 20, fontWeight: "bold", color: "#05102A", marginTop: 4 },
  commandeDate: { fontSize: 11, color: "#8AAABF", marginTop: 4 },
  statutBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statutBadgeTxt: { fontSize: 11, fontWeight: "bold" },
  listeCard: { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12, borderRadius: 18, overflow: "hidden" },
  listeHeader: { flexDirection: "row", alignItems: "center", padding: 16 },
  listeTitre: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  listeSous: { fontSize: 11, color: "#8AAABF", marginTop: 2 },
  listeLivreRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F0F4FF" },
  listeLivreTitre: { fontSize: 13, fontWeight: "bold", color: "#05102A" },
  listeLivreAuteur: { fontSize: 11, color: "#8AAABF" },
  listeLivrePrix: { fontSize: 13, fontWeight: "bold", color: "#1A6FFF" },
  ajouterListeBtn: { backgroundColor: "#05102A", margin: 16, borderRadius: 14, padding: 14, alignItems: "center" },
  ajouterListeBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  promoCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, borderTopWidth: 4 },
  promoIconBox: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  promoTitre: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  promoDesc: { fontSize: 12, color: "#8AAABF", marginTop: 2 },
  promoBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  promoBadgeTxt: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  promoBtn: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8 },
  promoBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  avatarBox: { backgroundColor: "#05102A", paddingBottom: 24, alignItems: "center" },
  avatarGrand: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#1A6FFF", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  avatarNom: { fontSize: 20, color: "#fff", fontWeight: "bold" },
  avatarNiveau: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 },
  compteCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginHorizontal: 16, marginBottom: 16 },
  inputLabel: { fontSize: 11, color: "#8AAABF", marginBottom: 6, letterSpacing: 0.5 },
  compteInput: { backgroundColor: "#F5F7FF", borderRadius: 12, padding: 12, fontSize: 14, color: "#05102A", marginBottom: 12, borderWidth: 1, borderColor: "#E0EDFF" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  infoLabel: { flex: 1, fontSize: 13, color: "#8AAABF" },
  infoVal: { fontSize: 13, fontWeight: "bold", color: "#05102A" },
  sauvegarderBtn: { backgroundColor: "#1A6FFF", borderRadius: 16, padding: 16, alignItems: "center", marginHorizontal: 16, marginBottom: 16 },
  sauvegarderBtnSaved: { backgroundColor: "#27AE60" },
  sauvegarderBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  livraisonTypeBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 2, borderColor: "#E0EDFF" },
  livraisonTypeBtnActif: { backgroundColor: "#1A6FFF", borderColor: "#1A6FFF" },
  livraisonTypeLbl: { fontSize: 14, fontWeight: "bold", color: "#05102A" },
  paiementBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 2, borderColor: "#E0EDFF" },
  paiementBtnActif: { backgroundColor: "#05102A", borderColor: "#05102A" },
  paiementLbl: { fontSize: 14, fontWeight: "bold", color: "#05102A" },
  especeBox: { backgroundColor: "#FFF9F0", borderRadius: 18, padding: 16, marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: "#F5A623" },
  especeTitre: { fontSize: 15, fontWeight: "bold", color: "#05102A" },
  monnaieBox: { backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 2, borderColor: "#27AE60", marginTop: 8 },
  monnaieLbl: { fontSize: 12, color: "#8AAABF" },
  monnaieVal: { fontSize: 28, fontWeight: "bold", color: "#27AE60", marginTop: 4 },
  recapBox: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginHorizontal: 16, marginBottom: 16 },
  recapRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4FF" },
  recapLbl: { fontSize: 14, color: "#8AAABF" },
  recapVal: { fontSize: 14, fontWeight: "bold", color: "#05102A" },
  recapTotalLbl: { fontSize: 18, fontWeight: "bold", color: "#05102A" },
  recapTotalVal: { fontSize: 22, fontWeight: "bold", color: "#05102A" },
  confirmerBtn: { backgroundColor: "#1A6FFF", borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 30 },
  confirmerBtnDisabled: { backgroundColor: "#8AAABF" },
  confirmerBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});

export default function Extras() { return null; }
