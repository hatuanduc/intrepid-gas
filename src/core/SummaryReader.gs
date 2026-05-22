// SummaryReader.gs — đọc và parse toàn bộ dữ liệu từ Summary sheet

/**
 * Đọc Summary sheet và trả về headers, danh sách brand, và tất cả data rows.
 *
 * @param {string} spreadsheetId
 * @param {Object} cfg — từ Config_load()
 * @returns {{
 *   ss: Spreadsheet,
 *   spendHeaders: Array<{col, name, isTiktok}>,
 *   natureHeaders: Array<{col, name}>,
 *   dataRows: Array<{brand, data}>,
 *   brands: string[]
 * }}
 */
function SummaryReader_read(spreadsheetId, cfg) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(cfg.summarySheetName);
  if (!sheet) {
    throw new Error('Không tìm thấy sheet "' + cfg.summarySheetName + '" trong spreadsheet.');
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < cfg.dataStartRow) {
    throw new Error('Sheet "' + cfg.summarySheetName + '" không có dữ liệu từ dòng ' + cfg.dataStartRow + '.');
  }

  // Đọc toàn bộ dữ liệu 1 lần để tránh nhiều lần gọi API
  var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = allData[cfg.headerRow - 1]; // 0-indexed

  // --- Parse spending headers (AS→BL) ---
  var spendHeaders = [];
  var spendEnd = Math.min(cfg.colSpendEnd, lastCol);
  for (var c = cfg.colSpendStart; c <= spendEnd; c++) {
    var name = String(headers[c - 1] || '').trim();
    var nameLow = name.toLowerCase();
    var isTiktok = cfg.tiktokKeywords.some(function(kw) { return nameLow.indexOf(kw) !== -1; });
    spendHeaders.push({ col: c, name: name, isTiktok: isTiktok });
  }

  // --- Parse nature/summary headers (AE→AR) ---
  var natureHeaders = [];
  var summaryEnd = Math.min(cfg.colSummaryEnd, lastCol);
  for (var c = cfg.colSummaryStart; c <= summaryEnd; c++) {
    var name = String(headers[c - 1] || '').trim();
    if (name) {
      natureHeaders.push({ col: c, name: name });
    }
  }

  // --- Đọc data rows từ dataStartRow ---
  var dataRows = [];
  for (var r = cfg.dataStartRow; r <= lastRow; r++) {
    var rowData = allData[r - 1];
    var brand = String(rowData[cfg.colBrand - 1] || '').trim();
    if (brand) {
      dataRows.push({ brand: brand, data: rowData });
    }
  }

  // --- Danh sách brand theo thứ tự xuất hiện (unique) ---
  var seen = {};
  var brands = [];
  dataRows.forEach(function(row) {
    if (!seen[row.brand]) {
      seen[row.brand] = true;
      brands.push(row.brand);
    }
  });

  return { ss: ss, spendHeaders: spendHeaders, natureHeaders: natureHeaders, dataRows: dataRows, brands: brands };
}
