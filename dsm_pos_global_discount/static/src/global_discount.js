// Détecte une remise globale : toutes les lignes portent le même % de remise.
// Basé sur les lignes elles-mêmes (et non un état local) pour rester valable
// après rechargement de la session ou réimpression d'un ticket.
export function dsmGetGlobalDiscountPct(order) {
    const lines = order?.get_orderlines?.() || [];
    if (!lines.length) {
        return 0;
    }
    const pct = lines[0].get_discount();
    if (!pct) {
        return 0;
    }
    return lines.every((l) => l.get_discount() === pct) ? pct : 0;
}

// Total de la ligne avant remise, TTC ou HT selon la configuration du POS
// (même logique que getUnitDisplayPriceBeforeDiscount, mais pour la quantité totale).
export function dsmLineTotalBeforeDiscount(line) {
    const prices = line.get_all_prices(line.get_quantity());
    return line.config.iface_tax_included === "total"
        ? prices.priceWithTaxBeforeDiscount
        : prices.priceWithoutTaxBeforeDiscount;
}
