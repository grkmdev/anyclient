import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { findBrowserExecutable } from './hdfilm.js';
import { extractDirectVideo } from './extractor.js';

const BASE_URL = 'https://dizikorea3.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Search Korean / Asian dramas and movies on DiziKorea
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchDiziKorea(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const searchUrl = `${BASE_URL}/ara?q=${encodeURIComponent(trimmed)}`;
  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': BASE_URL
    }
  });

  if (!resp.ok) {
    throw new Error(`DiziKorea arama servisi yanıt vermedi (HTTP ${resp.status})`);
  }

  const data = await resp.json();
  if (!data || !data.items || !Array.isArray(data.items)) {
    return [];
  }

  return data.items.map(item => {
    let poster = item.poster || '';
    if (poster && !poster.startsWith('http')) {
      poster = `${BASE_URL}${poster}`;
    }

    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      url: item.url,
      year: item.year ? String(item.year) : '',
      imdb: item.imdb_rating || '',
      description: item.description || item.excerpt || '',
      type: item.type_label || (item.type === 'movie' ? 'Film' : 'Dizi'),
      isSeries: item.type === 'series' || !item.type || item.type !== 'movie',
      poster,
      source: 'dizikorea'
    };
  });
}

/**
 * Fetch drama details, seasons, and episodes from DiziKorea
 * @param {string} dramaUrl
 * @returns {Promise<{ title: string, seasons: Array }>}
 */
export async function getDiziDetails(dramaUrl) {
  const resp = await fetch(dramaUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': BASE_URL
    }
  });

  if (!resp.ok) {
    throw new Error(`Dizi sayfası yüklenemedi (HTTP ${resp.status})`);
  }

  const html = await resp.text();

  // Extract page title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Dizi';

  // Pattern: href="https://dizikorea3.com/dizi/<slug>/sezon-<S>/bolum-<E>"
  const epRegex = /href="([^"]*\/dizi\/[^"]*\/sezon-(\d+)\/bolum-(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;
  const seasonsMap = new Map();

  let match;
  while ((match = epRegex.exec(html)) !== null) {
    const epUrl = match[1];
    const seasonNum = parseInt(match[2], 10);
    const epNum = parseInt(match[3], 10);
    const rawTitle = match[4].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');

    if (!seasonsMap.has(seasonNum)) {
      seasonsMap.set(seasonNum, []);
    }

    const list = seasonsMap.get(seasonNum);
    if (!list.some(e => e.episode === epNum)) {
      list.push({
        season: seasonNum,
        episode: epNum,
        name: `${epNum}. Bölüm`,
        title: rawTitle || `${epNum}. Bölüm`,
        url: epUrl
      });
    }
  }

  // If no season/episode pattern was matched, check if it's a single movie or direct player
  if (seasonsMap.size === 0) {
    return {
      title: pageTitle,
      isMovie: true,
      seasons: [
        {
          season: 1,
          season_number: 1,
          episodes: [
            {
              season: 1,
              episode: 1,
              name: 'Film',
              title: pageTitle,
              url: dramaUrl
            }
          ]
        }
      ]
    };
  }

  // Sort seasons and episodes
  const seasons = Array.from(seasonsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([num, eps]) => ({
      season: num,
      season_number: num,
      episodes: eps.sort((a, b) => a.episode - b.episode)
    }));

  return {
    title: pageTitle,
    isMovie: false,
    seasons
  };
}

/**
 * Extract 1080p stream URL for a DiziKorea episode
 * @param {string} episodeUrl
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, title: string, referer: string }>}
 */
