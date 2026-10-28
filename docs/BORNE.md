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

### Borne Windows

```bash
npm install
npx expo export --platform web --output-dir dist
```

Publier `dist/` sur un petit serveur web (nginx, ou le serveur Odoo lui-même),
puis lancer Chrome au démarrage de Windows :

```
chrome.exe --kiosk --incognito --noerrdialogs ^
  --disable-pinch --overscroll-history-navigation=0 ^
  http://<serveur>/borne
```

Désactiver la mise en veille de l'écran dans les options d'alimentation.

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
