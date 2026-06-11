import base64
import io
from dateutil.relativedelta import relativedelta

from odoo import models, fields, api, _
from odoo.exceptions import UserError

_COLS = [('-1', '— aucune —')] + [(str(i), chr(65 + i)) for i in range(26)]
_COLS_REQUIRED = [(str(i), chr(65 + i)) for i in range(26)]


class ImportExcelWizard(models.TransientModel):
    _name = 'dsm.import.excel.wizard'
    _description = 'Assistant importation Excel fournitures scolaires'

    session_id = fields.Many2one(
        'dsm.school.supply.session', string='Session', required=True, readonly=True,
    )
    excel_file = fields.Binary('Fichier Excel (.xlsx)', required=True, attachment=False)
    excel_filename = fields.Char()

    skip_rows = fields.Integer("Lignes d'entête à ignorer", default=1)
    col_barcode = fields.Selection(_COLS_REQUIRED, string='Colonne EAN13', default='0', required=True)
    col_school = fields.Selection(_COLS, string='Colonne École', default='1')
    col_qty = fields.Selection(_COLS, string='Colonne Qté N-1', default='2')
    use_odoo_history = fields.Boolean(
        "Calculer Qté N-1 depuis l'historique Odoo si valeur vide/nulle",
        default=True,
    )

    # ── Helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _col_idx(selection_val):
        val = int(selection_val)
        return val if val >= 0 else None

    @staticmethod
    def _safe_float(val):
        try:
            return float(val)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _clean_barcode(raw):
        """Normalise un code-barres : supprime les décimales (.0) et espaces."""
        s = str(raw).strip()
        if s.endswith('.0'):
            s = s[:-2]
        return s

    # ── Action principale ──────────────────────────────────────────────

    def action_import(self):
        self.ensure_one()
        try:
            import openpyxl
        except ImportError:
            raise UserError(_(
                "La bibliothèque openpyxl est requise.\n"
                "Installez-la avec : pip install openpyxl"
            ))

        file_data = base64.b64decode(self.excel_file)
        try:
            wb = openpyxl.load_workbook(
                io.BytesIO(file_data), read_only=True, data_only=True
            )
        except Exception as exc:
            raise UserError(_("Impossible de lire le fichier Excel : %s") % exc)

        ws = wb.active
        col_bc = self._col_idx(self.col_barcode)
        col_sc = self._col_idx(self.col_school)
        col_qt = self._col_idx(self.col_qty)

        all_rows = list(ws.iter_rows(values_only=True))
        data_rows = all_rows[self.skip_rows:]
        if not data_rows:
            raise UserError(_("Le fichier ne contient aucune donnée après l'entête."))

        # ── 1. Collecte des codes-barres ────────────────────────────────
        barcodes = set()
        for row in data_rows:
            if row and col_bc < len(row) and row[col_bc]:
                barcodes.add(self._clean_barcode(row[col_bc]))
        barcodes.discard('')

        # ── 2. Chargement des articles par code-barres ──────────────────
        products_by_barcode = {}
        if barcodes:
            prods = self.env['product.product'].search(
                [('barcode', 'in', list(barcodes))]
            )
            for p in prods:
                products_by_barcode[p.barcode] = p

        product_ids = [p.id for p in products_by_barcode.values()]

        # ── 3. Stock actuel (une seule requête) ─────────────────────────
        stock_map = {}
        if product_ids:
            quants = self.env['stock.quant'].read_group(
                [
                    ('product_id', 'in', product_ids),
                    ('location_id.usage', '=', 'internal'),
                ],
                ['product_id', 'quantity'],
                ['product_id'],
            )
            stock_map = {q['product_id'][0]: q['quantity'] for q in quants}

        # ── 4. Historique ventes N-1 (une seule requête) ─────────────────
        odoo_qty_map = {}
        if self.use_odoo_history and product_ids:
            date_from = fields.Date.today() - relativedelta(years=1)
            sale_groups = self.env['sale.order.line'].read_group(
                [
                    ('product_id', 'in', product_ids),
                    ('order_id.state', 'in', ['sale', 'done']),
                    ('order_id.date_order', '>=', str(date_from)),
                ],
                ['product_id', 'product_uom_qty'],
                ['product_id'],
            )
            odoo_qty_map = {
                g['product_id'][0]: g['product_uom_qty'] for g in sale_groups
            }

        # ── 5. Construction des valeurs ligne par ligne ─────────────────
        today = fields.Date.today()
        lines_vals = []

        for row in data_rows:
            if not row or not any(row):
                continue
            raw_bc = row[col_bc] if col_bc < len(row) else None
            if not raw_bc:
                continue
            barcode = self._clean_barcode(raw_bc)
            if not barcode:
                continue

            school = (
                str(row[col_sc]).strip()
                if col_sc is not None and col_sc < len(row) and row[col_sc]
                else ''
            )
            qty_excel = (
                self._safe_float(row[col_qt])
                if col_qt is not None and col_qt < len(row) and row[col_qt]
                else 0.0
            )

            product = products_by_barcode.get(barcode)
            state = 'ok'
            message = ''
            supplier_id = False
            price_unit = 0.0
            product_name = barcode

            if product:
                product_name = product.display_name
                sellers = product.seller_ids.filtered(
                    lambda s: not s.date_end or s.date_end >= today
                ).sorted('sequence')
                if sellers:
                    supplier_id = sellers[0].partner_id.id
                    price_unit = sellers[0].price
                else:
                    state = 'warning'
                    message = _('Aucun fournisseur actif défini')

                last_year_qty = qty_excel
                if last_year_qty == 0.0 and self.use_odoo_history:
                    last_year_qty = odoo_qty_map.get(product.id, 0.0)

                current_stock = stock_map.get(product.id, 0.0)
            else:
                state = 'error'
                message = _('Article non trouvé (EAN13 : %s)') % barcode
                last_year_qty = qty_excel
                current_stock = 0.0

            estimated = max(0.0, last_year_qty - current_stock)

            lines_vals.append({
                'session_id': self.session_id.id,
                'school_name': school,
                'barcode': barcode,
                'product_id': product.id if product else False,
                'product_name': product_name,
                'supplier_id': supplier_id,
                'last_year_qty': last_year_qty,
                'current_stock': current_stock,
                'adjusted_qty': estimated,
                'price_unit': price_unit,
                'state': state,
                'message': message,
            })

        if not lines_vals:
            raise UserError(_('Aucune ligne valide trouvée dans le fichier.'))

        # Supprime les anciennes lignes et recrée
        self.session_id.line_ids.unlink()
        self.env['dsm.school.supply.line'].create(lines_vals)
        self.session_id.write({'state': 'imported'})

        return {'type': 'ir.actions.act_window_close'}
