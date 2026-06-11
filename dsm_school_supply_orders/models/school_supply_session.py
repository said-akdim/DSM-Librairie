from datetime import date
from odoo import models, fields, api, _
from odoo.exceptions import UserError


class SchoolSupplySession(models.Model):
    _name = 'dsm.school.supply.session'
    _description = 'Session de commande fournitures scolaires'
    _order = 'create_date desc'
    _rec_name = 'name'

    name = fields.Char(
        'Référence', required=True, copy=False,
        default=lambda self: _('Nouvelle session'),
    )
    school_year = fields.Char(
        'Année scolaire', required=True,
        default=lambda self: self._default_school_year(),
    )
    state = fields.Selection(
        [
            ('draft', 'Brouillon'),
            ('imported', 'Importé'),
            ('po_created', 'Bons de commande créés'),
        ],
        default='draft', string='État', readonly=True,
    )
    line_ids = fields.One2many('dsm.school.supply.line', 'session_id', string='Lignes')
    po_ids = fields.Many2many(
        'purchase.order',
        'dsm_session_po_rel', 'session_id', 'po_id',
        string='Bons de commande',
    )
    notes = fields.Text('Notes')

    line_count = fields.Integer('Nb lignes', compute='_compute_counts')
    po_count = fields.Integer('Nb bons', compute='_compute_counts')
    error_count = fields.Integer('Erreurs', compute='_compute_counts')
    ok_count = fields.Integer('Sans erreur', compute='_compute_counts')

    def _default_school_year(self):
        today = date.today()
        if today.month >= 9:
            return f"{today.year}-{today.year + 1}"
        return f"{today.year - 1}-{today.year}"

    @api.depends('line_ids', 'line_ids.state', 'po_ids')
    def _compute_counts(self):
        for rec in self:
            rec.line_count = len(rec.line_ids)
            rec.po_count = len(rec.po_ids)
            rec.error_count = len(rec.line_ids.filtered(lambda l: l.state == 'error'))
            rec.ok_count = rec.line_count - rec.error_count

    # ── Actions boutons ────────────────────────────────────────────────

    def action_import_excel(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Importer le fichier Excel'),
            'res_model': 'dsm.import.excel.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_session_id': self.id},
        }

    def action_recompute_stock(self):
        """Rafraîchit le stock actuel depuis stock.quant pour toutes les lignes."""
        self.ensure_one()
        product_ids = self.line_ids.filtered('product_id').mapped('product_id').ids
        if not product_ids:
            return
        quants = self.env['stock.quant'].read_group(
            [('product_id', 'in', product_ids), ('location_id.usage', '=', 'internal')],
            ['product_id', 'quantity'],
            ['product_id'],
        )
        stock_map = {q['product_id'][0]: q['quantity'] for q in quants}
        for line in self.line_ids:
            if line.product_id:
                line.current_stock = stock_map.get(line.product_id.id, 0.0)

    def action_reset_adjusted_qty(self):
        """Réinitialise toutes les quantités ajustées = quantités estimées."""
        self.ensure_one()
        for line in self.line_ids:
            line.adjusted_qty = line.estimated_qty

    def action_create_purchase_orders(self):
        """Génère un bon de commande brouillon par fournisseur."""
        self.ensure_one()
        lines_ok = self.line_ids.filtered(
            lambda l: l.adjusted_qty > 0 and l.supplier_id and l.product_id
        )
        if not lines_ok:
            raise UserError(_(
                'Aucune ligne commandable.\n'
                'Vérifiez que les quantités > 0 et que chaque article a un fournisseur.'
            ))

        # Regroupement : supplier_id → product_id → données
        by_supplier = {}
        for line in lines_ok:
            by_supplier.setdefault(line.supplier_id.id, {})
            pid = line.product_id.id
            if pid not in by_supplier[line.supplier_id.id]:
                by_supplier[line.supplier_id.id][pid] = {
                    'product': line.product_id,
                    'qty': 0.0,
                    'price_unit': line.price_unit,
                }
            by_supplier[line.supplier_id.id][pid]['qty'] += line.adjusted_qty

        po_ids = []
        for supplier_id, products in by_supplier.items():
            order_lines = []
            for data in products.values():
                product = data['product']
                order_lines.append((0, 0, {
                    'product_id': product.id,
                    'name': product.display_name,
                    'product_qty': data['qty'],
                    'price_unit': data['price_unit'],
                    'product_uom': (product.uom_po_id or product.uom_id).id,
                    'date_planned': fields.Datetime.now(),
                }))
            po = self.env['purchase.order'].create({
                'partner_id': supplier_id,
                'origin': self.name,
                'order_line': order_lines,
            })
            po_ids.append(po.id)

        self.write({
            'state': 'po_created',
            'po_ids': [(6, 0, po_ids)],
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

    def action_reset_to_draft(self):
        self.write({'state': 'draft'})


class SchoolSupplyLine(models.Model):
    _name = 'dsm.school.supply.line'
    _description = 'Ligne de commande fournitures scolaires'
    _order = 'supplier_id, school_name, product_id'

    session_id = fields.Many2one(
        'dsm.school.supply.session', required=True, ondelete='cascade', index=True,
    )
    school_name = fields.Char('École')
    barcode = fields.Char('Code EAN13')
    product_id = fields.Many2one('product.product', string='Article')
    product_name = fields.Char('Désignation')
    supplier_id = fields.Many2one('res.partner', string='Fournisseur')

    last_year_qty = fields.Float('Qté N-1', digits=(16, 0))
    current_stock = fields.Float('Stock actuel', digits=(16, 2))
    estimated_qty = fields.Float(
        'Qté estimée', compute='_compute_estimated_qty', digits=(16, 0),
    )
    adjusted_qty = fields.Float('Qté commandée', digits=(16, 0))
    price_unit = fields.Float('Prix achat HT', digits='Product Price')

    state = fields.Selection(
        [('ok', 'OK'), ('warning', 'Avertissement'), ('error', 'Erreur')],
        default='ok', string='État',
    )
    message = fields.Char('Message')

    @api.depends('last_year_qty', 'current_stock')
    def _compute_estimated_qty(self):
        for line in self:
            line.estimated_qty = max(0.0, line.last_year_qty - line.current_stock)
