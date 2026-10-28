import dns from 'node:dns';
import { extractDirectVideo } from './extractor.js';
import {
  searchOpenAni,
  getOpenAniDetails,
  getOpenAniEpisodeStream
} from './openani.js';

// Ensure IPv4 first to avoid IPv6 connection issues on Windows
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const BASE_URL = 'https://animecix.tv';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://animecix.tv/'
};

// Re-export OpenAni functions
export { searchOpenAni, getOpenAniDetails, getOpenAniEpisodeStream };

/**
 * Search anime by title on AnimeciX
 * @param {string} query 
 * @returns {Promise<Array>}
 */
export async function searchAnime(query) {
  const url = `${BASE_URL}/secure/search/${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Arama başarısız oldu (HTTP ${res.status})`);
  }
  const data = await res.json();
  const list = data.results || [];
  return list.map(item => ({
    ...item,
    source: 'animecix'
  }));
}

/**
 * Unified Search across OpenAnime and/or AnimeciX
 * @param {string} query 
 * @param {string} provider 'all' | 'openani' | 'animecix'
 * @returns {Promise<Array>}
 */
export async function searchAllAnime(query, provider = 'all') {
  if (provider === 'openani') {
    return await searchOpenAni(query);
  }
  if (provider === 'animecix') {
    return await searchAnime(query);
  }

  // Provider === 'all': search both concurrently
  const [openAniRes, animecixRes] = await Promise.allSettled([
    searchOpenAni(query),
    searchAnime(query)
  ]);

  const openAniList = openAniRes.status === 'fulfilled' ? openAniRes.value : [];
  const animecixList = animecixRes.status === 'fulfilled' ? animecixRes.value : [];

  return [...openAniList, ...animecixList];
}

/**
 * Get recent / latest uploaded episodes from AnimeciX
 * @param {number} page 
 * @returns {Promise<object>}
 */
export async function getRecentEpisodes(page = 1) {
  const url = `${BASE_URL}/secure/last-episodes?page=${page}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Son bölümler alınamadı (HTTP ${res.status})`);
  }
  const json = await res.json();
  const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
  return {
    episodes: list.map(e => ({ ...e, source: 'animecix' })),
    total: json.total || list.length,
    page: json.current_page || page,
    lastPage: json.last_page || 1
  };
}

/**
 * Get anime seasons & full episode listing (Unified)
 * @param {object|string|number} anime 
 * @returns {Promise<object>}
 */
export async function getAnimeDetailsUnified(anime) {
  const isObject = typeof anime === 'object' && anime !== null;
  const source = isObject ? (anime.source || 'animecix') : 'animecix';
  const idOrSlug = isObject ? (anime.slug || anime.id) : anime;

  if (source === 'openani') {
    return await getOpenAniDetails(idOrSlug);
  }

  const url = `${BASE_URL}/secure/batch-download/${idOrSlug}/episodes`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Anime detayları alınamadı (HTTP ${res.status})`);
  }
  const data = await res.json();
  return {
    title: { ...(data.title || {}), source: 'animecix' },
    seasons: data.seasons || []
  };
}

// Backward-compatible alias
export const getAnimeDetails = getAnimeDetailsUnified;

/**
 * Get available video sources / fansubs for a specific episode (Unified)
 * @param {object} anime 
 * @param {number} season 
 * @param {number} episode 
 * @returns {Promise<Array>}
 */
export async function getEpisodeVideosUnified(anime, season, episode) {
  const isObject = typeof anime === 'object' && anime !== null;
  const source = isObject ? (anime.source || 'animecix') : 'animecix';
  const idOrSlug = isObject ? (anime.slug || anime.id) : anime;

  if (source === 'openani') {
    // OpenAnime has its own high speed CDN directly per episode
    return [
      {
        name: 'OpenAnime CDN (Doğrudan MP4)',
        extra: 'Türkçe Altyazılı 1080p/720p',
        source: 'openani',
        slug: idOrSlug,
        season,
        episode,
        url: `https://openani.me/anime/${idOrSlug}/${season}/${episode}`
      }
    ];
  }

  const url = `${BASE_URL}/secure/episode-videos?titleId=${idOrSlug}&season=${season}&episode=${episode}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Bölüm videoları alınamadı (HTTP ${res.status})`);
  }
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(v => ({ ...v, source: 'animecix' }));
}

// Backward-compatible alias
export const getEpisodeVideos = getEpisodeVideosUnified;

/**
 * Extract direct streaming URLs and qualities from a video source object (Unified)
 * @param {object} video 
 * @returns {Promise<object>}
 */
export async function extractStreamUnified(video) {
  // If video is from OpenAnime, extract via openani resolver
  if (video.source === 'openani') {
    return await getOpenAniEpisodeStream(video.slug, video.season, video.episode);
  }

  const embedUrl = video.url;
  const serverName = video.name || 'Bilinmeyen Sunucu';
  const extraInfo = video.extra || '';

  // 1. Tau Video direct MP4 extraction
  if (embedUrl && embedUrl.includes('tau-video.xyz')) {
    const idMatch = embedUrl.match(/embed\/([a-zA-Z0-9_\-]+)/);
    if (idMatch) {
      const videoId = idMatch[1];
      try {
        const apiUrl = `https://tau-video.xyz/api/video/${videoId}`;
        const res = await fetch(apiUrl, {
          headers: {
            ...HEADERS,
            'Referer': 'https://animecix.tv/'
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.urls && Array.isArray(json.urls) && json.urls.length > 0) {
            return {
              isDirect: true,
              type: 'mp4',
              server: serverName,
              extra: extraInfo,
              captions: video.captions || [],
              qualities: json.urls.map(u => ({
                label: u.label,
                url: u.url,
                size: u.size
              })),
              embedUrl: embedUrl
            };
          }
        }
      } catch (err) {
        console.error('Tau Video extract error:', err.message);
      }
    }
  }

  // 2. Universal extraction for other servers (Vidmoly, Sibnet, Direct HTML5, etc.)
  if (embedUrl) {
    try {
      const directRes = await extractDirectVideo(embedUrl, 'https://animecix.tv/');
      if (directRes.success && directRes.streamUrl) {
        return {
          isDirect: true,
          type: directRes.type,
          server: serverName,
          extra: extraInfo,
          captions: video.captions || [],
          qualities: [{ label: 'Doğrudan Akış (HD)', url: directRes.streamUrl }],
          embedUrl: embedUrl
        };
      }
    } catch {}
  }

  // 3. Fallback: Embed or raw video link
  return {
    isDirect: false,
    type: 'embed',
    server: serverName,
    extra: extraInfo,
    captions: video.captions || [],
    qualities: [{ label: 'Embed Web', url: embedUrl }],
    embedUrl: embedUrl
  };
}

// Backward-compatible alias
export const extractStream = extractStreamUnified;

