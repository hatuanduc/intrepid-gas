// Orchestrator.gs — điều phối flow Brand Split

var CACHE_KEY_PREFIX = 'intrepid_summary_';
var CACHE_EXPIRY_SEC = 300; // 5 phút

// ---------------------------------------------------------------------------
// getBrandList — bước 1: đọc summary, cache data, trả về brand list
// ---------------------------------------------------------------------------

/**
 * Đọc spreadsheet, cache parsed data, trả về danh sách brand và các sheet đã tồn tại.
 * Gọi 1 lần trước khi process từng brand.
 *
 * @param {string} url
 * @returns {{ ok, brands, existingSheets, error? }}
 */
function Orchestrator_getBrandList(url) {
  try {
    var cfg  = Config_load();
    var id   = Helpers_getSpreadsheetId(url);
    var data = SummaryReader_read(id, cfg);

    // Cache parsed data để processOne dùng lại, tránh đọc SS nhiều lần
    var cachePayload = JSON.stringify({
      spendHeaders:  data.spendHeaders,
      natureHeaders: data.natureHeaders,
      dataRows: data.dataRows.map(function(r) {
        return {
          brand: r.brand,
          data:  r.data.map(function(cell) {
            // Serialize Date thành chuỗi để JSON an toàn
            return (cell instanceof Date) ? cell.toISOString() : cell;
          })
        };
      })
    });
    CacheService.getScriptCache().put(CACHE_KEY_PREFIX + id, cachePayload, CACHE_EXPIRY_SEC);

    // Kiểm tra sheet nào đã tồn tại
    var ss = data.ss;
    var existingSheets = data.brands.filter(function(brand) {
      return ss.getSheetByName(brand) !== null;
    });

    return { ok: true, brands: data.brands, existingSheets: existingSheets };

  } catch (e) {
    Logger.log('getBrandList error: ' + e.message + '\n' + e.stack);
    return { ok: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// processOne — bước 2: xử lý 1 brand (dùng cache từ getBrandList)
// ---------------------------------------------------------------------------

/**
 * Tạo sheet cho một brand. Đọc data từ cache nếu có, fallback re-read SS.
 *
 * @param {string} url
 * @param {string} brand
 * @returns {{ ok, error? }}
 */
function Orchestrator_processOne(url, brand) {
  try {
    var cfg = Config_load();
    var id  = Helpers_getSpreadsheetId(url);
    var ss  = SpreadsheetApp.openById(id);

    var spendHeaders, natureHeaders, dataRows;
    var cached = CacheService.getScriptCache().get(CACHE_KEY_PREFIX + id);

    if (cached) {
      var c    = JSON.parse(cached);
      spendHeaders  = c.spendHeaders;
      natureHeaders = c.natureHeaders;
      dataRows      = c.dataRows;
    } else {
      // Cache hết hạn → đọc lại
      var data = SummaryReader_read(id, cfg);
      spendHeaders  = data.spendHeaders;
      natureHeaders = data.natureHeaders;
      dataRows      = data.dataRows;
    }

    var extracted = BrandExtractor_extract(dataRows, brand, cfg);
    SheetBuilder_build(ss, brand, extracted.companyName, extracted.rows, spendHeaders, natureHeaders, cfg);

    return { ok: true };

  } catch (e) {
    Logger.log('processOne error [' + brand + ']: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// process (all-in-one, legacy / manual trigger từ GAS editor)
// ---------------------------------------------------------------------------

function Orchestrator_process(url) {
  try {
    var listResult = Orchestrator_getBrandList(url);
    if (!listResult.ok) return listResult;

    var results = [];
    listResult.brands.forEach(function(brand) {
      var r = Orchestrator_processOne(url, brand);
      results.push({ brand: brand, ok: r.ok, error: r.error });
    });

    return { ok: true, brands: listResult.brands, details: results };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}
