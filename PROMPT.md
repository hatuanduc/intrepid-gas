# Prompt: Google Apps Script — Summary Sheet Brand Extractor

## Mục tiêu

Xây dựng một Google Apps Script app cho phép người dùng:

1. Nhập link Google Spreadsheet vào sidebar
2. Click nút "Xử lý" để tự động tách dữ liệu từ sheet **Summary** ra các sheet riêng cho từng brand
3. Thiết kế extensible — dễ thêm chức năng mới sau

---

## Cấu trúc dữ liệu đầu vào (Summary Sheet)

### Layout tổng quát

| Cột | Ý nghĩa |
|-----|---------|
| B | Brand name |
| C | Company Name (Customer Name) |
| AE → AR | Brand summary data (ngang) |
| AS → BL | Marketing spending details |

- Dữ liệu bắt đầu từ **dòng 5** (configurable)
- Dòng header nằm ngay trên dòng 5 (dòng 4, configurable)

### Vùng AE → AR (Brand Summary)

- Mỗi cột tương ứng một **Nature** (e.g., Live Streaming, KOLPage ReviewContent, Others, Lazada, Shopee, ...)
- Giá trị trong ô = Amount của brand đó cho Nature đó
- Cần chuyển từ **chiều ngang → chiều dọc** khi xuất ra sheet brand

### Vùng AS → BL (Marketing Spending Details)

Chia làm **2 nhóm header**:

#### Nhóm 1 — "From AS→BL (trừ tiktok header)"

Các cột spending không thuộc TikTok, ví dụ:

- Search brand ads + Display ads
- Shopee Ads
- Shopee Live Ads
- Shopee AMS
- Lazada Discovery
- Lazada Sponsored Max
- Lazada Affiliate
- Lazada Rebate
- Lazada Sponsored Display

#### Nhóm 2 — "From AS→BL (only tiktok header)"

Các cột thuộc TikTok, ví dụ:

- TikTok Ads (cột tổng)
- ads credit
- (cột phụ khác)
- Total

> **Cách phân biệt**: dựa vào tên header chứa "Tiktok" / "TikTok" (case-insensitive)

---

## Cấu trúc dữ liệu đầu ra (Brand Sheet)

Mỗi brand tạo một **sheet mới** với tên = brand name, layout như sau:

---

### Block 1 — Marketing spending details (From AS→BL trừ tiktok)

```
Marketing spending details                    Customer Name: [Levi Strauss (Thailand) Ltd.]  ← F1
From AS->BL (trừ tiktok header)              ↑ lấy từ cột C (Company Name) của brand row

| Search brand ads + Display ads | Shopee Ads | Shopee Live Ads | Shopee AMS | Lazada Discovery | Lazada Sponsored Max | Lazada Affiliate | Lazada Rebate | Lazada Sponsored Display | Total |
|---                              |---         |---              |---         |---               |---                   |---               |---            |---                       |---    |
| [values...]                     |            |                 |            |                  |                      |                  |               |                          | =SUM  |

Marketing management fee    9%    of total spending
Marketing management fee    [Total × 9%]    THB (before VAT)
```

- Cột **Total** = SUM của tất cả cột spending trong row
- Fee = Total × 9%

---

### Block 2 — From AS→BL (only tiktok header)

```
From AS->BL (only tiktok header)

| [TikTok col] | ads credit | [other] | Total |
|---            |---         |---      |---    |
| [values...]   |            |         | =SUM  |

Marketing management fee    7%    of total spending
Marketing management fee    [Total × 7%]    THB (before VAT)
```

- Cột **Total** = SUM của tất cả cột TikTok trong row
- Fee = Total × 7%

---

### Block 3 — Brand Summary (AE→AR, ngang → dọc)

