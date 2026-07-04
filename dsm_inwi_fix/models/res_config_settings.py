from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # Champ manquant référencé par un ancien module inwi désinstallé/corrompu
    inwi_notif_enabled = fields.Boolean(
        string='Notifications Inwi (désactivé)',
        default=False,
        help='Champ de compatibilité — module inwi non actif.',
    )
