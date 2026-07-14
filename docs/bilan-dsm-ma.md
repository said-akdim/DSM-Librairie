# Bilan du site dsm.ma & proposition de design

*Établi le 14 juillet 2026 — DSM Librairie*

## 1. Portée et méthode

L'environnement d'exécution de cette session applique une politique réseau restrictive :
les requêtes vers `dsm.ma` (et vers les services d'archives web) sont bloquées au niveau
du proxy de la session, avant même d'atteindre le site. **Le site en ligne n'a donc pas pu
être chargé ni audité visuellement depuis cette session.**

Ce bilan repose donc sur deux volets :

1. **Constats vérifiables** tirés du dépôt `DSM-Librairie` (configuration, architecture,
   points de sécurité) — section 2.
2. **Grille d'audit** à dérouler sur dsm.ma, avec les vérifications précises à faire et
   les seuils attendus — section 3. Si l'accès réseau à `dsm.ma` est autorisé dans les
   paramètres de l'environnement (Claude Code on the web → Environment → Network policy),
   l'audit réel (captures d'écran, performance, SEO) peut être exécuté dans une prochaine
   session.

## 2. Constats tirés du dépôt (vérifiés)

### Architecture actuelle

| Composant | Détail |
|---|---|
| ERP / back-office | Odoo 18, base `agora-prod`, hébergé sur `94.130.90.253:9069` |
| Application mobile | Expo / React Native (carte fidélité, boutique, caisse) |
| Notifications | Supabase + WebSocket (`:8090`) |
| Listes scolaires | Module Odoo maison `dsm_school_supply_orders` (import Excel, commandes par titre) |

### ⚠️ Point de sécurité prioritaire : trafic non chiffré

`app/config.ts` pointe la production en **HTTP simple** :

- `ODOO_URL = "http://94.130.90.253:9069"` (ni HTTPS, ni nom de domaine)
- `WS_URL = "ws://94.130.90.253:8090"` (WebSocket non chiffré)

Conséquences : les identifiants Odoo et les données clients (fidélité, commandes)
transitent **en clair** sur le réseau. De plus, iOS (ATS) et Android bloquent par défaut
le trafic HTTP non chiffré — l'app risque des refus de connexion en build de production.

**Recommandation** : placer un reverse proxy (Nginx ou Caddy) devant Odoo avec un
sous-domaine dédié, p. ex. `erp.dsm.ma` → certificat Let's Encrypt gratuit → remplacer
les URLs par `https://erp.dsm.ma` et `wss://…`. Effort : ~1 journée.

### Autres observations

- `odoo_produits.py` référence une base `Dsm` en `localhost:8069` : à aligner avec la
  prod pour éviter les scripts qui tournent sur la mauvaise base.
- Le `README.md` est encore celui du gabarit Expo : à remplacer par une vraie
  documentation du projet (composants, environnements, procédure de déploiement).
- Les assets (`assets/images/`) sont encore les logos React/Expo par défaut : l'icône et
  le splash screen de l'app ne portent pas encore la marque DSM.

## 3. Grille d'audit dsm.ma (à dérouler sur le site en ligne)

### 3.1 Technique & sécurité

- [ ] **HTTPS** actif avec redirection automatique `http://` → `https://` et certificat valide
- [ ] Redirection propre entre `dsm.ma` et `www.dsm.ma` (une seule version canonique)
- [ ] **Performance mobile** : viser un score Lighthouse ≥ 70 mobile ; LCP < 2,5 s ; images en WebP et dimensionnées
- [ ] Pas d'erreurs JavaScript en console, pas de liens 404
- [ ] Si le site est un Odoo Website : version à jour et modules e-commerce activés proprement

### 3.2 SEO local (levier n°1 pour une librairie de quartier)

- [ ] Balises `<title>` et meta description uniques par page (« Librairie papeterie à Casablanca — DSM », pas « Home »)
- [ ] **Fiche Google Business Profile** revendiquée, avec horaires, photos, avis — c'est ce qui capte « librairie près de moi »
- [ ] Fiches produits livres avec **ISBN, auteur, éditeur** en données structurées (`schema.org/Book`, `Product` + `Offer` avec prix en MAD)
- [ ] Sitemap XML soumis à Google Search Console
- [ ] Si contenu bilingue FR/AR : balises `hreflang` et vraie version arabe (RTL), pas de traduction automatique

### 3.3 E-commerce & conversion

- [ ] La recherche est-elle visible et tolérante (titre, auteur, ISBN, faute de frappe) ? C'est le premier geste sur un site de librairie
- [ ] Prix en DH visibles partout, stock indiqué (« en stock », « sur commande »)
- [ ] Tunnel de commande court : invité possible, paiement CMI/carte + paiement à la livraison
- [ ] **Le service listes scolaires est-il visible en ligne ?** C'est le différenciateur de DSM (module Odoo déjà développé) — il devrait être l'offre phare du site, pas seulement un service en magasin
- [ ] Le programme fidélité (app mobile) est-il relié au site (mêmes points en ligne et en magasin) ?

### 3.4 Contenu & confiance

- [ ] Adresse, téléphone, horaires visibles dès le pied de page
- [ ] Mentions légales, CGV, politique de retour
- [ ] Photos réelles du magasin et de l'équipe (confiance locale)

## 4. Proposition de design

Une maquette complète de page d'accueil est fournie dans **`docs/maquette-dsm-ma.html`**
(ouvrable dans n'importe quel navigateur, aucun fichier externe requis).

### Direction retenue

- **Identité** : reprise des couleurs déjà installées par l'app fidélité — encre
  `#0A2463` / nuit `#071538` + safran `#F5A623` / sable doré `#FFD080` — pour que le
  site, l'app et la carte fidélité forment une seule marque.
- **Typographie** : serif littéraire pour les titres (registre « librairie »), sans-serif
  système pour le corps et l'interface (rapidité, aucune dépendance externe).
- **Hiérarchie de la page** :
  1. Héro consacré aux **listes scolaires** (« Déposez la liste de votre école, on
     prépare le pack ») — le service que la concurrence n'a pas ;
  2. Parcours en 3 étapes (école → pack préparé → retrait/livraison) ;
  3. Univers produits (scolaire, littérature, fournitures, papeterie, beaux-arts, bureau) ;
  4. Sélection du libraire avec les **œuvres au programme marocain** (Sefrioui,
     Khaïr-Eddine…) : fort trafic SEO saisonnier ;
  5. Bloc fidélité reprenant la carte de l'app (continuité magasin ↔ app ↔ site) ;
  6. Barre de réassurance (retrait 48 h, livraison Maroc, paiement, conseil).
- **E-commerce d'abord** : recherche « titre, auteur, ISBN » dominante dans le header,
  panier persistant, prix en DH avec chiffres tabulaires.

### Mise en œuvre suggérée

Si dsm.ma est (ou devient) un site Odoo Website, cette direction se transpose bien :
thème aux couleurs ci-dessus, page d'accueil reconstruite par blocs dans cet ordre, et
le module `dsm_school_supply_orders` exposé côté portail client pour la commande de
packs scolaires en ligne.

## 5. Prochaines étapes proposées

1. **Sécurité (urgent)** : HTTPS sur l'instance Odoo + sous-domaine `erp.dsm.ma`.
2. Autoriser `dsm.ma` dans la politique réseau de l'environnement pour exécuter l'audit
   réel (captures, performance, SEO) et transformer la grille de la section 3 en constats.
3. Valider / amender la maquette `docs/maquette-dsm-ma.html`, puis décliner les pages
   suivantes (fiche produit livre, page « Rentrée scolaire », tunnel de commande).
