from datetime import date
from odoo import models, fields, api, _
from odoo.exceptions import UserError


class ListeScolaire(models.Model):
    _name = 'dsm.liste.scolaire'
    _description = 'Liste scolaire adoptée'
    _order = 'annee_scolaire desc, ecole_nom'

    name = fields.Char(
        'Référence', required=True, copy=False,
        default=lambda self: _('Nouvelle liste'),
    )
    ecole_nom = fields.Char('École', required=True)
    annee_scolaire = fields.Char(
        'Année scolaire', required=True,
        default=lambda self: self._default_school_year(),
    )
    state = fields.Selection(
        [
            ('brouillon', 'Brouillon'),
            ('validee', 'Validée'),
            ('commande', 'Commande créée'),
        ],
        default='brouillon', string='État', readonly=True,
    )
    ligne_ids = fields.One2many('dsm.titre.adopte', 'liste_id', string='Titres adoptés')
    po_ids = fields.Many2many(
        'purchase.order',
        'dsm_liste_scolaire_po_rel', 'liste_id', 'po_id',
        string='Bons de commande',
    )
    notes = fields.Text('Notes')

    titre_count = fields.Integer('Nb titres', compute='_compute_counts')
    po_count = fields.Integer('Nb bons', compute='_compute_counts')

    def _default_school_year(self):
        today = date.today()
        if today.month >= 9:
            return f"{today.year}-{today.year + 1}"
        return f"{today.year - 1}-{today.year}"

    @api.depends('ligne_ids', 'po_ids')
    def _compute_counts(self):
        for rec in self:
            rec.titre_count = len(rec.ligne_ids)
            rec.po_count = len(rec.po_ids)

    # ── Boutons ────────────────────────────────────────────────────────

    def action_valider(self):
        self.ensure_one()
        if not self.ligne_ids:
            raise UserError(_('La liste ne contient aucun titre adopté.'))
        self.ligne_ids._refresh_stock()
        self.write({'state': 'validee'})

    def action_reset_brouillon(self):
        self.write({'state': 'brouillon'})

    def action_recompute_stock(self):
        self.ensure_one()
        self.ligne_ids._refresh_stock()

    def action_creer_bons_commande(self):
        """Génère un bon de commande brouillon par distributeur."""
        self.ensure_one()
        lines = self.ligne_ids.filtered(
            lambda l: (l.qty_commander or l.qty_estimation) > 0
            and l.distributeur_id and l.product_id
        )
        if not lines:
            raise UserError(_(
                'Aucune ligne commandable.\n'
                'Vérifiez que les quantités à commander sont > 0 '
                'et que chaque titre a un distributeur.'
            ))

        # Regroupement par distributeur
        by_dist = {}
        for line in lines:
            by_dist.setdefault(line.distributeur_id.id, [])
            by_dist[line.distributeur_id.id].append(line)

        po_ids = []
        for dist_id, dist_lines in by_dist.items():
            order_lines_vals = []
            for line in dist_lines:
                qty = line.qty_commander or line.qty_estimation
                order_lines_vals.append((0, 0, {
                    'product_id': line.product_id.id,
                    'name': line.product_id.display_name,
                    'product_qty': qty,
                    'price_unit': line.prix_achat or 0.0,
                    'product_uom': (
                        line.product_id.uom_po_id or line.product_id.uom_id
                    ).id,
                    'date_planned': fields.Datetime.now(),
                }))
            po = self.env['purchase.order'].create({
                'partner_id': dist_id,
                'origin': self.name,
                'order_line': order_lines_vals,
            })
            po_ids.append(po.id)

        self.write({
            'state': 'commande',
            'po_ids': [(4, pid) for pid in po_ids],
        })
        return {
            'type': 'ir.actions.act_window',
            'name': _('Bons de commande générés'),
            'res_model': 'purchase.order',
            'view_mode': 'list,form',
            'domain': [('id', 'in', po_ids)],
        }

    def action_view_purchase_orders(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Bons de commande'),
            'res_model': 'purchase.order',
            'view_mode': 'list,form',
            'domain': [('id', 'in', self.po_ids.ids)],
        }


