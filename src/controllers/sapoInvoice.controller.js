
const config = require("../config");
const invoiceService = require("../services/sapoInvoice/invoice.service");
const oauthService = require("../services/sapoInvoice/oauth.service");

const invoiceSync = require("../sync/sapoInvoice/invoice.sync");

async function startOAuth(
  req,
  res
) {
  const {
    authorizeUrl,
    state,
  } =
    await oauthService
      .createAuthorizeUrl();

  console.log(
    "[START OAUTH]",
    {
      redirectUri:
        config.sapoInvoice.redirectUri,
      authorizeUrl,
    }
  );

  return res.redirect(
    authorizeUrl
  );
}

async function getInvoices(req,res){
    const data = await invoiceService.getInvoices({page:1,limit:250});
    return res.json({
        success:true,
        invoices:data
    })
}

async function syncInvoiceBatch(req, res){
  const result = await invoiceSync.buildInvoicesBatch();
  return res.json(result);
}

async function incremental(req, res){
  const result = await invoiceSync.incremental();
  return res.json({result});
}
const sapoInvoiceController = {
    startOAuth,
    getInvoices,
    syncInvoiceBatch,
    incremental
}


module.exports = sapoInvoiceController