import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { formatCurrency } from "@point_of_sale/app/models/utils/currency";

// Sur le ticket on ne garde que le titre : la partie finale entre
// parenthèses (catégorie / éditeur / auteur / attributs) est retirée.
function cleanProductName(name) {
    return (name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

patch(PosOrder.prototype, {
    export_for_printing(baseUrl, headerData) {
        const result = super.export_for_printing(...arguments);
        const lines = this.getSortedOrderlines();
        const discountProductId = this.config?.discount_product_id?.id;

        const kept = [];
        const discountLines = [];
        result.orderlines.forEach((data, idx) => {
            const line = lines[idx];
            const productName = cleanProductName(data.productName);
            const isDiscount =
                (discountProductId && line?.product_id?.id === discountProductId) ||
                /^remise\b/i.test(productName);
            if (isDiscount && line) {
                discountLines.push(line);
            } else {
                kept.push({ ...data, productName });
            }
        });

        if (discountLines.length) {
            const total = discountLines.reduce(
                (sum, l) => sum + (l.get_display_price?.() ?? 0),
                0
            );
            kept.push({
                productName: "REMISE",
                price: formatCurrency(total, this.currency),
                qty: "",
                unit: "",
                unitPrice: "",
                oldUnitPrice: "",
                discount: "",
                customerNote: "",
                comboParent: "",
                packLotLines: [],
                price_without_discount: "",
                taxGroupLabels: "",
                dsmCompact: true,
            });
        }
        result.orderlines = kept;
        return result;
    },
});