```
| Brand name  | Nature               | Amount       |
|-------------|----------------------|--------------|
| Levi's TH   | Live Streaming       |              |
| Levi's TH   | KOLPage ReviewContent|              |
| Levi's TH   | Others               |              |
| Levi's TH   | Lazada               | 757,530.09   |
| Levi's TH   | Shopee               | 1,322,476.42 |
| ...         | ...                  | ...          |
```

- Chuyển từng cột AE→AR thành một row
- Nếu ô trống thì vẫn giữ row (Amount = empty)

---

## Kiến trúc kỹ thuật

### Tech stack

| Layer | Công nghệ |
|-------|-----------|
| Runtime | Google Apps Script (V8) |
| Local dev | CLASP CLI |
| Version control | Git |
| Deploy | `clasp push` → GAS |

### Cấu trúc thư mục

```
intrepid-gas/
├── .clasp.json               # Script ID, rootDir: "./src"
├── .claspignore              # Loại trừ node_modules, PROMPT.md, ...
├── .gitignore
├── appsscript.json           # GAS manifest (timezone, oauthScopes)
├── package.json              # devDep: @google/clasp
├── PROMPT.md
├── README.md
└── src/
    ├── appsscript.json       # copy vào đây để clasp push nhận
    ├── Code.gs               # Entry: onOpen(), menu
    ├── ui/
    │   ├── Sidebar.html      # Sidebar UI (tab: Brand Split, Settings)
    │   └── SettingsTab.html  # (optional partial)
    ├── core/
    │   ├── Orchestrator.gs
    │   ├── SummaryReader.gs
    │   ├── BrandExtractor.gs
    │   └── SheetBuilder.gs
    ├── features/
    │   └── BrandSplit.gs
    └── utils/
        ├── Config.gs         # đọc/ghi PropertiesService
        └── Helpers.gs
```

> **Lưu ý về folder trong GAS/CLASP:**
> - CLASP **hỗ trợ** subdirectory — file `src/core/Orchestrator.gs` được push lên GAS bình thường
> - Trong **GAS web editor**, file hiển thị dạng phẳng với tên `core/Orchestrator` (không có cây thư mục)
> - Không ảnh hưởng gì đến runtime — chỉ là cách hiển thị trong editor
> - Workflow thực tế: code bằng VS Code local + `clasp push`, không cần dùng GAS editor

---

## UI Design

### Sidebar layout

```
┌─────────────────────────────────┐
│  Intrepid GAS Tools             │
├─────────────────────────────────┤
│ [Brand Split] [Settings] [...]  │  ← Tab bar, thêm tab = thêm feature
├─────────────────────────────────┤
│  Tab: Brand Split               │
│                                 │
│  Spreadsheet URL:               │
│  ┌───────────────────────────┐  │
│  │ https://docs.google...    │  │
│  └───────────────────────────┘  │
│                                 │
│  [ Xử lý ]                      │
│                                 │
│  ── Log ─────────────────────── │
│  ✅ Đã xử lý: Levi's TH         │
│  ✅ Đã xử lý: Brand 2           │
│  ✅ Hoàn thành (3 brands)       │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Tab: Settings                  │
│                                 │
│  Summary sheet name: [Summary ] │
│  Header row:         [4       ] │
│  Data start row:     [5       ] │
│  Col Brand (B=2):    [2       ] │
│  Col Company (C=3):  [3       ] │
│  Col Summary start:  [31      ] │  ← AE
│  Col Summary end:    [44      ] │  ← AR
│  Col Spending start: [45      ] │  ← AS
│  Col Spending end:   [64      ] │  ← BL
│  Fee non-TikTok (%): [9       ] │
│  Fee TikTok (%):     [7       ] │
│  TikTok keywords:    [tiktok  ] │
│                                 │
│  [ Lưu Settings ]               │
└─────────────────────────────────┘
```

- Settings được lưu qua `PropertiesService.getScriptProperties()` — persist giữa các lần dùng
- Mặc định load giá trị từ Properties, fallback về default nếu chưa có
- Log area hiển thị tiến trình realtime qua `google.script.run` + callback

