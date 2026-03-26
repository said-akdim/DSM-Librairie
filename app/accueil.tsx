import { Text, View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

type Props = {
  client: { prenom: string; nom: string; points: number; niveau: string; numCarte: string };
  onDeconnexion: () => void;
};

export default function Accueil({ client, onDeconnexion }: Props) {
  const pct = Math.min((client.points / 2000) * 100, 100);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.bonjour}>Bonjour,</Text>
          <Text style={styles.nom}>{client.prenom} {client.nom}</Text>
        </View>
        <TouchableOpacity onPress={onDeconnexion} style={styles.logoutBtn}>
          <Text style={styles.logoutTxt}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* Carte fidélité */}
      <View style={styles.carte}>
        <View style={styles.carteHeader}>
          <View>
            <Text style={styles.carteLogo}>DSM</Text>
            <Text style={styles.carteSous}>Librairie · Fidélité</Text>
          </View>
          <View style={styles.niveauBadge}>
            <Text style={styles.niveauTexte}>🥇 {client.niveau}</Text>
          </View>
        </View>
        <Text style={styles.carteNom}>{client.prenom} {client.nom}</Text>
        <Text style={styles.ptsLabel}>POINTS FIDÉLITÉ</Text>
        <Text style={styles.pts}>{client.points.toLocaleString()}</Text>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%` as any }]} />
        </View>
        <View style={styles.carteFooter}>
          <Text style={styles.numCarte}>•••• •••• •••• {client.numCarte}</Text>
          <Text style={styles.fidelite}>FIDÉLITÉ</Text>
        </View>
      </View>

      {/* Actions rapides */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>🛍️</Text>
          <Text style={styles.actionLabel}>Boutique</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGold]}>
          <Text style={styles.actionIcon}>✨</Text>
          <Text style={[styles.actionLabel, { color: '#1a1a00' }]}>Conseiller IA</Text>
        </TouchableOpacity>
      </View>

      {/* Infos */}
      <View style={styles.infoGrid}>
        {[
          { icon: '📚', label: 'Genre', val: 'Policier' },
          { icon: '⭐', label: 'Niveau', val: client.niveau },
          { icon: '🎁', label: 'Offres', val: '2 actives' },
          { icon: '🤝', label: 'Filleuls', val: '1' },
        ].map((item, i) => (
          <View key={i} style={styles.infoCard}>
            <Text style={styles.infoIcon}>{item.icon}</Text>
            <Text style={styles.infoVal}>{item.val}</Text>
            <Text style={styles.infoLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F8FF' },
  header: {
    backgroundColor: '#061440',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bonjour: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  nom: { fontSize: 22, color: '#fff', fontWeight: 'bold' },
  logoutBtn: {
    width: 36, height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTxt: { fontSize: 18 },
  carte: {
    margin: 16,
    backgroundColor: '#0A2463',
    borderRadius: 20,
    padding: 22,
  },
  carteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  carteLogo: { fontSize: 22, color: '#FFD080', fontWeight: 'bold', letterSpacing: 4 },
  carteSous: { fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 3 },
  niveauBadge: {
    backgroundColor: '#F5A623',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  niveauTexte: { fontSize: 11, fontWeight: 'bold', color: '#1a1a00' },
  carteNom: { fontSize: 18, color: '#fff', marginBottom: 12 },
  ptsLabel: { fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  pts: { fontSize: 34, color: '#FFD080', fontWeight: 'bold' },
  barBg: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 99, height: 5, marginVertical: 10 },
  barFill: { height: 5, backgroundColor: '#F5A623', borderRadius: 99 },
  carteFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  numCarte: { fontSize: 14, color: '#fff', letterSpacing: 4, fontWeight: 'bold' },
  fidelite: { fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 14 },
  actionBtn: {
    flex: 1, backgroundColor: '#0A2463',
    borderRadius: 14, padding: 16, alignItems: 'flex-start',
  },
  actionBtnGold: { backgroundColor: '#F5A623' },
  actionIcon: { fontSize: 26, marginBottom: 6 },
  actionLabel: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
  infoGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginHorizontal: 16,
  },
  infoCard: {
    width: '47%', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#E0EDFF',
  },
  infoIcon: { fontSize: 24, marginBottom: 6 },
  infoVal: { fontSize: 16, fontWeight: 'bold', color: '#0A2463' },
  infoLabel: { fontSize: 10, color: '#7AAAD0', marginTop: 2 },
});
