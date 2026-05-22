// BrandExtractor.gs — lọc data rows theo brand và lấy thông tin company

/**
 * Lấy tất cả rows của một brand và company name từ cột C.
 *
 * @param {Array} dataRows — từ SummaryReader_read()
 * @param {string} brand
 * @param {Object} cfg — từ Config_load()
 * @returns {{ rows: Array, companyName: string }}
 */
function BrandExtractor_extract(dataRows, brand, cfg) {
  var rows = dataRows.filter(function(r) { return r.brand === brand; });

  // Company name từ cột C (colCompany) của row đầu tiên
  var companyName = '';
  if (rows.length > 0) {
    companyName = String(rows[0].data[cfg.colCompany - 1] || '').trim();
  }

  return { rows: rows, companyName: companyName };
}
