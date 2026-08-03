import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { formatCurrency } from "@point_of_sale/app/models/utils/currency";
import { dsmGetGlobalDiscountPct, dsmLineTotalBeforeDiscount } from "./global_discount";

// Quand une remise globale est active, chaque ligne est affichée au prix
// AVANT remise (comme sur un ticket classique) ; la remise est portée par
// une seule ligne récapitulative ajoutée avant les totaux.
patch(PosOrderline.prototype, {
    getDisplayData() {
        const data = super.getDisplayData(...arguments);
        const pct = dsmGetGlobalDiscountPct(this.order_id);
        if (pct) {
            data.price = formatCurrency(dsmLineTotalBeforeDiscount(this), this.currency);
            data.unitPrice = formatCurrency(
                this.getUnitDisplayPriceBeforeDiscount(),
                this.currency
            );
            data.oldUnitPrice = "";
            // Masque la mention « With a X% discount » sous chaque ligne
            data.discount = "0";
        }
        return data;
    },
});

patch(PosOrder.prototype, {
    export_for_printing(baseUrl, headerData) {
        const result = super.export_for_printing(...arguments);
        const pct = dsmGetGlobalDiscountPct(this);
        if (pct) {
            const lines = this.get_orderlines();
            const gross = lines.reduce((sum, l) => sum + dsmLineTotalBeforeDiscount(l), 0);
            const net = lines.reduce((sum, l) => sum + l.get_display_price(), 0);
            result.dsmGlobalDiscount = {
                label: `REMISE GLOBALE (${pct}%)`,
                amount: formatCurrency(net - gross, this.currency),
            };
            // Évite le doublon avec le bloc « Discounts » natif du ticket
            result.total_discount = 0;
        }
        return result;
    },
});
