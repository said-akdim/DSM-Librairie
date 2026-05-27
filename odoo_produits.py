#!/usr/bin/env python3
"""
Script Odoo 18 — Prix Achat & Éditeur
DSM Librairie

Utilisation :
  python odoo_produits.py lister
  python odoo_produits.py chercher "Astérix"
  python odoo_produits.py update 42 --prix 9.99 --editeur "Gallimard"
  python odoo_produits.py batch produits.csv
"""

import argparse
import csv
import json
import sys
import urllib.request
from getpass import getpass

ODOO_URL = "http://localhost:8069"
ODOO_DB  = "Dsm"

# ─────────────────────────────────────────────
# Connexion JSON-RPC
# ─────────────────────────────────────────────

cookie = ""

def login(url, db, user, password):
    global cookie
    data = _post(url, "/web/session/authenticate",
                 {"db": db, "login": user, "password": password},
                 set_cookie=True)
    uid = data.get("uid")
    if not uid:
        print("❌ Connexion échouée (identifiants incorrects)")
        sys.exit(1)
    return uid

def _post(url, path, params, set_cookie=False):
    global cookie
    payload = json.dumps({
        "jsonrpc": "2.0", "method": "call", "id": 1,
        "params": params,
    }).encode()
    req = urllib.request.Request(
        url + path,
        data=payload,
        headers={
            "Content-Type": "application/json",
            **( {"Cookie": cookie} if not set_cookie else {} ),
        },
    )
    with urllib.request.urlopen(req) as resp:
        if set_cookie:
            cookie = resp.headers.get("Set-Cookie", "")
        result = json.loads(resp.read())
    if "error" in result:
        msg = result["error"].get("data", {}).get("message") or result["error"]["message"]
        print(f"❌ Erreur Odoo : {msg}")
        sys.exit(1)
    return result["result"]

def rpc(url, model, method, args, kwargs=None):
    return _post(url, "/web/dataset/call_kw", {
        "model": model, "method": method,
        "args": args, "kwargs": kwargs or {},
    })

# ─────────────────────────────────────────────
# Affichage
# ─────────────────────────────────────────────

FIELDS = ["id", "name", "default_code", "standard_price", "list_price", "dsm_editeur"]

def afficher(produits):
    if not produits:
        print("Aucun produit trouvé.")
        return
    print(f"\n{'ID':<6} {'Référence':<14} {'Prix achat':>10} {'Prix vente':>10}  {'Éditeur':<20}  Nom")
    print("─" * 90)
    for p in produits:
        editeur = p.get("dsm_editeur") or "-"
        ref     = p.get("default_code") or "-"
        print(f"{p['id']:<6} {ref:<14} {p['standard_price']:>10.2f} {p['list_price']:>10.2f}  {editeur:<20}  {p['name']}")
    print(f"\n{len(produits)} produit(s)\n")

# ─────────────────────────────────────────────
# Commandes
# ─────────────────────────────────────────────

def cmd_lister(args, url):
    produits = rpc(url, "product.template", "search_read",
                   [[["sale_ok", "=", True]]],
                   {"fields": FIELDS, "limit": args.limite, "order": "name asc"})
    afficher(produits)

def cmd_chercher(args, url):
    terme = args.terme
    domain = ["|", "|",
              ["name", "ilike", terme],
              ["default_code", "ilike", terme],
              ["barcode", "=", terme]]
    produits = rpc(url, "product.template", "search_read",
                   [domain],
                   {"fields": FIELDS, "limit": 40, "order": "name asc"})
    afficher(produits)

def cmd_update(args, url):
    vals = {}
    if args.prix is not None:
        if args.prix < 0:
            print("❌ Le prix d'achat ne peut pas être négatif")
            sys.exit(1)
        vals["standard_price"] = args.prix
    if args.editeur is not None:
        vals["dsm_editeur"] = args.editeur
    if not vals:
        print("⚠️  Rien à mettre à jour (--prix ou --editeur requis)")
        sys.exit(1)

    ok = rpc(url, "product.template", "write", [[args.id], vals])
    if ok:
        print(f"✅ Produit #{args.id} mis à jour : {vals}")
    else:
        print("❌ Échec de la mise à jour")

def cmd_batch(args, url):
    """
    Lit un CSV avec colonnes : id, prix_achat, editeur
    Exemple CSV :
      id,prix_achat,editeur
      1,9.99,Gallimard
      2,12.50,Hachette
    """
    try:
        with open(args.fichier, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            lignes = list(reader)
    except FileNotFoundError:
        print(f"❌ Fichier introuvable : {args.fichier}")
        sys.exit(1)

    ok_count = 0
    for ligne in lignes:
        pid = int(ligne["id"])
        vals = {}
        if ligne.get("prix_achat"):
            vals["standard_price"] = float(ligne["prix_achat"].replace(",", "."))
        if ligne.get("editeur"):
            vals["dsm_editeur"] = ligne["editeur"].strip()
        if not vals:
            continue
        ok = rpc(url, "product.template", "write", [[pid], vals])
        status = "✅" if ok else "❌"
        print(f"{status} Produit #{pid} → {vals}")
        if ok:
            ok_count += 1

    print(f"\n{ok_count}/{len(lignes)} mis à jour avec succès.")

# ─────────────────────────────────────────────
# Entrée principale
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Script Odoo 18 — Prix Achat & Éditeur — DSM Librairie",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--url",      default=ODOO_URL, help="URL Odoo (défaut: %(default)s)")
    parser.add_argument("--db",       default=ODOO_DB,  help="Base de données (défaut: %(default)s)")
    parser.add_argument("--user",     default="admin",  help="Utilisateur Odoo")
    parser.add_argument("--password",                   help="Mot de passe (demandé si absent)")

    sub = parser.add_subparsers(dest="cmd", required=True)

    # lister
    p_list = sub.add_parser("lister", help="Lister les produits")
    p_list.add_argument("--limite", type=int, default=80, help="Nombre max de résultats")

    # chercher
    p_search = sub.add_parser("chercher", help="Rechercher un produit")
    p_search.add_argument("terme", help="Nom, référence ou code-barres")

    # update
    p_upd = sub.add_parser("update", help="Mettre à jour un produit")
    p_upd.add_argument("id",      type=int,  help="ID du produit")
    p_upd.add_argument("--prix",  type=float, help="Nouveau prix d'achat")
    p_upd.add_argument("--editeur",           help="Nouvel éditeur")

    # batch
    p_batch = sub.add_parser("batch", help="Mise à jour en lot depuis un CSV")
    p_batch.add_argument("fichier", help="Chemin vers le fichier CSV (colonnes: id, prix_achat, editeur)")

    args = parser.parse_args()

    password = args.password or getpass(f"Mot de passe Odoo ({args.user}) : ")
    login(args.url, args.db, args.user, password)

    if   args.cmd == "lister":   cmd_lister(args, args.url)
    elif args.cmd == "chercher": cmd_chercher(args, args.url)
    elif args.cmd == "update":   cmd_update(args, args.url)
    elif args.cmd == "batch":    cmd_batch(args, args.url)

if __name__ == "__main__":
    main()
