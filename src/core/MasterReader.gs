// MasterReader.gs — đọc fee per brand từ Master sheet

/**
 * Đọc Master sheet và trả về fee map.
 *
 * Ưu tiên:
 *   1. Nếu masterSpreadsheetUrl có → mở file đó
 *   2. Nếu không có URL → tìm sheet trong cùng file Summary (ss)
 *   3. Nếu không tìm thấy ở đâu → warning (cần setup)
 *
 * @param {Spreadsheet} ss  — file Summary (fallback khi không có URL)
 * @param {Object} cfg      — từ Config_load()
 * @returns {{ map: Object, ok: boolean, warning?: string }}
 */
function MasterReader_read(ss, cfg) {
  var masterSs;

  if (cfg.masterSpreadsheetUrl) {
    // Ưu tiên 1: mở file riêng theo URL
    try {
      masterSs = SpreadsheetApp.openById(Helpers_getSpreadsheetId(cfg.masterSpreadsheetUrl));
    } catch (e) {
      return {
        map: {},
        ok: false,
        warning: 'Không mở được Master file.\nURL: ' + cfg.masterSpreadsheetUrl + '\nLỗi: ' + e.message
      };
    }
  } else {
    // Ưu tiên 2: tìm trong cùng file Summary
    masterSs = ss;
  }

  var sheet = masterSs.getSheetByName(cfg.masterSheetName);
  if (!sheet) {
    // Không tìm thấy ở đâu → cần setup
    if (cfg.masterSpreadsheetUrl) {
      return {
        map: {},
        ok: false,
        warning: 'Không tìm thấy sheet "' + cfg.masterSheetName + '" trong Master file đã cấu hình.\nVui lòng kiểm tra lại Master sheet name trong Settings.'
      };
    } else {
      return {
        map: {},
        ok: false,
        warning: 'Không tìm thấy sheet "' + cfg.masterSheetName + '" trong file hiện tại, và chưa cấu hình Master file URL.\n\nVui lòng vào Settings để điền Master file URL hoặc kiểm tra tên sheet.'
      };
    }
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
