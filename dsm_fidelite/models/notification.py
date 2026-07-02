from odoo import api, fields, models


class DsmNotification(models.Model):
    _name = 'dsm.notification'
    _description = 'Notifications clients DSM'
    _order = 'date_creation desc'

    partner_id = fields.Many2one('res.partner', string='Client', required=True, ondelete='cascade')
    titre = fields.Char(string='Titre', required=True)
    message = fields.Text(string='Message')
    lu = fields.Boolean(string='Lu', default=False)
    date_creation = fields.Datetime(string='Date', default=fields.Datetime.now)
    type = fields.Selection([
        ('points', 'Points'),
        ('commande', 'Commande'),
        ('livraison', 'Livraison'),
        ('offre', 'Offre spéciale'),
    ], string='Type', default='points')