---

## Logic xử lý (Orchestrator flow)

```
processSpreadsheet(url)
  │
  ├── 1. cfg = Config.load()              ← đọc từ PropertiesService
  ├── 2. getSpreadsheetIdFromUrl(url)
  ├── 3. openSpreadsheet(id)
  ├── 4. getSummarySheet(cfg.summarySheetName)
  ├── 5. readHeaders(cfg.headerRow)
  │         ├── parseSpendingHeaders(cfg.colSpendStart → cfg.colSpendEnd)
  │         │     ├── nonTikTokCols[]     ← header không chứa tiktok keyword
  │         │     └── tikTokCols[]        ← header chứa tiktok keyword
  │         └── parseSummaryCols(cfg.colSummaryStart → cfg.colSummaryEnd)
  │               └── natureHeaders[]
  │
  ├── 6. getUniqueBrands(cfg.colBrand, cfg.dataStartRow)
  │
  └── 7. forEach brand:
            ├── rows = getRowsForBrand(brand, cfg.colBrand)
            ├── companyName = rows[0][cfg.colCompany]  ← cột C
            ├── createOrClearSheet(brand)
            ├── buildBlock1(sheet, rows, nonTikTokCols, cfg.feeNonTiktok)
            │     ├── writeTitle "Marketing spending details" (A1)
            │     ├── writeCustomerName(companyName) → F1  ← cột C → F1
            │     ├── writeSubtitle "From AS->BL (trừ tiktok header)"
            │     ├── writeDataRows + Total col (SUM)
            │     └── writeManagementFee(cfg.feeNonTiktok %)
            ├── buildBlock2(sheet, rows, tikTokCols, cfg.feeTiktok)
            │     ├── writeSubtitle "From AS->BL (only tiktok header)"
            │     ├── writeDataRows + Total col (SUM)
            │     └── writeManagementFee(cfg.feeTiktok %)
            └── buildBlock3(sheet, rows, natureHeaders, cfg.colBrand)
                  └── writeRows [BrandName, Nature, Amount] (ngang→dọc)
```

---

## Config system (thay thế hardcoded Constants)

Tất cả thông số được lưu qua `PropertiesService.getScriptProperties()` để người dùng có thể thay đổi qua UI tab Settings mà không cần sửa code.

### Config.gs — cấu trúc

```javascript
// Config.gs
const CONFIG_DEFAULTS = {
  summarySheetName: 'Summary',
  headerRow:        4,           // dòng chứa tên cột
  dataStartRow:     5,           // dòng đầu tiên có data
  colBrand:         2,           // cột B
  colCompany:       3,           // cột C — Company Name → Customer Name
  colSummaryStart:  31,          // cột AE (brand summary, ngang)
  colSummaryEnd:    44,          // cột AR
  colSpendStart:    45,          // cột AS (spending details)
  colSpendEnd:      64,          // cột BL
  feeNonTiktok:     9,           // % (lưu dạng số nguyên, chia 100 khi dùng)
  feeTiktok:        7,           // %
  tiktokKeywords:   'tiktok,tik tok',  // comma-separated
};

function Config_load() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const cfg = {};
  for (const key in CONFIG_DEFAULTS) {
    cfg[key] = props[key] !== undefined ? props[key] : CONFIG_DEFAULTS[key];
  }
  // parse types
  cfg.headerRow       = Number(cfg.headerRow);
  cfg.dataStartRow    = Number(cfg.dataStartRow);
  cfg.colBrand        = Number(cfg.colBrand);
  cfg.colCompany      = Number(cfg.colCompany);
  cfg.colSummaryStart = Number(cfg.colSummaryStart);
  cfg.colSummaryEnd   = Number(cfg.colSummaryEnd);
  cfg.colSpendStart   = Number(cfg.colSpendStart);
  cfg.colSpendEnd     = Number(cfg.colSpendEnd);
  cfg.feeNonTiktok    = Number(cfg.feeNonTiktok) / 100;
  cfg.feeTiktok       = Number(cfg.feeTiktok) / 100;
  cfg.tiktokKeywords  = String(cfg.tiktokKeywords).split(',').map(s => s.trim().toLowerCase());
  return cfg;
}

function Config_save(settings) {   // gọi từ Sidebar khi user click "Lưu Settings"
  PropertiesService.getScriptProperties().setProperties(settings);
}
```

