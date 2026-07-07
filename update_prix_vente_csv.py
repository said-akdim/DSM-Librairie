"""
Mise à jour en masse des PRIX DE VENTE (list_price) Odoo 18
depuis un fichier CSV ou Excel (.xlsx) — DSM Librairie

Usage :
    # Simulation (aucune écriture, affiche ce qui serait modifié)
    python update_prix_vente_csv.py prix.csv --login admin --password xxx

    # Application réelle des changements
    python update_prix_vente_csv.py prix.csv --login admin --password xxx --apply

    # Fichier Excel
    python update_prix_vente_csv.py prix.xlsx --login admin --password xxx --apply

Format du fichier (1ère ligne = en-têtes) :
    - Une colonne d'identification du produit, au choix :
        barcode / code_barre / codebarre / ean / isbn      → code-barres
        default_code / reference / ref                     → référence interne
        id                                                 → ID Odoo
    - Une colonne prix de vente :
        prix_vente / prix / pv / list_price / prix de vente

Exemple CSV :
    barcode;prix_vente
    9782070368228;8,90
    9782253004226;7,50

Les décimales avec virgule (export Excel français) sont acceptées.
Aucune dépendance externe requise (openpyxl utilisé pour .xlsx s'il est
installé, sinon un lecteur intégré minimal prend le relais).
"""

import argparse
import csv
import getpass
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from odoo_produits import OdooSession

ODOO_URL_DEFAUT = "http://94.130.90.253:9069"
ODOO_DB_DEFAUT = "agora-prod"

# Colonnes reconnues (normalisées : minuscules, sans espaces/accents)
COLONNES_BARCODE = {"barcode", "codebarre", "codebarres", "code_barre", "code_barres", "ean", "ean13", "isbn"}
COLONNES_REFERENCE = {"default_code", "reference", "ref", "refinterne", "reference_interne"}
COLONNES_ID = {"id", "product_id", "id_produit"}
COLONNES_PRIX = {"prix_vente", "prixvente", "prixdevente", "prix", "pv", "list_price", "listprice", "prixpublic"}

TAILLE_LOT = 500  # produits recherchés / écrits par requête


# ─────────────────────────────────────────────
# Lecture du fichier (CSV ou XLSX)
# ─────────────────────────────────────────────

def _normaliser(texte: str) -> str:
    texte = texte.strip().lower()
    for a, b in (("é", "e"), ("è", "e"), ("ê", "e"), ("à", "a"), ("-", "_"), (" ", "_")):
        texte = texte.replace(a, b)
    return re.sub(r"_+", "_", texte).strip("_")


def _correspond(entete: str, colonnes: set[str]) -> bool:
    return entete in colonnes or entete.replace("_", "") in {c.replace("_", "") for c in colonnes}


def lire_csv(chemin: Path) -> list[list[str]]:
    """Lit un CSV en détectant le séparateur (; ou , ou tab)."""
    contenu = chemin.read_text(encoding="utf-8-sig", errors="replace")
    premiere_ligne = contenu.splitlines()[0] if contenu.splitlines() else ""
    separateur = max((";", ",", "\t"), key=premiere_ligne.count)
    return [ligne for ligne in csv.reader(contenu.splitlines(), delimiter=separateur) if any(c.strip() for c in ligne)]


def lire_xlsx(chemin: Path) -> list[list[str]]:
    """Lit la première feuille d'un .xlsx (openpyxl si dispo, sinon lecteur intégré)."""
    try:
        import openpyxl  # type: ignore

        wb = openpyxl.load_workbook(chemin, read_only=True, data_only=True)
        feuille = wb.worksheets[0]
        lignes = [["" if cellule is None else str(cellule) for cellule in ligne] for ligne in feuille.iter_rows(values_only=True)]
        wb.close()
        return [l for l in lignes if any(c.strip() for c in l)]
    except ImportError:
        return _lire_xlsx_minimal(chemin)


