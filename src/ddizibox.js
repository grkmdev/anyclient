import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://ddizibox.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

let cachedCatalog = null;

function loadLocalCatalog() {
  if (cachedCatalog) return cachedCatalog;
  try {
    const p = path.join(__dirname, '..', 'data', 'dizibox-catalog.json');
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const data = JSON.parse(raw);
      cachedCatalog = Array.isArray(data.items) ? data.items : [];
      return cachedCatalog;
    }
  } catch {}
  cachedCatalog = [];
  return cachedCatalog;
}

/**
 * Search TV series and movies on DiziBOX (ddizibox.com)
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchDDiziBox(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const results = [];
  const seenUrls = new Set();

  // 1. Live search on ddizibox.com
  try {
    const searchUrl = `${BASE_URL}/ara?q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': `${BASE_URL}/`
      }
    });

    if (res.ok) {
      const html = await res.text();
      // Match cards: <a href="https://ddizibox.net/dizi/..." ...> or /dizi/...
      const cardRegex = /<a[^>]+href=["']((?:https:\/\/[^"']+\/)?(?:dizi|film)\/[a-z0-9-]+)["'][^>]*class=["'][^"']*group[^"']*["'][\s\S]*?<\/a>/gi;
      const matches = html.matchAll(cardRegex);

      for (const m of matches) {
        const fullCard = m[0];
        let linkUrl = m[1];
        if (linkUrl.startsWith('/')) linkUrl = `${BASE_URL}${linkUrl}`;
        // Normalize domain to ddizibox.com
        linkUrl = linkUrl.replace(/https:\/\/ddizibox\.(?:net|org|live)/, BASE_URL);

        if (seenUrls.has(linkUrl)) continue;
        seenUrls.add(linkUrl);

        const isFilm = linkUrl.includes('/film/');
        const titleMatch = fullCard.match(/<h3[^>]*>([^<]+)<\/h3>/i) || fullCard.match(/alt=["']([^"']+)["']/i);
        const title = titleMatch ? titleMatch[1].trim() : linkUrl.split('/').pop();

        const imgMatch = fullCard.match(/<img[^>]+src=["']([^"']+)["']/i);
        const poster = imgMatch ? imgMatch[1] : '';

        const yearMatch = fullCard.match(/<p[^>]*>(\d{4})<\/p>/i);
        const year = yearMatch ? yearMatch[1] : '';

        const ratingMatch = fullCard.match(/badge-rating["'][^>]*>[\s\S]*?(\d+\.\d+)/i);
        const rating = ratingMatch ? ratingMatch[1] : '';

        const descParts = [];
        if (year) descParts.push(year);
        if (rating) descParts.push(`★ ${rating}`);
        descParts.push(isFilm ? 'Film' : 'Dizi');

        results.push({
          id: linkUrl.split('/').pop(),
          title,
          slug: linkUrl.split('/').pop(),
          url: linkUrl,
          poster,
          description: descParts.join(' · '),
          year,
          imdb: rating,
          type: isFilm ? 'Film' : 'Dizi',
          isSeries: !isFilm,
          source: 'ddizibox'
        });
      }
    }
  } catch (err) {
    // live search error
  }

  // 2. Augment from pre-indexed local catalog
  try {
    const catalog = loadLocalCatalog();
    const lowerQ = trimmed.toLowerCase();
    for (const item of catalog) {
      if (item.title && item.title.toLowerCase().includes(lowerQ)) {
        let slug = (item.pageUrl || '').replace(/\/+$/, '').split('/').pop();
        let normalizedUrl = `${BASE_URL}/dizi/${slug}`;
        if (!seenUrls.has(normalizedUrl)) {
          seenUrls.add(normalizedUrl);
          results.push({
            id: slug,
            title: item.title,
            slug,
            url: normalizedUrl,
            poster: '',
            description: 'DiziBOX Katalog',
            type: 'Dizi',
            isSeries: true,
            source: 'ddizibox'
          });
          if (results.length >= 25) break;
        }
      }
    }
  } catch {}

  return results;
}

/**
 * Get series details, seasons, and episodes from DiziBox (ddizibox.com)
 * @param {string} seriesUrl
 * @returns {Promise<{ title: string, seasons: Array, description: string, imdb: string, year: string }>}
 */
