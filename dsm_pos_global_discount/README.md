# DSM - Remise globale POS (`dsm_pos_global_discount`)

Module Odoo 18 : remise globale en pourcentage sur toute la commande du
Point de Vente, **sans aucune ligne « Remise »** sur la commande.

## Principe (et pourquoi c'est sûr comptablement)

Inspiré du module OCA `sale_global_discount`, mais adapté au POS avec une
approche plus sûre : au lieu de recalculer la TVA à la main, le bouton
applique le pourcentage sur le champ **remise (%) natif** de chaque ligne
de commande. C'est le cœur d'Odoo qui recalcule les montants et la TVA,
ligne par ligne et taux par taux — aucun calcul de taxe personnalisé,
aucun risque d'écart comptable.

## Utilisation en caisse

1. Ajouter les produits à la commande.
2. Ouvrir les actions (bouton ⋮ / « Actions ») → **Remise globale**.
3. Saisir le pourcentage (ex. `12`). Il s'applique à toutes les lignes.
4. Pour annuler la remise : rouvrir le bouton et saisir `0`.

⚠️ Si un produit est ajouté **après** avoir appliqué la remise globale, il
n'est pas remisé automatiquement : ré-appliquer le bouton pour l'inclure.

## Rendu du ticket

```
Taille crayon - 2 trous      10,50 DH
1,00  x 10,50 DH / Unité(s)
LE ROBERT JUNIOR POCHE
PLUS                        174,00 DH
1,00  x 174,00 DH / Unité(s)

REMISE GLOBALE (12%)        -22,14 DH
--------------------------------
Montant hors taxes          xxx,xx DH
TVA 20% ...                  xx,xx DH
--------------------------------
TOTAL                       xxx,xx DH
```

- Les produits sont imprimés au **prix normal** (avant remise).
- Une **seule ligne** « REMISE GLOBALE (X%) » apparaît avant les totaux.
- Les totaux et la TVA imprimés sont les montants réels après remise.
- La mention « avec X% de remise » sous chaque ligne est masquée.

La remise globale est reconnue quand **toutes** les lignes portent le même
pourcentage. Si les remises diffèrent d'une ligne à l'autre (remises
manuelles mélangées), le ticket reprend l'affichage standard d'Odoo.

## Installation sur le serveur (agora-prod)

1. Copier le dossier `dsm_pos_global_discount/` dans le répertoire des
   addons du serveur Odoo (même endroit que `dsm_school_supply_orders`).
2. Redémarrer Odoo.
3. Apps → Mettre à jour la liste des applications → installer
   **DSM - Remise globale POS**.
4. Fermer puis rouvrir la session du Point de Vente.

**Tester d'abord sur une base de test avant `agora-prod`** : faire une
vente avec remise globale, vérifier le ticket, puis contrôler la commande
POS dans le back-office (remise % visible sur chaque ligne, TVA correcte).

## Compatibilité

- Compatible avec `dsm_pos_receipt` (titres nettoyés + regroupement des
  anciennes lignes Remise) — les deux modules peuvent être installés
  ensemble.
- L'ancien bouton « Remise » d'Odoo (`pos_discount`, qui crée des lignes
  Remise par taux de TVA) reste utilisable, mais il est recommandé
  d'utiliser désormais « Remise globale » à la place.
