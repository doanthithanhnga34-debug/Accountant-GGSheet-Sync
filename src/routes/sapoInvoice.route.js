const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const sapoInvoiceController = require("../controllers/sapoInvoice.controller");

const sapoInvoiceRouter = express.Router();

sapoInvoiceRouter.get("/auth", asyncHandler(sapoInvoiceController.startOAuth));
sapoInvoiceRouter.get(
  "/invoices",
  asyncHandler(sapoInvoiceController.getInvoices),
);
sapoInvoiceRouter.post(
  "/syncBatchInvoice",
  asyncHandler(sapoInvoiceController.syncInvoiceBatch),
);
sapoInvoiceRouter.post(
  "/incremental",
  asyncHandler(sapoInvoiceController.incremental),
);



module.exports = sapoInvoiceRouter;
