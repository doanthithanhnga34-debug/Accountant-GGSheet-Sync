
const config = require("../config");

function excludeInvoice(invoice){
    const buyerName = String(invoice.buyer?.full_name || "").trim().toLowerCase();
    const excludedBuyerNames = config.filterBuyer.map((name)=> String(name).trim().toLowerCase());
    return excludedBuyerNames.includes(buyerName);
}

module.exports = {
    excludeInvoice
}