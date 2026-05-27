// DriveLister.gs — list files in a Google Drive folder into a sheet
// Adapted from listFileInFolder_v1.gs: no UI alerts, accepts params, returns result objects.

var DL_RESUME_PREFIX    = 'driveLister_';
var DL_TIME_LIMIT_MS    = 28 * 60 * 1000;
var DL_PAGE_SIZE        = 1000;
var DL_PARENTS_CHUNK    = 20;
var DL_WRITE_CHUNK_ROWS = 1000;

/**
 * List all files under folderUrl into a sheet named sheetName inside ss.
 *
 * @param {Spreadsheet} ss
 * @param {string} sheetName  — sheet tab name to write into (created if missing)
 * @param {string} folderUrl  — Google Drive folder URL or ID
 * @param {Object} dlCfg      — optional config overrides
 *   { resume: bool, mimeTypes: string[], modifiedAfterISO: string,
 *     includeDesc: bool, includeLastUser: bool, doColor: bool, autoResize: bool }
 * @returns {{ ok, timedOut, rowCount, elapsed, error? }}
 */
function DriveLister_run(ss, sheetName, folderUrl, dlCfg) {
  var t0 = Date.now();
  dlCfg = dlCfg || {};

  if (!DL_hasDriveApi_()) {
    return { ok: false, error: 'Drive API (Advanced Google Services) chưa được bật. Vào Apps Script Editor → Services → Drive API v3.' };
  }

  var resolved = DL_resolveFolder_(folderUrl);
  if (!resolved) return { ok: false, error: 'Không xác định được Folder từ URL/ID đã nhập.' };
  var folderId = resolved.folderId;
  var rootName = resolved.rootName;

  // Get or create sheet
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  // Resume state
  var resumeKey  = DL_RESUME_PREFIX + folderId;
  var saved      = DL_resumeLoad_(resumeKey);
  var resumeMode = false;
  var startChunk = 0;
  var writeRow   = 3;

  if (dlCfg.resume && saved && saved.folderId === folderId) {
    resumeMode = true;
    startChunk = saved.chunkIndex;
    writeRow   = saved.writeRow;
  } else {
    DL_resumeClear_(resumeKey);
    DL_clearAndBuildHeader_(sh);
  }

  // Verify folder
  var driveId = null;
  try {
    var meta = Drive.Files.get(folderId, { fields: 'id,name,driveId', supportsAllDrives: true });
    rootName = meta.name || rootName;
    driveId  = meta.driveId || null;
  } catch (e) {
    return {
      ok: false,
      error: 'Không truy cập được folder (ID: ' + folderId + ').\n\n' +
             'Nguyên nhân có thể:\n' +
             '• Tài khoản của bạn chưa được share quyền vào folder này\n' +
             '• Folder nằm trong Shared Drive mà bạn không phải member\n' +
             '• URL/ID folder không đúng\n\n' +
             'Chi tiết lỗi: ' + e.message
    };
  }

  var scope = driveId
    ? { corpora: 'drive', driveId: driveId }
    : { corpora: 'user' };

  // Phase A: BFS — collect all sub-folders + build path map
  var tree           = DL_fetchSubtreeFolders_(folderId, rootName, scope);
  var folders        = tree.allFolders;
  var pathByFolder   = tree.pathByFolder;
  var parentByFolder = tree.parentByFolderId;
  var descendants    = new Set([folderId].concat(folders.map(function(f) { return f.id; })));

  // Phase B: list files chunk by chunk
  var HEADERS = DL_getHeaders_();
  var buffer  = [];
  var timedOut = false;
  var foldersWithDirectFiles = new Set();
  var parentIds = Array.from(descendants);
  var chunks    = DL_chunk_(parentIds, DL_PARENTS_CHUNK);

  for (var ci = startChunk; ci < chunks.length; ci++) {
    if (Date.now() - t0 > DL_TIME_LIMIT_MS) {
      timedOut = true;
      if (buffer.length) {
        sh.getRange(writeRow, 1, buffer.length, HEADERS.length).setValues(buffer);
        writeRow += buffer.length;
        buffer = [];
      }
      DL_resumeSave_(resumeKey, folderId, ci, writeRow);
      break;
    }

    var q      = DL_buildQuery_(chunks[ci], dlCfg.mimeTypes || [], dlCfg.modifiedAfterISO || '');
    var fields = DL_buildFields_(dlCfg);
    var base   = {
      q: q, pageSize: DL_PAGE_SIZE, fields: fields,
      includeItemsFromAllDrives: true, supportsAllDrives: true
    };
    if (scope.corpora === 'drive') { base.corpora = 'drive'; base.driveId = scope.driveId; }
    else { base.corpora = 'user'; }

    var token = null;
    do {
      if (Date.now() - t0 > DL_TIME_LIMIT_MS) { timedOut = true; break; }
      var params = token ? Object.assign({}, base, { pageToken: token }) : base;
      var resp   = DL_retryList_(params);
      var files  = (resp && resp.files) ? resp.files : [];

      for (var j = 0; j < files.length; j++) {
        var it = files[j];
        var ps = it.parents || [];
        for (var k = 0; k < ps.length; k++) {
          if (descendants.has(ps[k])) foldersWithDirectFiles.add(ps[k]);
        }
        var parentHit  = ps.find(function(id) { return pathByFolder.has(id); }) || '';
        var folderPath = parentHit ? pathByFolder.get(parentHit) : rootName;
        buffer.push(DL_mapFile_(it, folderPath, DL_tail_(folderPath), parentHit, dlCfg));

        if (buffer.length >= DL_WRITE_CHUNK_ROWS) {
          sh.getRange(writeRow, 1, buffer.length, HEADERS.length).setValues(buffer);
          writeRow += buffer.length;
          buffer = [];
        }
      }
      token = resp ? (resp.nextPageToken || null) : null;
    } while (token);

    if (timedOut) break;
  }

  if (buffer.length) {
    sh.getRange(writeRow, 1, buffer.length, HEADERS.length).setValues(buffer);
    writeRow += buffer.length;
    buffer = [];
  }

  if (!timedOut) {
    // Collect folders that have NO files anywhere in their subtree
    var foldersHasFiles = new Set();
    foldersWithDirectFiles.forEach(function(fid) {
      var cur  = fid;
      var seen = new Set();
      while (cur && descendants.has(cur) && !seen.has(cur)) {
        seen.add(cur);
        foldersHasFiles.add(cur);
        cur = parentByFolder.get(cur) || '';
      }
    });

    // Append empty-folder rows
    var folderRows = [];
    for (var i = 0; i < folders.length; i++) {
      var f = folders[i];
      if (foldersHasFiles.has(f.id)) continue; // skip folders that have files
      if (!pathByFolder.has(f.id)) continue;
      var fp       = pathByFolder.get(f.id);
      var parentId = (f.parents && f.parents[0]) ? f.parents[0] : '';
      var parentNm = parentId && pathByFolder.has(parentId) ? DL_tail_(pathByFolder.get(parentId)) : '';
      folderRows.push(DL_mapFolder_(f, fp, parentNm, parentId));
    }
    if (folderRows.length) {
      sh.getRange(writeRow, 1, folderRows.length, HEADERS.length).setValues(folderRows);
      writeRow += folderRows.length;
    }

    DL_resumeClear_(resumeKey);

    // Sort DFS / pre-order
    DL_sortPreOrder_(sh, 3, HEADERS.length);

    // Color alternating folder-path groups
    if (dlCfg.doColor !== false) {
      var total = Math.max(sh.getLastRow() - 2, 0);
      if (total > 0 && total <= 20000) {
        var paths = sh.getRange(3, 8, total, 1).getValues().map(function(r) { return r[0] || ''; });
        DL_colorBlocks_(sh, 3, paths, HEADERS.length);
      }
    }
    if (dlCfg.autoResize) sh.autoResizeColumns(1, HEADERS.length);
  }

  var elapsed  = ((Date.now() - t0) / 1000).toFixed(1);
  var rowCount = Math.max(sh.getLastRow() - 2, 0);
  return { ok: true, timedOut: timedOut, rowCount: rowCount, elapsed: elapsed };
}

