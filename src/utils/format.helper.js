function text(value) {
  if (value == null) {
    return "";
  }
  if (!["string", "number", "boolean"].includes(typeof value)) {
    throw new Error("Expected a scalar cell value");
  }
  return String(value).trim();
}

function formatNumber(value){
    return Number(value).toLocaleString('en-US')
}

function convertToDate(value){
    const date = new Date(value).toLocaleString('en-US');
    return date;
}
module.exports={
    formatNumber,
    convertToDate,
    text
}