// DriveFiles.gs — feature entry points for the Drive Files Lister sidebar screen

var DF_CFG_DEFAULTS = {
  dfMimeTypes:        '',      // comma-separated MIME types, empty = all
  dfModifiedAfter:    '',      // ISO date string, empty = no filter
  dfIncludeDesc:      'false',
  dfIncludeLastUser:  'true',
  dfDoColor:          'true',
  dfAutoResize:       'false',
};

// ---------------------------------------------------------------------------
// Main run function (called from sidebar)
// ---------------------------------------------------------------------------

/**
 * Start or resume listing files.
 *
 * @param {string} sheetUrl   — target spreadsheet URL
 * @param {string} folderUrl  — Google Drive folder URL
 * @param {boolean} resume    — true = continue from saved resume state
 * @returns {{ ok, timedOut, rowCount, elapsed, error? }}
 */
/**
 * Check if Drive scope is authorized. Returns authUrl if not yet granted.
 * @returns {{ ok: true } | { ok: false, authRequired: true, authUrl: string }}
 */
function DriveFiles_checkAuth() {
  var authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  if (authInfo.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
    return { ok: false, authRequired: true, authUrl: authInfo.getAuthorizationUrl() };
  }
  return { ok: true };
}

/**
 * Resolve sheet name from a spreadsheet URL containing a GID.
 * @param {string} sheetUrl
 * @returns {{ found: bool, sheetName?: string }}
 */
function DriveFiles_resolveSheetName(sheetUrl) {
  try {
    var id = Helpers_getSpreadsheetId(sheetUrl);
    var ss = SpreadsheetApp.openById(id);
    var gidMatch = sheetUrl.match(/[#&?]gid=(\d+)/);
    if (gidMatch) {
      var gid = parseInt(gidMatch[1], 10);
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getSheetId() === gid) {
          return { found: true, sheetName: sheets[i].getName() };
        }
      }
    }
    return { found: false };
  } catch (e) {
    return { found: false };
  }
}

function DriveFiles_run(sheetUrl, folderUrl, sheetName, resume) {
  try {
    // Check Drive scope before doing anything
    var auth = DriveFiles_checkAuth();
    if (!auth.ok) return auth;

    var id  = Helpers_getSpreadsheetId(sheetUrl);
    var ss;
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) {
      return { ok: false, error: 'Không mở được Spreadsheet.\nKiểm tra URL đúng chưa và tài khoản có quyền edit file đó không.\nChi tiết: ' + e.message };
    }
    var raw = DF_loadRaw_();

    // Resolve sheet name: param → auto-detect from GID → fallback default
    if (!sheetName) {
      var resolved = DriveFiles_resolveSheetName(sheetUrl);
      sheetName = resolved.found ? resolved.sheetName : 'Drive Files';
    }

    var mimeTypes = raw.dfMimeTypes
      ? raw.dfMimeTypes.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
      : [];

    var dlCfg = {
      resume:           !!resume,
      mimeTypes:        mimeTypes,
      modifiedAfterISO: raw.dfModifiedAfter || '',
      includeDesc:      raw.dfIncludeDesc     === 'true',
      includeLastUser:  raw.dfIncludeLastUser !== 'false',
      doColor:          raw.dfDoColor         !== 'false',
      autoResize:       raw.dfAutoResize      === 'true',
    };

    var result = DriveLister_run(ss, sheetName, folderUrl, dlCfg);

    // Nếu DriveLister thất bại, re-check auth — có thể lỗi thực ra là do Drive scope chưa authorize
    if (!result.ok) {
      var recheck = DriveFiles_checkAuth();
      if (!recheck.ok) return recheck; // là auth issue → trả về authUrl để hiện button
    }

    return result;

  } catch (e) {
    Logger.log('DriveFiles_run error: ' + e.message + '\n' + e.stack);
    // Nếu exception có liên quan đến permission/authorization → show auth button
    var msg = e.message || '';
    if (msg.indexOf('Required permissions') !== -1 || msg.indexOf('authorization') !== -1) {
      var authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
      return { ok: false, authRequired: true, authUrl: authInfo.getAuthorizationUrl() };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Check if there's a saved resume state for the given folder URL.
 * @returns {{ hasResume: bool, rowCount: number } | null}
 */
function DriveFiles_checkResume(folderUrl) {
  try {
    return DriveLister_checkResume(folderUrl);
  } catch (e) {
    return null;
  }
}

/**
 * Clear resume state for the given folder URL.
 */
function DriveFiles_clearResume(folderUrl) {
  try { DriveLister_clearResume(folderUrl); } catch (e) {}
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function DriveFiles_loadSettings() {
  return DF_loadRaw_();
}

function DriveFiles_saveSettings(settings) {
  var toSave = {};
  for (var key in DF_CFG_DEFAULTS) {
    if (settings[key] !== undefined && settings[key] !== null) {
      toSave[key] = String(settings[key]);
    }
  }
  PropertiesService.getScriptProperties().setProperties(toSave);
}

function DriveFiles_resetSettings() {
  for (var key in DF_CFG_DEFAULTS) {
    PropertiesService.getScriptProperties().deleteProperty(key);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function DF_loadRaw_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var raw = {};
  for (var key in DF_CFG_DEFAULTS) {
    raw[key] = (props[key] !== undefined && props[key] !== '') ? props[key] : DF_CFG_DEFAULTS[key];
  }
  return raw;
}