/**
 * Check if there is a saved resume state for a given folder URL.
 * @returns {{ hasResume, rowCount } | null}
 */
function DriveLister_checkResume(folderUrl) {
  var resolved = DL_resolveFolder_(folderUrl);
  if (!resolved) return null;
  var saved = DL_resumeLoad_(DL_RESUME_PREFIX + resolved.folderId);
  if (!saved) return null;
  return { hasResume: true, rowCount: saved.writeRow - 3 };
}

/**
 * Clear resume state for a given folder URL.
 */
function DriveLister_clearResume(folderUrl) {
  var resolved = DL_resolveFolder_(folderUrl);
  if (resolved) DL_resumeClear_(DL_RESUME_PREFIX + resolved.folderId);
}

// ---------------------------------------------------------------------------
// BFS — fetch all sub-folders
// ---------------------------------------------------------------------------

function DL_fetchSubtreeFolders_(rootId, rootName, scope) {
  var allFolders      = [];
  var pathByFolder    = new Map([[rootId, rootName]]);
  var parentByFolderId = new Map([[rootId, '']]);
  var frontier        = [rootId];
  var visited         = new Set([rootId]);

  while (frontier.length > 0) {
    var chunks      = DL_chunk_(frontier, DL_PARENTS_CHUNK);
    var nextFrontier = [];

    for (var ci = 0; ci < chunks.length; ci++) {
      var parentsOr = chunks[ci].map(function(id) { return "'" + id + "' in parents"; }).join(' or ');
      var base = {
        q: '(' + parentsOr + ") and mimeType='application/vnd.google-apps.folder' and trashed=false",
        pageSize: DL_PAGE_SIZE,
        fields: 'files(id,name,parents),nextPageToken',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      };
      if (scope.corpora === 'drive') { base.corpora = 'drive'; base.driveId = scope.driveId; }
      else { base.corpora = 'user'; }

      var token = null;
      do {
        var params = token ? Object.assign({}, base, { pageToken: token }) : base;
        var resp   = DL_retryList_(params);
        var items  = (resp && resp.files) ? resp.files : [];
        for (var i = 0; i < items.length; i++) {
          var f = items[i];
          if (!visited.has(f.id)) {
            visited.add(f.id);
            allFolders.push(f);
            nextFrontier.push(f.id);
            var parents   = f.parents || [];
            var parentHit = parents.find(function(pid) { return pathByFolder.has(pid); }) || (parents[0] || '');
            pathByFolder.set(f.id, (pathByFolder.get(parentHit) || rootName) + '/' + f.name);
            parentByFolderId.set(f.id, parentHit);
          }
        }
        token = resp ? (resp.nextPageToken || null) : null;
      } while (token);
    }

    frontier = nextFrontier;
  }

  return { allFolders: allFolders, pathByFolder: pathByFolder, parentByFolderId: parentByFolderId };
}

