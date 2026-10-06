const { stat } = require("fs");
const {
  text,
  convertToDate,
  formatNumber,
} = require("../../utils/format.helper");

const crypto = require("crypto");
const HEADERS = [
  "ID",
  "Ký hiệu",
  "Ngày hóa đơn",
  "Số hóa đơn",
  "Mã chứng từ gốc",
  "Mã của CQT",
  "Người mua hàng",
  "Tên đơn vị",
  "Mã số thuế",
  "Tổng tiền",
  "Trạng thái hóa đơn",
  "Phát hành",
  'Ngày cập nhật'
];

function statusInvoice(status) {
  switch (status) {
    case "initialized":
      return "HĐ mới";
    case "replace":
      return "HĐ thay thế";
    case "replaced":
      return "HĐ bị thay thế";
    case "modified":
      return "HĐ bị điều chỉnh";
    case "modify":
      return "HĐ điều chỉnh";
    default:
      return "";
  }
}
function statusPublish(status){
    if(status !== 'accepted'){
        return ''
    }
    return 'HĐ hợp lệ'
}

function makeHash(row) {
  const normalized = row.map((val) => {
    if (val === null) {
      return "";
    }
    return String(val).trim();
  });

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}
function isoToGoogleSheetDateTime(isoString) {
  if (!isoString) return "";

  const timestamp = Date.parse(isoString);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const vietnamTimestamp = timestamp + 7 * 60 * 60 * 1000;

  return vietnamTimestamp / 86400000 + 25569;
}
async function invoiceToRow(invoice) {
  const row = [
    text(invoice.id) || "",
    text(invoice.invoice_series) || "",
    isoToGoogleSheetDateTime(invoice.invoice_date) || "",
    text(invoice.invoice_no) || "",
    text(invoice.partner_ref_code) || "",
    text(invoice.tax_agency_code) || "",
    text(invoice.buyer.full_name) || "",
    text(invoice.buyer.legal_name) || "",
    text(invoice.buyer.tax_code) || "",
    formatNumber(invoice.total_amount) || "",
    statusInvoice(invoice.status),
    statusPublish(invoice.publish_status),
    invoice.updated_at
  ];

  return row;
}
const invoiceMapper = {
  HEADERS,
  invoiceToRow,
};
module.exports = invoiceMapper;
