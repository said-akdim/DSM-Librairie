"""
Frais de livraison par ville — DSM Librairie
Ajoute le type de tarification « Selon la ville » sur delivery.carrier.
"""

import unicodedata

from odoo import api, fields, models, _


def _normalize_city(name):
    """Normalise un nom de ville pour la comparaison :
    minuscules, sans accents, tirets → espaces, espaces multiples réduits.
    Ex. « El-Jadida  » == « el jadida » == « EL JADIDA »
    """
    if not name:
        return ''
    name = unicodedata.normalize('NFKD', name)
    name = ''.join(c for c in name if not unicodedata.combining(c))
    return ' '.join(name.lower().replace('-', ' ').split())


class DeliveryCarrier(models.Model):
    _inherit = 'delivery.carrier'

    delivery_type = fields.Selection(
        selection_add=[('based_on_city', 'Selon la ville')],
        ondelete={'based_on_city': 'set default'},
    )
    city_fee_ids = fields.One2many(
        'delivery.carrier.city.fee', 'carrier_id',
        string='Frais par ville', copy=True,
    )
    city_fallback_policy = fields.Selection(
        [
            ('error', 'Refuser la livraison'),
            ('default', 'Appliquer un tarif par défaut'),
        ],
        string='Si la ville est introuvable',
        default='error', required=True,
        help="Comportement lorsque la ville de l'adresse de livraison "
             "n'apparaît pas dans la grille des frais par ville.",
    )
    city_default_price = fields.Float(
        string='Tarif par défaut',
        help="Frais appliqués quand la ville du client n'est pas dans la grille "
             "(si la politique est « Appliquer un tarif par défaut »).",
    )

    def _get_city_fee(self, partner):
        """Retourne la ligne de frais correspondant à la ville du partenaire,
        ou un recordset vide si aucune ne correspond."""
        self.ensure_one()
        city = _normalize_city(partner.city)
        if not city:
            return self.env['delivery.carrier.city.fee']
        for fee in self.city_fee_ids:
            if city in fee._get_normalized_names():
                return fee
        return self.env['delivery.carrier.city.fee']

    def based_on_city_rate_shipment(self, order):
        self.ensure_one()
        carrier = self._match_address(order.partner_shipping_id)
        if not carrier:
            return {
                'success': False,
                'price': 0.0,
                'error_message': _("Erreur : cette méthode de livraison n'est pas "
                                   "disponible pour cette adresse."),
                'warning_message': False,
            }
        partner = order.partner_shipping_id
        if not partner.city:
            return {
                'success': False,
                'price': 0.0,
                'error_message': _("Erreur : aucune ville n'est renseignée sur "
                                   "l'adresse de livraison."),
                'warning_message': False,
            }
        fee = self._get_city_fee(partner)
        if fee:
            price = fee.price
        elif self.city_fallback_policy == 'default':
            price = self.city_default_price
        else:
            return {
                'success': False,
                'price': 0.0,
                'error_message': _("Erreur : la livraison vers « %s » n'est pas "
                                   "prise en charge par cette méthode.",
                                   partner.city),
                'warning_message': False,
            }
        company = self.company_id or order.company_id or self.env.company
        if company.currency_id and company.currency_id != order.currency_id:
            price = company.currency_id._convert(
                price, order.currency_id, company, fields.Date.context_today(self))
        return {
            'success': True,
            'price': price,
            'error_message': False,
            'warning_message': False,
        }

    # Méthodes appelées par stock_delivery lors de la validation des
    # transferts, si ce module est installé.
    def based_on_city_send_shipping(self, pickings):
        res = []
        for picking in pickings:
            sale = picking.sale_id if 'sale_id' in picking._fields else False
            if sale:
                rate = self.based_on_city_rate_shipment(sale)
                price = rate['price'] if rate.get('success') else 0.0
            else:
                fee = self._get_city_fee(picking.partner_id)
                price = fee.price if fee else self.city_default_price
            res.append({'exact_price': price, 'tracking_number': False})
        return res

    def based_on_city_get_tracking_link(self, picking):
        return False

    def based_on_city_cancel_shipment(self, pickings):
        raise NotImplementedError()


class DeliveryCarrierCityFee(models.Model):
    _name = 'delivery.carrier.city.fee'
    _description = 'Frais de livraison par ville'
    _order = 'sequence, id'

    sequence = fields.Integer(default=10)
    carrier_id = fields.Many2one(
        'delivery.carrier', string='Méthode de livraison',
        required=True, ondelete='cascade', index=True,
    )
    city_name = fields.Char(string='Ville', required=True)
    city_aliases = fields.Char(
        string='Autres orthographes',
        help="Variantes acceptées, séparées par des virgules. "
             "Ex. pour Casablanca : « Casa, Casablanca-Settat »",
    )
    price = fields.Monetary(string='Frais de livraison', required=True)
    currency_id = fields.Many2one(
        'res.currency', compute='_compute_currency_id', string='Devise')

    _sql_constraints = [
        ('price_positive', 'CHECK(price >= 0)',
         'Les frais de livraison ne peuvent pas être négatifs.'),
    ]

    @api.depends('carrier_id.company_id')
    def _compute_currency_id(self):
        for fee in self:
            company = fee.carrier_id.company_id or self.env.company
            fee.currency_id = company.currency_id

    def _get_normalized_names(self):
        """Nom principal + alias, normalisés pour la comparaison."""
        self.ensure_one()
        names = [self.city_name]
        if self.city_aliases:
            names += self.city_aliases.split(',')
        return {_normalize_city(n) for n in names if n and n.strip()}
