import logging
import requests
from odoo import models, fields, api, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

# ─── Messages par événement ───────────────────────────────────────────────────

MSG_TEMPLATES = {
    'commande_creee': (
        "Bonjour {name},\n\n"
        "📚 Votre commande *{ref}* a bien été enregistrée chez DSM Librairie.\n"
        "Montant : *{amount} DH*\n\n"
        "Nous vous contacterons dès que vos articles seront disponibles.\n"
        "Merci de votre confiance ! 🙏\n"
        "— DSM Librairie"
    ),
    'commande_confirmee': (
        "Bonjour {name},\n\n"
        "✅ Votre commande *{ref}* est confirmée et en cours de traitement.\n"
        "Montant : *{amount} DH*\n\n"
        "Nous vous tiendrons informé(e) de l'avancement.\n"
        "— DSM Librairie"
    ),
    'commande_reception': (
        "Bonjour {name},\n\n"
        "📦 Bonne nouvelle ! Les articles de votre commande *{ref}* "
        "sont arrivés en librairie.\n\n"
        "Vous pouvez venir les récupérer pendant nos horaires d'ouverture.\n"
        "— DSM Librairie"
    ),
    'titre_disponible': (
        "Bonjour {name},\n\n"
        "📖 Le titre *{titre}* de votre commande *{ref}* est maintenant disponible.\n\n"
        "Passez nous voir en librairie !\n"
        "— DSM Librairie"
    ),
    'commande_finalisee': (
        "Bonjour {name},\n\n"
        "🎉 Votre commande *{ref}* est finalisée. Merci pour votre achat !\n\n"
        "À très bientôt chez DSM Librairie 📚\n"
        "— DSM Librairie"
    ),
}


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _wa_config(self):
        ICP = self.env['ir.config_parameter'].sudo()
        return {
            'enabled': ICP.get_param('dsm_whatsapp.enabled') == 'True',
            'token': ICP.get_param('dsm_whatsapp.token', ''),
            'phone_id': ICP.get_param('dsm_whatsapp.phone_id', ''),
            'api_url': ICP.get_param('dsm_whatsapp.api_url', 'https://graph.facebook.com/v19.0'),
            'country_code': ICP.get_param('dsm_whatsapp.country_code', '212'),
            'mode': ICP.get_param('dsm_whatsapp.notification_mode', 'whatsapp'),
        }

    def _sms_config(self):
        ICP = self.env['ir.config_parameter'].sudo()
        return {
            'api_url': ICP.get_param('dsm_whatsapp.sms_api_url', ''),
            'login': ICP.get_param('dsm_whatsapp.sms_login', ''),
            'password': ICP.get_param('dsm_whatsapp.sms_password', ''),
            'sender': ICP.get_param('dsm_whatsapp.sms_sender', 'DSM'),
        }

    def _wa_format_phone(self, phone, country_code='212'):
        """Normalise un numéro de téléphone au format international E.164 (sans +)."""
        if not phone:
            return None
        digits = ''.join(c for c in phone if c.isdigit() or c == '+')
        if digits.startswith('+'):
            digits = digits[1:]
        # Numéro local (ex: 06XXXXXXXX → 2126XXXXXXXX pour le Maroc)
        if digits.startswith('0') and len(digits) == 10:
            digits = country_code + digits[1:]
        return digits if len(digits) >= 10 else None

    def _wa_send(self, phone, message, event):
        """Envoie un message via WhatsApp Business Cloud API et log le résultat."""
        cfg = self._wa_config()
        log_vals = {
            'canal': 'whatsapp',
            'partner_id': self.partner_id.id,
            'phone': phone,
            'message': message,
            'event': event,
            'sale_order_id': self.id,
        }

        if not cfg['enabled']:
            self.env['dsm.whatsapp.log'].sudo().create({
                **log_vals, 'statut': 'desactive',
                'erreur_detail': 'Notifications WhatsApp désactivées dans la configuration.',
            })
            return False

        if not cfg['token'] or not cfg['phone_id']:
            self.env['dsm.whatsapp.log'].sudo().create({
                **log_vals, 'statut': 'erreur',
                'erreur_detail': 'Token ou Phone Number ID manquant dans la configuration.',
            })
            return False

        url = f"{cfg['api_url']}/{cfg['phone_id']}/messages"
        headers = {
            'Authorization': f"Bearer {cfg['token']}",
            'Content-Type': 'application/json',
        }
        payload = {
            'messaging_product': 'whatsapp',
            'to': phone,
            'type': 'text',
            'text': {'preview_url': False, 'body': message},
        }

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            self.env['dsm.whatsapp.log'].sudo().create({**log_vals, 'statut': 'succes'})
            return True
        except Exception as exc:
            _logger.warning('WhatsApp send error [%s]: %s', event, exc)
            self.env['dsm.whatsapp.log'].sudo().create({
                **log_vals, 'statut': 'erreur', 'erreur_detail': str(exc),
            })
            return False

    def _sms_send(self, phone, message, event):
        """Envoie un SMS via Inwi Business SMS API et log le résultat."""
        sms = self._sms_config()
        log_vals = {
            'canal': 'sms',
            'partner_id': self.partner_id.id,
            'phone': phone,
            'message': message,
            'event': event,
            'sale_order_id': self.id,
        }

        if not sms['api_url'] or not sms['login'] or not sms['password']:
            self.env['dsm.whatsapp.log'].sudo().create({
                **log_vals, 'statut': 'erreur',
                'erreur_detail': 'URL API, Login ou Mot de passe Inwi SMS manquant dans la configuration.',
            })
            return False

        # Supprimer le formatage WhatsApp (*bold*) — SMS ne supporte pas le markdown
        sms_body = message.replace('*', '')

        try:
            from requests.auth import HTTPBasicAuth
            resp = requests.post(
                sms['api_url'],
                json={
                    'to': f'+{phone}',
                    'from': sms['sender'],
                    'text': sms_body,
                },
                auth=HTTPBasicAuth(sms['login'], sms['password']),
                timeout=10,
            )
            if resp.status_code not in (200, 201, 202):
                raise Exception(f'HTTP {resp.status_code}: {resp.text[:200]}')
            self.env['dsm.whatsapp.log'].sudo().create({**log_vals, 'statut': 'succes'})
            return True
        except Exception as exc:
            _logger.warning('Inwi SMS send error [%s]: %s', event, exc)
            self.env['dsm.whatsapp.log'].sudo().create({
                **log_vals, 'statut': 'erreur', 'erreur_detail': str(exc),
            })
            return False

    def _wa_notify(self, event, titre=None):
        """Prépare le message et déclenche l'envoi selon le mode configuré."""
        self.ensure_one()
        cfg = self._wa_config()
        partner = self.partner_id
        phone = self._wa_format_phone(
            partner.mobile or partner.phone,
            cfg['country_code'],
        )
        if not phone:
            return False

        tpl = MSG_TEMPLATES.get(event, '')
        msg = tpl.format(
            name=partner.name,
            ref=self.name,
            amount=f'{self.amount_total:.2f}',
            titre=titre or '',
        )

        mode = cfg.get('mode', 'whatsapp')
        wa_ok = False
        sms_ok = False

        if mode in ('whatsapp', 'les_deux'):
            wa_ok = self._wa_send(phone, msg, event)
        if mode in ('sms', 'les_deux'):
            sms_ok = self._sms_send(phone, msg, event)

        return wa_ok or sms_ok

    # ─── Hooks automatiques ──────────────────────────────────────────────────

    @api.model_create_multi
    def create(self, vals_list):
        orders = super().create(vals_list)
        for order in orders:
            try:
                order._wa_notify('commande_creee')
            except Exception as exc:
                _logger.error('WA create hook error: %s', exc)
        return orders

    def action_confirm(self):
        res = super().action_confirm()
        for order in self.filtered(lambda o: o.state == 'sale'):
            try:
                order._wa_notify('commande_confirmee')
            except Exception as exc:
                _logger.error('WA confirm hook error: %s', exc)
        return res

    def write(self, vals):
        pre_states = {o.id: o.state for o in self} if 'state' in vals else {}
        res = super().write(vals)
        if vals.get('state') == 'done':
            for order in self:
                if pre_states.get(order.id) != 'done':
                    try:
                        order._wa_notify('commande_finalisee')
                    except Exception as exc:
                        _logger.error('WA done hook error: %s', exc)
        return res

    # ─── Boutons manuels ─────────────────────────────────────────────────────

    def action_wa_reception(self):
        """Notifie le client que sa commande est arrivée en librairie."""
        self.ensure_one()
        cfg = self._wa_config()
        partner = self.partner_id
        phone = self._wa_format_phone(partner.mobile or partner.phone, cfg['country_code'])
        if not phone:
            raise UserError(_(
                'Aucun numéro de téléphone trouvé pour %s.\n'
                'Veuillez renseigner le champ Mobile ou Téléphone.'
            ) % partner.name)

        sent = self._wa_notify('commande_reception')
        if sent:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('WhatsApp envoyé ✅'),
                    'message': _('Message de réception envoyé à %s (%s)') % (partner.name, phone),
                    'type': 'success',
                    'sticky': False,
                },
            }
        raise UserError(_(
            'L\'envoi WhatsApp a échoué. '
            'Vérifiez la configuration et le journal WhatsApp.'
        ))

    def action_wa_log(self):
        """Ouvre les logs WhatsApp pour cette commande."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Journal WhatsApp — %s') % self.name,
            'res_model': 'dsm.whatsapp.log',
            'view_mode': 'list,form',
            'domain': [('sale_order_id', '=', self.id)],
            'context': {'default_sale_order_id': self.id},
        }

    def _wa_log_count(self):
        for order in self:
            order.wa_log_count = self.env['dsm.whatsapp.log'].search_count(
                [('sale_order_id', '=', order.id)]
            )

    wa_log_count = fields.Integer(
        string='Messages WhatsApp',
        compute='_wa_log_count',
    )


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    def action_wa_titre_disponible(self):
        """Notifie le client qu'un titre spécifique de sa commande est disponible."""
        self.ensure_one()
        order = self.order_id
        cfg = order._wa_config()
        partner = order.partner_id
        phone = order._wa_format_phone(partner.mobile or partner.phone, cfg['country_code'])
        if not phone:
            raise UserError(_(
                'Aucun numéro de téléphone trouvé pour %s.'
            ) % partner.name)

        titre = self.product_id.display_name or self.name
        sent = order._wa_notify('titre_disponible', titre=titre)
        if sent:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('WhatsApp envoyé ✅'),
                    'message': _('Notification "titre disponible" envoyée à %s') % partner.name,
                    'type': 'success',
                    'sticky': False,
                },
            }
        raise UserError(_(
            'L\'envoi WhatsApp a échoué. '
            'Vérifiez la configuration et le journal WhatsApp.'
        ))
