const { getSheetsClient } = require("../../infra/googleSheet");

function columnNumberToLetter(column) {
  let result = "";
  while (column > 0) {
    const remainder = (column - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    column = Math.floor((column - 1) / 26);
  }
  return result;
}
async function formatDateTimeColumn(sheetName, columnIndex, spreadsheetId) {
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const sheet = spreadsheet.data.sheets.find(
    (item) => item.properties.title === sheetName,
  );

  if (!sheet) {
    throw new Error(`Can not find sheet ${sheetName}`);
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheet.properties.sheetId,
              startRowIndex: 1,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: "DATE_TIME",
                  pattern: "dd/MM/yyyy HH:mm:ss",
                },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },
      ],
    },
  });
}
async function getValues(range, spreadsheetId) {
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

async function updateValues(range, values, spreadsheetId) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values,
    },
  });
  return response.data.updatedRows || 0;
}

async function appendValues(range, values, spreadsheetId) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });
  return response.data.updates?.updatedRows || 0;
}
async function batchUpdateValues(data, sheetId) {
  if (!data.length) {
    return;
  }
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}
async function insertRowsAtTop(sheetName, rowCount, spreadsheetId) {
  if (!rowCount || rowCount <= 0) {
    return false;
  }

  const sheets = await getSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const targetSheet = spreadsheet.data.sheets.find(
    (item) => item.properties.title === sheetName,
  );

  if (!targetSheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  const sheetId = targetSheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: 1,
              endIndex: 1 + rowCount,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  return true;
}

async function ensureSheet(sheetName, rowCount, columnCount, spreadsheetId) {
  const sheets = await getSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,

    fields: "sheets.properties(sheetId,title,gridProperties)",
  });

  const existingSheet = spreadsheet.data.sheets?.find(
    (sheet) => sheet.properties.title === sheetName,
  );

  // Đã có sheet
  if (existingSheet) {
    console.log(`[SHEET EXISTS] ${sheetName}`);

    return existingSheet.properties;
  }

  console.log(`[CREATE SHEET] ${sheetName}`);

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,

    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,

              gridProperties: {
                rowCount: Math.max(Number(rowCount) || 1000, 1000),

                columnCount: Math.max(Number(columnCount) || 26, 26),
              },
            },
          },
        },
      ],
    },
  });

  const createdSheet = response.data.replies?.[0]?.addSheet?.properties;

  if (!createdSheet) {
    console.error("[CREATE SHEET RESPONSE]", response.data);

    throw new Error(`Create sheet failed: ${sheetName}`);
  }

  console.log(`[SHEET CREATED] ${sheetName}`);

  return createdSheet;
}

async function ensureHeaders(sheetName, headers, spreadsheetId) {
  if (!Array.isArray(headers) || headers.length === 0) {
    throw new Error("headers are required");
  }
  const lastColumn = columnNumberToLetter(headers.length);
  const range = `'${sheetName}'!A1:${lastColumn}1`;
  const values = await getValues(range, spreadsheetId);
  const currentHeaders = values[0] || [];
  const same =
    headers.every(
      (header, index) =>
        String(currentHeaders[index] ?? "").trim() === String(header).trim(),
    ) && currentHeaders.length === headers.length;
  if (same) {
    return false;
  }
  await updateValues(range, [headers], spreadsheetId);
  return true;
}

async function ensureSheetSize(
  sheetName,
  requiredRows,
  requiredColumns,
  spreadsheetId,
) {
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,gridProperties)",
  });
  const sheet = spreadsheet.data.sheets.find(
    (item) => item.properties.title === sheetName,
  );
  if (!sheet) {
    throw new Error(`Sheet not found :${sheetName}`);
  }
  const { sheetId, gridProperties } = sheet.properties;
  const requests = [];
  if (requiredRows > gridProperties.rowCount) {
    requests.push({
      appendDimension: {
        sheetId,
        dimension: "ROWS",
        length: requiredRows - gridProperties.rowCount,
      },
    });
  }
  if (requiredColumns > gridProperties.columnCount) {
    requests.push({
      appendDimension: {
        sheetId,
        dimension: "COLUMNS",
        length: requiredColumns - gridProperties.columnCount,
      },
    });
  }
  if (!requests.length) {
    return false;
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests,
    },
  });
  return true;
}

async function clearValues(range, spreadsheetId) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
  return true;
}

const sheetService = {
  getValues,
  updateValues,
  appendValues,
  clearValues,
  formatDateTimeColumn,
  columnNumberToLetter,
  insertRowsAtTop,
  batchUpdateValues,

  ensureHeaders,
  ensureSheet,
  ensureSheetSize,
};

module.exports = sheetService;
