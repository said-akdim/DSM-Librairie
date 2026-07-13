"""
Extension des règles de prix natives d'Odoo (delivery.price.rule) :
chaque règle peut être limitée à une ou plusieurs villes, en plus de la
condition standard (poids, volume, prix, quantité).
"""

from odoo import fields, models

from .delivery_carrier import _normalize_city


class DeliveryPriceRule(models.Model):
    _inherit = 'delivery.price.rule'

    city_names = fields.Char(
        string='Villes',
        help="Limite la règle à certaines villes, séparées par des virgules "
             "(ex. « Casablanca, Casa, الدار البيضاء »). Vide = la règle "
             "s'applique à toutes les villes. La comparaison ignore la casse, "
             "les accents et les tirets.",
    )

    def _match_shipping_city(self, city):
        """True si la règle s'applique à cette ville. Une règle sans villes
        s'applique partout ; une règle avec villes exige une correspondance."""
        self.ensure_one()
        if not self.city_names:
            return True
        normalized = _normalize_city(city)
        if not normalized:
            return False
        return normalized in {
            _normalize_city(name)
            for name in self.city_names.split(',') if name.strip()
        }
