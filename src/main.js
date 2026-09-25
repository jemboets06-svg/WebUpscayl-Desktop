const { app, BrowserWindow, dialog, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const https = require('https');
const { spawn } = require('child_process');

const APP_VERSION = '1.0.1';
const ENGINE_VERSION = '0.2.5.0';
const ENGINE_URL = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip';
const ENGINE_ROOT = path.join(app.getPath('userData'), 'engine');
const ENGINE_ARCHIVE = path.join(ENGINE_ROOT, 'realesrgan-engine.zip');
const BUNDLED_ENGINE_ROOT = path.join(process.resourcesPath, 'engine');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

let mainWindow = null;
let activeProcess = null;
let stopRequested = false;

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460, height: 900, minWidth: 1100, minHeight: 720,
    backgroundColor: '#090a0f',
    title: 'WebUpscayl Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function walkImages(root) {
  const results = [];
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) results.push(full);
    }
  }
  walk(root);
  return results;
}

function safeName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'image';
}

function extensionFor(format) {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[format] || 'png';
}

function outputPathFor(inputPath, inputRoot, outputRoot, prefix, scale, format) {
  const relative = path.relative(inputRoot, inputPath);
  const relativeDir = path.dirname(relative);
  const base = safeName(path.basename(inputPath, path.extname(inputPath)));
  const ext = extensionFor(format);
  const targetDir = path.join(outputRoot, relativeDir === '.' ? '' : relativeDir);
  return {
    dir: targetDir,
    file: path.join(targetDir, `${prefix}${base}_${scale}x.${ext}`)
  };
}

function findEngineExe() {
  try {
    const direct = [
      path.join(ENGINE_ROOT, 'realesrgan-ncnn-vulkan-20220424-windows', 'realesrgan-ncnn-vulkan.exe'),
      path.join(ENGINE_ROOT, 'realesrgan-ncnn-vulkan.exe')
    ];
    for (const p of direct) if (fs.existsSync(p)) return p;
    function walk(dir, depth) {
      if (depth > 4) return null;
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isFile() && item.name.toLowerCase() === 'realesrgan-ncnn-vulkan.exe') return full;
        if (item.isDirectory()) {
          const hit = walk(full, depth + 1);
          if (hit) return hit;
        }
      }
      return null;
    }
    return walk(ENGINE_ROOT, 0);
  } catch { return null; }
}

function httpsDownload(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'WebUpscaylDesktop/1.0' } }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return resolve(httpsDownload(new URL(response.headers.location, url).toString(), destination));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Download gagal (HTTP ${response.statusCode}).`));
      }
      const total = Number(response.headers['content-length'] || 0);
      let received = 0;
      const file = fs.createWriteStream(destination);
      response.on('data', chunk => {
        received += chunk.length;
        if (total) send('engine-progress', { received, total, percent: Math.round(received / total * 100) });
      });
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
      response.on('error', reject);
    });
    request.on('error', reject);
  });
}

async function expandZip(zipPath, destination) {
  await fsp.mkdir(destination, { recursive: true });
  const script = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`;
  await new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let stderr = '';
    ps.stderr.on('data', d => { stderr += d.toString(); });
    ps.on('error', reject);
    ps.on('close', code => code === 0 ? resolve() : reject(new Error(stderr || `Expand-Archive gagal (${code}).`)));
  });
}

async function ensureEngine() {
  const existing = findEngineExe();
  if (existing) {
    send('engine-status', { state: 'ready', version: ENGINE_VERSION, bundled: existing.startsWith(BUNDLED_ENGINE_ROOT) });
    return existing;
  }
  if (process.platform !== 'win32') throw new Error('Aplikasi ini menargetkan Windows 64-bit.');
  await fsp.mkdir(ENGINE_ROOT, { recursive: true });
  send('engine-status', { state: 'downloading', version: ENGINE_VERSION });
  try {
    if (!fs.existsSync(ENGINE_ARCHIVE)) await httpsDownload(ENGINE_URL, ENGINE_ARCHIVE);
    send('engine-status', { state: 'extracting', version: ENGINE_VERSION });
    await expandZip(ENGINE_ARCHIVE, ENGINE_ROOT);
    const exe = findEngineExe();
    if (!exe) throw new Error('Executable Real-ESRGAN tidak ditemukan setelah ekstraksi.');
    try { await fsp.unlink(ENGINE_ARCHIVE); } catch {}
    send('engine-status', { state: 'ready', version: ENGINE_VERSION });
    return exe;
  } catch (err) {
    send('engine-status', { state: 'error', message: err.message });
    throw err;
  }
}

function createThumbnailDataUrl(filePath) {
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) return null;
  return image.resize({ width: 360, height: 240, quality: 'good' }).toDataURL();
}

function getImageDimensions(filePath) {
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) return { width: 0, height: 0 };
  return image.getSize();
}

