from odoo import fields, models, api, _
from odoo.exceptions import UserError
import requests


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    whatsapp_enabled = fields.Boolean(
        string='Activer les notifications WhatsApp',
        config_parameter='dsm_whatsapp.enabled',
    )
    whatsapp_token = fields.Char(
        string='Token d\'accès (Bearer)',
        config_parameter='dsm_whatsapp.token',
        help='Token permanant ou temporaire de l\'API WhatsApp Business Cloud (Meta)',
    )
    whatsapp_phone_id = fields.Char(
        string='Phone Number ID',
        config_parameter='dsm_whatsapp.phone_id',
        help='ID du numéro de téléphone WhatsApp Business dans Meta',
    )
    whatsapp_api_url = fields.Char(
        string='URL API',
        config_parameter='dsm_whatsapp.api_url',
        default='https://graph.facebook.com/v19.0',
    )
    whatsapp_default_country = fields.Char(
        string='Indicatif pays par défaut',
        config_parameter='dsm_whatsapp.country_code',
        default='212',
        help='Indicatif international sans le + (ex: 212 pour le Maroc)',
    )

    def action_test_whatsapp(self):
        """Envoie un message de test au numéro configuré."""
        self.ensure_one()
        ICP = self.env['ir.config_parameter'].sudo()
        token = ICP.get_param('dsm_whatsapp.token', '')
        phone_id = ICP.get_param('dsm_whatsapp.phone_id', '')
        api_url = ICP.get_param('dsm_whatsapp.api_url', 'https://graph.facebook.com/v19.0')

        if not token or not phone_id:
            raise UserError(_('Veuillez renseigner le Token et le Phone Number ID avant de tester.'))

        url = f"{api_url}/{phone_id}/messages"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        }
        payload = {
            'messaging_product': 'whatsapp',
            'to': phone_id,
            'type': 'text',
            'text': {'body': 'Test de connexion DSM Librairie ✅'},
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            data = resp.json()
            if resp.status_code == 200 and data.get('messages'):
                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': _('Connexion réussie'),
                        'message': _('L\'API WhatsApp est bien configurée.'),
                        'type': 'success',
                        'sticky': False,
                    },
                }
            raise UserError(_('Réponse inattendue : %s') % str(data))
        except requests.RequestException as e:
            raise UserError(_('Erreur de connexion : %s') % str(e))
