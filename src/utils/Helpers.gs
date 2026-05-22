// Helpers.gs — shared utility functions

/**
 * Extract spreadsheet ID from a Google Sheets URL.
 * @param {string} url
 * @returns {string} spreadsheet ID
 */
function Helpers_getSpreadsheetId(url) {
  var match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error('URL không hợp lệ. Vui lòng dùng link Google Sheets.');
  return match[1];
}

/**
 * Convert 1-based column index to Excel letter(s), e.g. 1→A, 27→AA, 31→AE.
 * @param {number} index 1-based
 * @returns {string}
 */
function Helpers_colLetter(index) {
  var letter = '';
  var col = index;
  while (col > 0) {
    var rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

/**
 * Convert Excel column letter(s) to 1-based index, e.g. A→1, AE→31.
 * @param {string} letter
 * @returns {number}
 */
function Helpers_colIndex(letter) {
  var upper = letter.toUpperCase();
  var result = 0;
  for (var i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result;
}

/**
 * Format a number to 2 decimal places with comma separator.
 * Returns empty string for null/undefined/empty values.
 * @param {*} n
 * @returns {string}
 */
function Helpers_formatNumber(n) {
  if (n === null || n === undefined || n === '') return '';
  var num = Number(n);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Sum an array of values, treating blank/non-numeric as 0.
 * @param {Array} arr
 * @returns {number}
 */
function Helpers_sum(arr) {
  return arr.reduce(function(acc, v) {
    return acc + (Number(v) || 0);
  }, 0);
}