export async function getDiziKoreaStream(episodeUrl) {
  // 1. Fast Direct Resolver (Bypasses browser for instant 1080p in ~1s)
  try {
    const resp = await fetch(episodeUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': BASE_URL
      }
    });

    if (resp.ok) {
      const html = await resp.text();
      const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'DiziKorea';

      const iframes = [...html.matchAll(/(?:data-src|src)=["'](https?:\/\/[^"']+)["']/gi)]
        .map(m => m[1])
        .filter(u => u.includes('playerdkorea') || u.includes('vidmoly') || u.includes('embed') || u.includes('video'));

      for (const iframeUrl of iframes) {
        // PlayerDKorea API
        if (iframeUrl.includes('playerdkorea.xyz/video/')) {
          const idMatch = iframeUrl.match(/video\/([a-zA-Z0-9]+)/);
          if (idMatch) {
            const id = idMatch[1];
            const postUrl = `https://playerdkorea.xyz/player/index.php?data=${id}&do=getVideo`;
            const postRes = await fetch(postUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': USER_AGENT,
                'Referer': iframeUrl
              },
              body: `hash=${id}&r=${encodeURIComponent(BASE_URL + '/')}`
            });

            if (postRes.ok) {
              const data = await postRes.json();
              const streamUrl = data.securedLink || data.videoSource;
              if (streamUrl) {
                return {
                  streamUrl,
                  isDirect: true,
                  title,
                  sourceName: 'DiziKorea (PlayerDKorea 1080p)',
                  referer: 'https://playerdkorea.xyz/'
                };
              }
            }
          }
        }

        // Vidmoly or other embed unpacker
        const extracted = await extractDirectVideo(iframeUrl, episodeUrl);
        if (extracted.success && extracted.streamUrl) {
          return {
            streamUrl: extracted.streamUrl,
            isDirect: true,
            title,
            sourceName: 'DiziKorea (Vidmoly 1080p)',
            referer: iframeUrl.includes('vidmoly') ? 'https://vidmoly.org/' : BASE_URL
          };
        }
      }
    }
  } catch (fastErr) {
    // Fall back to headless browser
  }

  // 2. Headless Browser Fallback
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

    const m3u8Urls = [];

    page.on('response', res => {
      const u = res.url();
      const status = res.status();
      if ((status === 200 || status === 206) && (u.includes('.m3u8') || u.includes('.mp4'))) {
        m3u8Urls.push(u);
      }
    });

    await page.goto(episodeUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    const pageTitle = await page.evaluate(() => {
      const h1 = document.querySelector('h1.page-title, h1');
      return h1 ? h1.innerText.trim() : document.title;
    });

    // 1. Click start button / overlay
    await page.evaluate(() => {
      const btn = document.querySelector('.player-start-btn, .player-start-overlay');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // 2. Try Vidmoly tab first for highest quality 1080p
    const vidmolyClicked = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.player-tab'));
      const vm = tabs.find(t => t.innerText.toLowerCase().includes('vidmoly'));
      if (vm) {
        vm.click();
        return true;
      }
      return false;
    });

    if (vidmolyClicked) {
      await new Promise(r => setTimeout(r, 2000));
      for (const frame of page.frames()) {
        if (frame.url().includes('vidmoly')) {
          await frame.evaluate(() => {
            const b = document.querySelector('.jw-display-icon-container, #player, video');
            if (b) b.click();
          }).catch(() => {});
        }
      }
    }

    // 3. Wait up to 10 seconds for m3u8 stream to be intercepted
    const startWait = Date.now();
    while (m3u8Urls.length === 0 && (Date.now() - startWait) < 10000) {
      await new Promise(r => setTimeout(r, 500));
    }

    // 4. If still empty, cycle through all available player tabs
    if (m3u8Urls.length === 0) {
      const tabCount = await page.evaluate(() => document.querySelectorAll('.player-tab').length);
      for (let i = 0; i < tabCount; i++) {
        await page.evaluate((idx) => {
          const tabs = document.querySelectorAll('.player-tab');
          if (tabs[idx]) tabs[idx].click();
        }, i);
        await new Promise(r => setTimeout(r, 2000));

        for (const frame of page.frames()) {
          await frame.evaluate(() => {
            const b = document.querySelector('.jw-display-icon-container, #player, video, button, .play');
            if (b) b.click();
          }).catch(() => {});
        }
        await new Promise(r => setTimeout(r, 2500));
        if (m3u8Urls.length > 0) break;
      }
    }

    let streamUrl = null;
    if (m3u8Urls.length > 0) {
      const master = m3u8Urls.find(u => u.includes('master'));
      streamUrl = master || m3u8Urls[0];
    }

    if (!streamUrl) {
      throw new Error('DiziKorea video akışı çözülemedi (Kaynaklar kapalı veya m3u8 yakalanamadı).');
    }

    const referer = streamUrl.includes('vmpx') || streamUrl.includes('vidmoly') ? 'https://vidmoly.org/' : (streamUrl.includes('playerdkorea') ? 'https://playerdkorea.xyz/' : BASE_URL);

    return {
      streamUrl,
      isDirect: true,
      title: pageTitle,
      captions: [],
      referer
    };
  } finally {
    await browser.close();
  }
}
