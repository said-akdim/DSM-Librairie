# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Outils Odoo 18

### Module Odoo : mise à jour des prix dans l'interface

Le module **`dsm_price_import/`** ajoute un menu **Ventes → Mise à jour des prix**
dans Odoo : chargement d'un fichier CSV/Excel, rapport d'analyse, puis
application des prix de vente. Voir `dsm_price_import/README.md` pour
l'installation.

### Mise à jour en masse des prix de vente (CSV / Excel)

Le script `update_prix_vente_csv.py` met à jour le prix de vente (`list_price`)
de toute la base Odoo 18 à partir d'un fichier `.csv` ou `.xlsx` :

```bash
# Simulation (aucune écriture)
python update_prix_vente_csv.py prix.csv --login admin

# Application réelle
python update_prix_vente_csv.py prix.csv --login admin --apply
```

Le fichier doit contenir une colonne d'identification (`barcode`/`isbn`/`ean`,
`reference` ou `id`) et une colonne prix (`prix_vente`, `prix`, `pv`…).
Voir `exemple_prix_vente.csv` pour le format, et l'en-tête du script pour les détails.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