def _lire_xlsx_minimal(chemin: Path) -> list[list[str]]:
    """Lecteur .xlsx sans dépendance : chaînes partagées + 1ère feuille."""
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(chemin) as z:
        chaines = []
        if "xl/sharedStrings.xml" in z.namelist():
            racine = ET.fromstring(z.read("xl/sharedStrings.xml"))
            chaines = ["".join(t.text or "" for t in si.iter(f"{{{ns['m']}}}t")) for si in racine.findall("m:si", ns)]
        nom_feuille = next(n for n in sorted(z.namelist()) if n.startswith("xl/worksheets/sheet"))
        racine = ET.fromstring(z.read(nom_feuille))

    def colonne_index(ref: str) -> int:
        lettres = re.match(r"[A-Z]+", ref).group()
        idx = 0
        for l in lettres:
            idx = idx * 26 + ord(l) - 64
        return idx - 1

    lignes = []
    for ligne_xml in racine.iter(f"{{{ns['m']}}}row"):
        cellules: dict[int, str] = {}
        for c in ligne_xml.findall("m:c", ns):
            v = c.find("m:v", ns)
            if v is None or v.text is None:
                continue
            valeur = chaines[int(v.text)] if c.get("t") == "s" else v.text
            cellules[colonne_index(c.get("r", "A1"))] = valeur
        if cellules:
            largeur = max(cellules) + 1
            lignes.append([cellules.get(i, "") for i in range(largeur)])
    return lignes


def lire_fichier(chemin: Path) -> list[list[str]]:
    if chemin.suffix.lower() in (".xlsx", ".xlsm"):
        return lire_xlsx(chemin)
    if chemin.suffix.lower() == ".xls":
        sys.exit("Erreur : format .xls (ancien Excel) non pris en charge — réenregistrez en .xlsx ou .csv")
    return lire_csv(chemin)


# ─────────────────────────────────────────────
# Analyse du fichier
# ─────────────────────────────────────────────

def nettoyer_cle(cle: str) -> str:
    """Corrige les codes-barres lus comme nombres : '9782070368228.0' ou '9.782E+12'."""
    cle = cle.strip()
    if re.fullmatch(r"\d+\.0+", cle):
        return cle.split(".")[0]
    if re.fullmatch(r"\d(\.\d+)?[eE]\+?\d+", cle):
        return str(int(float(cle)))
    return cle


def parser_prix(brut: str) -> float:
    """Convertit '12,50', '12.50', '12,50 €', '1 250,00' en float."""
    texte = brut.strip().replace("€", "").replace(" ", "").replace(" ", "")
    if "," in texte and "." in texte:
        texte = texte.replace(".", "").replace(",", ".")  # 1.250,00 → 1250.00
    else:
        texte = texte.replace(",", ".")
    return float(texte)


def analyser(lignes: list[list[str]]) -> tuple[str, list[tuple[str, float, int]]]:
    """Retourne (champ_odoo, [(cle_produit, prix, numero_ligne), ...])."""
    if not lignes:
        sys.exit("Erreur : fichier vide")

    entetes = [_normaliser(c) for c in lignes[0]]
    col_cle = champ_odoo = None
    for i, e in enumerate(entetes):
        if _correspond(e, COLONNES_BARCODE):
            col_cle, champ_odoo = i, "barcode"
            break
        if _correspond(e, COLONNES_REFERENCE):
            col_cle, champ_odoo = i, "default_code"
            break
        if _correspond(e, COLONNES_ID):
            col_cle, champ_odoo = i, "id"
            break
    col_prix = next((i for i, e in enumerate(entetes) if _correspond(e, COLONNES_PRIX)), None)

    if col_cle is None:
        sys.exit(f"Erreur : aucune colonne d'identification trouvée (attendu : barcode/isbn/ean, reference, ou id). En-têtes lus : {lignes[0]}")
    if col_prix is None:
        sys.exit(f"Erreur : aucune colonne prix trouvée (attendu : prix_vente/prix/pv/list_price). En-têtes lus : {lignes[0]}")

    resultat, erreurs = [], []
    for num, ligne in enumerate(lignes[1:], start=2):
        if len(ligne) <= max(col_cle, col_prix):
            continue
        cle = nettoyer_cle(ligne[col_cle])
        brut_prix = ligne[col_prix].strip()
        if not cle and not brut_prix:
            continue
        try:
            prix = parser_prix(brut_prix)
            if prix < 0:
                raise ValueError("prix négatif")
            if not cle:
                raise ValueError("identifiant vide")
            resultat.append((cle, prix, num))
        except ValueError as e:
            erreurs.append(f"  ligne {num} : {e} ({ligne[col_cle]!r} / {brut_prix!r})")

    if erreurs:
        print(f"⚠ {len(erreurs)} ligne(s) ignorée(s) :")
        print("\n".join(erreurs[:20]))
        if len(erreurs) > 20:
            print(f"  … et {len(erreurs) - 20} autres")

    return champ_odoo, resultat


