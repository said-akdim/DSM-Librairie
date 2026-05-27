#!/usr/bin/env python3
"""
MAJ Prix Achat & Éditeur — Odoo 18 — DSM Librairie
====================================================

Lit un fichier CSV et applique les mises à jour dans Odoo.

Colonnes CSV reconnues :
  barcode      → code-barres / ISBN         (pour retrouver le produit)
  reference    → référence interne           (alternative au barcode)
  nom          → nom du produit              (alternative)
  prix_achat   → nouveau prix d'achat        (standard_price)
  editeur      → nouvel éditeur              (dsm_editeur)

Exemples d'utilisation :
  # Prévisualiser sans modifier Odoo
  python maj_produits_odoo.py --dry-run produits.csv

  # Appliquer les mises à jour
  python maj_produits_odoo.py produits.csv

  # Seulement les prix (ignorer la colonne éditeur même si présente)
  python maj_produits_odoo.py --mode prix produits.csv

  # Seulement les éditeurs
  python maj_produits_odoo.py --mode editeur produits.csv

  # Serveur distant + utilisateur personnalisé
  python maj_produits_odoo.py --url http://192.168.1.10:8069 --user said produits.csv
"""

import argparse
import csv
import json
import sys
import urllib.request
from datetime import datetime
from getpass import getpass
from pathlib import Path

ODOO_URL = "http://localhost:8069"
ODOO_DB  = "Dsm"

# ══════════════════════════════════════════════
# Connexion Odoo 18
# ══════════════════════════════════════════════

_cookie = ""

