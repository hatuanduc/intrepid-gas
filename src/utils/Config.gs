// Config.gs — load/save all user-configurable settings via PropertiesService

var CONFIG_DEFAULTS = {
  summarySheetName: 'Summary',
  headerRow:        '5',   // dòng chứa header (Brand, Company Name, ...)
  dataStartRow:     '6',   // dòng đầu tiên có data
  colBrand:         '2',   // column B — Brand
  colCompany:       '3',   // column C — Company Name → Customer Name in output F1
  // brandFilterCol: cột dùng để lọc brand thật vs dòng header-nhóm (INT, Retails Model, ...)
  // Nếu ô này TRỐNG thì bỏ qua dòng đó (không phải brand thật).
  // Để trống (0) = dùng colBrand để kiểm tra (mặc định cũ).
  brandFilterCol:   '3',   // column C — Company Name thường trống ở header-nhóm
  colSummaryStart:  '31',  // column AE (brand summary, horizontal)
  colSummaryEnd:    '44',  // column AR
  colSpendStart:    '45',  // column AS (marketing spending)
  colSpendEnd:      '64',  // column BL
  feeNonTiktok:     '9',   // % stored as integer, e.g. 9 = 9%
  feeTiktok:        '7',   // %
  tiktokKeywords:   'tiktok,tik tok',
};

/**
 * Load config with type conversion, falling back to defaults for missing keys.
 * @returns {Object} typed config object
 */
function Config_load() {
  var raw = Config_loadRaw();
  return {
    summarySheetName: raw.summarySheetName,
    headerRow:        Number(raw.headerRow),
    dataStartRow:     Number(raw.dataStartRow),
    colBrand:         Number(raw.colBrand),
    colCompany:       Number(raw.colCompany),
    brandFilterCol:   Number(raw.brandFilterCol),
    colSummaryStart:  Number(raw.colSummaryStart),
    colSummaryEnd:    Number(raw.colSummaryEnd),
    colSpendStart:    Number(raw.colSpendStart),
    colSpendEnd:      Number(raw.colSpendEnd),
    feeNonTiktok:     Number(raw.feeNonTiktok) / 100,
    feeTiktok:        Number(raw.feeTiktok) / 100,
    tiktokKeywords:   raw.tiktokKeywords.split(',').map(function(s) { return s.trim().toLowerCase(); }),
  };
}

/**
 * Load raw string values (for populating Settings UI).
 * @returns {Object} raw string config
 */
function Config_loadRaw() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var raw = {};
  for (var key in CONFIG_DEFAULTS) {
    raw[key] = (props[key] !== undefined && props[key] !== '') ? props[key] : CONFIG_DEFAULTS[key];
  }
  return raw;
}

/**
 * Save settings from the UI.
 * @param {Object} settings key-value pairs matching CONFIG_DEFAULTS keys
 */
function Config_save(settings) {
  var toSave = {};
  for (var key in CONFIG_DEFAULTS) {
    if (settings[key] !== undefined && settings[key] !== null) {
      toSave[key] = String(settings[key]);
    }
  }
  PropertiesService.getScriptProperties().setProperties(toSave);
}

/**
 * Reset all settings to defaults.
 */
function Config_reset() {
  PropertiesService.getScriptProperties().deleteAllProperties();
}
