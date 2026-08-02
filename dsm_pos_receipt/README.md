# DSM - Ticket de caisse simplifié (`dsm_pos_receipt`)

Module Odoo 18 qui nettoie le ticket de caisse du Point de Vente.

## Ce que fait le module

**Avant** (ticket actuel) :

```
LE ROBERT JUNIOR
POCHE PLUS (LE
ROBERT, Michael
Wooldridge)          174,00 DH
1,00  x 174,00 DH / Unité(s)

REMISE              -129,54 DH
1,00  x -129,54 DH / Unité(s)
REMISE               -40,82 DH
1,00  x -40,82 DH / Unité(s)
REMISE              -275,40 DH
1,00  x -275,40 DH / Unité(s)
```

**Après** :

```
LE ROBERT JUNIOR
POCHE PLUS           174,00 DH
1,00  x 174,00 DH / Unité(s)

REMISE              -445,76 DH
```

1. **Titre seul** : la partie finale entre parenthèses du nom du produit
   (catégorie, éditeur, auteur, attributs de variante) n'est plus imprimée.
2. **Remise sur une seule ligne** : toutes les lignes « Remise » (créées par
   le bouton Remise du POS, une par taux de TVA) sont regroupées en une seule
   ligne `REMISE  -XXX,XX DH`, sans le détail « 1,00 x ... / Unité(s) ».

Seule **l'impression du ticket** change. L'écran de caisse, les commandes
enregistrées, les totaux et la TVA restent identiques.

## Installation sur le serveur (agora-prod)

1. Copier le dossier `dsm_pos_receipt/` dans le répertoire des addons du
   serveur Odoo (même endroit que `dsm_school_supply_orders`).
2. Redémarrer Odoo.
3. Apps → Mettre à jour la liste des applications → installer
   **DSM - Ticket de caisse simplifié**.
4. Fermer puis rouvrir la session du Point de Vente (ou recharger la page)
   pour charger les nouveaux assets.

## Remarque

Le nettoyage du titre retire uniquement la parenthèse **en fin de nom**.
Un produit dont le vrai titre contient une parenthèse finale (ex.
« Cahier (grand format) ») serait aussi tronqué sur le ticket — renommer
le produit si besoin.
