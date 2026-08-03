import { _t } from "@web/core/l10n/translation";
import { NumberPopup } from "@point_of_sale/app/utils/input_popups/number_popup";
import { ControlButtons } from "@point_of_sale/app/screens/product_screen/control_buttons/control_buttons";
import { patch } from "@web/core/utils/patch";
import { dsmGetGlobalDiscountPct } from "./global_discount";

patch(ControlButtons.prototype, {
    async clickDsmGlobalDiscount() {
        const order = this.pos.get_order();
        if (!order || !order.get_orderlines().length) {
            return;
        }
        this.dialog.add(NumberPopup, {
            title: _t("Remise globale (%)"),
            startingValue: dsmGetGlobalDiscountPct(order) || 0,
            getPayload: (num) => {
                const pct = Math.max(
                    0,
                    Math.min(100, this.env.utils.parseValidFloat(num.toString()))
                );
                for (const line of order.get_orderlines()) {
                    line.set_discount(pct);
                }
            },
        });
    },
});