// ---------------------------------------------------------------------------
// Sort DFS / pre-order by file path
// ---------------------------------------------------------------------------

function DL_sortPreOrder_(sh, startRow, headersLen) {
  var lastRow = sh.getLastRow();
  var total   = lastRow - startRow + 1;
  if (total <= 1) return;

  var names = sh.getRange(startRow, 5, total, 1).getValues().map(function(r) { return String(r[0] || ''); });
  var paths = sh.getRange(startRow, 8, total, 1).getValues().map(function(r) { return String(r[0] || ''); });
  var types = sh.getRange(startRow, 13, total, 1).getValues().map(function(r) { return String(r[0] || ''); });

  function norm(s) {
    return String(s || '').toLowerCase().replace(/(\d+)/g, function(m) { return m.padStart(10, '0'); });
  }

  var keys = [];
  for (var i = 0; i < total; i++) {
    var isFolder = types[i].toLowerCase() === 'folder';
    keys.push(isFolder ? (norm(paths[i]) + '/ ') : (norm(paths[i]) + '/~' + norm(names[i])));
  }

  var tmpCol = headersLen + 1;
  sh.getRange(2, tmpCol).setValue('SortKey').setFontWeight('bold');
  sh.getRange(startRow, tmpCol, total, 1).setValues(keys.map(function(k) { return [k]; }));
  sh.getRange(startRow, 1, total, tmpCol).sort([{ column: tmpCol, ascending: true }]);
  sh.deleteColumn(tmpCol);
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function DL_mapFile_(it, folderPath, parentName, parentId, dlCfg) {
  var id   = it.id   || '';
  var name = it.name || '';
  var url  = it.webViewLink || ('https://drive.google.com/file/d/' + id + '/view');
  var mime = it.mimeType || '';

  var desc     = (dlCfg && dlCfg.includeDesc)     ? (it.description || '') : '';
  var lastUser = (dlCfg && dlCfg.includeLastUser && it.lastModifyingUser)
                   ? (it.lastModifyingUser.displayName || '') : '';

  return [
    '', '', '', '',
    name,
    desc,
    it.starred ? 'Y' : 'N',
    folderPath,
    id,
    url,
    parentName,
    parentId,
    DL_mimeToReadable_(mime, name),
    DL_toIso_(it.createdTime),
    DL_toIso_(it.modifiedTime),
    lastUser,
    DL_toMB_(it.size),
    it.fileExtension || DL_inferExt_(mime, name)
  ];
}

function DL_mapFolder_(f, folderPath, parentName, parentId) {
  return [
    '', '', '', '',
    f.name || '', '', 'N',
    folderPath,
    f.id || '',
    'https://drive.google.com/drive/folders/' + (f.id || ''),
    parentName, parentId,
    'Folder',
    '', '', '', '', ''
  ];
}

// ---------------------------------------------------------------------------
// Sheet header
// ---------------------------------------------------------------------------

function DL_clearAndBuildHeader_(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, Math.max(1, sh.getMaxColumns())).clearContent().clearFormat();
  var H = DL_getHeaders_();
  sh.getRange(2, 1, 1, H.length).setValues([H]).setFontWeight('bold');
  sh.getRange(2, 1, 1, 4).setBackground('#e6e6e6');
  sh.getRange(2, 5, 1, 9).setBackground('#d9e1f2');
  sh.getRange(2, 14, 1, 5).setBackground('#e2efd9');
  sh.setFrozenRows(2);
}

