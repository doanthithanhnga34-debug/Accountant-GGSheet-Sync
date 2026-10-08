async function buildInvoiceIdIndex() {
  const sheetName = String(
    config.sheet.sapoInvoice.sheetName
  ).trim();

  const sheetId =
    config.sheet.sapoInvoice.sheetId;

  const lastColumn =
    sheetService.columnNumberToLetter(
      invoiceMapper.HEADERS.length,
    );

  // A:M là A1 notation hợp lệ
  const allValues =
    await sheetService.getValues(
      `'${sheetName}'!A:${lastColumn}`,
      sheetId,
    );

  const updatedAtIndex =
    invoiceMapper.HEADERS.indexOf(
      "Ngày cập nhật",
    );

  if (updatedAtIndex === -1) {
    throw new Error(
      "Not found Ngày cập nhật column",
    );
  }

  // Bỏ row 1 là header
  const values = allValues.slice(1);

  const index = new Map();

  values.forEach((row, indexRow) => {
    const id =
      String(row[0] || "").trim();

    if (!id) {
      return;
    }

    index.set(id, {
      row: indexRow + 2,

      updateAt: String(
        row[updatedAtIndex] || "",
      ).trim(),
    });
  });

  return index;
}