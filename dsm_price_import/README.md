# DSM - Mise à jour des prix de vente

Module Odoo 18 : mise à jour en masse des prix de vente (`list_price`)
depuis un fichier CSV ou Excel, directement dans l'interface Odoo.

## Utilisation (après installation)

1. Menu **Ventes → Mise à jour des prix**
2. Charger le fichier CSV ou Excel (code-barres EAN13 + prix de vente,
   avec ou sans en-tête, virgule ou point pour les décimales)
3. Cliquer **Analyser le fichier** → rapport complet, rien n'est modifié :
   - produits trouvés / codes-barres introuvables
   - prix déjà à jour / prix à modifier
   - aperçu ancien prix → nouveau prix
4. Cliquer **✔ Appliquer les changements** (avec confirmation)

Réservé au groupe **Responsable des ventes**.

## Installation (une seule fois, par la personne qui gère le serveur)

```bash
# 1. Copier le dossier dsm_price_import dans le répertoire des addons
#    (le même que dsm_school_supply_orders), par exemple :
cp -r dsm_price_import /opt/odoo/addons/

# 2. Redémarrer Odoo
sudo systemctl restart odoo    # ou docker restart <conteneur>

# 3. Dans Odoo : activer le mode développeur
#    (Paramètres → Outils développeur → Activer)
#    puis Apps → ⟳ Mettre à jour la liste des applications
#    → rechercher « DSM - Mise à jour des prix » → Installer
```

Pour les fichiers Excel (.xlsx), la bibliothèque `openpyxl` doit être
installée sur le serveur (déjà requise par dsm_school_supply_orders).
Les fichiers CSV fonctionnent sans aucune dépendance.
