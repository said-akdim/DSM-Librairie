from odoo import api, fields, models


class DsmHistoriquePoints(models.Model):
    _name = 'dsm.historique.points'
    _description = 'Historique des points fidélité'
    _order = 'date desc'

    partner_id = fields.Many2one('res.partner', string='Client', required=True, ondelete='cascade')
    date = fields.Datetime(string='Date', required=True, default=fields.Datetime.now)
    type = fields.Selection([
        ('inscription', 'Inscription'),
        ('achat', 'Achat'),
        ('bonus', 'Bonus'),
        ('remboursement', 'Remboursement'),
    ], string='Type', required=True, default='achat')
    description = fields.Char(string='Description')
    points = fields.Integer(string='Points', required=True)
    points_avant = fields.Integer(string='Points avant')
    points_apres = fields.Integer(string='Points après')
    order_id = fields.Many2one('sale.order', string='Commande liée')