def odoo_login(url: str, db: str, user: str, password: str) -> int:
    global _cookie
    payload = {
        "jsonrpc": "2.0", "method": "call", "id": 1,
        "params": {"db": db, "login": user, "password": password},
    }
    req = urllib.request.Request(
        f"{url}/web/session/authenticate",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        _cookie = resp.headers.get("Set-Cookie", "")
        data = json.loads(resp.read())

    uid = data.get("result", {}).get("uid")
    if not uid:
        _err("Connexion échouée — vérifiez identifiants / URL / base")
    return uid


def odoo_rpc(url: str, model: str, method: str, args: list, kwargs: dict = None):
    payload = {
        "jsonrpc": "2.0", "method": "call", "id": 2,
        "params": {
            "model": model, "method": method,
            "args": args, "kwargs": kwargs or {},
        },
    }
    req = urllib.request.Request(
        f"{url}/web/dataset/call_kw",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Cookie": _cookie},
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())

    if "error" in data:
        msg = data["error"].get("data", {}).get("message") or data["error"]["message"]
        _err(f"Erreur Odoo : {msg}")
    return data["result"]


# ══════════════════════════════════════════════
# Lecture CSV
# ══════════════════════════════════════════════

COLONNES_BARCODE   = {"barcode", "isbn", "ean", "code_barre", "code-barre"}
COLONNES_REFERENCE = {"reference", "ref", "default_code", "code_interne"}
COLONNES_NOM       = {"nom", "name", "titre", "title"}
COLONNES_PRIX      = {"prix_achat", "prix", "price", "cost", "standard_price", "achat"}
COLONNES_EDITEUR   = {"editeur", "editeur_", "publisher", "dsm_editeur", "éditeur"}


def _normalise(nom: str) -> str:
    return nom.strip().lower().replace(" ", "_").replace("é", "e").replace("è", "e")


def lire_csv(fichier: str) -> tuple[list[dict], list[str]]:
    """Retourne (lignes, avertissements)."""
    with open(fichier, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=None)  # détecte , ou ;
        # csv.DictReader utilise le premier délimiteur trouvé — forcer la détection
        sample = f.read(1024)
        f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        reader = csv.DictReader(f, dialect=dialect)
        lignes = list(reader)

    avertissements = []
    mapping = {}  # nom_col_csv → rôle (barcode|reference|nom|prix|editeur)

    if not lignes:
        _err("Le fichier CSV est vide")

    for col in lignes[0].keys():
        role = _detecter_role(col)
        if role:
            mapping[col] = role

    if not any(r in mapping.values() for r in ("barcode", "reference", "nom")):
        avertissements.append(
            "⚠️  Aucune colonne d'identification trouvée (barcode/reference/nom) — "
            "ajoutez au moins une colonne pour retrouver les produits dans Odoo."
        )

    if "prix" not in mapping.values() and "editeur" not in mapping.values():
        _err("Aucune colonne à mettre à jour trouvée (prix_achat / editeur)")

    return lignes, mapping, avertissements


def _detecter_role(col: str) -> str | None:
    n = _normalise(col)
    if n in COLONNES_BARCODE:   return "barcode"
    if n in COLONNES_REFERENCE: return "reference"
    if n in COLONNES_NOM:       return "nom"
    if n in COLONNES_PRIX:      return "prix"
    if n in COLONNES_EDITEUR:   return "editeur"
    return None


def _valeur(ligne: dict, mapping: dict, role: str) -> str | None:
    for col, r in mapping.items():
        if r == role:
            v = ligne.get(col, "").strip()
            return v if v else None
    return None


# ══════════════════════════════════════════════
# Recherche produit dans Odoo
# ══════════════════════════════════════════════

_cache_produits: dict[str, dict | None] = {}


def trouver_produit(url: str, barcode: str | None, reference: str | None, nom: str | None) -> dict | None:
    """Recherche dans Odoo par barcode > reference > nom (dans cet ordre de priorité)."""
    cle = f"{barcode}|{reference}|{nom}"
    if cle in _cache_produits:
        return _cache_produits[cle]

    for domain in _domaines(barcode, reference, nom):
        resultats = odoo_rpc(url, "product.template", "search_read", [domain], {
            "fields": ["id", "name", "default_code", "barcode", "standard_price", "dsm_editeur"],
            "limit": 1,
        })
        if resultats:
            _cache_produits[cle] = resultats[0]
            return resultats[0]

    _cache_produits[cle] = None
    return None


def _domaines(barcode, reference, nom):
    domaines = []
    if barcode:
        domaines.append([["barcode", "=", barcode]])
    if reference:
        domaines.append([["default_code", "=", reference]])
    if nom:
        domaines.append([["name", "ilike", nom]])
    return domaines


# ══════════════════════════════════════════════
# Application des mises à jour
# ══════════════════════════════════════════════

def traiter(url: str, lignes: list, mapping: dict, mode: str, dry_run: bool) -> dict:
    stats = {"ok": 0, "skipped": 0, "erreur": 0, "introuvable": 0}
    log   = []

    for i, ligne in enumerate(lignes, start=2):  # ligne 1 = en-tête CSV
        barcode   = _valeur(ligne, mapping, "barcode")
        reference = _valeur(ligne, mapping, "reference")
        nom       = _valeur(ligne, mapping, "nom")
        prix_str  = _valeur(ligne, mapping, "prix")
        editeur   = _valeur(ligne, mapping, "editeur")

        identifiant = barcode or reference or nom or f"ligne {i}"

        # Filtrer selon le mode
        if mode == "prix":    editeur  = None
        if mode == "editeur": prix_str = None

        # Construire les valeurs à écrire
        vals = {}
        try:
            if prix_str:
                prix = float(prix_str.replace(",", ".").replace(" ", ""))
                if prix < 0:
                    raise ValueError("prix négatif")
                vals["standard_price"] = prix
        except ValueError:
            log.append(f"  ⚠️  Ligne {i} [{identifiant}] — prix invalide : «{prix_str}» ignoré")

        if editeur:
            vals["dsm_editeur"] = editeur

        if not vals:
            log.append(f"  –  Ligne {i} [{identifiant}] — rien à mettre à jour")
            stats["skipped"] += 1
            continue

        # Retrouver le produit dans Odoo
        produit = trouver_produit(url, barcode, reference, nom)
        if not produit:
            log.append(f"  ❌ Ligne {i} [{identifiant}] — produit introuvable dans Odoo")
            stats["introuvable"] += 1
            continue

        pid  = produit["id"]
        pnom = produit["name"]

        # Afficher les changements
        changements = []
        if "standard_price" in vals:
            changements.append(
                f"prix achat : {produit['standard_price']:.2f} → {vals['standard_price']:.2f}"
            )
        if "dsm_editeur" in vals:
            ancien = produit.get("dsm_editeur") or "(vide)"
            changements.append(f"éditeur : {ancien!r} → {vals['dsm_editeur']!r}")

        if dry_run:
            log.append(f"  👁  Ligne {i} [{identifiant}] #{pid} «{pnom}» — {' | '.join(changements)} (simulation)")
            stats["ok"] += 1
            continue

        # Appliquer
        try:
            ok = odoo_rpc(url, "product.template", "write", [[pid], vals])
            if ok:
                log.append(f"  ✅ Ligne {i} [{identifiant}] #{pid} «{pnom}» — {' | '.join(changements)}")
                stats["ok"] += 1
            else:
                log.append(f"  ❌ Ligne {i} [{identifiant}] #{pid} — écriture refusée par Odoo")
                stats["erreur"] += 1
        except Exception as e:
            log.append(f"  ❌ Ligne {i} [{identifiant}] #{pid} — erreur : {e}")
            stats["erreur"] += 1

    return stats, log


# ══════════════════════════════════════════════
# Rapport
# ══════════════════════════════════════════════

def afficher_rapport(stats: dict, log: list, dry_run: bool, fichier_log: str | None):
    mode_txt = "SIMULATION (--dry-run)" if dry_run else "RÉSULTAT"
    lignes_rapport = [
        "",
        f"══════════ {mode_txt} ══════════",
        *log,
        "",
        f"  Total mis à jour   : {stats['ok']}",
        f"  Introuvables       : {stats['introuvable']}",
        f"  Ignorés (vides)    : {stats['skipped']}",
        f"  Erreurs            : {stats['erreur']}",
        "═" * 40,
    ]

    rapport = "\n".join(lignes_rapport)
    print(rapport)

    if fichier_log:
        with open(fichier_log, "w", encoding="utf-8") as f:
            f.write(f"Rapport MAJ Odoo — {datetime.now():%Y-%m-%d %H:%M}\n")
            f.write(rapport)
        print(f"\n  Rapport sauvegardé : {fichier_log}")


# ══════════════════════════════════════════════
# Utilitaires
# ══════════════════════════════════════════════

def _err(msg: str):
    print(f"\n❌ {msg}\n", file=sys.stderr)
    sys.exit(1)


def generer_csv_exemple():
    exemple = Path("exemple_produits.csv")
    exemple.write_text(
        "barcode,reference,prix_achat,editeur\n"
        "9782070360024,GAL-001,8.50,Gallimard\n"
        "9782253004226,LIV-002,6.90,Le Livre de Poche\n"
        "9782070413119,,12.00,\n"
        ",MON-003,,Hachette\n",
        encoding="utf-8",
    )
    print(f"✅ Fichier exemple créé : {exemple}")
    print("   Colonnes : barcode, reference, prix_achat, editeur")
    print("   (les colonnes vides sont ignorées)\n")


# ══════════════════════════════════════════════
# Point d'entrée
# ══════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Mise à jour prix achat & éditeur — Odoo 18 — DSM Librairie",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("fichier", nargs="?", help="Fichier CSV à traiter")
    parser.add_argument("--url",      default=ODOO_URL, metavar="URL",
                        help="URL Odoo (défaut : %(default)s)")
    parser.add_argument("--db",       default=ODOO_DB,  metavar="DB",
                        help="Base de données (défaut : %(default)s)")
    parser.add_argument("--user",     default="admin",  metavar="USER",
                        help="Utilisateur Odoo (défaut : admin)")
    parser.add_argument("--password", metavar="PASS",
                        help="Mot de passe (demandé interactivement si absent)")
    parser.add_argument("--mode",     choices=["tout", "prix", "editeur"], default="tout",
                        help="Quoi mettre à jour (défaut : tout)")
    parser.add_argument("--dry-run",  action="store_true",
                        help="Simuler sans modifier Odoo")
    parser.add_argument("--log",      metavar="FICHIER",
                        help="Sauvegarder le rapport dans un fichier texte")
    parser.add_argument("--exemple",  action="store_true",
                        help="Générer un fichier CSV exemple et quitter")

    args = parser.parse_args()

    if args.exemple:
        generer_csv_exemple()
        return

    if not args.fichier:
        parser.print_help()
        print("\nAstuce : utilisez --exemple pour créer un fichier CSV de démarrage.\n")
        sys.exit(1)

    if not Path(args.fichier).exists():
        _err(f"Fichier introuvable : {args.fichier}")

    # Connexion
    password = args.password or getpass(f"Mot de passe Odoo ({args.user}) : ")
    print(f"\n🔗 Connexion à {args.url} (base : {args.db})…")
    odoo_login(args.url, args.db, args.user, password)
    print("   Connecté.\n")

    # Lecture CSV
    lignes, mapping, avertissements = lire_csv(args.fichier)
    for a in avertissements:
        print(a)

    roles_detectes = set(mapping.values())
    print(f"📄 {len(lignes)} ligne(s) lues — colonnes détectées : {', '.join(mapping.keys())}")
    if args.dry_run:
        print("👁  Mode simulation activé — aucune modification ne sera faite dans Odoo\n")

    # Traitement
    stats, log = traiter(args.url, lignes, mapping, args.mode, args.dry_run)

    # Rapport
    afficher_rapport(stats, log, args.dry_run, args.log)


if __name__ == "__main__":
    main()
