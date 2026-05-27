// Config.gs — load/save all user-configurable settings via PropertiesService

var CONFIG_DEFAULTS = {
  // ── Summary sheet ──────────────────────────────────────────────
  summarySheetName: 'Summary',
  headerRow:        '5',
  dataStartRow:     '6',
  colBrand:         '2',   // column B
  colCompany:       '3',   // column C → Customer Name (F1 trong output)
  brandFilterCol:   '3',   // skip row nếu cột này trống (loại header nhóm)
  colSummaryStart:  '31',  // column AE
  colSummaryEnd:    '44',  // column AR
  colSpendStart:    '45',  // column AS
  colSpendEnd:      '64',  // column BL
  tiktokKeywords:   'tiktok,tik tok',

  // ── Master sheet — fee per brand ───────────────────────────────
  // Nếu brand tìm thấy trong master → dùng fee của master
  // Nếu không tìm thấy             → dùng defaultFeeNonTiktok / defaultFeeTiktok
  masterSpreadsheetUrl:   '',    // URL file master (để trống = dùng chung file với Summary)
  masterSheetName:        'Master record',
  masterDataStartRow:     '2',   // dòng đầu tiên có data (bỏ qua header)
  colMasterBrand:         '1',   // column A — Brand name
  colMasterFeeNonTiktok:  '2',   // column B — Management fee (except tiktok)
  colMasterFeeTiktok:     '3',   // column C — TikTok management fee

  // ── Default fee (fallback khi brand không có trong master) ─────
  defaultFeeNonTiktok: '9',   // 9%
  defaultFeeTiktok:    '7',   // 7%
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
    tiktokKeywords:   raw.tiktokKeywords.split(',').map(function(s) { return s.trim().toLowerCase(); }),
    masterSpreadsheetUrl:  raw.masterSpreadsheetUrl || '',
    masterSheetName:       raw.masterSheetName,
    masterDataStartRow:    Number(raw.masterDataStartRow),
    colMasterBrand:        Number(raw.colMasterBrand),
    colMasterFeeNonTiktok: Number(raw.colMasterFeeNonTiktok),
    colMasterFeeTiktok:    Number(raw.colMasterFeeTiktok),
    defaultFeeNonTiktok:   Number(raw.defaultFeeNonTiktok) / 100,
    defaultFeeTiktok:      Number(raw.defaultFeeTiktok) / 100,
  };
}

/**
 * Load raw string values (for populating Settings UI).
 * @returns {Object} raw string config
 */
function Config_loadRaw() {
  var props = PropertiesService.getUserProperties().getProperties();
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
  PropertiesService.getUserProperties().setProperties(toSave);
}

/**
 * Reset all settings to defaults.
 */
function Config_reset() {
  var props = PropertiesService.getUserProperties();
  for (var key in CONFIG_DEFAULTS) {
    props.deleteProperty(key);
  }
}
