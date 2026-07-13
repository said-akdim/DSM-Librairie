# DSM - Frais de livraison par ville (Odoo 18)

Ajoute un mode de tarification **« Selon la ville »** aux méthodes de
livraison Odoo : les frais sont calculés automatiquement d'après la ville de
l'adresse de livraison du client.

## Installation

1. Copier le dossier `dsm_delivery_city` dans le répertoire des addons.
2. Mettre à jour la liste des applications, puis installer
   **DSM - Frais de livraison par ville**.
3. Prérequis : le module standard **Frais de livraison** (`delivery`).

## Configuration

1. Aller dans **Inventaire → Configuration → Méthodes de livraison**
   (ou **Ventes → Configuration → Méthodes de livraison**).
2. Créer une méthode de livraison et choisir le fournisseur
   **Selon la ville**.
3. Dans l'onglet **Frais par ville**, cliquer sur
   **Charger les villes du Maroc** pour pré-remplir la grille avec une
   cinquantaine de villes marocaines (Casablanca, Rabat, Salé, Fès,
   Marrakech, Tanger, Agadir, Oujda, Laâyoune, Dakhla…), chacune avec ses
   variantes d'orthographe en français, anglais et arabe (ex. `Casa`,
   `الدار البيضاء` pour Casablanca). Il ne reste qu'à saisir les tarifs.
   Le bouton restreint aussi la méthode au Maroc et ignore les villes déjà
   présentes (on peut donc le relancer sans créer de doublons).
   On peut aussi ajouter les lignes à la main : le champ
   *Autres orthographes* accepte des variantes séparées par des virgules.
4. Choisir le comportement quand la ville du client n'est pas dans la
   grille :
   - **Refuser la livraison** : la méthode n'est pas proposée / affiche une
     erreur ;
   - **Appliquer un tarif par défaut** : le montant du champ
     *Tarif par défaut* est utilisé.

## Fonctionnement

- Sur un devis, le bouton **Ajouter une livraison** calcule le tarif selon
  la ville de l'adresse de livraison.
- Au checkout eCommerce, le tarif s'affiche automatiquement d'après la
  ville saisie par le client.
- La comparaison des villes ignore la casse, les accents et les tirets
  (`El-Jadida` = `el jadida` = `EL JADIDA`).
- Les champs standards restent utilisables : marge, **livraison gratuite à
  partir d'un montant**, disponibilité par pays/région/code postal.

## Données de démonstration

En base de démo, une méthode « Livraison par ville (démo) » est créée avec
Casablanca (20), Rabat (25), Marrakech (35) et un tarif par défaut de 50.
