import { Text, View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';

const LIVRES = [
  { titre:"Les Misérables", auteur:"Victor Hugo", prix:18.90, emoji:"📗", genre:"Roman" },
  { titre:"L'Étranger", auteur:"Albert Camus", prix:8.50, emoji:"📘", genre:"Roman" },
  { titre:"Pars vite et reviens tard", auteur:"Fred Vargas", prix:9.20, emoji:"🔍", genre:"Policier" },
  { titre:"Le Meurtre de Roger Ackroyd", auteur:"Agatha Christie", prix:7.90, emoji:"🕵️", genre:"Policier" },
  { titre:"Dune", auteur:"Frank Herbert", prix:14.90, emoji:"🌑", genre:"Sci-Fi" },
  { titre:"Fondation", auteur:"Isaac Asimov", prix:11.50, emoji:"🚀", genre:"Sci-Fi" },
  { titre:"Harry Potter T.1", auteur:"J.K. Rowling", prix:13.90, emoji:"🧙", genre:"Jeunesse" },
  { titre:"Le Petit Prince", auteur:"Saint-Exupéry", prix:7.50, emoji:"🌹", genre:"Jeunesse" },
];

const GENRES = ["Tous", "Roman", "Policier", "Sci-Fi", "Jeunesse"];

type Livre = typeof LIVRES[0];
type Props = { onAchat: (pts: number) => void };

export default function Boutique({ onAchat }: Props) {
  const [genre, setGenre] = useState("Tous");
  const [panier, setPanier] = useState<Livre[]>([]);
  const [showPanier, setShowPanier] = useState(false);

  const livresFiltres = genre === "Tous" ? LIVRES : LIVRES.filter(l => l.genre === genre);
  const total = panier.reduce((a, b) => a + b.prix, 0);
  const pts = Math.round(total * 10);

  const ajouterAuPanier = (livre: Livre) => {
    setPanier(p => [...p, livre]);
  };

  const validerCommande = () => {
    if (panier.length === 0) return;
    Alert.alert('✅ Commande validée !', `+${pts} points fidélité ajoutés !`, [
      { text: 'Super !', onPress: () => { onAchat(pts); setPanier([]); setShowPanier(false); }}
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitre}>🛍️ Boutique DSM</Text>
        <TouchableOpacity style={styles.panierBtn} onPress={() => setShowPanier(!showPanier)}>
          <Text style={styles.panierTxt}>🛒 {panier.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Genres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
        {GENRES.map(g => (
          <TouchableOpacity key={g} onPress={() => setGenre(g)}
            style={[styles.genreBtn, genre === g && styles.genreBtnActif]}>
            <Text style={[styles.genreTxt, genre === g && styles.genreTxtActif]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Panier ouvert */}
      {showPanier && (
        <View style={styles.panierBox}>
          <Text style={styles.panierTitre}>Mon panier</Text>
          {panier.length === 0
            ? <Text style={styles.panierVide}>Panier vide</Text>
            : panier.map((item, i) => (
              <View key={i} style={styles.panierItem}>
                <Text style={styles.panierEmoji}>{item.emoji}</Text>
                <Text style={styles.panierNom}>{item.titre}</Text>
                <Text style={styles.panierPrix}>{item.prix.toFixed(2)}€</Text>
              </View>
            ))
          }
          {panier.length > 0 && <>
            <View style={styles.panierTotal}>
              <Text style={styles.panierTotalTxt}>Total : {total.toFixed(2)}€</Text>
              <Text style={styles.panierPts}>+{pts} pts</Text>
            </View>
            <TouchableOpacity style={styles.validerBtn} onPress={validerCommande}>
              <Text style={styles.validerTxt}>✅ Valider la commande</Text>
            </TouchableOpacity>
          </>}
        </View>
      )}

      {/* Liste livres */}
      <ScrollView style={styles.liste}>
        <View style={styles.grid}>
          {livresFiltres.map((livre, i) => (
            <View key={i} style={styles.livreCard}>
              <Text style={styles.livreEmoji}>{livre.emoji}</Text>
              <Text style={styles.livreTitre}>{livre.titre}</Text>
              <Text style={styles.livreAuteur}>{livre.auteur}</Text>
              <Text style={styles.livrePrix}>{livre.prix.toFixed(2)} €</Text>
              <Text style={styles.livrePts}>+{Math.round(livre.prix * 10)} pts</Text>
              <TouchableOpacity style={styles.ajouterBtn} onPress={() => ajouterAuPanier(livre)}>
                <Text style={styles.ajouterTxt}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F8FF' },
  header: { backgroundColor: '#061440', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitre: { fontSize: 20, color: '#FFD080', fontWeight: 'bold' },
  panierBtn: { backgroundColor: '#2E86FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  panierTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  genreScroll: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 12, maxHeight: 52 },
  genreBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 99, backgroundColor: '#E0EDFF', marginRight: 8 },
  genreBtnActif: { backgroundColor: '#0A2463' },
  genreTxt: { fontSize: 12, fontWeight: '700', color: '#4A6080' },
  genreTxtActif: { color: '#fff' },
  panierBox: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E0EDFF' },
  panierTitre: { fontSize: 16, fontWeight: 'bold', color: '#0A2463', marginBottom: 10 },
  panierVide: { fontSize: 13, color: '#7AAAD0', textAlign: 'center', padding: 10 },
  panierItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E0EDFF' },
  panierEmoji: { fontSize: 20, marginRight: 10 },
  panierNom: { flex: 1, fontSize: 13, color: '#040D2A' },
  panierPrix: { fontSize: 13, fontWeight: 'bold', color: '#0A2463' },
  panierTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10 },
  panierTotalTxt: { fontSize: 15, fontWeight: 'bold', color: '#0A2463' },
  panierPts: { fontSize: 13, color: '#2E86FF', fontWeight: 'bold' },
  validerBtn: { backgroundColor: '#0A2463', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 10 },
  validerTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  liste: { flex: 1, padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  livreCard: { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E0EDFF' },
  livreEmoji: { fontSize: 34, textAlign: 'center', marginBottom: 8 },
  livreTitre: { fontSize: 12, fontWeight: 'bold', color: '#040D2A', marginBottom: 2, textAlign: 'center' },
  livreAuteur: { fontSize: 10, color: '#7AAAD0', textAlign: 'center', marginBottom: 6 },
  livrePrix: { fontSize: 17, fontWeight: 'bold', color: '#0A2463', textAlign: 'center' },
  livrePts: { fontSize: 10, color: '#2E86FF', textAlign: 'center', marginBottom: 8 },
  ajouterBtn: { backgroundColor: '#0A2463', borderRadius: 10, padding: 9, alignItems: 'center' },
  ajouterTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
