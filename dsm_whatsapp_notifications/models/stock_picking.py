import logging
from odoo import models

_logger = logging.getLogger(__name__)


class StockPicking(models.Model):
    _inherit = 'stock.picking'

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

    def _picking_titres(self):
        moves = self.move_ids.filtered(
            lambda m: m.product_id.type != 'service' and m.state == 'assigned'
        )
        return [m.product_id.display_name for m in moves]

    def _order_fully_covered(self):
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

    def _wa_notify_assigned(self):
        titres = self._picking_titres()
        if not titres:
            return
        titres_str = '\n'.join(f'  • {t}' for t in titres)
        if self._order_fully_covered():
            self.sale_id._wa_notify('commande_complete')
        else:
            self.sale_id._wa_notify('titres_reserves', titres=titres_str)