export async function getDDiziBoxDetails(seriesUrl) {
  // Normalize URL
  let targetUrl = seriesUrl.replace(/https:\/\/ddizibox\.(?:net|org|live)/, BASE_URL);
  if (!targetUrl.startsWith('http')) targetUrl = `${BASE_URL}${targetUrl}`;

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': `${BASE_URL}/`
    }
  });

  if (!res.ok) {
    throw new Error(`DiziBOX sayfası açılamadı: HTTP ${res.status}`);
  }

  const html = await res.text();

  // Extract Title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Dizi';

  // Extract Description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                    html.match(/<div class=["'][^"']*synopsis[^"']*["']>([\s\S]*?)<\/div>/i);
  let description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  // Extract Rating and Year
  const ratingMatch = html.match(/badge-rating["'][^>]*>[\s\S]*?(\d+\.\d+)/i) || html.match(/(\d+\.\d+)\s*\/\s*10/);
  const imdb = ratingMatch ? ratingMatch[1] : '';

  const yearMatch = html.match(/>(\d{4})</);
  const year = yearMatch ? yearMatch[1] : '';

  // Extract available season numbers from season links: ?sezon=N#bolumler or data-season
  const seasonNumbers = new Set([1]);
  const sLinks = html.matchAll(/[?&]sezon=(\d+)/gi);
  for (const m of sLinks) {
    seasonNumbers.add(parseInt(m[1], 10));
  }

  // Parse episodes for season 1 from current page
  const epMap = new Map();

  function parseEpisodesFromHtml(content) {
    const epRegex = /href=["']((?:https:\/\/[^"']+\/)?dizi\/[a-z0-9-]+?\/sezon-(\d+)\/bolum-(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of content.matchAll(epRegex)) {
      const s = parseInt(m[2], 10);
      const e = parseInt(m[3], 10);
      const key = `S${s}E${e}`;
      if (!epMap.has(key)) {
        let epUrl = m[1];
        if (epUrl.startsWith('/')) epUrl = `${BASE_URL}${epUrl}`;
        epUrl = epUrl.replace(/https:\/\/ddizibox\.(?:net|org|live)/, BASE_URL);

        const rawText = m[4].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
        // If text contains episode title e.g. "Pilot Bölüm 1. Sezon 1. Bölüm"
        const cleanName = rawText ? rawText.replace(/\b\d+\.\s*Sezon\s*\d+\.\s*Bölüm\b/i, '').trim() : '';
        const displayName = cleanName ? `${s}. Sezon ${e}. Bölüm - ${cleanName}` : `${s}. Sezon ${e}. Bölüm`;

        epMap.set(key, {
          season: s,
          episode: e,
          url: epUrl,
          name: displayName
        });
      }
    }
  }

  parseEpisodesFromHtml(html);

  // If there are other seasons (2, 3, etc.), fetch them in parallel
  const otherSeasons = Array.from(seasonNumbers).filter(s => s > 1);
  if (otherSeasons.length > 0) {
    const cleanBase = targetUrl.split('?')[0].split('#')[0];
    const fetchPromises = otherSeasons.map(async (s) => {
      try {
        const sUrl = `${cleanBase}?sezon=${s}`;
        const sRes = await fetch(sUrl, {
          headers: { 'User-Agent': USER_AGENT, 'Referer': targetUrl }
        });
        if (sRes.ok) {
          const sHtml = await sRes.text();
          parseEpisodesFromHtml(sHtml);
        }
      } catch {}
    });
    await Promise.allSettled(fetchPromises);
  }

  // Group into seasons
  const seasonsMap = new Map();
  for (const ep of epMap.values()) {
    if (!seasonsMap.has(ep.season)) {
      seasonsMap.set(ep.season, { season: ep.season, episodes: [] });
    }
    seasonsMap.get(ep.season).episodes.push(ep);
  }

  const seasons = Array.from(seasonsMap.values())
    .sort((a, b) => a.season - b.season)
    .map(s => ({
      ...s,
      episodes: s.episodes.sort((a, b) => a.episode - b.episode)
    }));

  return {
    title,
    description,
    imdb,
    year,
    seasons
  };
}

/**
 * Extract streaming URL from DiziBOX episode via Pilavyer API (Instant 1080p HTTP)
 * @param {string} episodeUrl
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, subtitles?: Array, audios?: Array, referer?: string, embedUrl?: string, title?: string }>}
 */
export async function getDDiziBoxStream(episodeUrl) {
  let targetUrl = episodeUrl.replace(/https:\/\/ddizibox\.(?:net|org|live)/, BASE_URL);
  if (!targetUrl.startsWith('http')) targetUrl = `${BASE_URL}${targetUrl}`;

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': `${BASE_URL}/`
    }
  });

  if (!res.ok) {
    throw new Error(`DiziBOX bölüm sayfası açılamadı: HTTP ${res.status}`);
  }

  const html = await res.text();

  // Extract Pilavyer player
  const pvMatch = html.match(/data-pv=["']([a-zA-Z0-9_-]+)["']/i);
  const coreScriptMatch = html.match(/src=["'](https:\/\/[^"']*pilavyerplay[^"']*\/assets\/js\/(?:core|c)\.js)["']/i);

  if (pvMatch && coreScriptMatch) {
    const pvSlug = pvMatch[1];
    const scriptUrl = coreScriptMatch[1];
    const playerBase = scriptUrl.replace(/\/(?:e\/c|assets\/js\/core)\.js.*$/, '');
    const sUrl = `${playerBase}/assets/js/s.php?s=${encodeURIComponent(pvSlug)}`;

    const sRes = await fetch(sUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': targetUrl,
        'Origin': new URL(targetUrl).origin
      }
    });

    if (sRes.ok) {
      const sText = await sRes.text();
      const pMatch = sText.match(/window\.__PLAYER__\s*=\s*(\{[\s\S]*?\});/);
      if (pMatch) {
        try {
          const config = JSON.parse(pMatch[1]);
          if (config.stream) {
            const subtitles = (config.subs || [])
              .filter(s => Boolean(s.src))
              .map((s, idx) => ({
                id: s.lang || `sub-${idx}`,
                lang: s.lang === 'tr' ? 'tur' : s.lang || 'tur',
                label: s.label || s.lang || 'Türkçe',
                url: s.src
              }));

            return {
              streamUrl: config.stream,
              isDirect: true,
              subtitles,
              audios: config.audios || [],
              referer: `${playerBase}/`,
              title: targetUrl
            };
          }
        } catch {}
      }
    }
  }

  // Fallback: check iframes for web player
  const iframeMatch = html.match(/<iframe[^>]+src=["'](https:\/\/[^"']+)["']/i);
  if (iframeMatch) {
    return {
      streamUrl: iframeMatch[1],
      isDirect: false,
      embedUrl: iframeMatch[1],
      title: targetUrl
    };
  }

  return {
    streamUrl: targetUrl,
    isDirect: false,
    embedUrl: targetUrl,
    title: targetUrl
  };
}

// Backward compatibility aliases
export const searchDiziBox = searchDDiziBox;
export const getDiziBoxDetails = getDDiziBoxDetails;
export const getDiziBoxStream = getDDiziBoxStream;
