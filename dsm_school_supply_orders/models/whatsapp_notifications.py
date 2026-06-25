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


def _envoyer_whatsapp(phone, message):
    to = _normaliser_telephone(phone)
    if not to:
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
                "recipient_type": "individual",
                "to": to,
                "type": "text",
                "text": {"preview_url": False, "body": message},
            },
            timeout=10,
        )
        if not res.ok:
            _logger.warning("WhatsApp API error %s: %s", res.status_code, res.text)
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
            titres = order.order_line.mapped("product_id.name")
            apercu = ", ".join(titres[:3])
            if len(titres) > 3:
                apercu += f" (+{len(titres) - 3} articles)"
            msg = (
                f"✅ Librairie DSM\n"
                f"Commande {order.name} confirmée !\n"
                f"Articles : {apercu}\n"
                f"Total : {order.amount_total:.2f} DH\n"
                f"Merci pour votre confiance 📚"
            )
            _envoyer_whatsapp(phone, msg)
        return result


class StockPickingWhatsApp(models.Model):
    _inherit = "stock.picking"

    def button_validate(self):
        # Mémoriser les réceptions en cours avant validation
        receptions = self.filtered(
            lambda p: p.picking_type_code == "incoming"
            and p.state in ("assigned", "ready", "waiting")
        )
        result = super().button_validate()

        # Après validation, notifier les clients qui attendent ces titres
        for picking in receptions.filtered(lambda p: p.state == "done"):
            product_ids = picking.move_ids.mapped("product_id").ids
            if not product_ids:
                continue

            # Clients avec une commande confirmée sur ces produits
            lines = self.env["sale.order.line"].search([
                ("product_id", "in", product_ids),
                ("order_id.state", "in", ["sale", "done"]),
            ])

            notifies = set()
            for line in lines:
                partner = line.order_id.partner_id
                if partner.id in notifies:
                    continue
                notifies.add(partner.id)
                phone = partner.mobile or partner.phone
                if not phone:
                    continue
                msg = (
                    f"📦 Librairie DSM\n"
                    f"Bonne nouvelle {partner.name} !\n"
                    f"Le titre « {line.product_id.name} » est arrivé en stock.\n"
                    f"Venez le récupérer à la librairie 📚"
                )
                _envoyer_whatsapp(phone, msg)

        return result
