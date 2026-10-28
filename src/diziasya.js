import puppeteer from 'puppeteer-core';
import { findBrowserExecutable } from './hdfilm.js';
import { extractDirectVideo } from './extractor.js';

const BASE_URL = 'https://diziasya.com';
const API_BASE = 'https://api.diziasya.com/v2';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Search Korean, Chinese, and Asian dramas on DiziAsya via their official API
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchDiziAsya(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const searchUrl = `${API_BASE}/contents/content-by-type?search=${encodeURIComponent(trimmed)}&page=1&take=24`;
  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/`
    }
  });

  if (!resp.ok) {
    throw new Error(`DiziAsya arama servisi yanıt vermedi (HTTP ${resp.status})`);
  }

  const data = await resp.json();
  const items = data?.data || [];

  return items.map(item => {
    const isMovie = item.type === 'MOVIE';
    const slug = item.slug || item.id;
    const url = `${BASE_URL}/${isMovie ? 'film' : 'dizi'}/${slug}`;

    return {
      id: item.id,
      title: item.title,
      originalTitle: item.original_title || '',
      slug,
      url,
      year: item.publish_year ? String(item.publish_year) : '',
      rate: item.rate ? String(item.rate) : '',
      type: isMovie ? 'Film' : 'Dizi',
      isMovie,
      country: item.country?.country?.name || '',
      poster: item.cover_image || item.thumb_image || '',
      source: 'diziasya'
    };
  });
}

/**
 * Fetch series details, seasons, and episodes from DiziAsya
 * @param {string} seriesUrl
 * @returns {Promise<{ title: string, isMovie: boolean, seasons: Array, episodes: Array }>}
 */
export async function getDiziAsyaDetails(seriesUrl) {
  const resp = await fetch(seriesUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': BASE_URL
    }
  });

  if (!resp.ok) {
    throw new Error(`Dizi sayfası yüklenemedi (HTTP ${resp.status})`);
  }

  const html = await resp.text();

  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Dizi';
  title = title.replace(/\s+izle$/i, '').replace(/\s*—\s*Diziasya$/i, '').trim();

  // Pattern: href="/dizi/<slug>/sezon-<S>-bolum-<E>"
  const epRegex = /href=["'](\/dizi\/[^"']+\/sezon-(\d+)-bolum-(\d+))["']/gi;
  const seasonsMap = new Map();
  const allEpisodes = [];
  const seenUrls = new Set();

  let match;
  while ((match = epRegex.exec(html)) !== null) {
    const path = match[1];
    const fullEpUrl = `${BASE_URL}${path}`;
    const sNum = parseInt(match[2], 10);
    const epNum = parseInt(match[3], 10);

    if (seenUrls.has(fullEpUrl)) continue;
    seenUrls.add(fullEpUrl);

    if (!seasonsMap.has(sNum)) {
      seasonsMap.set(sNum, []);
    }

    const epObj = {
      season: sNum,
      episode: epNum,
      name: `${epNum}. Bölüm`,
      title: `Sezon ${sNum} Bölüm ${epNum}`,
      url: fullEpUrl
    };

    seasonsMap.get(sNum).push(epObj);
    allEpisodes.push(epObj);
  }

  // Sort episodes by season and episode ascending
  allEpisodes.sort((a, b) => a.season === b.season ? a.episode - b.episode : a.season - b.season);

  const seasons = Array.from(seasonsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([sNum, eps]) => ({
      season: sNum,
      season_number: sNum,
      episodes: eps.sort((a, b) => a.episode - b.episode)
    }));

  const isMovie = allEpisodes.length === 0 || seriesUrl.includes('/film/');

  if (isMovie && allEpisodes.length === 0) {
    const movieEp = {
      season: 1,
      episode: 1,
      name: 'Film',
      title,
      url: seriesUrl
    };
    allEpisodes.push(movieEp);
    seasons.push({ season: 1, season_number: 1, episodes: [movieEp] });
  }

  return {
    title,
    isMovie,
    episodes: allEpisodes,
    seasons
  };
}

/**
 * Extract 1080p stream URL for a DiziAsya episode
 * @param {string} episodeUrl
 * @param {string|null} preferredServer
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, title: string, sourceName: string, headers: Object }>}
 */
export async function getDiziAsyaStream(episodeUrl, preferredServer = null) {
  const exePath = findBrowserExecutable();
  if (!exePath) {
    throw new Error('Sistemde Microsoft Edge veya Google Chrome bulunamadı.');
  }

  const browser = await puppeteer.launch({
    executablePath: exePath,
    headless: 'new',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--window-size=1280,800',
      `--user-agent=${USER_AGENT}`
    ]
  });

  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto(episodeUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    // 1. Activate player if big play button exists
    await page.evaluate(() => {
      const playBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.className.includes('aspect-video') || (b.innerText && b.innerText.includes('Bölüm'))
      );
      if (playBtn) playBtn.click();
    });

    await new Promise(r => setTimeout(r, 1200));

    // 2. Discover available server buttons
    const serverButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const known = ['Vidmoly', 'Diziasya2', 'OKRU', 'Abyss', 'EV', 'P2P', 'ABStr', 'LULU'];
      return btns
        .filter(b => known.some(k => b.innerText.trim().toLowerCase() === k.toLowerCase()))
        .map(b => b.innerText.trim());
    });

    // 3. Choose server: user preference -> Vidmoly -> OKRU -> Diziasya2 -> first
    let targetServer = null;
    if (preferredServer) {
      targetServer = serverButtons.find(s => s.toLowerCase().includes(preferredServer.toLowerCase()));
    }

    if (!targetServer) {
      targetServer = serverButtons.find(s => s.toLowerCase() === 'vidmoly') ||
                     serverButtons.find(s => s.toLowerCase() === 'okru') ||
                     serverButtons.find(s => s.toLowerCase() === 'diziasya2') ||
                     serverButtons[0];
    }

    if (targetServer) {
      await page.evaluate((srvName) => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.innerText.trim().toLowerCase() === srvName.toLowerCase());
        if (target) target.click();
      }, targetServer);

      await new Promise(r => setTimeout(r, 1500));
    }

    // 4. Retrieve iframe src
    const iframeSrc = await page.evaluate(() => {
      const frame = document.querySelector('iframe');
      return frame ? (frame.src || frame.dataset?.src || '') : '';
    });

    if (!iframeSrc) {
      throw new Error('Video oynatıcı adresi yüklenemedi (Bölüm henüz eklenmemiş olabilir).');
    }

    // 5. Extract direct video from iframe (e.g. Vidmoly master.m3u8 or OKRU mp4)
    const extracted = await extractDirectVideo(iframeSrc, episodeUrl);

    if (extracted.success && extracted.streamUrl) {
      return {
        streamUrl: extracted.streamUrl,
        isDirect: true,
        title: targetServer || 'DiziAsya',
        sourceName: `DiziAsya - ${targetServer || 'Player'}`,
        availableServers: serverButtons,
        headers: {
          'Referer': iframeSrc.includes('vidmoly') ? 'https://vidmoly.org/' : (iframeSrc.includes('ok.ru') ? 'https://ok.ru/' : BASE_URL),
          'User-Agent': USER_AGENT
        }
      };
    }

    return {
      streamUrl: iframeSrc,
      isDirect: false,
      embedUrl: iframeSrc,
      title: targetServer || 'DiziAsya',
      sourceName: `DiziAsya - ${targetServer || 'Player'}`,
      availableServers: serverButtons,
      headers: {
        'Referer': episodeUrl,
        'User-Agent': USER_AGENT
      }
    };
  } finally {
    await browser.close();
  }
}
