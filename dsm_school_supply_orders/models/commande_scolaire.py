from datetime import date
from odoo import models, fields, api, _
from odoo.exceptions import UserError


# Statuts de traitement d'une ligne de commande scolaire.
# Ordre = déroulé logique du workflow (utilisé aussi pour le kanban).
TRAITEMENT_STATES = [
    ('a_traiter', 'À traiter'),
    ('disponible', 'Disponible en stock'),
    ('a_commander', 'À commander'),
    ('en_commande', 'En commande fournisseur'),
    ('reserve', 'Réservé'),
    ('termine', 'Terminé'),
]


class CommandeScolaire(models.Model):
    _name = 'dsm.commande.scolaire'
    _description = 'Commande scolaire (client)'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'date_commande desc, name desc'

    name = fields.Char(
        'Référence', required=True, copy=False, index=True, readonly=True,
        default=lambda self: _('Nouvelle commande'),
    )
    partner_id = fields.Many2one(
        'res.partner', string='Client', required=True, tracking=True,
        help="Parent ou élève passant la commande.",
    )
    eleve_nom = fields.Char('Élève', tracking=True)
    classe = fields.Char('Classe / Niveau')
    liste_id = fields.Many2one(
        'dsm.liste.scolaire', string='Liste scolaire',
        help="Liste adoptée servant de base à la commande.",
    )
    ecole_nom = fields.Char(
        'École', related='liste_id.ecole_nom', store=True, readonly=True,
    )
    annee_scolaire = fields.Char(
        'Année scolaire', required=True,
        default=lambda self: self._default_school_year(),
    )
    date_commande = fields.Date(
        'Date commande', default=fields.Date.context_today, tracking=True,
    )

    state = fields.Selection(
        [
            ('brouillon', 'Brouillon'),
            ('en_traitement', 'En traitement'),
            ('terminee', 'Terminée'),
            ('annulee', 'Annulée'),
        ],
        default='brouillon', string='État', readonly=True, tracking=True,
        copy=False,
    )
    ligne_ids = fields.One2many(
        'dsm.commande.scolaire.ligne', 'commande_id', string='Lignes',
        copy=True,
    )
    po_ids = fields.Many2many(
        'purchase.order',
        'dsm_commande_scolaire_po_rel', 'commande_id', 'po_id',
        string='Bons de commande', copy=False,
    )
    notes = fields.Text('Notes')

    # ── Compteurs / indicateurs ─────────────────────────────────────────
    ligne_count = fields.Integer('Nb lignes', compute='_compute_counts')
    po_count = fields.Integer('Nb bons', compute='_compute_counts')
    nb_a_traiter = fields.Integer('À traiter', compute='_compute_counts')
    nb_restant = fields.Integer('Restant', compute='_compute_counts')
    nb_termine = fields.Integer('Terminé', compute='_compute_counts')
    progression = fields.Float(
        'Progression (%)', compute='_compute_counts', digits=(16, 0),
        help="Pourcentage de lignes terminées.",
    )

    def _default_school_year(self):
        today = date.today()
        if today.month >= 9:
            return f"{today.year}-{today.year + 1}"
        return f"{today.year - 1}-{today.year}"

    @api.depends('ligne_ids', 'ligne_ids.traitement', 'po_ids')
    def _compute_counts(self):
        for rec in self:
            lines = rec.ligne_ids
            total = len(lines)
            termine = len(lines.filtered(lambda l: l.traitement == 'termine'))
            rec.ligne_count = total
            rec.po_count = len(rec.po_ids)
            rec.nb_a_traiter = len(lines.filtered(lambda l: l.traitement == 'a_traiter'))
            rec.nb_termine = termine
            rec.nb_restant = total - termine
            rec.progression = (termine / total * 100.0) if total else 0.0

    # ── Création : séquence ─────────────────────────────────────────────
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('name') or vals['name'] == _('Nouvelle commande'):
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'dsm.commande.scolaire'
                ) or _('Nouvelle commande')
        return super().create(vals_list)

    # ── Chargement depuis une liste scolaire ────────────────────────────
    @api.onchange('liste_id')
    def _onchange_liste_id(self):
        if self.liste_id and self.liste_id.annee_scolaire:
            self.annee_scolaire = self.liste_id.annee_scolaire

    def action_charger_liste(self):
        """Pré-remplit les lignes à partir des titres de la liste scolaire."""
        self.ensure_one()
        if not self.liste_id:
            raise UserError(_("Sélectionnez d'abord une liste scolaire."))
        existing = self.ligne_ids.mapped('product_id').ids
        new_lines = []
        for titre in self.liste_id.ligne_ids:
            if not titre.product_id or titre.product_id.id in existing:
                continue
            new_lines.append((0, 0, {
                'product_id': titre.product_id.id,
                'distributeur_id': titre.distributeur_id.id if titre.distributeur_id else False,
                'prix_achat': titre.prix_achat,
                'qty': titre.qty_besoin or 1.0,
            }))
        if not new_lines:
            raise UserError(_("Aucun nouveau titre à charger depuis cette liste."))
        self.write({'ligne_ids': new_lines})
        self.ligne_ids._refresh_stock()
        self.ligne_ids._auto_statut()
        return True

    # ── Transitions d'état ──────────────────────────────────────────────
    def action_confirmer(self):
        self.ensure_one()
        if not self.ligne_ids:
            raise UserError(_("La commande ne contient aucune ligne."))
        self.ligne_ids._refresh_stock()
        self.ligne_ids._auto_statut()
        self.write({'state': 'en_traitement'})

    def action_terminer(self):
        self.ensure_one()
        restant = self.ligne_ids.filtered(lambda l: l.traitement != 'termine')
        if restant:
            raise UserError(_(
                "%d ligne(s) ne sont pas encore terminées.\n"
                "Terminez toutes les lignes avant de clôturer la commande."
            ) % len(restant))
        self.write({'state': 'terminee'})

    def action_annuler(self):
        self.write({'state': 'annulee'})

    def action_remettre_brouillon(self):
        self.write({'state': 'brouillon'})

    def action_recompute_stock(self):
        self.ensure_one()
        self.ligne_ids._refresh_stock()
        self.ligne_ids._auto_statut()

    # ── Génération des bons de commande fournisseur ─────────────────────
    def action_creer_bons_commande(self):
        """Regroupe les lignes « À commander » par distributeur et crée des BC."""
        self.ensure_one()
        lines = self.ligne_ids.filtered(
            lambda l: l.traitement == 'a_commander'
            and l.distributeur_id and l.product_id and l.qty_a_commander > 0
        )
        if not lines:
            raise UserError(_(
                "Aucune ligne « À commander » exploitable.\n"
                "Vérifiez le distributeur et la quantité à commander (> 0)."
            ))

        by_dist = {}
        for line in lines:
            by_dist.setdefault(line.distributeur_id.id, []).append(line)

        po_ids = []
        for dist_id, dist_lines in by_dist.items():
            order_lines = []
            for line in dist_lines:
                order_lines.append((0, 0, {
                    'product_id': line.product_id.id,
                    'name': line.product_id.display_name,
                    'product_qty': line.qty_a_commander,
                    'price_unit': line.prix_achat or 0.0,
                    'product_uom': (
                        line.product_id.uom_po_id or line.product_id.uom_id
                    ).id,
                    'date_planned': fields.Datetime.now(),
                }))
            po = self.env['purchase.order'].create({
                'partner_id': dist_id,
                'origin': self.name,
                'order_line': order_lines,
            })
            po_ids.append(po.id)
            dist_lines.write({'traitement': 'en_commande', 'po_id': po.id})

        self.write({'po_ids': [(4, pid) for pid in po_ids]})
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

    def action_view_lignes_traitement(self):
        """Ouvre le tableau kanban de traitement des lignes de cette commande."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Traitement — %s') % self.name,
            'res_model': 'dsm.commande.scolaire.ligne',
            'view_mode': 'kanban,list,form',
            'domain': [('commande_id', '=', self.id)],
            'context': {'default_commande_id': self.id, 'search_default_group_traitement': 1},
        }


class CommandeScolaireLigne(models.Model):
    _name = 'dsm.commande.scolaire.ligne'
    _description = 'Ligne de commande scolaire'
    _order = 'commande_id, product_id'

    commande_id = fields.Many2one(
        'dsm.commande.scolaire', string='Commande', required=True,
        ondelete='cascade', index=True,
    )
    # Champs liés à la commande (pratique pour le kanban / recherches)
    partner_id = fields.Many2one(
        related='commande_id.partner_id', store=True, string='Client',
    )
    eleve_nom = fields.Char(related='commande_id.eleve_nom', store=True, string='Élève')
    annee_scolaire = fields.Char(
        related='commande_id.annee_scolaire', store=True, string='Année',
    )
    commande_state = fields.Selection(
        related='commande_id.state', store=True, string='État commande',
    )

    product_id = fields.Many2one('product.product', string='Article', required=True)
    editeur = fields.Char('Éditeur', compute='_compute_editeur', store=True)
    distributeur_id = fields.Many2one('res.partner', string='Distributeur')

    qty = fields.Float('Qté demandée', digits=(16, 0), default=1.0, required=True)

    qty_stock_reel = fields.Float('Stock réel', digits=(16, 2), readonly=True)
    qty_reserved = fields.Float('Qté réservée (stock)', digits=(16, 2), readonly=True)
    qty_disponible = fields.Float(
        'Disponible', digits=(16, 2), compute='_compute_disponible', store=True,
    )
    qty_a_commander = fields.Float(
        'Qté à commander', digits=(16, 0), compute='_compute_a_commander',
        store=True, readonly=False,
    )

    prix_achat = fields.Float('Prix achat HT', digits='Product Price')

    traitement = fields.Selection(
        TRAITEMENT_STATES, string='Traitement', default='a_traiter',
        required=True, index=True, tracking=True,
    )
    po_id = fields.Many2one(
        'purchase.order', string='Bon de commande', copy=False,
        help="Bon de commande fournisseur associé à cette ligne.",
    )
    po_state = fields.Selection(
        related='po_id.state', string='État BC', readonly=True,
    )
    note = fields.Char('Note')

    # ── Calculs ─────────────────────────────────────────────────────────
    @api.depends('product_id')
    def _compute_editeur(self):
        for rec in self:
            rec.editeur = (getattr(rec.product_id, 'dsm_editeur', '') or '') if rec.product_id else ''

    @api.depends('qty_stock_reel', 'qty_reserved')
    def _compute_disponible(self):
        for rec in self:
            rec.qty_disponible = rec.qty_stock_reel - rec.qty_reserved

    @api.depends('qty', 'qty_disponible')
    def _compute_a_commander(self):
        for rec in self:
            rec.qty_a_commander = max(0.0, rec.qty - rec.qty_disponible)

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if not self.product_id:
            return
        self._refresh_stock()
        sellers = self.product_id.seller_ids.filtered(
            lambda s: not s.date_end or s.date_end >= date.today()
        ).sorted('sequence')
        if sellers:
            self.distributeur_id = sellers[0].partner_id
            self.prix_achat = sellers[0].price
        self._auto_statut()

    # ── Stock ───────────────────────────────────────────────────────────
    def _refresh_stock(self):
        products = self.filtered('product_id').mapped('product_id')
        if not products:
            return
        quants = self.env['stock.quant'].read_group(
            [
                ('product_id', 'in', products.ids),
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

    def _auto_statut(self):
        """Propose un statut selon la disponibilité (ne touche pas aux
        lignes déjà réservées, en commande ou terminées)."""
        for rec in self:
            if rec.traitement in ('reserve', 'en_commande', 'termine'):
                continue
            if rec.qty_disponible >= rec.qty and rec.qty > 0:
                rec.traitement = 'disponible'
            else:
                rec.traitement = 'a_commander'

    # ── Boutons de workflow par ligne ───────────────────────────────────
    def action_statut_disponible(self):
        self.write({'traitement': 'disponible'})

    def action_statut_a_commander(self):
        self.write({'traitement': 'a_commander'})

    def action_statut_reserve(self):
        self.write({'traitement': 'reserve'})

    def action_statut_termine(self):
        self.write({'traitement': 'termine'})

    def action_statut_a_traiter(self):
        self.write({'traitement': 'a_traiter'})

    def action_commander_ligne(self):
        """Crée (ou complète) un bon de commande fournisseur pour cette ligne."""
        self.ensure_one()
        qty = self.qty_a_commander or self.qty
        if qty <= 0:
            raise UserError(_("La quantité à commander doit être supérieure à 0."))
        if not self.distributeur_id:
            raise UserError(_("Renseignez le distributeur pour ce titre."))

        po = self.env['purchase.order'].create({
            'partner_id': self.distributeur_id.id,
            'origin': self.commande_id.name,
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
        self.write({'po_id': po.id, 'traitement': 'en_commande'})
        self.commande_id.po_ids = [(4, po.id)]
        return {
            'type': 'ir.actions.act_window',
            'name': _('Bon de commande créé'),
            'res_model': 'purchase.order',
            'view_mode': 'form',
            'res_id': po.id,
        }
