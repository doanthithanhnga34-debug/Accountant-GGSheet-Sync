const config = require("../../config");
const { getInvoices } = require("../../services/sapoInvoice/invoice.service");
const invoiceSyncState = require("../../services/sapoInvoice/syncState.service");
const sheetService = require("../../services/sheet/sheet.service");
const {
  ensureSheet,
  ensureHeaders,
  ensureSheetSize,
  columnNumberToLetter,
  updateValues,
} = require("../../services/sheet/sheet.service");
const { excludeInvoice } = require("../../utils/filter.helper");
const invoiceMapper = require("./invoice.mapper");

async function buildInvoiceIdIndex() {
  const sheetName = config.sheet.sapoInvoice.sheetName;
  const sheetId = config.sheet.sapoInvoice.sheetId;
  const lastColumn = sheetService.columnNumberToLetter(
    invoiceMapper.HEADERS.length,
  );

  const values = await sheetService.getValues(
    `'${sheetName}'!A2:${lastColumn}`,
    sheetId,
  );
  const updatedAtIndex = invoiceMapper.HEADERS.indexOf("Ngày cập nhật");
  const index = new Map();
  values.forEach((row, indexRow) => {
    const id = String(row[0] || "").trim();

    if (!id) {
      return;
    }
    index.set(id, {
      row: indexRow + 2,
      updateAt: String(row[updatedAtIndex] || "").trim(),
    });
  });
  return index;
}

async function buildInvoicesBatch() {
  const limit = config.sapoInvoice.limit;
  const syncState = await invoiceSyncState.get();
  const page = Number(syncState.nextPage) || 1;
  const startRow = Number(syncState.nextRow) || 2;

  try {
    const invoices = await getInvoices({ page: page, limit: limit });
    if (!invoices.length) {
      return {
        success: true,
        done: true,
      };
    }
    const filterInvoices = invoices.filter(
      (invoice) => !excludeInvoice(invoice),
    );
    const rows = [];

    for (const invoice of filterInvoices) {
      const row = await invoiceMapper.invoiceToRow(invoice);
      rows.push(row);
    }

    const sheetName = String(config.sheet.sapoInvoice.sheetName).trim();
    const sheetID = config.sheet.sapoInvoice.sheetId;

    await sheetService.ensureSheet(
      sheetName,
      1000,
      invoiceMapper.HEADERS.length,
      sheetID,
    );
    await sheetService.ensureHeaders(sheetName, invoiceMapper.HEADERS, sheetID);

    const invoiceDate = invoiceMapper.HEADERS.indexOf("Ngày hóa đơn");
    if (invoiceDate === -1) {
      throw new Error("not column invoice date");
    }
    await sheetService.formatDateTimeColumn(sheetName, invoiceDate, sheetID);

    if (rows.length > 0) {
      const endRow = startRow + rows.length - 1;
      await sheetService.ensureSheetSize(
        sheetName,
        endRow,
        invoiceMapper.HEADERS.length,
        sheetID,
      );
      const lastColumn = columnNumberToLetter(invoiceMapper.HEADERS.length);
      await sheetService.updateValues(
        `'${sheetName}'!A${startRow}:${lastColumn}${endRow}`,
        rows,
        sheetID,
      );
    }

    const done = invoices.length < limit;

    await invoiceSyncState.set({
      nextPage: page + 1,
      nextRow: startRow + rows.length,
      status: done ? "done" : "idle",
    });
    return {
      success: true,
      done,
      page,
      nextPage: page + 1,
      totalInvoices: invoices.length,
      filteredInvoices: invoices.length - filterInvoices.length,
      written: rows.length,

      startRow,

      nextRow: startRow + rows.length,
    };
  } catch (e) {
    await invoiceSyncState.set({
      status: "error",
    });
    throw e;
  }
}

async function incremental() {
  const limit = config.sapoInvoice.limit;
  const sheetName = config.sheet.sapoInvoice.sheetName;
  const sheetID = config.sheet.sapoInvoice.sheetId;
  const idIndex = await buildInvoiceIdIndex();
  const invoices = await getInvoices({ page: 1, limit });

  const filteredInvoices = invoices.filter(
    (invoice) => !excludeInvoice(invoice),
  );
  const lastColumn = sheetService.columnNumberToLetter(
    invoiceMapper.HEADERS.length,
  );

  const updateData = [];
  const insertRows = [];
  let totalSkip = 0;
  let totalUpdate = 0;

  for (const invoice of filteredInvoices) {
    const invoiceId = String(invoice.id || "").trim();
    if (!invoiceId) {
      continue;
    }
    const row = await invoiceMapper.invoiceToRow(invoice);
    const existing = idIndex.get(invoiceId);
    const newUpdateAt = String(invoice.updated_at || "").trim();
    if (!existing) {
      insertRows.push(row);
      continue;
    }

    if (existing.updateAt === newUpdateAt) {
      totalSkip++;
      continue;
    }

    updateData.push({
      range: `'${sheetName}'!A${existing.row}:${lastColumn}${existing.row}`,
      values: [row],
    });
    totalUpdate++;
  }
  if (updateData.length > 0) {
    await sheetService.batchUpdateValues(updateData, sheetID);
  }
  if (insertRows.length > 0) {
    await sheetService.insertRowsAtTop(sheetName, insertRows.length, sheetID);
    const startRow = 2;
    const endRow = startRow + insertRows.length - 1;
    await sheetService.updateValues(
      `'${sheetName}'!A${startRow}:${lastColumn}${endRow}`,
      insertRows,
      sheetID,
    );
  }
  return {
    success: true,
    totalInvoices: invoices.length,
    excluded: invoices.length - filteredInvoices.length,
    inserted: insertRows.length,
    updated: updateData.length,
    skipped: totalSkip,
  };
}

const invoiceSync = {
  buildInvoicesBatch,
  incremental,
};
module.exports = invoiceSync;
