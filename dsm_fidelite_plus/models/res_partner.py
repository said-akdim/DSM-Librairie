from odoo import models, fields


class ResPartner(models.Model):
    _inherit = 'res.partner'

    dsm_editeur_favori = fields.Char(string="Éditeur favori")
    dsm_langue_pref = fields.Selection([
        ('fr', 'Français'),
        ('ar', 'Arabe'),
        ('en', 'Anglais'),
        ('es', 'Espagnol'),
    ], string="Langue préférée", default='fr')
    dsm_budget_moyen = fields.Float(string="Budget moyen (DH)", digits=(10, 2))
    dsm_date_naissance = fields.Date(string="Date de naissance")
    dsm_wishlist = fields.Text(string="Liste de souhaits (JSON)")
