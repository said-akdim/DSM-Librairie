# Borne de prix DSM — installation

Écran libre-service : le client présente un article, la borne affiche son nom
et son prix public. Code : `app/borne.tsx` (écran) et `app/odoo18.ts`
(connexion Odoo 18). Route `/borne`, aussi accessible depuis l'onglet
« Plus » de l'application.

## 1. Matériel — à exiger du fournisseur

Borne tout-en-un murale avec lecteur intégré (type lecteur de prix magasin).

| Point | Exigence | Pourquoi |
|---|---|---|
| Mode du lecteur | **HID / émulation clavier**, suffixe **Entrée (CR)** | La borne valide le code sur Entrée. Réglable par code-barres de configuration. |
| Déclenchement | **Mode présentation / auto-sense** | Le client ne doit appuyer sur rien. |
| Type de lecteur | **Imageur 2D** | Lit les ISBN abîmés, les codes incurvés ou brillants, et les QR. |
| Disposition clavier | Identique entre le lecteur et l'appareil (AZERTY/QWERTY) | Sinon les chiffres scannés sortent faux. |
| Système | **Android** (APK) ou **Windows** (navigateur en mode kiosque) | Les deux sont pris en charge, voir §3. |
| Réseau | Wi-Fi ou Ethernet atteignant le serveur Odoo | La borne interroge Odoo à chaque scan. |

Demander au fournisseur une **démonstration du lecteur en mode clavier** :
ouvrir un bloc-notes sur la borne, scanner un article, le code doit s'écrire
puis passer à la ligne tout seul. Si c'est le cas, la borne fonctionnera.

## 2. Compte Odoo de la borne

Créer dans Odoo un utilisateur dédié, **en lecture seule** — une borne en
libre-service ne doit pas porter un compte administrateur.

1. Paramètres → Utilisateurs → Nouveau : nom `Borne de prix`, login `borne`.
2. Droits : *Ventes → aucun*, *Inventaire → aucun*, uniquement l'accès de base
   (lecture des articles). Aucun droit d'écriture, aucun accès comptabilité.
3. Mot de passe long, noté dans le coffre de l'équipe.

La borne lit `product.product` / `product.template` (nom, prix, code-barres,
référence) et, si le module DSM est installé, `dsm_editeur`.

## 3. Installation de l'application

Copier `.env.borne.exemple` en `.env`, renseigner l'URL du serveur, la base et
le compte créé ci-dessus. Ces variables sont lues **au moment du build**.

### Borne Android

```bash
npm install
npx expo install --check
eas build --platform android --profile preview   # produit un APK
```

Sur la borne : installer l'APK, ouvrir l'application, aller dans
**Plus → Borne de prix** (ou lancer directement `dsmlibrairie://borne`).

Verrouillage en mode kiosque :
- Android → Paramètres → Sécurité → **Épinglage d'écran**, puis épingler l'app ;
- ou un lanceur kiosque si le fournisseur en livre un (fréquent sur ces bornes).

L'écran reste allumé en permanence (l'app désactive la mise en veille).

### Borne Windows 10 (procédure retenue)

> **Pourquoi un serveur local ?** Dans un navigateur, une page servie depuis
> une origine ne peut pas appeler Odoo sur une autre adresse : le navigateur
> bloque la requête (CORS) et refuse de renvoyer le cookie de session. Le
> petit serveur `kiosque/serveur-borne.js` sert l'application **et** relaie
> les appels `/web/...` vers Odoo : le navigateur ne voit qu'une seule
> origine, tout passe. Il n'exige aucune modification du serveur Odoo.

**a. Sur un poste de travail — produire l'application**

```bash
npm install
EXPO_PUBLIC_ODOO_URL= EXPO_PUBLIC_ODOO_DB=agora-prod \
EXPO_PUBLIC_ODOO_LOGIN=borne EXPO_PUBLIC_ODOO_PASSWORD=<mot_de_passe> \
npx expo export --platform web --output-dir dist
```

`EXPO_PUBLIC_ODOO_URL` **vide** est volontaire : les appels partent alors en
`/web/...` sur la même origine, c'est-à-dire vers le relais local.

**b. Sur la borne — installer**

1. Installer **Node.js LTS** (https://nodejs.org) et **Google Chrome**.
2. Copier sur la borne, par exemple dans `C:\BorneDSM\` :
   - le dossier `dist/` produit à l'étape a ;
   - le dossier `kiosque/` du dépôt.
3. Ouvrir `kiosque\demarrer-borne.bat` dans le Bloc-notes et vérifier
   `ODOO_CIBLE` (adresse du serveur Odoo vue depuis la borne) et `PORT`.
4. Double-cliquer sur `demarrer-borne.bat` : Chrome s'ouvre en plein écran
   sur l'écran d'attente. Scanner un article pour vérifier.

**c. Démarrage automatique**

`Win+R` → `shell:startup` → y placer un raccourci vers `demarrer-borne.bat`.
La borne redémarre donc seule après une coupure de courant.

**d. Réglages Windows**

```bat
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
powercfg /change disk-timeout-ac 0
```

- Désactiver l'écran de verrouillage et la veille prolongée.
- Désactiver les redémarrages automatiques de Windows Update aux heures
  d'ouverture (heures d'activité).
- Vérifier que la **disposition du clavier Windows** correspond à celle
  configurée dans le lecteur, sinon les chiffres scannés sortent faux.
- `arreter-borne.bat` ferme Chrome et le serveur pour la maintenance.
  En mode kiosque, `Alt+F4` ferme aussi Chrome ; pour un verrouillage
  complet, utiliser l'**accès attribué** de Windows 10 (Paramètres →
  Comptes → Autres utilisateurs → Configurer un kiosque).

## 4. Exploitation

- **Barre technique** en bas d'écran : horodatage, voyant de liaison
  (`DIRECTE` vert, `CONNEXION…` orange, `HORS LIGNE` rouge), base et version
  Odoo, bascule **caméra ↔ douchette**. Sur une borne à lecteur intégré,
  rester en mode **douchette**.
- **Retour automatique** à l'écran d'attente 10 s après un affichage.
- **Liaison vérifiée chaque minute** en veille : si Odoo redémarre, la session
  est rouverte toute seule.
- **Article non reconnu** : code affiché, invitation à voir un libraire. Cela
  signale en général un article sans code-barres renseigné dans Odoo.
- **Serveur injoignable** : écran « Borne momentanément indisponible ». Le
  message technique n'est jamais montré au client.

## 5. Limites connues

- La borne affiche le **prix public** enregistré dans Odoo. Les listes de prix
  (`product.pricelist`) ne sont pas appliquées : les méthodes de calcul d'Odoo 18
  ne sont pas appelables en RPC, il faudrait lire les règles et les appliquer
  côté borne.
- Pas de cache local : une coupure réseau rend la borne inopérante le temps de
  la coupure.