function runEngine(exe, args, onLine) {
  return new Promise((resolve, reject) => {
    const proc = spawn(exe, args, { windowsHide: true });
    activeProcess = proc;
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { const s = d.toString(); stdout += s; s.split(/\r?\n/).filter(Boolean).forEach(onLine); });
    proc.stderr.on('data', d => { const s = d.toString(); stderr += s; s.split(/\r?\n/).filter(Boolean).forEach(onLine); });
    proc.on('error', reject);
    proc.on('close', code => {
      activeProcess = null;
      if (stopRequested) return reject(new Error('Dibatalkan oleh pengguna.'));
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error((stderr || stdout || `Engine berhenti dengan kode ${code}.`).trim().slice(-3000)));
    });
  });
}

ipcMain.handle('app-info', () => ({ version: APP_VERSION, engineVersion: ENGINE_VERSION, platform: process.platform, arch: process.arch }));

ipcMain.handle('select-input-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Pilih Folder Input' });
  if (result.canceled || !result.filePaths[0]) return null;
  const folder = result.filePaths[0];
  const files = walkImages(folder).map((p, i) => ({
    id: `${Date.now()}_${i}`, path: p, name: path.basename(p), relative: path.relative(folder, p),
    size: fs.statSync(p).size, ...getImageDimensions(p)
  }));
  return { folder, folderName: path.basename(folder), files };
});

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'], title: 'Pilih Folder Output' });
  return result.canceled ? null : (result.filePaths[0] || null);
});

ipcMain.handle('get-thumbnail', async (_event, filePath) => {
  try { return createThumbnailDataUrl(filePath); } catch { return null; }
});

ipcMain.handle('open-folder', async (_event, folder) => {
  if (folder) await shell.openPath(folder);
});

ipcMain.handle('open-file', async (_event, filePath) => {
  if (filePath) await shell.openPath(filePath);
});

ipcMain.handle('ensure-engine', async () => {
  try {
    const executable = await ensureEngine();
    return { ok: true, executable, version: ENGINE_VERSION };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cancel-batch', () => {
  stopRequested = true;
  if (activeProcess) {
    try { activeProcess.kill(); } catch {}
  }
  return true;
});

ipcMain.handle('start-batch', async (_event, options) => {
  stopRequested = false;
  const { files = [], inputRoot, outputDir, model = 'photo', scale = 4, outputFormat = 'image/png', prefix = 'upscayl_', tile = 0, performance = 'auto' } = options || {};
  if (!outputDir) throw new Error('Folder output belum dipilih.');
  if (!files.length) throw new Error('Tidak ada gambar dalam antrian.');
  const exe = await ensureEngine();
  await fsp.mkdir(outputDir, { recursive: true });

  const modelName = model === 'anime' ? 'realesrgan-x4plus-anime' : 'realesrgan-x4plus';
  const jobs = performance === 'low' ? '1:1:1' : performance === 'fast' ? '1:3:2' : '1:2:2';
  const format = extensionFor(outputFormat);
  let done = 0;
  const results = [];

  for (const item of files) {
    if (stopRequested) break;
    const target = outputPathFor(item.path, inputRoot, outputDir, prefix, scale, outputFormat);
    await fsp.mkdir(target.dir, { recursive: true });
    send('batch-progress', { phase: 'processing', done, total: files.length, item: item.name, outputPath: target.file, percent: Math.round(done / files.length * 100) });

    try {
      const args = ['-i', item.path, '-o', target.file, '-n', modelName, '-s', String(scale), '-t', String(tile), '-j', jobs, '-f', format];
      await runEngine(exe, args, line => {
        send('engine-log', { line });
        const m = line.match(/(\\d+(?:\\.\\d+)?)%/);
        if (m) {
          const local = Math.max(0, Math.min(100, Number(m[1])));
          send('batch-progress', { phase: 'processing', done, total: files.length, item: item.name, outputPath: target.file, percent: Math.min(99, Math.round(((done + local / 100) / files.length) * 100)) });
        }
      });
      if (!fs.existsSync(target.file)) throw new Error('Engine selesai tetapi file output tidak ditemukan.');
      const dims = getImageDimensions(target.file);
      done++;
      results.push({ ...item, status: 'completed', outputPath: target.file, outputWidth: dims.width, outputHeight: dims.height });
      send('batch-progress', { phase: 'completed', done, total: files.length, item: item.name, outputPath: target.file, percent: Math.round(done / files.length * 100) });
    } catch (err) {
      results.push({ ...item, status: stopRequested ? 'cancelled' : 'error', outputPath: target.file, error: err.message });
      send('batch-progress', { phase: stopRequested ? 'cancelled' : 'error', done, total: files.length, item: item.name, outputPath: target.file, percent: Math.round(done / files.length * 100), error: err.message });
      if (stopRequested) break;
    }
  }

  const cancelled = stopRequested;
  stopRequested = false;
  send('batch-finished', { completed: done, total: files.length, cancelled, results });
  return { completed: done, total: files.length, cancelled, results };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (activeProcess) { try { activeProcess.kill(); } catch {} } });
