from odoo import models, fields


class DsmWhatsappLog(models.Model):
    _name = 'dsm.whatsapp.log'
    _description = 'Journal des messages WhatsApp'
    _order = 'date_envoi desc'
    _rec_name = 'sale_order_id'

    partner_id = fields.Many2one('res.partner', string='Client', readonly=True, index=True)
    phone = fields.Char(string='Numéro WhatsApp', readonly=True)
    message = fields.Text(string='Message envoyé', readonly=True)
    event = fields.Selection([
        ('commande_creee', 'Commande créée'),
        ('commande_confirmee', 'Commande confirmée'),
        ('commande_reception', 'Articles reçus en librairie'),
        ('titre_disponible', 'Titre disponible'),
        ('commande_finalisee', 'Commande finalisée'),
    ], string='Événement', readonly=True)
    sale_order_id = fields.Many2one('sale.order', string='Commande', readonly=True, ondelete='set null')
    date_envoi = fields.Datetime(string='Date d\'envoi', readonly=True, default=fields.Datetime.now)
    statut = fields.Selection([
        ('succes', 'Succès'),
        ('erreur', 'Erreur'),
        ('desactive', 'Désactivé'),
    ], string='Statut', readonly=True)
    erreur_detail = fields.Text(string='Détail erreur', readonly=True)
