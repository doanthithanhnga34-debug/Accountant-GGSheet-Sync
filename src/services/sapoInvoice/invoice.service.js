const  axios  = require("axios");
const config = require("../../config");
const tokenService = require("./token.service");

async function getInvoices({page=1, limit= config.sapoInvoice.limit}) {

  const accessToken = await tokenService.getValidAccessToken();
  if (!accessToken) {
    throw new Error("Sapo invoice is not authenticated");
  }

  const params = new URLSearchParams({
    is_calculating_machine: true,
    publish_statuses: "accepted", // FILTER INVOICE hóa đơn hợp lệ
    page: String(page),
    limit: String(limit),
  });

  const url = `${config.sapoInvoice.apiBaseUrl}/invoices?${params.toString()}`;
  const response = await axios.get(url, {
    headers: {
      "X-Sapo-Access-Token": accessToken,
      Accept: "application/json",
    },
  });
  console.log("response", response.data)
  const data= response.data.invoices|| [];
  return data;
}

const invoiceService = {
  getInvoices,
};
module.exports = invoiceService;
