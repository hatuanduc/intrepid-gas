// SheetBuilder.gs — tạo brand sheet với 3 block

var COLOR_CYAN   = '#00E5CC'; // subtitle row: "From AS->BL..."
var COLOR_PEACH  = '#F4CCAD'; // header row block 1
var COLOR_BLACK  = '#000000'; // header row block 2
var COLOR_WHITE  = '#FFFFFF';
var COLOR_TITLE  = '#FFFFFF'; // title row background

/**
 * Tạo hoặc xoá và build lại sheet cho một brand.
 *
 * @param {Spreadsheet} ss
 * @param {string} brandName
 * @param {string} companyName — từ cột C, ghi vào F1
 * @param {Array} brandRows — rows của brand này
 * @param {Array} spendHeaders — tất cả spending headers (có isTiktok flag)
 * @param {Array} natureHeaders — headers cột AE→AR
 * @param {Object} cfg
 * @returns {Sheet}
 */
function SheetBuilder_build(ss, brandName, companyName, brandRows, spendHeaders, natureHeaders, cfg, brandFees) {
  var sheet = ss.getSheetByName(brandName);
  if (sheet) {
    sheet.clear();
    sheet.clearFormats();
    // Move sheet cũ về cuối để đúng thứ tự xử lý
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(ss.getSheets().length);
  } else {
    // Sheet mới luôn thêm vào cuối
    sheet = ss.insertSheet(brandName, ss.getSheets().length);
  }

  var nonTiktokCols = spendHeaders.filter(function(h) { return !h.isTiktok; });
  var tiktokCols    = spendHeaders.filter(function(h) { return h.isTiktok;  });

  var currentRow = 1;

  // Lấy fee từ brandFees (master) hoặc fallback về cfg default
  var fees = brandFees || { feeNonTiktok: cfg.defaultFeeNonTiktok, feeTiktok: cfg.defaultFeeTiktok };

  // Block 1: non-TikTok spending
  currentRow = SheetBuilder_buildSpendingBlock(
    sheet, currentRow, companyName, brandRows, nonTiktokCols,
    fees.feeNonTiktok, true   // showMainTitle
  );

  currentRow++; // blank row giữa 2 block

  // Block 2: TikTok only
  currentRow = SheetBuilder_buildSpendingBlock(
    sheet, currentRow, null, brandRows, tiktokCols,
    fees.feeTiktok, false     // không lặp lại main title
  );

  currentRow++; // blank row

  // Block 3: brand summary (horizontal → vertical)
  SheetBuilder_buildSummaryBlock(sheet, currentRow, brandName, brandRows, natureHeaders);

  // Auto-resize cột A (tên dài)
  sheet.autoResizeColumn(1);

  return sheet;
}

// ---------------------------------------------------------------------------
// Block 1 & 2: spending details
// ---------------------------------------------------------------------------

function SheetBuilder_buildSpendingBlock(sheet, startRow, companyName, brandRows, cols, feeRate, showMainTitle) {
  var row = startRow;

  // Bỏ qua block nếu không có cột nào
  if (cols.length === 0) return row;

  // --- Dòng title + Customer Name (chỉ Block 1) ---
  if (showMainTitle) {
    sheet.getRange(row, 1).setValue('Marketing spending details').setFontWeight('bold').setFontSize(11);
    if (companyName) {
      sheet.getRange(row, 6).setValue('Customer Name').setFontWeight('bold');
      sheet.getRange(row, 7).setValue(companyName);
    }
    row++;
  }

  // --- Dòng header cột ---
  var headerValues = cols.map(function(h) { return h.name; });
  headerValues.push('Total');
  var headerRange = sheet.getRange(row, 1, 1, headerValues.length);
  headerRange.setValues([headerValues]);

  if (showMainTitle) {
    headerRange.setBackground(COLOR_PEACH).setFontWeight('bold').setWrap(true);
  } else {
    headerRange.setBackground(COLOR_BLACK).setFontColor(COLOR_WHITE).setFontWeight('bold').setWrap(true);
  }
  row++;

  // --- Data rows ---
  var blockTotal = 0;
  brandRows.forEach(function(brandRow) {
    var values = cols.map(function(h) { return brandRow.data[h.col - 1] || ''; });
    var rowTotal = Helpers_sum(values);
    blockTotal += rowTotal;
    values.push(rowTotal);
    sheet.getRange(row, 1, 1, values.length).setValues([values]).setNumberFormat('#,##0.00');
    row++;
  });

  row++; // blank row trước fee

  // --- Marketing management fee ---
  var feeAmount  = blockTotal * feeRate;
  var feePercent = Math.round(feeRate * 100) + '%';

  sheet.getRange(row, 1).setValue('Marketing management fee').setFontWeight('bold');
  sheet.getRange(row, 4).setValue(feePercent).setFontWeight('bold');
  sheet.getRange(row, 5).setValue('of total spending');
  row++;

  sheet.getRange(row, 1).setValue('Marketing management fee').setFontWeight('bold');
  sheet.getRange(row, 4).setValue(feeAmount).setNumberFormat('#,##0.00');
  sheet.getRange(row, 5).setValue('THB (before VAT)');
  row++;

  return row;
}

// ---------------------------------------------------------------------------
// Block 3: Brand summary (AE→AR ngang → dọc)
// ---------------------------------------------------------------------------

function SheetBuilder_buildSummaryBlock(sheet, startRow, brandName, brandRows, natureHeaders) {
  var row = startRow;

  // Header row
  var headers = [['Brand name', 'Nature', 'Amount']];
  var headerRange = sheet.getRange(row, 1, 1, 3);
  headerRange.setValues(headers).setBackground(COLOR_PEACH).setFontWeight('bold');
  row++;

  // Data: với mỗi brand row, chuyển ngang → dọc qua natureHeaders
  brandRows.forEach(function(brandRow) {
    natureHeaders.forEach(function(nature) {
      var amount = brandRow.data[nature.col - 1];
      var displayAmount = (amount === '' || amount === null || amount === undefined) ? '' : amount;
      sheet.getRange(row, 1, 1, 3).setValues([[brandName, nature.name, displayAmount]]);
      if (displayAmount !== '') {
        sheet.getRange(row, 3).setNumberFormat('#,##0.00');
      }
      row++;
    });
  });

  return row;
}