function DL_getHeaders_() {
  return [
    'Delete Y/N', 'Update Y/N?', 'Copy File', 'Move to Folder',
    'File Name', 'File Description', 'Starred Y/N', 'File Path', 'File ID', 'File URL',
    'Parent Folder Name', 'Parent ID', 'File Type',
    'Date Created', 'Date Last Updated', 'Last Modified By', 'File Size (MB)', 'File Extension'
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function DL_resolveFolder_(raw) {
  raw = String(raw || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    var mFolder = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (mFolder) {
      var fid = mFolder[1];
      try {
        var meta = Drive.Files.get(fid, { fields: 'id,name', supportsAllDrives: true });
        return { folderId: fid, rootName: meta.name || 'Root' };
      } catch (e) { return { folderId: fid, rootName: 'Root' }; }
    }
    // If it's a file URL, resolve to its parent folder
    var mFile = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (mFile) {
      try {
        var fileMeta = Drive.Files.get(mFile[1], { fields: 'id,parents', supportsAllDrives: true });
        var parents = fileMeta.parents || [];
        if (parents.length > 0) {
          var pm = Drive.Files.get(parents[0], { fields: 'id,name', supportsAllDrives: true });
          return { folderId: parents[0], rootName: pm.name || 'Root' };
        }
      } catch (e) {}
    }
    // Strip query/fragment and take last path segment as ID
    raw = raw.replace(/[?#].*$/, '').split(/[/=]/).pop();
  }
  // Treat raw as a bare ID
  try {
    var m = Drive.Files.get(raw, { fields: 'id,mimeType,name,parents', supportsAllDrives: true });
    if ((m.mimeType || '').toLowerCase() === 'application/vnd.google-apps.folder') {
      return { folderId: m.id, rootName: m.name || 'Root' };
    }
    var ps = m.parents || [];
    if (ps.length > 0) {
      var pm2 = Drive.Files.get(ps[0], { fields: 'id,name', supportsAllDrives: true });
      return { folderId: ps[0], rootName: pm2.name || 'Root' };
    }
  } catch (e) {}
  return null;
}

function DL_hasDriveApi_() {
  try { return Drive.Files && typeof Drive.Files.list === 'function'; }
  catch (e) { return false; }
}

function DL_buildQuery_(parentIds, mimeTypes, modifiedAfterISO) {
  var parentsOr = parentIds.map(function(id) { return "'" + id + "' in parents"; }).join(' or ');
  var q = '( ' + parentsOr + " ) and trashed=false and mimeType != 'application/vnd.google-apps.folder'";
  if (mimeTypes && mimeTypes.length > 0) {
    var mOr = mimeTypes.filter(Boolean).map(function(mt) { return "mimeType='" + mt + "'"; }).join(' or ');
    if (mOr) q += ' and ( ' + mOr + ' )';
  }
  if (modifiedAfterISO) q += " and modifiedTime >= '" + modifiedAfterISO + "'";
  return q;
}

function DL_buildFields_(dlCfg) {
  var f = 'files(id,name,mimeType,webViewLink,size,createdTime,modifiedTime,starred,parents,fileExtension';
  if (dlCfg && dlCfg.includeDesc)     f += ',description';
  if (dlCfg && dlCfg.includeLastUser) f += ',lastModifyingUser/displayName';
  f += '),nextPageToken';
  return f;
}

function DL_retryList_(params, maxTries) {
  maxTries = maxTries || 3;
  var lastErr;
  for (var i = 0; i < maxTries; i++) {
    try { return Drive.Files.list(params); }
    catch (e) {
      lastErr = e;
      if (i < maxTries - 1) Utilities.sleep(Math.pow(2, i) * 1500);
    }
  }
  throw lastErr;
}

function DL_colorBlocks_(sheet, startRow, pathValues, lastCol) {
  if (!pathValues.length) return;
  var W = '#ffffff', Y = '#fff9db';
  var cur = pathValues[0], col = W, beg = 0;
  function apply(a, b, c) { sheet.getRange(startRow + a, 1, b - a + 1, lastCol).setBackground(c); }
  for (var i = 1; i <= pathValues.length; i++) {
    var v = i < pathValues.length ? pathValues[i] : null;
    if (v !== cur) { apply(beg, i - 1, col); col = (col === W) ? Y : W; beg = i; cur = v; }
  }
}

function DL_mimeToReadable_(mime, name) {
  var m = String(mime || '').toLowerCase();
  var MAP = {
    'application/vnd.google-apps.folder':       'Folder',
    'application/vnd.google-apps.spreadsheet':  'Google Sheet',
    'application/vnd.google-apps.document':     'Google Doc',
    'application/vnd.google-apps.presentation': 'Google Slide',
    'application/vnd.google-apps.drawing':      'Google Drawing',
    'application/pdf':                          'PDF',
    'image/png':                                'PNG Image',
    'image/jpeg':                               'JPG Image',
    'image/gif':                                'GIF Image',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (.xlsx)',
    'application/vnd.ms-excel':                 'Excel (.xls)',
    'application/vnd.ms-excel.sheet.macroenabled.12': 'Excel Macro (.xlsm)'
  };
  if (MAP[m]) return MAP[m];
  var ext = (String(name || '').match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
  return ext ? ext.toUpperCase() + ' File' : (mime || '');
}

function DL_inferExt_(mime, name) {
  var MAP = {
    'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.ms-excel.sheet.macroenabled.12': 'xlsm',
    'application/vnd.google-apps.spreadsheet': 'gsheet'
  };
  if (MAP[mime]) return MAP[mime];
  var r = (/\.(\w+)$/).exec(name || '');
  return r ? r[1].toLowerCase() : '';
}

function DL_chunk_(arr, n) {
  var out = [];
  for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function DL_tail_(p) {
  var s = String(p || '').split('/');
  return s[s.length - 1] || p;
}

function DL_toIso_(d) {
  if (!d) return '';
  var x = new Date(d), z = function(n) { return n < 10 ? '0' + n : n; };
  return x.getFullYear() + '-' + z(x.getMonth() + 1) + '-' + z(x.getDate()) +
         'T' + z(x.getHours()) + ':' + z(x.getMinutes()) + ':' + z(x.getSeconds());
}

function DL_toMB_(b) { return b ? Math.round(Number(b) / (1024 * 1024) * 10) / 10 : ''; }

// ---------------------------------------------------------------------------
// Resume state (per folder, in ScriptProperties)
// ---------------------------------------------------------------------------

// Resume state dùng getUserProperties() để mỗi user có state riêng, tránh conflict khi chạy đồng thời.
function DL_resumeSave_(key, folderId, chunkIndex, writeRow) {
  PropertiesService.getUserProperties().setProperty(
    key, JSON.stringify({ folderId: folderId, chunkIndex: chunkIndex, writeRow: writeRow })
  );
}

function DL_resumeLoad_(key) {
  try {
    var v = PropertiesService.getUserProperties().getProperty(key);
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}

function DL_resumeClear_(key) {
  PropertiesService.getUserProperties().deleteProperty(key);
}
