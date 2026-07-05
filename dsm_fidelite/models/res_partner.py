import base64
import io
import random
from collections import defaultdict

from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    # ── Champs fidélité de base ───────────────────────────────────────────────

    dsm_points = fields.Integer(string='Points fidélité', default=0)
    dsm_niveau = fields.Selection([
        ('bronze', '🥉 Bronze'),
        ('silver', '🥈 Silver'),
        ('gold', '🥇 Gold'),
        ('platine', '💎 Platine'),
    ], string='Niveau', compute='_compute_dsm_niveau', store=True)
    dsm_num_carte = fields.Char(string='N° Carte fidélité', copy=False, index=True)
    dsm_solde = fields.Float(string='Solde équivalent (DH)', compute='_compute_dsm_solde', store=True, digits=(10, 2))
    dsm_membre_depuis = fields.Date(string='Membre depuis')
    dsm_genre_favori = fields.Char(string='Genre favori')
    dsm_auteur_favori = fields.Char(string='Auteur favori')

    # ── Carte virtuelle QR ────────────────────────────────────────────────────

    dsm_carte_qr = fields.Binary(string='QR Code carte', compute='_compute_carte_qr', store=False)
    dsm_carte_html = fields.Html(
        string='Carte virtuelle', compute='_compute_carte_html',
        sanitize=False, store=False,
    )

    # ── Statistiques commandes/livraisons (smart buttons) ────────────────────

    dsm_nb_commandes = fields.Integer(string='Commandes', compute='_compute_dsm_stats')
    dsm_nb_livraisons = fields.Integer(string='Livraisons', compute='_compute_dsm_stats')
    dsm_ca_total = fields.Float(string='CA total (DH)', compute='_compute_dsm_stats', digits=(10, 2))

    # ── Relations ────────────────────────────────────────────────────────────

    dsm_historique_ids = fields.One2many(
        'dsm.historique.points', 'partner_id', string='Historique des points')
    dsm_notification_ids = fields.One2many(
        'dsm.notification', 'partner_id', string='Notifications')
    dsm_livre_prefere_ids = fields.One2many(
        'dsm.livre.prefere', 'partner_id', string='Livres préférés')

    # ── Computed : niveau ────────────────────────────────────────────────────

    @api.depends('dsm_points')
    def _compute_dsm_niveau(self):
        for rec in self:
            pts = rec.dsm_points
            if pts >= 2000:
                rec.dsm_niveau = 'platine'
            elif pts >= 1000:
                rec.dsm_niveau = 'gold'
            elif pts >= 500:
                rec.dsm_niveau = 'silver'
            else:
                rec.dsm_niveau = 'bronze'

    @api.depends('dsm_points')
    def _compute_dsm_solde(self):
        for rec in self:
            rec.dsm_solde = round(rec.dsm_points * 0.1, 2)

    # ── Computed : QR code ───────────────────────────────────────────────────

    @api.depends('dsm_num_carte')
    def _compute_carte_qr(self):
        for rec in self:
            if not rec.dsm_num_carte:
                rec.dsm_carte_qr = False
                continue
            try:
                import qrcode  # noqa: PLC0415
                qr = qrcode.QRCode(version=1, box_size=8, border=3)
                qr.add_data(f'DSM-{rec.dsm_num_carte}')
                qr.make(fit=True)
                img = qr.make_image(fill_color='#1a1a2e', back_color='white')
                buf = io.BytesIO()
                img.save(buf, format='PNG')
                rec.dsm_carte_qr = base64.b64encode(buf.getvalue())
            except Exception:
                rec.dsm_carte_qr = False

    @api.depends('dsm_num_carte', 'dsm_points', 'dsm_niveau', 'dsm_solde', 'dsm_membre_depuis', 'dsm_carte_qr')
    def _compute_carte_html(self):
        niveau_colors = {
            'bronze': ('#CD7F32', '#fff8f0'),
            'silver': ('#A0A0A0', '#f5f5f5'),
            'gold':   ('#D4AF37', '#fffdf0'),
            'platine': ('#6C63FF', '#f5f3ff'),
        }
        for rec in self:
            if not rec.dsm_num_carte:
                rec.dsm_carte_html = '<p style="color:#888;">Aucune carte générée.</p>'
                continue
            niveau = rec.dsm_niveau or 'bronze'
            color, bg = niveau_colors.get(niveau, ('#888', '#fff'))
            label = dict(self._fields['dsm_niveau'].selection).get(niveau, niveau)
            membre = rec.dsm_membre_depuis.strftime('%d/%m/%Y') if rec.dsm_membre_depuis else '—'

            # QR code embarqué dans la carte
            if rec.dsm_carte_qr:
                qr_b64 = rec.dsm_carte_qr.decode() if isinstance(rec.dsm_carte_qr, bytes) else rec.dsm_carte_qr
                qr_html = f"""
                <div style="text-align:center; margin-top:16px;">
                    <div style="
                        display:inline-block; background:#fff;
                        border:2px solid {color}; border-radius:12px;
                        padding:10px; box-shadow:0 2px 8px rgba(0,0,0,.1);
                    ">
                        <img src="data:image/png;base64,{qr_b64}"
                             width="130" height="130"
                             style="display:block;"
                             alt="QR Code"/>
                        <div style="font-size:13px; font-weight:700; letter-spacing:4px;
                                    color:#333; margin-top:6px; font-family:monospace;">
                            {rec.dsm_num_carte}
                        </div>
                    </div>
                </div>"""
            else:
                qr_html = ''

            rec.dsm_carte_html = f"""
<div style="
    background: linear-gradient(135deg, {bg} 0%, white 100%);
    border: 2px solid {color};
    border-radius: 16px;
    padding: 20px 28px;
    max-width: 420px;
    font-family: 'Segoe UI', sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,.08);
">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
            <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:1px;">
                Librairie DSM
            </div>
            <div style="font-size:20px; font-weight:700; color:{color}; margin-top:2px;">
                {label}
            </div>
        </div>
        <div style="font-size:28px;">{label.split()[-1] if label else ''}</div>
    </div>
    <div style="font-size:13px; color:#444; margin-bottom:14px;">
        <b>Client :</b> {rec.name or '—'}
    </div>
    {qr_html}
    <div style="display:flex; gap:24px; font-size:13px; color:#555; margin-top:16px;">
        <div><b style="color:{color};">{rec.dsm_points}</b><br/>Points</div>
        <div><b style="color:{color};">{rec.dsm_solde:.2f} DH</b><br/>Solde</div>
        <div><b style="color:{color};">{membre}</b><br/>Membre depuis</div>
    </div>
</div>
"""

    # ── Computed : stats commandes/livraisons ─────────────────────────────────

    def _compute_dsm_stats(self):
        for rec in self:
            orders = self.env['sale.order'].search([
                ('partner_id', '=', rec.id),
                ('state', 'in', ['sale', 'done']),
            ])
            rec.dsm_nb_commandes = len(orders)
            rec.dsm_ca_total = sum(orders.mapped('amount_total'))

            pickings = self.env['stock.picking'].search([
                ('partner_id', '=', rec.id),
                ('picking_type_code', '=', 'outgoing'),
                ('state', '=', 'done'),
            ])
            rec.dsm_nb_livraisons = len(pickings)

    # ── Actions ───────────────────────────────────────────────────────────────

    def action_generer_carte(self):
        """Génère un numéro de carte unique et initialise le membership."""
        self.ensure_one()
        if self.dsm_num_carte:
            return
        while True:
            num = str(random.randint(10000, 99999))
            if not self.search([('dsm_num_carte', '=', num)], limit=1):
                break
        self.write({
            'dsm_num_carte': num,
            'dsm_membre_depuis': fields.Date.today(),
        })
        if not self.dsm_points:
            self._ajouter_points(50, 'inscription', 'Bienvenue — 50 points offerts')
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Carte créée !',
                'message': f'N° carte : {num} — 50 points de bienvenue offerts.',
                'type': 'success',
            },
        }

    def action_analyser_achats(self):
        """Analyse les commandes du client et remplit les livres préférés."""
        self.ensure_one()
        orders = self.env['sale.order'].search([
            ('partner_id', '=', self.id),
            ('state', 'in', ['sale', 'done']),
        ])
        if not orders:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Aucun achat trouvé',
                    'message': "Ce client n'a pas encore de commandes confirmées.",
                    'type': 'warning',
                },
            }

        lines = self.env['sale.order.line'].search([('order_id', 'in', orders.ids)])

        # Agrégation par produit
        product_data = defaultdict(lambda: {
            'nb_achats': 0, 'qte': 0.0, 'montant': 0.0,
            'premier': None, 'dernier': None, 'auteur': '',
        })
        genre_count = defaultdict(float)
        author_count = defaultdict(float)

        for line in lines:
            tmpl = line.product_id.product_tmpl_id
            d = product_data[tmpl.id]
            d['nb_achats'] += 1
            d['qte'] += line.product_uom_qty
            d['montant'] += line.price_subtotal
            date = line.order_id.date_order
            if not d['premier'] or date < d['premier']:
                d['premier'] = date
            if not d['dernier'] or date > d['dernier']:
                d['dernier'] = date

            genre = tmpl.categ_id.name or ''
            if genre:
                genre_count[genre] += line.product_uom_qty

            # Auteur via attribut produit
            for attr_val in line.product_id.product_template_attribute_value_ids:
                if 'auteur' in (attr_val.attribute_id.name or '').lower():
                    author_count[attr_val.name] += line.product_uom_qty
                    if not product_data[tmpl.id]['auteur']:
                        product_data[tmpl.id]['auteur'] = attr_val.name

        # Supprime les anciens enregistrements
        self.dsm_livre_prefere_ids.unlink()

        # Crée les nouveaux (top 20 par quantité)
        sorted_products = sorted(product_data.items(), key=lambda x: x[1]['qte'], reverse=True)[:20]
        vals_list = []
        for tmpl_id, d in sorted_products:
            tmpl = self.env['product.template'].browse(tmpl_id)
            vals_list.append({
                'partner_id': self.id,
                'product_id': tmpl_id,
                'genre': tmpl.categ_id.name or '',
                'auteur': d.get('auteur', ''),
                'nb_achats': d['nb_achats'],
                'qte_totale': d['qte'],
                'montant_total': d['montant'],
                'date_premier_achat': d['premier'],
                'date_dernier_achat': d['dernier'],
            })
        if vals_list:
            self.env['dsm.livre.prefere'].create(vals_list)

        # Met à jour genre et auteur favoris
        if genre_count:
            self.dsm_genre_favori = max(genre_count, key=genre_count.get)
        if author_count:
            self.dsm_auteur_favori = max(author_count, key=author_count.get)

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Analyse terminée',
                'message': (
                    f'{len(vals_list)} livres/produits analysés. '
                    f'Genre favori : {self.dsm_genre_favori or "—"}. '
                    f'Auteur favori : {self.dsm_auteur_favori or "—"}.'
                ),
                'type': 'success',
            },
        }

    def action_voir_recommandations(self):
        """Ouvre les produits recommandés selon le profil d'achat."""
        self.ensure_one()
        # Produits déjà achetés
        orders = self.env['sale.order'].search([
            ('partner_id', '=', self.id),
            ('state', 'in', ['sale', 'done']),
        ])
        deja_achetes = []
        if orders:
            lines = self.env['sale.order.line'].search([('order_id', 'in', orders.ids)])
            deja_achetes = lines.mapped('product_id.product_tmpl_id').ids

        domain = [('sale_ok', '=', True), ('active', '=', True)]
        if deja_achetes:
            domain.append(('id', 'not in', deja_achetes))
        if self.dsm_genre_favori:
            domain.append(('categ_id.name', '=', self.dsm_genre_favori))

        return {
            'name': f'Recommandations pour {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'product.template',
            'view_mode': 'kanban,list,form',
            'domain': domain,
            'context': {
                'search_default_available': 1,
                'default_categ_id': self.env['product.category'].search(
                    [('name', '=', self.dsm_genre_favori)], limit=1
                ).id if self.dsm_genre_favori else False,
            },
        }

    def action_voir_commandes(self):
        self.ensure_one()
        return {
            'name': f'Commandes — {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'sale.order',
            'view_mode': 'list,form',
            'domain': [('partner_id', '=', self.id)],
            'context': {'default_partner_id': self.id},
        }

    def action_voir_livraisons(self):
        self.ensure_one()
        return {
            'name': f'Livraisons — {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'stock.picking',
            'view_mode': 'list,form',
            'domain': [
                ('partner_id', '=', self.id),
                ('picking_type_code', '=', 'outgoing'),
            ],
        }

    def action_envoyer_carte_email(self):
        """Envoie la carte de fidélité virtuelle par email au client."""
        self.ensure_one()
        if not self.email:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Email manquant',
                    'message': "Ce client n'a pas d'adresse email renseignée.",
                    'type': 'warning',
                },
            }
        if not self.dsm_num_carte:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Carte non générée',
                    'message': "Veuillez d'abord générer la carte de fidélité.",
                    'type': 'warning',
                },
            }
        template = self.env.ref('dsm_fidelite.mail_template_carte_fidelite', raise_if_not_found=False)
        if template:
            template.send_mail(self.id, force_send=True)
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': 'Email envoyé !',
                    'message': f'Carte de fidélité envoyée à {self.email}.',
                    'type': 'success',
                },
            }

    # ── Méthode interne ───────────────────────────────────────────────────────

    def _ajouter_points(self, points, type_op, description, order_id=False):
        """Ajoute des points et crée l'entrée historique."""
        self.ensure_one()
        avant = self.dsm_points
        self.dsm_points = avant + points
        self.env['dsm.historique.points'].create({
            'partner_id': self.id,
            'type': type_op,
            'description': description,
            'points': points,
            'points_avant': avant,
            'points_apres': self.dsm_points,
            'order_id': order_id,
        })
        self.env['dsm.notification'].create({
            'partner_id': self.id,
            'titre': f'⭐ +{points} points',
            'message': description,
            'type': 'points',
        })
