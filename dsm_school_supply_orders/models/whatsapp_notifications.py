import logging
import requests
from odoo import models

_logger = logging.getLogger(__name__)

WA_PHONE_ID = "1222766347580412"
WA_TOKEN = (
    "EAAOwrZAgt5jABR19GTxxyVkGP6p4ABf8ZAGdBOebzZCcpddC5DRbwd71GeA7dsJP"
    "ENDLzq6Vf7OwrOcWJuYwZBzpeZCLROeUaHQ9sjnbGZAiKrWXeSZCqpyX13eUZCJmy"
    "n1SGG4uuIH5PPopJz3BAECRFv1GNtZCoaKui8FwRrvNyb2r5b78N0395ZAtG8qKmAU"
    "QFN2gZDZD"
)


def _normaliser_telephone(phone):
    if not phone:
        return None
    p = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace("+", "")
    if p.startswith("0"):
        p = "212" + p[1:]
    if not p.startswith("212"):
        p = "212" + p[-9:]
    return p if len(p) >= 12 else None


def _envoyer_template(phone, template_name, params):
    """Envoie un template WhatsApp approuvé Meta avec ses paramètres body."""
    to = _normaliser_telephone(phone)
    if not to:
        _logger.warning("WhatsApp: numéro invalide '%s'", phone)
        return False
    try:
        res = requests.post(
            f"https://graph.facebook.com/v20.0/{WA_PHONE_ID}/messages",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {WA_TOKEN}",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": "fr"},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": str(p)} for p in params
                            ],
                        }
                    ],
                },
            },
            timeout=10,
        )
        if not res.ok:
            _logger.warning("WhatsApp '%s' → %s: %s", template_name, res.status_code, res.text)
        else:
            _logger.info("WhatsApp '%s' envoyé à %s", template_name, to)
        return res.ok
    except Exception as e:
        _logger.warning("WhatsApp send failed: %s", e)
        return False


class SaleOrderWhatsApp(models.Model):
    _inherit = "sale.order"

    def action_confirm(self):
        result = super().action_confirm()
        for order in self:
            partner = order.partner_id
            phone = partner.mobile or partner.phone
            if not phone:
                continue
            # Template sms_cmd_client_to_order :
            # "Votre commande a été bien reçue et enregistrée sous le No : {{1}}.
            #  - {{2}}"
            titres = "\n- ".join(order.order_line.mapped("product_id.name"))
            _envoyer_template(
                phone,
                "sms_cmd_client_to_order",
                [order.name, "- " + titres if titres else ""],
            )
        return result


class StockPickingWhatsApp(models.Model):
    _inherit = "stock.picking"

    def button_validate(self):
        receptions = self.filtered(
            lambda p: p.picking_type_code == "incoming"
            and p.state in ("assigned", "ready", "waiting")
        )
        result = super().button_validate()

        for picking in receptions.filtered(lambda p: p.state == "done"):
            product_ids = picking.move_ids.mapped("product_id").ids
            if not product_ids:
                continue

            # Trouver les commandes clients confirmées contenant ces produits
            lines = self.env["sale.order.line"].search([
                ("product_id", "in", product_ids),
                ("order_id.state", "in", ["sale", "done"]),
            ])

            # Grouper par commande
            commandes = {}
            for line in lines:
                oid = line.order_id.id
                if oid not in commandes:
                    commandes[oid] = {
                        "order": line.order_id,
                        "partner": line.order_id.partner_id,
                        "produits_recus": [],
                    }
                commandes[oid]["produits_recus"].append(line.product_id.name)

            for data in commandes.values():
                partner = data["partner"]
                phone = partner.mobile or partner.phone
                if not phone:
                    continue

                order = data["order"]
                produits_recus = data["produits_recus"]
                total_lignes = len(order.order_line)

                # Vérifier si TOUS les produits de la commande sont reçus
                tous_recus = len(produits_recus) >= total_lignes

                if tous_recus:
                    # Template sms_cmd_ls_disponible :
                    # "La totalité de votre commande No {{1}} est disponible à la librairie DSM."
                    _envoyer_template(
                        phone,
                        "sms_cmd_ls_disponible",
                        [order.name],
                    )
                elif len(produits_recus) == 1:
                    # Template article_disponible :
                    # "L'article {{1}} faisant partie de votre commande No {{2}} est disponible..."
                    _envoyer_template(
                        phone,
                        "article_disponible",
                        [produits_recus[0], order.name],
                    )
                else:
                    # Plusieurs titres partiellement reçus → article_disponible par titre
                    for titre in produits_recus:
                        _envoyer_template(
                            phone,
                            "article_disponible",
                            [titre, order.name],
                        )

        return result
