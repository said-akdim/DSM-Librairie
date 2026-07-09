# -*- coding: utf-8 -*-
"""
Mise à jour des PRIX DE VENTE Odoo 18 via XML-RPC — DSM Librairie
Fichier autonome : fonctionne dans Google Colab (colab.research.google.com)
ou avec n'importe quel Python 3, sans rien installer.

Déroulement :
  1. Vous fournissez le fichier CSV (barcode;prix_vente)
  2. Connexion à Odoo (XML-RPC, simple login/mot de passe — pas de SSH)
  3. SIMULATION : rapport complet, rien n'est modifié
  4. Vous tapez « oui » pour appliquer réellement
"""

import csv
import getpass
import sys
import xmlrpc.client

ODOO_URL = "http://94.130.90.253:9069"
ODOO_DB = "agora-prod"
TAILLE_LOT = 500


# ── 1. Récupération du fichier CSV ──────────────────────────────
def charger_csv() -> list[tuple[str, float]]:
    try:  # Dans Google Colab : fenêtre d'envoi de fichier
        from google.colab import files  # type: ignore

        print("➜ Envoyez votre fichier CSV (prix_vente_test.csv ou prix_vente_2026_2027.csv)")
        envoyes = files.upload()
        contenu = next(iter(envoyes.values())).decode("utf-8-sig")
    except ImportError:  # Python classique : chemin du fichier
        chemin = input("Chemin du fichier CSV : ").strip().strip('"')
        with open(chemin, encoding="utf-8-sig") as f:
            contenu = f.read()

    premiere = contenu.splitlines()[0] if contenu.splitlines() else ""
    separateur = max((";", ",", "\t"), key=premiere.count)
    entrees, vus, ignorees = [], set(), 0
    for ligne in csv.reader(contenu.splitlines(), delimiter=separateur):
        cellules = [c.strip() for c in ligne if c.strip()]
        if len(cellules) < 2:
            ignorees += bool(cellules)
            continue
        code, brut = cellules[0], cellules[-1]
        try:
            prix = float(brut.replace(" ", "").replace(",", "."))
        except ValueError:
            ignorees += 1  # en-tête ou ligne invalide
            continue
        if not code.isdigit() or prix <= 0 or code in vus:
            ignorees += code not in vus
            continue
        vus.add(code)
        entrees.append((code, prix))
    if not entrees:
        sys.exit("Erreur : aucune ligne exploitable (format attendu : code-barres;prix)")
    print(f"✔ Fichier lu : {len(entrees)} articles uniques ({ignorees} ligne(s) invalide(s) ignorée(s))")
    return entrees


# ── 2. Connexion Odoo ───────────────────────────────────────────
def connecter() -> tuple:
    url = input(f"URL Odoo [{ODOO_URL}] : ").strip() or ODOO_URL
    db = input(f"Base de données [{ODOO_DB}] : ").strip() or ODOO_DB
    login = input("Login Odoo : ").strip()
    mdp = getpass.getpass("Mot de passe Odoo : ")

    common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common", allow_none=True)
    uid = common.authenticate(db, login, mdp, {})
    if not uid:
        sys.exit("Erreur : authentification refusée — vérifiez login/mot de passe")
    modeles = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object", allow_none=True)
    print(f"✔ Connecté à {url} (base {db}, utilisateur #{uid})")
    return modeles, db, uid, mdp


# ── 3. Simulation puis application ──────────────────────────────
def executer(modeles, db: str, uid: int, mdp: str, entrees: list[tuple[str, float]]) -> None:
    def rpc(methode, *args, **kwargs):
        return modeles.execute_kw(db, uid, mdp, "product.template", methode, list(args), kwargs)

    # Correspondance code-barres → produit(s)
    codes = [c for c, _ in entrees]
    correspondance: dict[str, list[int]] = {}
    for debut in range(0, len(codes), TAILLE_LOT):
        lot = codes[debut : debut + TAILLE_LOT]
        for p in rpc("search_read", [["barcode", "in", lot]], fields=["id", "barcode", "name", "list_price"]):
            correspondance.setdefault(str(p["barcode"]), []).append(p["id"])
        print(f"  … recherche {min(debut + TAILLE_LOT, len(codes))}/{len(codes)}")

    maj: dict[float, list[int]] = {}
    introuvables = []
    for code, prix in entrees:
        ids = correspondance.get(code)
        if ids:
            maj.setdefault(round(prix, 2), []).extend(ids)
        else:
            introuvables.append(code)

    nb = sum(len(v) for v in maj.values())
    print("\n════════ RAPPORT (SIMULATION — rien n'est encore modifié) ════════")
    print(f"  Produits trouvés dans Odoo : {nb}")
    print(f"  Codes-barres introuvables  : {len(introuvables)}")
    if introuvables:
        print("  Liste des introuvables :")
        for c in introuvables[:30]:
            print(f"    - {c}")
        if len(introuvables) > 30:
            print(f"    … et {len(introuvables) - 30} autres")
    if not maj:
        sys.exit("Rien à mettre à jour.")

    # Aperçu avant/après sur quelques produits
    apercu_ids = [ids[0] for ids in list(maj.values())[:5]]
    prix_par_id = {pid: prix for prix, ids in maj.items() for pid in ids}
    print("\n  Aperçu (5 premiers) :")
    for p in rpc("read", apercu_ids, fields=["name", "barcode", "list_price"]):
        print(f"    {p['barcode']} | {p['name'][:45]:45s} | {p['list_price']:.2f} → {prix_par_id[p['id']]:.2f}")

    reponse = input(f"\n➜ Appliquer ces {nb} changements ? (tapez oui pour confirmer) : ").strip().lower()
    if reponse not in ("oui", "o", "yes", "y"):
        print("Abandon — aucun prix modifié.")
        return

    total = 0
    for prix, ids in sorted(maj.items()):
        for debut in range(0, len(ids), TAILLE_LOT):
            lot = ids[debut : debut + TAILLE_LOT]
            rpc("write", lot, {"list_price": prix})
            total += len(lot)
    print(f"\n✔ TERMINÉ : {total} produit(s) mis à jour.")


if __name__ == "__main__":
    entrees = charger_csv()
    modeles, db, uid, mdp = connecter()
    executer(modeles, db, uid, mdp, entrees)
