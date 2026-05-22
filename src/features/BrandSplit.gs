// BrandSplit.gs — feature entry point, expose functions cho Sidebar & Code.gs

/**
 * Xử lý tách brand từ URL spreadsheet.
 * Gọi từ Sidebar: google.script.run.processSpreadsheet(url)
 */
function processSpreadsheet(url) {
  return Orchestrator_process(url);
}

/**
 * Lưu settings từ Settings tab.
 * Gọi từ Sidebar: google.script.run.saveSettings(settings)
 */
function saveSettings(settings) {
  Config_save(settings);
  return { ok: true };
}

/**
 * Load settings hiện tại về cho Settings tab.
 * Gọi từ Sidebar: google.script.run.loadSettings()
 */
function loadSettings() {
  return Config_loadRaw();
}

/**
 * Reset settings về default.
 */
function resetSettings() {
  Config_reset();
  return { ok: true };
}
