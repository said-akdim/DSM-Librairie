#!/bin/bash
# ══════════════════════════════════════
# DSM Librairie - Détection IP automatique
# ══════════════════════════════════════

echo "🔍 Détection de l'IP Mac..."

# Détecter l'IP locale
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo "✅ IP détectée : $IP"

# Fichiers à mettre à jour
FILES=(
  "/Users/mac/Documents/DSM-Librairie/app/index.tsx"
  "/Users/mac/Documents/DSM-Librairie/app/extras.tsx"
  "/Users/mac/Documents/DSM-Librairie/app/caisse.tsx"
)

# Remplacer toutes les IPs dans les fichiers
for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    # Remplacer n'importe quelle IP 192.168.x.x par la nouvelle
    sed -i '' "s|http://192\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}:8069|http://$IP:8069|g" "$FILE"
    sed -i '' "s|ws://192\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}:8090|ws://$IP:8090|g" "$FILE"
    echo "✅ Mis à jour : $(basename $FILE)"
  else
    echo "⚠️  Fichier non trouvé : $FILE"
  fi
done

echo ""
echo "🚀 Configuration DSM :"
echo "   Odoo    : http://$IP:8069"
echo "   WebSocket: ws://$IP:8090"
echo ""
echo "▶️  Lancez l'app avec : npx expo start"
