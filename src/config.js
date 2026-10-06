require("dotenv").config();

const config = {
  port: Number(process.env.PORT || 8080),
  filterBuyer: [
    "Bán cho người tiêu dùng_shopee",

    "Bán cho người tiêu dùng_tiktokshop",

    "Bán cho người tiêu dùng_ShopeeFood",
  ],
  sapoInvoice: {
    limit: 250,
    baseUrl: process.env.SAPO_INVOICE_BASE_URL,
    authorizeUrl: "https://invoice.sapo.vn/admin/oauth/authorize",
    tokenUrl: "https://invoice.sapo.vn/api/oauth/token",
    refreshUrl: "https://invoice.sapo.vn/api/oauth/token/refresh",
    apiBaseUrl: "https://invoice.sapo.vn/api",
    clientId: process.env.SAPO_INVOICE_CLIENT_ID,
    clientSecret: process.env.SAPO_INVOICE_CLIENT_SECRET,
    scope: process.env.SAPO_INVOICE_ALLOWS_SCOPE,
    redirectUri: process.env.SAPO_INVOICE_REDIRECT_URI,
    tenantId: process.env.SAPO_TENANT_ID,
    tenantName: "CÔNG TY TNHH BÁNH GẠO HA VÀ HA",
  },
  sheet: {
    sapoInvoice: {
      sheetId: process.env.GG_SHEET_ID,
      sheetName: process.env.GG_SHEET_NAME || "Sapo Invoice",
    },
  },
};

module.exports = config;
