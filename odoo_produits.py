"""
API Odoo 18 — Mise à jour Prix Achat & Éditeur
DSM Librairie
"""

import json
import urllib.request
import urllib.error
from typing import Optional

ODOO_URL = "http://localhost:8069"
ODOO_DB  = "Dsm"


# ─────────────────────────────────────────────
# Connexion
# ─────────────────────────────────────────────

class OdooSession:
    def __init__(self, url: str = ODOO_URL, db: str = ODOO_DB):
        self.url = url
        self.db  = db
        self.uid: Optional[int] = None
        self.cookie = ""

    def login(self, login: str, password: str) -> int:
        payload = {
            "jsonrpc": "2.0", "method": "call", "id": 1,
            "params": {"db": self.db, "login": login, "password": password},
        }
        req = urllib.request.Request(
            f"{self.url}/web/session/authenticate",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as resp:
            self.cookie = resp.headers.get("Set-Cookie", "")
            data = json.loads(resp.read())

        if data.get("result", {}).get("uid"):
            self.uid = data["result"]["uid"]
            return self.uid
        raise PermissionError("Authentification échouée")

    def _rpc(self, model: str, method: str, args: list, kwargs: dict = None) -> any:
        if not self.uid:
            raise RuntimeError("Non connecté — appelez login() d'abord")

        payload = {
            "jsonrpc": "2.0", "method": "call", "id": 2,
            "params": {"model": model, "method": method,
                       "args": args, "kwargs": kwargs or {}},
        }
        req = urllib.request.Request(
            f"{self.url}/web/dataset/call_kw",
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "Cookie": self.cookie,
            },
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())

        if "error" in data:
            msg = data["error"].get("data", {}).get("message") or data["error"].get("message")
            raise RuntimeError(f"Erreur Odoo : {msg}")

        return data["result"]


# ─────────────────────────────────────────────
# Lecture
# ─────────────────────────────────────────────

FIELDS_PRODUIT = [
    "name", "standard_price", "list_price",
    "dsm_editeur", "categ_id", "default_code", "barcode",
]


def get_produits(session: OdooSession, domain: list = None, limit: int = 80) -> list[dict]:
    """Retourne les produits avec prix d'achat et éditeur."""
    return session._rpc(
        "product.template", "search_read",
        [domain or []],
        {"fields": FIELDS_PRODUIT, "limit": limit, "order": "name asc"},
    )


def get_produit_by_id(session: OdooSession, product_id: int) -> dict:
    """Retourne un produit par son ID."""
    results = session._rpc(
        "product.template", "search_read",
        [[["id", "=", product_id]]],
        {"fields": FIELDS_PRODUIT, "limit": 1},
    )
    if not results:
        raise ValueError(f"Produit #{product_id} introuvable")
    return results[0]


def rechercher_produits(session: OdooSession, terme: str, limit: int = 40) -> list[dict]:
    """Recherche par nom, référence interne ou code-barres."""
    domain = [
        "|", "|",
        ["name", "ilike", terme],
        ["default_code", "ilike", terme],
        ["barcode", "=", terme],
    ]
    return session._rpc(
        "product.template", "search_read",
        [domain],
        {"fields": FIELDS_PRODUIT, "limit": limit, "order": "name asc"},
    )


# ─────────────────────────────────────────────
# Mise à jour
# ─────────────────────────────────────────────

def update_prix_achat(session: OdooSession, product_id: int, standard_price: float) -> bool:
    """Met à jour le prix d'achat (standard_price) d'un produit."""
    if standard_price < 0:
        raise ValueError("Le prix d'achat ne peut pas être négatif")
    return session._rpc(
        "product.template", "write",
        [[product_id], {"standard_price": standard_price}],
    )


def update_editeur(session: OdooSession, product_id: int, dsm_editeur: str) -> bool:
    """Met à jour l'éditeur (dsm_editeur) d'un produit."""
    return session._rpc(
        "product.template", "write",
        [[product_id], {"dsm_editeur": dsm_editeur}],
    )


def update_produit(
    session: OdooSession,
    product_id: int,
    standard_price: float = None,
    dsm_editeur: str = None,
) -> bool:
    """Met à jour prix d'achat ET/OU éditeur en une seule requête."""
    vals = {}
    if standard_price is not None:
        if standard_price < 0:
            raise ValueError("Le prix d'achat ne peut pas être négatif")
        vals["standard_price"] = standard_price
    if dsm_editeur is not None:
        vals["dsm_editeur"] = dsm_editeur
    if not vals:
        return True
    return session._rpc("product.template", "write", [[product_id], vals])


def update_produits_batch(
    session: OdooSession,
    product_ids: list[int],
    standard_price: float = None,
    dsm_editeur: str = None,
) -> bool:
    """Mise à jour en lot : applique les mêmes valeurs à plusieurs produits."""
    if not product_ids:
        return True
    vals = {}
    if standard_price is not None:
        if standard_price < 0:
            raise ValueError("Le prix d'achat ne peut pas être négatif")
        vals["standard_price"] = standard_price
    if dsm_editeur is not None:
        vals["dsm_editeur"] = dsm_editeur
    if not vals:
        return True
    return session._rpc("product.template", "write", [product_ids, vals])


# ─────────────────────────────────────────────
# Exemple d'utilisation
# ─────────────────────────────────────────────

if __name__ == "__main__":
    s = OdooSession(url="http://localhost:8069", db="Dsm")
    s.login("admin", "admin")

    # Lire les produits
    produits = get_produits(s, limit=5)
    for p in produits:
        print(f"[{p['id']}] {p['name']} | Achat: {p['standard_price']} | Éditeur: {p['dsm_editeur']}")

    # Mettre à jour un produit
    ok = update_produit(s, product_id=1, standard_price=9.99, dsm_editeur="Gallimard")
    print("Mise à jour :", "OK" if ok else "Échec")
