// Code.gs — entry point: menu, sidebar, web app

/**
 * Tạo menu khi mở Google Spreadsheet (bound mode).
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Intrepid Tools')
    .addItem('Mở Sidebar', 'showSidebar')
    .addSeparator()
    .addItem('Reset Settings', 'resetSettings')
    .addToUi();
}

/**
 * Mở sidebar (bound to spreadsheet).
 */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('ui/Sidebar')
    .setTitle('Intrepid GAS Tools')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Web app entry point (standalone mode).
 * Deploy → New deployment → Web app để dùng không cần mở spreadsheet.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('ui/Sidebar')
    .setTitle('Intrepid GAS Tools')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
