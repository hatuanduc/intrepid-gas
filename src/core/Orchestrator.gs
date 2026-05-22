// Orchestrator.gs — điều phối toàn bộ flow xử lý Brand Split

/**
 * Điểm vào chính: đọc spreadsheet → tách từng brand → tạo sheet.
 * Được gọi từ Sidebar qua google.script.run.processSpreadsheet(url).
 *
 * @param {string} url — Google Sheets URL
 * @returns {{ ok: boolean, brands?: string[], error?: string }}
 */
function Orchestrator_process(url) {
  try {
    var cfg  = Config_load();
    var id   = Helpers_getSpreadsheetId(url);
    var data = SummaryReader_read(id, cfg);

    var ss           = data.ss;
    var spendHeaders = data.spendHeaders;
    var natureHeaders= data.natureHeaders;
    var dataRows     = data.dataRows;
    var brands       = data.brands;

    if (brands.length === 0) {
      return { ok: false, error: 'Không tìm thấy brand nào trong cột ' + Helpers_colLetter(cfg.colBrand) + ' từ dòng ' + cfg.dataStartRow + '.' };
    }

    var processed = [];
    brands.forEach(function(brand) {
      var extracted   = BrandExtractor_extract(dataRows, brand, cfg);
      SheetBuilder_build(ss, brand, extracted.companyName, extracted.rows, spendHeaders, natureHeaders, cfg);
      processed.push(brand);
    });

    return { ok: true, brands: processed };

  } catch (e) {
    Logger.log('Orchestrator_process error: ' + e.message + '\n' + e.stack);
    return { ok: false, error: e.message };
  }
}
