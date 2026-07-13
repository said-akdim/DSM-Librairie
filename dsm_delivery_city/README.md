# DSM - Frais de livraison par ville (Odoo 18)

Ajoute un mode de tarification **« Selon la ville »** aux méthodes de
livraison Odoo : les frais sont calculés automatiquement d'après la ville de
l'adresse de livraison du client.

## Installation

1. Copier le dossier `dsm_delivery_city` dans le répertoire des addons.
2. Mettre à jour la liste des applications, puis installer
   **DSM - Frais de livraison par ville**.
3. Prérequis : le module standard **Frais de livraison** (`delivery`).

## Prêt à l'emploi : méthode « Livraison à domicile (Maroc) »

À l'installation, le module crée une méthode **Livraison à domicile
(Maroc)** déjà configurée : les 50 principales villes marocaines sont dans
la grille avec des **tarifs indicatifs par zone** —

- **35 MAD** : grandes villes et axes bien desservis (Casablanca, Rabat,
  Salé, Fès, Marrakech, Tanger, Meknès, Agadir, Kénitra, Tétouan,
  Mohammedia, El Jadida…) ;
- **45 MAD** : villes moyennes (Oujda, Safi, Béni Mellal, Nador, Taza,
  Settat, Essaouira, Larache…) ;
- **60 MAD** : villes lointaines (Laâyoune, Dakhla, Guelmim, Tan-Tan,
  Tiznit, Errachidia, Ouarzazate, Midelt, Al Hoceïma) — tarif aussi
  appliqué par défaut aux villes hors grille.

La méthode est restreinte au Maroc, avec la **livraison offerte dès
500 MAD d'achat** (champ natif *Gratuit si le montant de la commande
dépasse* — seuil ajustable ou désactivable), et livrée **archivée** pour
ne pas apparaître au checkout avant validation des tarifs.

Le module crée aussi une méthode **Retrait en librairie (gratuit)**
(click & collect, archivée elle aussi) : le client commande en ligne et
récupère ses livres en boutique sans frais.

Pour la mettre en service :

1. **Inventaire → Configuration → Méthodes de livraison**, filtre
   *Archivé* → ouvrir **Livraison à domicile (Maroc)**.
2. Ajuster les tarifs par ville dans l'onglet **Frais par ville**
   (et supprimer les villes non desservies si souhaité).
3. **Désarchiver** la méthode, et la **publier** sur le site web pour le
   checkout eCommerce.

## Configuration manuelle

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

## Villes dans les règles natives « Selon des règles »

Le module améliore aussi le mode natif **Selon des règles** : chaque règle
de prix (`delivery.price.rule`) gagne un champ **Villes**.

- Vide, la règle s'applique partout (comportement natif inchangé).
- Renseigné (villes séparées par des virgules, variantes acceptées), la
  règle n'est utilisée que si la ville de livraison correspond.
- Les règles sont évaluées dans l'ordre natif (séquence) ; la première qui
  correspond gagne. On peut donc combiner ville **et** poids/montant :

  | Séq. | Villes            | Condition      | Coût   |
  |------|-------------------|----------------|--------|
  | 1    | Casablanca, Casa  | quantité >= 0  | 20 MAD |
  | 2    | Rabat, Salé       | quantité >= 0  | 25 MAD |
  | 3    | *(vide = autres)* | quantité >= 0  | 40 MAD |

- Marge, livraison gratuite et restrictions pays/région/code postal
  natives restent appliquées par-dessus.

## Fonctionnement

- Sur un devis, le bouton **Ajouter une livraison** calcule le tarif selon
  la ville de l'adresse de livraison.
- Au checkout eCommerce, le tarif s'affiche automatiquement d'après la
  ville saisie par le client.
- La comparaison des villes ignore la casse, les accents et les tirets
  (`El-Jadida` = `el jadida` = `EL JADIDA`).
- Les champs standards restent utilisables : marge, **livraison gratuite à
  partir d'un montant**, disponibilité par pays/région/code postal.

## Affichage au checkout (normes e-commerce)

Chaque méthode arrive avec des textes prêts pour la vente en ligne :

- **Sous l'option de livraison au checkout** (champ *Description pour les
  devis en ligne*, lié à la description de vente du produit de
  livraison) : délais estimés (24-48 h grandes villes, 2-5 jours villes
  éloignées) et rappel « offerte dès 500 DH » ;
- **Sur le devis et l'e-mail de confirmation de commande** (champ natif
  *Description du transporteur*) : les mêmes informations pour le client.

Le badge de prix, le passage automatique à « Gratuit » au-delà de
500 DH et le recalcul selon la ville saisie sont gérés par le checkout
standard d'Odoo. Pensez à **publier** les méthodes sur le site web
(bouton « Publié » sur la fiche) après les avoir désarchivées.

## Tests automatiques

Le module embarque des tests (`tests/test_delivery_city.py`) couvrant la
normalisation des noms de villes, la tarification par ville et alias
(y compris en arabe), les politiques « ville introuvable », le chargement
des villes du Maroc (idempotent) et les règles natives limitées par ville.

```bash
odoo -d <base> --test-tags /dsm_delivery_city --stop-after-init
```

## Données de démonstration

En base de démo, une méthode « Livraison par ville (démo) » est créée avec
Casablanca (20), Rabat (25), Marrakech (35) et un tarif par défaut de 50.
