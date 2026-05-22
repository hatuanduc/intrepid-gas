// MasterReader.gs — đọc fee per brand từ Master sheet

/**
 * Đọc Master sheet từ file riêng (masterSpreadsheetUrl) và trả về fee map.
 * Master và Summary là 2 file độc lập — không đọc chung.
 *
 * Cell value có thể là:
 *   - Decimal: 0.09  (percentage-formatted cell trong GAS trả về decimal)
 *   - Integer: 9     (nhập tay dạng số nguyên)
 *   - String: "9%"   (trường hợp hiếm)
 *
 * @param {Object} cfg  — từ Config_load(), cần cfg.masterSpreadsheetUrl
 * @returns {{ map: Object, ok: boolean, warning?: string }}
 */
function MasterReader_read(cfg) {
  // Master URL bắt buộc phải được cấu hình riêng — không đọc chung file Summary
  if (!cfg.masterSpreadsheetUrl) {
    return {
      map: {},
      ok: false,
      warning: 'Chưa cấu hình Master file URL.\n\nVui lòng vào Settings → điền "Master file URL" để app lấy fee theo từng brand.\n\nHiện tại sẽ dùng Default fee cho tất cả brand.'
    };
  }

  var masterSs;
  try {
    var masterId = Helpers_getSpreadsheetId(cfg.masterSpreadsheetUrl);
    masterSs = SpreadsheetApp.openById(masterId);
  } catch (e) {
    return {
      map: {},
      ok: false,
      warning: 'Không mở được Master file.\nURL: "' + cfg.masterSpreadsheetUrl + '"\nLỗi: ' + e.message + '\n\nVui lòng kiểm tra lại URL trong Settings.'
    };
  }

  var sheet = masterSs.getSheetByName(cfg.masterSheetName);
  if (!sheet) {
    return {
      map: {},
      ok: false,
      warning: 'Không tìm thấy sheet "' + cfg.masterSheetName + '" trong Master file.\n\nVui lòng kiểm tra lại Master sheet name trong Settings.'
    };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < cfg.masterDataStartRow) return {};

  var maxCol = Math.max(cfg.colMasterBrand, cfg.colMasterFeeNonTiktok, cfg.colMasterFeeTiktok);
  var data = sheet.getRange(cfg.masterDataStartRow, 1, lastRow - cfg.masterDataStartRow + 1, maxCol).getValues();

  var feeMap = {};
  data.forEach(function(row) {
    var brand = String(row[cfg.colMasterBrand - 1] || '').trim();
    if (!brand) return;
    feeMap[brand] = {
      feeNonTiktok: MasterReader_parseRate(row[cfg.colMasterFeeNonTiktok - 1], cfg.defaultFeeNonTiktok),
      feeTiktok:    MasterReader_parseRate(row[cfg.colMasterFeeTiktok    - 1], cfg.defaultFeeTiktok),
    };
  });

  return { map: feeMap, ok: true };
}

/**
 * Parse fee value từ cell về decimal (0.09).
 * - 0.09  → 0.09  (GAS percentage cell)
 * - 9     → 0.09  (nhập tay integer)
 * - "9%"  → 0.09  (string with %)
 * - ""    → fallback
 */
function MasterReader_parseRate(raw, fallback) {
  if (raw === '' || raw === null || raw === undefined) return fallback;
  var str = String(raw).replace('%', '').trim();
  var n = parseFloat(str);
  if (isNaN(n)) return fallback;
  // GAS trả decimal cho percentage cell (e.g. 9% → 0.09)
  // Nếu n > 1 thì là integer (e.g. 9), cần chia 100
  return n > 1 ? n / 100 : n;
}

/**
 * Lấy fee cho một brand cụ thể, fallback về default nếu không tìm thấy.
 *
 * @param {Object} feeMap — từ MasterReader_read()
 * @param {string} brand
 * @param {Object} cfg
 * @returns {{ feeNonTiktok: number, feeTiktok: number }}
 */
function MasterReader_getFee(feeMap, brand, cfg) {
  if (feeMap[brand]) return feeMap[brand];
  return {
    feeNonTiktok: cfg.defaultFeeNonTiktok,
    feeTiktok:    cfg.defaultFeeTiktok,
  };
}
