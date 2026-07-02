from odoo import api, fields, models


class DsmLivrePrefere(models.Model):
    _name = 'dsm.livre.prefere'
    _description = 'Livres préférés du client (analyse achats)'
    _order = 'qte_totale desc, nb_achats desc'

    partner_id = fields.Many2one('res.partner', string='Client', required=True, ondelete='cascade')
    product_id = fields.Many2one('product.template', string='Livre / Produit', required=True)
    genre = fields.Char(string='Genre / Catégorie', related='product_id.categ_id.name', store=True)
    auteur = fields.Char(string='Auteur', related='product_id.dsm_auteur', store=True)
    nb_achats = fields.Integer(string='Nb commandes')
    qte_totale = fields.Float(string='Qté totale achetée', digits=(10, 1))
    montant_total = fields.Float(string='Montant total (DH)', digits=(10, 2))
    date_premier_achat = fields.Datetime(string='Premier achat')
    date_dernier_achat = fields.Datetime(string='Dernier achat')
