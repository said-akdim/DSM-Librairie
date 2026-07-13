from odoo import Command
from odoo.tests import TransactionCase, tagged

from odoo.addons.dsm_delivery_city.models.delivery_carrier import (
    MOROCCO_CITIES,
    _normalize_city,
)


@tagged('post_install', '-at_install')
class TestDeliveryCity(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.book = cls.env['product.product'].create({
            'name': 'Livre test',
            'type': 'consu',
            'list_price': 100.0,
        })
        cls.delivery_product = cls.env['product.product'].create({
            'name': 'Frais de livraison test',
            'type': 'service',
            'list_price': 0.0,
        })
        cls.carrier = cls.env['delivery.carrier'].create({
            'name': 'Livraison par ville test',
            'delivery_type': 'based_on_city',
            'product_id': cls.delivery_product.id,
            'city_fallback_policy': 'error',
            'city_fee_ids': [
                Command.create({'city_name': 'Casablanca',
                                'city_aliases': 'Casa, الدار البيضاء',
                                'price': 20.0}),
                Command.create({'city_name': 'Salé', 'price': 25.0}),
            ],
        })
        cls.partner = cls.env['res.partner'].create({
            'name': 'Client test',
            'city': 'Casablanca',
        })

    def _make_order(self, city):
        self.partner.city = city
        return self.env['sale.order'].create({
            'partner_id': self.partner.id,
            'order_line': [Command.create({
                'product_id': self.book.id,
                'product_uom_qty': 1,
            })],
        })

    def test_normalize_city(self):
        self.assertEqual(_normalize_city('  EL-Jadida '), 'el jadida')
        self.assertEqual(_normalize_city('Salé'), 'sale')
        self.assertEqual(_normalize_city(False), '')

    def test_rate_by_city_and_alias(self):
        res = self.carrier.based_on_city_rate_shipment(self._make_order('CASA'))
        self.assertTrue(res['success'])
        self.assertEqual(res['price'], 20.0)
        res = self.carrier.based_on_city_rate_shipment(self._make_order('salé '))
        self.assertTrue(res['success'])
        self.assertEqual(res['price'], 25.0)
        res = self.carrier.based_on_city_rate_shipment(
            self._make_order('الدار البيضاء'))
        self.assertTrue(res['success'])
        self.assertEqual(res['price'], 20.0)

    def test_unknown_city_policies(self):
        order = self._make_order('Zagora')
        res = self.carrier.based_on_city_rate_shipment(order)
        self.assertFalse(res['success'])
        self.carrier.write({
            'city_fallback_policy': 'default',
            'city_default_price': 60.0,
        })
        res = self.carrier.based_on_city_rate_shipment(order)
        self.assertTrue(res['success'])
        self.assertEqual(res['price'], 60.0)

    def test_load_morocco_cities(self):
        carrier = self.env['delivery.carrier'].create({
            'name': 'Maroc test',
            'delivery_type': 'based_on_city',
            'product_id': self.delivery_product.id,
            'city_fee_ids': [
                Command.create({'city_name': 'Casablanca', 'price': 19.0}),
            ],
        })
        carrier.action_load_morocco_cities()
        self.assertEqual(len(carrier.city_fee_ids), len(MOROCCO_CITIES))
        self.assertIn(self.env.ref('base.ma'), carrier.country_ids)
        # La ville déjà présente n'est pas écrasée ni dupliquée.
        casa = carrier.city_fee_ids.filtered(
            lambda f: _normalize_city(f.city_name) == 'casablanca')
        self.assertEqual(len(casa), 1)
        self.assertEqual(casa.price, 19.0)
        # Relancer le bouton ne crée aucun doublon.
        carrier.action_load_morocco_cities()
        self.assertEqual(len(carrier.city_fee_ids), len(MOROCCO_CITIES))

    def test_native_rules_by_city(self):
        carrier = self.env['delivery.carrier'].create({
            'name': 'Règles par ville test',
            'delivery_type': 'base_on_rule',
            'product_id': self.delivery_product.id,
            'price_rule_ids': [
                Command.create({'variable': 'quantity', 'operator': '>=',
                                'max_value': 0, 'list_base_price': 20.0,
                                'list_price': 0.0, 'variable_factor': 'quantity',
                                'city_names': 'Casablanca, Casa'}),
                Command.create({'variable': 'quantity', 'operator': '>=',
                                'max_value': 0, 'list_base_price': 40.0,
                                'list_price': 0.0, 'variable_factor': 'quantity'}),
            ],
        })
        price = carrier._get_price_available(self._make_order('casa'))
        self.assertEqual(price, 20.0)
        # Ville non ciblée : la règle générique (sans villes) s'applique.
        price = carrier._get_price_available(self._make_order('Oujda'))
        self.assertEqual(price, 40.0)
