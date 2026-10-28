import { extractDirectVideo } from './extractor.js';

const BASE_URL = 'https://webdramaturkey2.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Search Korean, Chinese, BL and Asian dramas on WebDramaTurkey
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchWebDramaTurkey(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const searchUrl = `${BASE_URL}/arama?q=${encodeURIComponent(trimmed)}`;
  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': BASE_URL
    }
  });

  if (!resp.ok) {
    throw new Error(`WebDramaTurkey arama servisi yanıt vermedi (HTTP ${resp.status})`);
  }

  const html = await resp.text();

  // Pattern: match cards or links in search results
  // <a href="https://webdramaturkey2.com/dizi/<slug>" ...>
  const linkRegex = /href=["'](https:\/\/webdramaturkey2\.com\/(?:dizi|film)\/([^"']+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results = [];
  const seenUrls = new Set();

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const fullUrl = match[1];
    const slug = match[2];
    const inner = match[3];

    if (seenUrls.has(fullUrl)) continue;

    // Check if inner has title or poster
    const titleMatch = inner.match(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/i) ||
                       inner.match(/class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\//i) ||
                       inner.match(/alt=["']([^"']+)["']/i);

    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    if (!title && slug) {
      title = slug.replace(/-izle$/i, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    if (title && !seenUrls.has(fullUrl)) {
      seenUrls.add(fullUrl);
      const isMovie = fullUrl.includes('/film/');
      results.push({
        id: slug,
        title,
        url: fullUrl,
        type: isMovie ? 'Film' : 'Dizi',
        isMovie,
        source: 'webdramaturkey'
      });
    }
  }

  return results;
}

/**
 * Fetch series details, seasons, and episodes from WebDramaTurkey
 * @param {string} seriesUrl
 * @returns {Promise<{ title: string, isMovie: boolean, seasons: Array, episodes: Array }>}
 */
export async function getWebDramaTurkeyDetails(seriesUrl) {
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
  title = title.replace(/\s+izle$/i, '').trim();

  // Episodes regex: href="https://webdramaturkey2.com/dizi/<slug>/<season>-sezon/<ep>-bolum"
  const epRegex = /href=["'](https:\/\/webdramaturkey2\.com\/dizi\/[^"']+\/(\d+)-sezon\/(\d+)-bolum)["']/gi;
  const seasonsMap = new Map();
  const allEpisodes = [];
  const seenUrls = new Set();

  let match;
  while ((match = epRegex.exec(html)) !== null) {
    const epUrl = match[1];
    const sNum = parseInt(match[2], 10);
    const epNum = parseInt(match[3], 10);

    if (seenUrls.has(epUrl)) continue;
    seenUrls.add(epUrl);

    if (!seasonsMap.has(sNum)) {
      seasonsMap.set(sNum, []);
    }

    const epObj = {
      season: sNum,
      episode: epNum,
      name: `${epNum}. Bölüm`,
      title: `Sezon ${sNum} Bölüm ${epNum}`,
      url: epUrl
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
 * Extract stream URL for a WebDramaTurkey episode
 * @param {string} episodeUrl
 * @param {string|null} preferredServer
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, title: string, sourceName: string, headers: Object }>}
 */
export async function getWebDramaTurkeyStream(episodeUrl, preferredServer = null) {
  const resp = await fetch(episodeUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': BASE_URL
    }
  });

  if (!resp.ok) {
    throw new Error(`Bölüm sayfası yüklenemedi (HTTP ${resp.status})`);
  }

  const html = await resp.text();

  // Find server buttons: <button ... class="btn-service dropdown-source" data-embed="120224"><span class="name">WDT</span>
  const btnRegex = /<button[^>]*class=["'][^"']*dropdown-source[^"']*["'][^>]*data-embed=["'](\d+)["'][^>]*>([\s\S]*?)<\/button>/gi;
  const servers = [];

  let match;
  while ((match = btnRegex.exec(html)) !== null) {
    const embedId = match[1];
    const inner = match[2];
    const nameMatch = inner.match(/class=["']name["'][^>]*>([^<]+)<\//i);
    const langMatch = inner.match(/class=["']language["'][^>]*>([^<]+)<\//i);
    const name = nameMatch ? nameMatch[1].trim() : 'Sunucu';
    const language = langMatch ? langMatch[1].trim() : '';

    servers.push({
      id: embedId,
      name,
      language
    });
  }

  if (servers.length === 0) {
    // If no dropdown-source buttons found, check data-embed anywhere
    const genericEmbeds = [...html.matchAll(/data-embed=["'](\d+)["']/gi)].map(m => m[1]);
    for (const ge of genericEmbeds) {
      if (!servers.some(s => s.id === ge)) {
        servers.push({ id: ge, name: 'Sunucu', language: '' });
      }
    }
  }

  if (servers.length === 0) {
    throw new Error('Bölüme ait video sunucusu bulunamadı.');
  }

  // Prioritize fast 1080p servers: Vidmoly -> Moon -> WDT -> Abyss -> first
  let selectedServer = null;
  if (preferredServer) {
    selectedServer = servers.find(s => s.name.toLowerCase().includes(preferredServer.toLowerCase()));
  }

  if (!selectedServer) {
    selectedServer = servers.find(s => s.name.toLowerCase().includes('moly') || s.name.toLowerCase().includes('vidmoly')) ||
                     servers.find(s => s.name.toLowerCase().includes('wdt')) ||
                     servers.find(s => s.name.toLowerCase().includes('moon')) ||
                     servers.find(s => s.name.toLowerCase().includes('abyss')) ||
                     servers[0];
  }

  // Request embed HTML from /ajax/embed
  const embedResp = await fetch(`${BASE_URL}/ajax/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': USER_AGENT,
      'Referer': episodeUrl
    },
    body: `id=${encodeURIComponent(selectedServer.id)}`
  });

  if (!embedResp.ok) {
    throw new Error(`Video sunucusu yanıt vermedi (HTTP ${embedResp.status})`);
  }

  const embedHtml = await embedResp.text();

  // Extract iframe src
  const iframeMatch = embedHtml.match(/<iframe[^>]*src=["']([^"']*)["']/i);
  let iframeUrl = iframeMatch ? iframeMatch[1] : '';

  if (!iframeUrl) {
    // Check if response contains direct URL or video tag
    const directUrlMatch = embedHtml.match(/src=["'](https?:\/\/[^"']+)["']/i);
    iframeUrl = directUrlMatch ? directUrlMatch[1] : '';
  }

  if (!iframeUrl) {
    throw new Error(`Oynatıcı adresi alınamadı (${selectedServer.name})`);
  }

  // If iframe is video.php?hash=... from WDT, fetch video.php to get real player
  if (iframeUrl.includes('video.php')) {
    const vpResp = await fetch(iframeUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': episodeUrl
      }
    });
    if (vpResp.ok) {
      const vpHtml = await vpResp.text();
      const realFrame = vpHtml.match(/<iframe[^>]*src=["']([^"']*)["']/i);
      if (realFrame && realFrame[1]) {
        iframeUrl = realFrame[1];
      }
    }
  }

  // Unpack video stream from iframeUrl
  const extracted = await extractDirectVideo(iframeUrl, episodeUrl);

  if (extracted.success && extracted.streamUrl) {
    return {
      streamUrl: extracted.streamUrl,
      isDirect: true,
      title: `${selectedServer.name}`,
      sourceName: `WDT - ${selectedServer.name}`,
      availableServers: servers.map(s => s.name),
      headers: {
        'Referer': iframeUrl.includes('vidmoly') ? 'https://vidmoly.org/' : (iframeUrl.includes('dtpasn') ? 'https://webdramaturkey2.com/' : BASE_URL),
        'User-Agent': USER_AGENT
      }
    };
  }

  return {
    streamUrl: iframeUrl,
    isDirect: false,
    embedUrl: iframeUrl,
    title: `${selectedServer.name}`,
    sourceName: `WDT - ${selectedServer.name}`,
    availableServers: servers.map(s => s.name),
    headers: {
      'Referer': episodeUrl,
      'User-Agent': USER_AGENT
    }
  };
}
