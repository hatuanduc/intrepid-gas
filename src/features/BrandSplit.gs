// BrandSplit.gs — expose các server functions cho Sidebar

/** Lấy danh sách brand + kiểm tra sheet nào đã tồn tại. */
function getBrandList(url) {
  return Orchestrator_getBrandList(url);
}

/** Xử lý 1 brand (được gọi tuần tự từ Sidebar để hiển thị log từng bước). */
function processSingleBrand(url, brand) {
  return Orchestrator_processOne(url, brand);
}

/** Lưu settings từ Settings screen. */
function saveSettings(settings) {
  Config_save(settings);
  return { ok: true };
}

/** Load settings raw (cho Settings screen). */
function loadSettings() {
  return Config_loadRaw();
}

/** Reset settings về default. */
function resetSettings() {
  Config_reset();
  return { ok: true };
}
