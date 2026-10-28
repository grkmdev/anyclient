import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const OLD_CONFIG_DIRS = [
  path.join(os.homedir(), '.gorkemstream'),
  path.join(os.homedir(), '.aniclient')
];
const CONFIG_DIR = path.join(os.homedir(), '.anyclient');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json');

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    for (const oldDir of OLD_CONFIG_DIRS) {
      if (fs.existsSync(oldDir)) {
        try {
          const oldCfg = path.join(oldDir, 'config.json');
          const oldHist = path.join(oldDir, 'history.json');
          if (fs.existsSync(oldCfg) && !fs.existsSync(CONFIG_FILE)) {
            fs.copyFileSync(oldCfg, CONFIG_FILE);
          }
          if (fs.existsSync(oldHist) && !fs.existsSync(HISTORY_FILE)) {
            fs.copyFileSync(oldHist, HISTORY_FILE);
          }
          break;
        } catch {}
      }
    }
  }
}

export const DEFAULT_CONFIG = {
  provider: 'all', // 'all', 'openani', 'animecix'
  player: 'borderless', // 'borderless' (Terminal Overlay), 'fullscreen', 'mpv'
  fullscreen: false, // Varsayılan olarak tam ekran başlasın mı?
  customPlayerPath: '',
  quality: 'best', // 'best', '1080p', '720p', '480p'
  autoNext: 'countdown', // 'instant' (sormadan geç), 'countdown' (geri sayım), 'prompt' (sor), 'off' (kapalı)
  autoNextDelay: 3, // saniye
  alwaysOnTop: true, // Çerçevesiz modda her zaman üstte
  windowSize: '75%', // '90%', '75%', '60%', '50%'
  subSize: 'medium', // 'small' (36px), 'medium' (48px), 'large' (60px)
  subColor: 'white', // 'white', 'yellow', 'soft_white'
  aniSkip: 'auto', // 'auto' (AniSkip otomatik atla), 'manual' (Tab tuşuyla atla), 'off' (kapalı)
  skipEnding: false, // Kapanış jeneriğini (ED) de atla
  downloadDir: '', // Boşsa varsayılan ~/Downloads/AnyClient
  playAction: 'play' // 'play' (doğrudan oynat), 'ask' (her oynatmada sor)
};

export function getConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    if (data.autoNext === true) data.autoNext = 'countdown';
    if (data.autoNext === false) data.autoNext = 'off';
    delete data.skipIntro;
    if (data.player === 'terminal' || data.player === 'mpv') {
      data.player = 'borderless';
    }
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(cfg) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

export function resetConfig() {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  return { ...DEFAULT_CONFIG };
}

export function getHistory() {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) || [];
  } catch {
    return [];
  }
}

export function addToHistory(item) {
  ensureDir();
  const history = getHistory();
  // Filter out existing record for same anime
  const filtered = history.filter(h => h.titleId !== item.titleId);
  filtered.unshift({
    ...item,
    updatedAt: new Date().toISOString()
  });
  // Keep last 30
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(filtered.slice(0, 30), null, 2), 'utf-8');
}

export function clearHistory() {
  ensureDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
}

export function saveHistory(hist) {
  ensureDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(hist, null, 2), 'utf-8');
}

export const loadConfig = getConfig;
export const loadHistory = getHistory;