class TitreAdopte(models.Model):
    _name = 'dsm.titre.adopte'
    _description = 'Titre adopté en liste scolaire'
    _order = 'distributeur_id, product_id'

    liste_id = fields.Many2one(
        'dsm.liste.scolaire', required=True, ondelete='cascade', index=True,
    )
    product_id = fields.Many2one('product.product', string='Article', required=True)
    editeur = fields.Char('Éditeur', readonly=True, store=True,
                          compute='_compute_editeur')
    distributeur_id = fields.Many2one('res.partner', string='Distributeur')

    qty_besoin = fields.Float('Qté demandée', digits=(16, 0), default=1.0)

    # Stock — mis à jour via bouton "Recalculer le stock" ou à la validation
    qty_stock_reel = fields.Float('Stock réel', digits=(16, 2), readonly=True, default=0.0)
    qty_reserved = fields.Float('Qté réservée', digits=(16, 2), readonly=True, default=0.0)

    qty_disponible = fields.Float(
        'Qté disponible', digits=(16, 2), readonly=True,
        compute='_compute_disponible', store=True,
    )
    qty_estimation = fields.Float(
        'Estimation commande', digits=(16, 0), readonly=True,
        compute='_compute_estimation', store=True,
    )
    qty_commander = fields.Float('Qté à commander', digits=(16, 0))

    prix_achat = fields.Float('Prix achat HT', digits='Product Price')

    # ── Computed ───────────────────────────────────────────────────────

    @api.depends('product_id')
    def _compute_editeur(self):
        for rec in self:
            if rec.product_id:
                rec.editeur = getattr(rec.product_id, 'dsm_editeur', '') or ''
            else:
                rec.editeur = ''

    @api.depends('qty_stock_reel', 'qty_reserved')
    def _compute_disponible(self):
        for rec in self:
            rec.qty_disponible = rec.qty_stock_reel - rec.qty_reserved

    @api.depends('qty_besoin', 'qty_disponible')
    def _compute_estimation(self):
        for rec in self:
            rec.qty_estimation = max(0.0, rec.qty_besoin - rec.qty_disponible)

    # ── Onchange ───────────────────────────────────────────────────────

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if not self.product_id:
            return
        # Éditeur
        self.editeur = getattr(self.product_id, 'dsm_editeur', '') or ''
        # Stock instantané
        quants = self.env['stock.quant'].search([
            ('product_id', '=', self.product_id.id),
            ('location_id.usage', '=', 'internal'),
        ])
        self.qty_stock_reel = sum(q.quantity for q in quants)
        self.qty_reserved = sum(q.reserved_quantity for q in quants)
        # Distributeur par défaut (premier fournisseur actif)
        sellers = self.product_id.seller_ids.filtered(
            lambda s: not s.date_end or s.date_end >= date.today()
        ).sorted('sequence')
        if sellers:
            self.distributeur_id = sellers[0].partner_id
            self.prix_achat = sellers[0].price

    # ── Méthodes stock ─────────────────────────────────────────────────

    def _refresh_stock(self):
        """Rafraîchit stock réel et réservé depuis stock.quant (sans @api.depends)."""
        product_ids = self.filtered('product_id').mapped('product_id').ids
        if not product_ids:
            return
        quants = self.env['stock.quant'].read_group(
            [
                ('product_id', 'in', product_ids),
                ('location_id.usage', '=', 'internal'),
            ],
            ['product_id', 'quantity:sum', 'reserved_quantity:sum'],
            ['product_id'],
        )
        stock_map = {
            q['product_id'][0]: (q['quantity'], q['reserved_quantity'])
            for q in quants
        }
        for rec in self:
            if rec.product_id:
                reel, reserved = stock_map.get(rec.product_id.id, (0.0, 0.0))
                rec.qty_stock_reel = reel
                rec.qty_reserved = reserved

    # ── Bouton Commander par ligne ──────────────────────────────────────

    def action_commander_ligne(self):
        """Crée un bon de commande brouillon pour cette seule ligne."""
        self.ensure_one()
        qty = self.qty_commander or self.qty_estimation
        if qty <= 0:
            raise UserError(_("La quantité à commander doit être supérieure à 0."))
        if not self.distributeur_id:
            raise UserError(_("Veuillez renseigner le distributeur pour ce titre."))

        po = self.env['purchase.order'].create({
            'partner_id': self.distributeur_id.id,
            'origin': self.liste_id.name,
            'order_line': [(0, 0, {
                'product_id': self.product_id.id,
                'name': self.product_id.display_name,
                'product_qty': qty,
                'price_unit': self.prix_achat or 0.0,
                'product_uom': (
                    self.product_id.uom_po_id or self.product_id.uom_id
                ).id,
                'date_planned': fields.Datetime.now(),
            })],
        })
        self.liste_id.po_ids = [(4, po.id)]

        return {
            'type': 'ir.actions.act_window',
            'name': _('Bon de commande créé'),
            'res_model': 'purchase.order',
            'view_mode': 'form',
            'res_id': po.id,
        }
