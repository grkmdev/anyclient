import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

export function findBrowserExecutable() {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const BASE_URL = 'https://www.hdfilmcehennemi.nl';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Search movies and TV series on hdfilmcehennemi.nl
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchHdFilm(query) {
  const exePath = findBrowserExecutable();
  if (!exePath) {
    throw new Error('Sistemde Microsoft Edge veya Google Chrome bulunamadı.');
  }

  const browser = await puppeteer.launch({
    executablePath: exePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.includes('devtools-console-detect')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });

    const searchInput = await page.$('input[placeholder="Ara"]');
    if (!searchInput) {
      return [];
    }

    await searchInput.type(query, { delay: 80 });
    await new Promise(r => setTimeout(r, 2500));

    const results = await page.evaluate(() => {
      const items = [];
      const links = document.querySelectorAll('.search-container a, .search-results a, .live-search a, .search-box a');
      for (const a of links) {
        const href = a.href;
        if (!href || href.includes('javascript:') || href.endsWith('.nl/')) continue;

        const text = a.innerText.trim();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        let year = '';
        let imdb = '';
        let type = 'Film';
        let title = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^\d{4}$/.test(line)) {
            year = line;
          } else if (/^\d\.\d$/.test(line)) {
            imdb = line;
          } else if (line.toLowerCase() === 'dizi' || line.toLowerCase() === 'film') {
            type = line;
          } else if (!line.startsWith('Arama Sonuclari') && line.length > 2) {
            title = line;
          }
        }

        if (title && href) {
          items.push({
            title,
            href,
            url: href,
            type,
            year,
            imdb,
            isSeries: href.includes('/dizi/') || type.toLowerCase() === 'dizi',
            source: 'hdfilm'
          });
        }
      }
      return items;
    });

    return results;
  } finally {
    await browser.close();
  }
}

/**
 * Extract direct video stream (m3u8) from a movie or series page
 * @param {string} pageUrl
 * @param {number} preferredSourceIndex
 * @returns {Promise<{ streamUrl: string, captions: Array, referer: string, title: string }>}
 */
