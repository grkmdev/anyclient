import puppeteer from 'puppeteer-core';
import { findBrowserExecutable } from './hdfilm.js';
import { extractDirectVideo } from './extractor.js';

const BASE_URL = 'https://anizm.net';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Search anime on Anizm
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchAnizm(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const searchUrl = `${BASE_URL}/arama-onerileri?q=${encodeURIComponent(trimmed)}`;
  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': BASE_URL
    }
  });

  if (!resp.ok) {
    throw new Error(`Anizm arama servisi yanıt vermedi (HTTP ${resp.status})`);
  }

  const data = await resp.json();
  if (!data || !data.results || !Array.isArray(data.results)) {
    return [];
  }

  return data.results.map(item => {
    let url = item.url || '';
    if (url && !url.startsWith('http')) {
      url = `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    return {
      id: item.url ? item.url.replace(`${BASE_URL}/`, '') : item.title,
      title: item.title,
      year: item.year ? String(item.year) : '',
      url,
      source: 'anizm',
      type: 'Anime'
    };
  });
}

/**
 * Fetch anime details and all episodes from Anizm
 * @param {string} animeUrl
 * @returns {Promise<{ title: string, episodes: Array }>}
 */
export async function getAnizmDetails(animeUrl) {
  const resp = await fetch(animeUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': BASE_URL
    }
  });

  if (!resp.ok) {
    throw new Error(`Anime sayfası yüklenemedi (HTTP ${resp.status})`);
  }

  const html = await resp.text();

  // Extract page title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
  let pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Anime';
  pageTitle = pageTitle.replace(/\s+izle$/i, '').trim();

  // Extract episodes from data-episode-number and links
  const episodes = [];
  const seenUrls = new Set();

  // Primary: match data-episode-number elements (Series)
  const epTagRegex = /<a[^>]+href=["'](https:\/\/anizm\.net\/[^"']*-izle)["'][^>]*data-episode-number=["'](\d+)["'][^>]*data-episode-title=["']([^"']*)["'][^>]*>/gi;
  let match;
  while ((match = epTagRegex.exec(html)) !== null) {
    const epUrl = match[1];
    const epNum = parseInt(match[2], 10);
    const epTitle = match[3] || `${epNum}. Bölüm`;
    if (!seenUrls.has(epUrl)) {
      seenUrls.add(epUrl);
      episodes.push({
        season: 1,
        episode: epNum,
        name: `${epNum}. Bölüm`,
        title: epTitle,
        url: epUrl
      });
    }
  }

  // Fallback 1: match any *-bolum-izle
  if (episodes.length === 0) {
    const fallbackRegex = /href=["'](https:\/\/anizm\.net\/([^\/"']+-(\d+)-bolum-izle))["']/gi;
    while ((match = fallbackRegex.exec(html)) !== null) {
      const epUrl = match[1];
      const epNum = parseInt(match[3], 10);
      if (!seenUrls.has(epUrl)) {
        seenUrls.add(epUrl);
        episodes.push({
          season: 1,
          episode: epNum,
          name: `${epNum}. Bölüm`,
          title: `${epNum}. Bölüm`,
          url: epUrl
        });
      }
    }
  }

  // Fallback 2: Single Movie or OVA ending in -izle
  if (episodes.length === 0) {
    const movieRegex = /href=["'](https:\/\/anizm\.net\/[^\/"']*-izle)["']/gi;
    while ((match = movieRegex.exec(html)) !== null) {
      const epUrl = match[1];
      if (!seenUrls.has(epUrl) && epUrl !== animeUrl) {
        seenUrls.add(epUrl);
        episodes.push({
          season: 1,
          episode: 1,
          name: 'Film / Özel Bölüm',
          title: pageTitle,
          url: epUrl
        });
      }
    }
  }

  // Sort episodes by episode number ascending
  episodes.sort((a, b) => a.episode - b.episode);

  return {
    title: pageTitle,
    isMovie: episodes.length === 1 && episodes[0].name.includes('Film'),
    episodes,
    seasons: [
      {
        season: 1,
        season_number: 1,
        episodes
      }
    ]
  };
}

/**
 * Extract 1080p/720p stream URL for an Anizm episode
 * @param {string} episodeUrl
 * @param {string|null} preferredServer
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, title: string, resolution: string, sourceName: string, headers: Object }>}
 */
export async function getAnizmStream(episodeUrl, preferredServer = null) {
  const exePath = findBrowserExecutable();
  if (!exePath) {
    throw new Error('Chromium/Chrome tarayıcısı bulunamadı. Lütfen Chrome yüklü olduğundan emin olun.');
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

    await page.goto(episodeUrl, { waitUntil: 'networkidle2' });

    // Retrieve CSRF token and available sources from the page
    const sourcesData = await page.evaluate(async () => {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
      await new Promise(r => setTimeout(r, 600));
      const buttons = Array.from(document.querySelectorAll('#v3-source-options button, .v3-source-button, [data-video]'));
      return {
        csrf,
        buttons: buttons.map(b => ({
          name: b.textContent.trim(),
          video: b.dataset.video,
          url: b.dataset.url
        }))
      };
    });

    const sources = sourcesData?.buttons || [];
    if (sources.length === 0) {
      throw new Error('Bölüme ait video sunucusu bulunamadı.');
    }

    // Pick selected source
    let selected = null;
    if (preferredServer) {
      selected = sources.find(s => s.name.toLowerCase().includes(preferredServer.toLowerCase()));
    }

    if (!selected) {
      // Prioritize fast internal ad-free players
      selected = sources.find(s => s.name.toLowerCase().includes('aincrad')) ||
                 sources.find(s => s.name.toLowerCase().includes('sistenn')) ||
                 sources.find(s => s.name.toLowerCase().includes('beta player')) ||
                 sources.find(s => s.name.toLowerCase().includes('vidmoly')) ||
                 sources[0];
    }

    // Fetch video endpoint
    const videoData = await page.evaluate(async (url, csrf) => {
      const r = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': csrf || ''
        }
      });
      return await r.json();
    }, selected.url, sourcesData.csrf);

    if (!videoData?.url) {
      throw new Error(`Video adresi çözülemedi (${selected.name})`);
    }

    // Open player page to intercept master.txt or redirect
    const playerPage = await browser.newPage();
    await playerPage.setExtraHTTPHeaders({
      'Referer': episodeUrl
    });

    let masterTxtUrl = null;
    let redirectedUrl = null;

    playerPage.on('response', async res => {
      const u = res.url();
      if (u.includes('master.txt')) {
        masterTxtUrl = u;
      }
      if (u.includes('getVideo')) {
        try {
          const body = await res.json();
          if (body?.videoSource) {
            masterTxtUrl = body.videoSource;
          }
        } catch {}
      }
      if (res.status() >= 300 && res.status() < 400 && res.headers()['location']) {
        redirectedUrl = res.headers()['location'];
      }
    });

    await playerPage.goto(videoData.url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2200));

    // Case 1: Internal player with master.txt HLS stream
    if (masterTxtUrl) {
      const txtResp = await fetch(masterTxtUrl, {
        headers: {
          'Referer': 'https://anizmplayer.com/',
          'User-Agent': USER_AGENT
        }
      });
      const playlistText = await txtResp.text();

      const subStreams = [];
      const lines = playlistText.split('\n');
      let currentRes = 'Auto';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#EXT-X-STREAM-INF')) {
          const resMatch = trimmed.match(/NAME="([^"]+)"/) || trimmed.match(/RESOLUTION=(\d+x\d+)/);
          if (resMatch) currentRes = resMatch[1];
        } else if (trimmed.startsWith('/') || trimmed.startsWith('http')) {
          const fullUrl = trimmed.startsWith('/') ? `https://anizmplayer.com${trimmed}` : trimmed;
          subStreams.push({
            resolution: currentRes,
            url: fullUrl
          });
        }
      }

      // Pick highest quality stream: 1080p -> 720p -> 480p -> auto
      const stream = subStreams.find(s => s.resolution === '1080p') ||
                     subStreams.find(s => s.resolution === '720p') ||
                     subStreams[subStreams.length - 1] ||
                     { resolution: 'Auto', url: masterTxtUrl };

      return {
        streamUrl: stream.url,
        isDirect: true,
        resolution: stream.resolution,
        sourceName: selected.name,
        availableServers: sources.map(s => s.name),
        headers: {
          'Referer': 'https://anizmplayer.com/',
          'User-Agent': USER_AGENT
        }
      };
    }

    // Case 2: External provider embed (Vidmoly, Sibnet, etc.)
    const targetEmbed = redirectedUrl || playerPage.url();
    if (targetEmbed && !targetEmbed.includes('anizm.net')) {
      const extracted = await extractDirectVideo(targetEmbed, episodeUrl);
      if (extracted.success && extracted.streamUrl) {
        return {
          streamUrl: extracted.streamUrl,
          isDirect: true,
          resolution: '1080p',
          sourceName: selected.name,
          availableServers: sources.map(s => s.name),
          headers: {
            'Referer': targetEmbed,
            'User-Agent': USER_AGENT
          }
        };
      }

      return {
        streamUrl: targetEmbed,
        isDirect: false,
        embedUrl: targetEmbed,
        resolution: 'Embed',
        sourceName: selected.name,
        availableServers: sources.map(s => s.name),
        headers: {
          'Referer': episodeUrl,
          'User-Agent': USER_AGENT
        }
      };
    }

    throw new Error('Video oynatıcı akışı alınamadı.');
  } finally {
    await browser.close();
  }
}
