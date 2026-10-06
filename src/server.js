const express = require("express");
const config = require("./config");
const sapoInvoiceRouter = require("./routes/sapoInvoice.route");
const errorHandler = require("./middleware/error.middleware");
const oauthService = require("./services/sapoInvoice/oauth.service");
const tokenService = require("./services/sapoInvoice/token.service");
const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  return res.json({
    success: true,
  });
});
app.use("/sapoInvoice", sapoInvoiceRouter);
app.use(
  express.urlencoded({
    extended: false,
  }),
);

app.get("/api/install/connect", async (req, res) => {
  const { code, state, tenant_id, timestamp, author_name, hmac } = req.query;

  console.log("[SAPO CALLBACK]", {
    hasCode: Boolean(code),

    codePrefix: code ? String(code).slice(0, 5) : null,

    hasState: Boolean(state),

    tenantId: tenant_id,

    timestamp,

    authorName: author_name,

    hasHmac: Boolean(hmac),
  });

  await oauthService.validateState(state);

  console.log("[CALLBACK] state OK");

  if (!oauthService.verifyHmac(req.query)) {
    const error = new Error("Invalid OAuth HMAC");

    error.status = 400;

    throw error;
  }

  console.log("[CALLBACK] HMAC OK");

  oauthService.validateTimestamp(timestamp);

  console.log("[CALLBACK] timestamp OK");

  const tokens = await oauthService.exchangeCodeForTokens(code);

  console.log("[CALLBACK] token OK");

  await tokenService.set({
    ...tokens,
    connectedTenantId: tenant_id,
  });

  console.log("[CALLBACK] token saved");

  return res.json({
    success: true,
    message: "Sapo Invoice connected successfully",
  });
});

app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);

  error.status = 404;
  next(error);
});
app.use(errorHandler);
const port = process.env.PORT || config.port || 8080;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running port localhost http://localhost:${port}`);
});
