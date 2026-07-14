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

    notification_mode = fields.Selection([
        ('whatsapp', 'WhatsApp uniquement'),
        ('sms', 'SMS uniquement (Inwi Business)'),
        ('les_deux', 'WhatsApp + SMS (les deux canaux)'),
    ], string='Mode d\'envoi des notifications',
        config_parameter='dsm_whatsapp.notification_mode',
        default='les_deux',
    )

    # ── Inwi Business SMS ───────────────────────────────────────────────────────
    sms_api_url = fields.Char(
        string='URL API Inwi SMS',
        config_parameter='dsm_whatsapp.sms_api_url',
        help='URL de l\'endpoint SMS fournie par Inwi Business (ex: https://api.inwi.ma/sms/send)',
    )
    sms_login = fields.Char(
        string='Login Inwi SMS',
        config_parameter='dsm_whatsapp.sms_login',
        help='Identifiant / username fourni par Inwi Business',
    )
    sms_password = fields.Char(
        string='Mot de passe Inwi SMS',
        config_parameter='dsm_whatsapp.sms_password',
    )
    sms_sender = fields.Char(
        string='Nom expéditeur (Sender ID)',
        config_parameter='dsm_whatsapp.sms_sender',
        help='Nom affiché chez le destinataire (ex: DSM ou +212XXXXXXXXX). Max 11 caractères alphanumériques.',
        placeholder='DSM',
    )

    # ── Délai de retrait ────────────────────────────────────────────────────────
    whatsapp_pickup_delay = fields.Integer(
        string='Délai de retrait (jours)',
        config_parameter='dsm_whatsapp.pickup_delay',
        default=15,
        help='Nombre de jours accordés au client pour récupérer sa commande après notification de disponibilité.',
    )

    def action_test_sms(self):
        """Envoie un SMS de test via Inwi Business SMS."""
        self.ensure_one()
        ICP = self.env['ir.config_parameter'].sudo()
        api_url = ICP.get_param('dsm_whatsapp.sms_api_url', '')
        login = ICP.get_param('dsm_whatsapp.sms_login', '')
        password = ICP.get_param('dsm_whatsapp.sms_password', '')
        sender = ICP.get_param('dsm_whatsapp.sms_sender', 'DSM')
        country_code = ICP.get_param('dsm_whatsapp.country_code', '212')

        if not api_url or not login or not password:
            raise UserError(_('Veuillez renseigner l\'URL API, le Login et le Mot de passe Inwi avant de tester.'))

        # Récupère le téléphone de l'utilisateur courant pour le test
        partner = self.env.user.partner_id
        test_phone = partner.mobile or partner.phone or ''
        if not test_phone:
            raise UserError(_('Aucun numéro de téléphone trouvé sur votre profil pour le test.'))

        # Normalisation numéro
        digits = ''.join(c for c in test_phone if c.isdigit())
        if digits.startswith('0') and len(digits) == 10:
            digits = country_code + digits[1:]
        to_phone = f'+{digits}'

        try:
            from requests.auth import HTTPBasicAuth
            resp = requests.post(
                api_url,
                json={'to': to_phone, 'from': sender, 'text': 'Test SMS DSM Librairie ✅'},
                auth=HTTPBasicAuth(login, password),
                timeout=10,
            )
            if resp.status_code in (200, 201, 202):
                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': _('SMS Inwi envoyé ✅'),
                        'message': _('SMS de test envoyé à %s') % to_phone,
                        'type': 'success',
                        'sticky': False,
                    },
                }
            raise UserError(_('Réponse Inwi inattendue (HTTP %s) : %s') % (resp.status_code, resp.text[:300]))
        except requests.RequestException as e:
            raise UserError(_('Erreur de connexion Inwi SMS : %s') % str(e))

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
