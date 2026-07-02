# DSM Réception — appli terminal Honeywell

Petite application Expo autonome, dédiée au terminal Honeywell (douchette)
utilisé en réserve pour scanner les livres reçus et compter les quantités.

Écran unique : pas de connexion, pas de boutique — juste le scan et la liste.

## Fonctionnement

- Le champ de saisie reste toujours actif pour recevoir le flux clavier
  envoyé par le scanner intégré du Honeywell (mode "keyboard wedge" /
  émulation clavier — réglage habituel dans les paramètres du scanner de
  l'appareil, terminé par un retour à la ligne).
- Un bouton caméra permet de scanner en secours si besoin (ex. test sur un
  téléphone classique).
- Chaque code scanné est recherché dans Odoo (lecture seule, par
  code-barres). Si le même code est rescanné, la quantité s'incrémente.
- La liste (titre, éditeur, quantité, stock actuel/nouveau) peut être
  partagée ou envoyée par email en fin de réception. **Aucune écriture
  automatique dans le stock Odoo** — la mise à jour se fait manuellement
  par l'équipe.

## Installer sur le terminal Honeywell

### Test rapide (sans build)

1. Installer **Expo Go** depuis le Play Store sur le terminal.
2. Depuis ce dossier : `npm install` puis `npx expo start`.
3. Scanner le QR code affiché avec Expo Go (même réseau Wi-Fi, ou
   `npx expo start --tunnel` si les réseaux diffèrent).

### Installation définitive (APK)

1. `npm install`
2. `npx expo prebuild` (génère le projet Android natif)
3. `npx expo run:android` (build + installe directement sur le terminal
   connecté en USB), ou `eas build --platform android` pour obtenir un
   APK à distribuer/installer manuellement.

Après installation, vérifier dans les réglages du scanner Honeywell que
la sortie est bien configurée en mode clavier (keyboard wedge/HID) avec
un retour à la ligne après chaque code — c'est en général le réglage
par défaut.