### Mapping cột chữ → số (tham chiếu)

| Cột Excel | Index (1-based) | Ý nghĩa |
|-----------|-----------------|---------|
| B | 2 | Brand name |
| C | 3 | Company Name |
| AE | 31 | Summary start |
| AR | 44 | Summary end |
| AS | 45 | Spending start |
| BL | 64 | Spending end |

> GAS dùng 1-based index cho `getRange(row, col)` — khớp với số trên.

---

## Git & CLASP Workflow

### Setup lần đầu

```bash
# Cài clasp
npm install -g @google/clasp
clasp login

# Trong thư mục project
npm init -y
npm install --save-dev @google/clasp

# Tạo GAS project mới (Spreadsheet-bound hoặc Standalone)
clasp create --title "Intrepid GAS" --type standalone
# hoặc clone script có sẵn
clasp clone <scriptId>
```

### .clasp.json

```json
{
  "scriptId": "<YOUR_SCRIPT_ID>",
  "rootDir": "./src"
}
```

### appsscript.json

```json
{
  "timeZone": "Asia/Bangkok",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.container.ui"
  ]
}
```

### Daily workflow

```bash
# Kéo code mới nhất từ GAS
clasp pull

# Đẩy code lên GAS
clasp push

# Auto push khi save (dev mode)
clasp push --watch

# Xem logs
clasp logs
```

### Git branching

```
main        ← production (đã test, stable)
develop     ← integration branch
feat/*      ← feature branches
fix/*       ← bug fix branches
```

### Commit convention

```
feat: thêm tính năng tách brand
fix: sửa lỗi parse cột TikTok
chore: update clasp config
refactor: tách BrandExtractor ra module riêng
```

---

## Mở rộng sau này

Để thêm feature mới:

1. Tạo file `src/features/NewFeature.gs`
2. Thêm tab mới vào `Sidebar.html`
3. Đăng ký handler trong `Code.gs`
4. Không cần sửa core logic

Ví dụ feature có thể thêm:

- Export PDF từ brand sheet
- Tổng hợp báo cáo multi-month
- So sánh spending giữa các brand
- Auto-send email báo cáo

---

## Checklist triển khai

- [ ] Init Git repo + `.gitignore`
- [ ] `npm init` + cài `@google/clasp`
- [ ] `clasp login` + `clasp create`
- [ ] Tạo cấu trúc thư mục `src/`
- [ ] Viết `utils/Config.gs` (load/save PropertiesService + defaults)
- [ ] Viết `utils/Helpers.gs` (parse URL, col letter→index, format number)
- [ ] Viết `core/SummaryReader.gs` (đọc header, đọc brands, đọc rows)
- [ ] Viết `core/BrandExtractor.gs` (lọc rows theo brand, lấy companyName từ colCompany)
- [ ] Viết `core/SheetBuilder.gs` (tạo 3 block, writeCustomerName → F1)
- [ ] Viết `core/Orchestrator.gs` (nối tất cả, truyền cfg)
- [ ] Viết `features/BrandSplit.gs` (feature entry point)
- [ ] Viết `ui/Sidebar.html` (tab Brand Split + tab Settings)
- [ ] Viết `Code.gs` (menu `onOpen`, expose `processSpreadsheet`, `saveSettings`, `loadSettings`)
- [ ] Test với file Test.xlsx → Google Sheets
- [ ] `clasp push` + chạy thử trên GAS
- [ ] Commit & push lên Git