# ─────────────────────────────────────────────
# Mise à jour Odoo
# ─────────────────────────────────────────────

def chercher_produits(session: OdooSession, champ: str, cles: list[str]) -> dict[str, list[int]]:
    """Associe chaque clé (barcode/référence/id) aux IDs product.template correspondants."""
    correspondance: dict[str, list[int]] = {}
    for debut in range(0, len(cles), TAILLE_LOT):
        lot = cles[debut : debut + TAILLE_LOT]
        valeurs = [int(c) for c in lot] if champ == "id" else lot
        for p in session._rpc(
            "product.template", "search_read",
            [[[champ, "in", valeurs]]],
            {"fields": ["id", champ]},
        ):
            correspondance.setdefault(str(p[champ]), []).append(p["id"])
    return correspondance


def appliquer(session: OdooSession, maj: dict[float, list[int]]) -> int:
    """Écrit les prix, groupés par valeur pour minimiser les requêtes."""
    total = 0
    for prix, ids in sorted(maj.items()):
        for debut in range(0, len(ids), TAILLE_LOT):
            lot = ids[debut : debut + TAILLE_LOT]
            session._rpc("product.template", "write", [lot, {"list_price": prix}])
            total += len(lot)
            print(f"  ✔ {len(lot)} produit(s) → {prix:.2f}")
    return total


def main() -> None:
    parseur = argparse.ArgumentParser(description="Mise à jour en masse des prix de vente Odoo 18 depuis un CSV/Excel")
    parseur.add_argument("fichier", type=Path, help="Fichier .csv ou .xlsx")
    parseur.add_argument("--url", default=ODOO_URL_DEFAUT, help=f"URL Odoo (défaut : {ODOO_URL_DEFAUT})")
    parseur.add_argument("--db", default=ODOO_DB_DEFAUT, help=f"Base de données (défaut : {ODOO_DB_DEFAUT})")
    parseur.add_argument("--login", required=True, help="Identifiant Odoo")
    parseur.add_argument("--password", help="Mot de passe (demandé si absent)")
    parseur.add_argument("--apply", action="store_true", help="Applique réellement les changements (sinon : simulation)")
    args = parseur.parse_args()

    if not args.fichier.exists():
        sys.exit(f"Erreur : fichier introuvable : {args.fichier}")

    mot_de_passe = args.password or getpass.getpass("Mot de passe Odoo : ")

    champ, entrees = analyser(lire_fichier(args.fichier))
    if not entrees:
        sys.exit("Erreur : aucune ligne exploitable dans le fichier")
    print(f"Fichier lu : {len(entrees)} ligne(s), identification par « {champ} »")

    session = OdooSession(url=args.url, db=args.db)
    session.login(args.login, mot_de_passe)
    print(f"Connecté à {args.url} (base {args.db})")

    correspondance = chercher_produits(session, champ, [cle for cle, _, _ in entrees])

    maj: dict[float, list[int]] = {}
    introuvables, doublons_fichier = [], set()
    vus = set()
    for cle, prix, num in entrees:
        if cle in vus:
            doublons_fichier.add(cle)
            continue
        vus.add(cle)
        ids = correspondance.get(cle)
        if not ids:
            introuvables.append(f"  ligne {num} : {cle}")
            continue
        maj.setdefault(round(prix, 2), []).extend(ids)

    nb_produits = sum(len(v) for v in maj.values())
    print(f"\nProduits trouvés : {nb_produits} | Introuvables : {len(introuvables)} | Doublons fichier ignorés : {len(doublons_fichier)}")
    if introuvables:
        print("Introuvables dans Odoo :")
        print("\n".join(introuvables[:20]))
        if len(introuvables) > 20:
            print(f"  … et {len(introuvables) - 20} autres")

    if not maj:
        sys.exit("Rien à mettre à jour.")

    if not args.apply:
        print("\n── SIMULATION (ajoutez --apply pour écrire) ──")
        for prix, ids in sorted(maj.items()):
            print(f"  {len(ids)} produit(s) → prix de vente {prix:.2f}")
        return

    print("\n── APPLICATION DES CHANGEMENTS ──")
    total = appliquer(session, maj)
    print(f"\nTerminé : {total} produit(s) mis à jour.")


if __name__ == "__main__":
    main()