export async function getHdFilmStream(pageUrl, preferredLang = 'sub', preferredSourceIndex = 1) {
  const exePath = findBrowserExecutable();
  if (!exePath) {
    throw new Error('Sistemde Microsoft Edge veya Google Chrome bulunamadı.');
  }

  const browser = await puppeteer.launch({
    executablePath: exePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.includes('devtools-console-detect')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const m3u8Urls = [];
    const captionUrls = [];

    page.on('response', res => {
      const u = res.url();
      const status = res.status();
      if ((status === 200 || status === 206) && u.includes('.m3u8')) {
        m3u8Urls.push(u);
      }
      if ((status === 200 || status === 301) && (u.includes('.vtt') || u.includes('.srt'))) {
        const lang = u.toLowerCase().includes('turkish') ? 'Türkçe' : 'İngilizce';
        if (!captionUrls.some(c => c.url === u)) {
          captionUrls.push({ url: u, label: lang });
        }
      }
    });

    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    const pageTitle = await page.evaluate(() => {
      const h1 = document.querySelector('h1.section-title, h1');
      return h1 ? h1.innerText.trim() : document.title;
    });

    const playBtn = await page.$("[aria-label='Play video']");
    if (playBtn) {
      await playBtn.click();
      await new Promise(r => setTimeout(r, 1500));
    }

    // Check language tabs (Dublaj / Altyazı) if separate tabs are available
    try {
      const langBtns = await page.$$("[aria-label='Language tab menu'] button, .nav-pills button, .language-link");
      for (const btn of langBtns) {
        const txt = await btn.evaluate(b => (b.innerText || '').trim().toLowerCase());
        if (preferredLang === 'dub' && txt.includes('dublaj') && !txt.includes('dual')) {
          await btn.click();
          await new Promise(r => setTimeout(r, 1200));
          break;
        } else if (preferredLang === 'sub' && txt.includes('altyaz') && !txt.includes('dual')) {
          await btn.click();
          await new Promise(r => setTimeout(r, 1200));
          break;
        }
      }
    } catch { }

    const altButtons = await page.$$("[aria-label='Alternative tab content'] button");
    if (altButtons.length > 0) {
      let targetIdx = preferredSourceIndex;
      if (targetIdx < 0 || targetIdx >= altButtons.length) {
        targetIdx = altButtons.length - 1;
      }
      await altButtons[targetIdx].click();
    }

    // Wait up to 14 seconds for m3u8 playlist to appear
    const start = Date.now();
    while (m3u8Urls.length === 0 && (Date.now() - start) < 14000) {
      await new Promise(r => setTimeout(r, 600));
    }

    let streamUrl = null;
    if (m3u8Urls.length > 0) {
      const master = m3u8Urls.find(u => u.toLowerCase().includes('master'));
      streamUrl = master || m3u8Urls[0];
    }

    if (!streamUrl) {
      throw new Error('Video akış kaynağı çözülemedi (Alternatif kaynak kapalı veya m3u8 yakalanamadı).');
    }

    // Extract and download subtitles locally to bypass Cloudflare protection
    const candidateSubs = [];
    const seenUrls = new Set();
    for (const item of captionUrls) {
      let clean = item.url.replace(/\/+$/, '');
      if (clean.startsWith('/')) clean = new URL(clean, BASE_URL).href;
      if (!seenUrls.has(clean)) {
        seenUrls.add(clean);
        candidateSubs.push({ url: clean, label: item.label });
      }
    }

    // If Turkish subtitle not caught by network responses, scan JWPlayer instances in frames
    const hasTrSub = candidateSubs.some(s => s.label.includes('Türk') || s.url.toLowerCase().includes('turkish'));
    if (!hasTrSub) {
      for (const frame of page.frames()) {
        try {
          const fSubs = await frame.evaluate(() => {
            const list = [];
            if (window.jwplayer) {
              try {
                const pl = window.jwplayer().getPlaylist();
                if (pl && pl[0] && pl[0].tracks) {
                  for (const t of pl[0].tracks) {
                    if (t.file && (t.kind === 'captions' || t.kind === 'subtitles' || t.file.includes('.vtt') || t.file.includes('.srt'))) {
                      list.push({ url: t.file, label: t.label || 'Altyazı' });
                    }
                  }
                }
              } catch { }
            }
            return list;
          });
          if (fSubs && fSubs.length > 0) {
            for (const s of fSubs) {
              let clean = s.url.replace(/\/+$/, '');
              if (clean.startsWith('/')) clean = new URL(clean, BASE_URL).href;
              if (!seenUrls.has(clean)) {
                seenUrls.add(clean);
                const isTr = s.label.toLowerCase().includes('türk') || clean.toLowerCase().includes('turkish');
                candidateSubs.push({ url: clean, label: isTr ? 'Türkçe' : s.label });
              }
            }
          }
        } catch { }
      }
    }

    // Sort: Turkish subtitles first!
    candidateSubs.sort((a, b) => {
      const aTr = (a.label.includes('Türk') || a.url.toLowerCase().includes('turkish')) ? 1 : 0;
      const bTr = (b.label.includes('Türk') || b.url.toLowerCase().includes('turkish')) ? 1 : 0;
      return bTr - aTr;
    });

    const subDir = path.join(os.homedir(), '.anyclient', 'subs');
    if (!fs.existsSync(subDir)) {
      try { fs.mkdirSync(subDir, { recursive: true }); } catch { }
    }

    const downloadedCaptions = [];
    for (let i = 0; i < candidateSubs.length; i++) {
      const sub = candidateSubs[i];
      try {
        const text = await page.evaluate(async (url) => {
          try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
            return await resp.text();
          } catch {
            return null;
          }
        }, sub.url);

        if (text && text.length > 30 && (text.includes('WEBVTT') || text.includes('-->') || /^\d+\s*$/m.test(text))) {
          const isTr = sub.label.includes('Türk') || sub.url.toLowerCase().includes('turkish');
          const ext = sub.url.endsWith('.srt') ? '.srt' : '.vtt';
          const fileName = isTr ? `sub_turkish_${Date.now()}_${i}${ext}` : `sub_english_${Date.now()}_${i}${ext}`;
          const localPath = path.join(subDir, fileName);
          fs.writeFileSync(localPath, text, 'utf-8');
          downloadedCaptions.push({
            url: localPath,
            label: sub.label,
            isDefault: isTr
          });
        } else {
          downloadedCaptions.push(sub);
        }
      } catch {
        downloadedCaptions.push(sub);
      }
    }

    return {
      streamUrl,
      isDirect: true,
      title: pageTitle,
      captions: downloadedCaptions,
      referer: BASE_URL
    };
  } finally {
    await browser.close();
  }
}

/**
 * Get all available episodes for a TV series on hdfilmcehennemi
 * @param {string} seriesUrl
 * @returns {Promise<Array<{ season: number, episode: number, url: string, name: string }>>}
 */
export async function getHdFilmSeriesEpisodes(seriesUrl) {
  const exePath = findBrowserExecutable();
  if (!exePath) throw new Error('Sistemde Microsoft Edge veya Google Chrome bulunamadı.');

  const browser = await puppeteer.launch({
    executablePath: exePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(seriesUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await new Promise(r => setTimeout(r, 2000));

    const episodes = await page.evaluate(() => {
      const list = [];
      const links = document.querySelectorAll('a');
      for (const a of links) {
        const href = a.href || '';
        const m = href.match(/\/sezon-(\d+)\/bolum-(\d+)/i);
        if (m) {
          const s = parseInt(m[1], 10);
          const e = parseInt(m[2], 10);
          if (!list.some(item => item.season === s && item.episode === e)) {
            const raw = a.innerText.trim();
            const clean = raw.split('\n')[0].trim();
            list.push({
              season: s,
              episode: e,
              url: href,
              name: clean || `Sezon ${s} Bölüm ${e}`
            });
          }
        }
      }
      return list;
    });

    return episodes.sort((a, b) => a.season !== b.season ? a.season - b.season : a.episode - b.episode);
  } finally {
    await browser.close();
  }
}
