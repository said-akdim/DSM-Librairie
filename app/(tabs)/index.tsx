import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.emoji}>📚</Text>
      </View>
      <Text style={styles.titre}>DSM</Text>
      <Text style={styles.sous}>LIBRAIRIE</Text>
      <Text style={styles.slogan}>Votre univers littéraire</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#061440",
    alignItems: "center",
    justifyContent: "center",
  },
  logoBox: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: "#2E86FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emoji: {
    fontSize: 44,
  },
  titre: {
    fontSize: 48,
    color: "#FFD080",
    letterSpacing: 8,
    fontWeight: "bold",
  },
  sous: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 6,
    marginTop: 4,
  },
  slogan: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
    marginTop: 16,
    letterSpacing: 2,
  },
});
