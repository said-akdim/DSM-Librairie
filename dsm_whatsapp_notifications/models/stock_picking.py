import logging
from odoo import models

_logger = logging.getLogger(__name__)


class StockPicking(models.Model):
    _inherit = 'stock.picking'

    # ─── Réservation (action_assign) ────────────────────────────────────────────

    def action_assign(self):
        states_before = {p.id: p.state for p in self}
        res = super().action_assign()
        for picking in self.filtered(
            lambda p: p.sale_id
            and p.state == 'assigned'
            and states_before.get(p.id) not in ('assigned', 'done')
        ):
            try:
                picking._wa_notify_assigned()
            except Exception as exc:
                _logger.error('WA picking assign [%s]: %s', picking.name, exc)
        return res

    # ─── Validation (picking done) ───────────────────────────────────────────────

    def _action_done(self):
        res = super()._action_done()
        for picking in self.filtered(lambda p: p.sale_id and p.state == 'done'):
            try:
                picking._wa_notify_done()
            except Exception as exc:
                _logger.error('WA picking done [%s]: %s', picking.name, exc)
        return res

    # ─── Helpers ─────────────────────────────────────────────────────────────────

    def _picking_titres(self, done_only=False):
        """Retourne la liste des noms de produits du picking."""
        moves = self.move_ids.filtered(lambda m: m.product_id.type != 'service')
        if done_only:
            moves = moves.filtered(lambda m: m.state == 'done')
        return [m.product_id.display_name for m in moves]

    def _order_fully_covered(self):
        """Vérifie si toutes les lignes de la commande sont livrées ou réservées."""
        order = self.sale_id
        for line in order.order_line.filtered(
            lambda l: l.product_id.type != 'service' and l.product_uom_qty > 0
        ):
            done = line.qty_delivered
            reserved = sum(
                m.reserved_availability
                for m in line.move_ids.filtered(lambda m: m.state not in ('done', 'cancel'))
            )
            if done + reserved < line.product_uom_qty:
                return False
        return True

    def _order_fully_done(self):
        """Vérifie si toutes les lignes sont entièrement livrées."""
        order = self.sale_id
        lines = order.order_line.filtered(
            lambda l: l.product_id.type != 'service' and l.product_uom_qty > 0
        )
        return lines and all(l.qty_delivered >= l.product_uom_qty for l in lines)

    def _wa_notify_assigned(self):
        """Notifie le client que ses titres sont réservés."""
        titres = self._picking_titres()
        if not titres:
            return
        titres_str = '\n'.join(f'  • {t}' for t in titres)
        if self._order_fully_covered():
            self.sale_id._wa_notify('commande_complete')
        else:
            self.sale_id._wa_notify('titres_reserves', titres=titres_str)

    def _wa_notify_done(self):
        """Notifie le client que ses titres sont disponibles (picking validé)."""
        titres = self._picking_titres(done_only=True)
        if not titres:
            return
        titres_str = '\n'.join(f'  • {t}' for t in titres)
        if self._order_fully_done():
            self.sale_id._wa_notify('commande_complete')
        else:
            self.sale_id._wa_notify('titres_recus', titres=titres_str)
