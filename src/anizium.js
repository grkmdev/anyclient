const BASE_URL = 'https://api.anizium.co';
const SITE_ORIGIN = 'https://anizium.co';
const TOKEN_KEY = 'hlxjl1c2w281ax473rt1ofgrvhyjvi';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function getIstanbulDay() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 6e4;
  const istDate = new Date(utc + 36e5 * 3);
  return days[istDate.getDay()];
}

function xorEncryptHex(text, key) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    const hex = code.toString(16);
    out += hex.length < 2 ? '0' + hex : hex;
  }
  return out;
}

function generateCfControl() {
  const weekday = getIstanbulDay();
  const key = TOKEN_KEY + '_' + weekday;
  const randomKey = Math.random().toString(36).substring(2, 8);
  const payload = {};
  payload[randomKey] = Date.now();
  return xorEncryptHex(JSON.stringify(payload), key);
}

async function aniziumFetch(endpoint, params = {}) {
  let url = `${BASE_URL}${endpoint}`;
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      searchParams.append(k, String(v));
    }
  }
  const queryString = searchParams.toString();
  if (queryString) {
    url += (url.includes('?') ? '&' : '?') + queryString;
  }

  const headers = {
    'User-Agent': USER_AGENT,
    'Origin': SITE_ORIGIN,
    'Referer': `${SITE_ORIGIN}/`,
    'Accept': 'application/json, text/plain, */*',
    'Cf-Control': generateCfControl(),
    'device': 'browser',
    'language': 'tr',
    'site': 'main'
  };

  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Search anime on Anizium (4K UHD & 1080p)
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchAnizium(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  try {
    const data = await aniziumFetch('/page/search', { value: trimmed, page: 1 });
    const items = data?.page?.data;
    if (!Array.isArray(items)) return [];

    return items.map(item => {
      const isMovie = item.type === 'movie';
      const imdb = item.imdb_point ? String(item.imdb_point) : '';
      const quality = item.quality ? item.quality.toUpperCase() : '4K';

      const descParts = [];
      if (quality) descParts.push(quality);
      if (imdb) descParts.push(`★${imdb}`);
      if (item.overview_short) descParts.push(item.overview_short);

      return {
        id: String(item.ID),
        title: item.name,
        name: item.name,
        poster: item.poster || item.details_banner || item.banner || '',
        banner: item.banner || '',
        description: descParts.join(' · '),
        imdb,
        quality,
        type: isMovie ? 'Film' : 'Anime',
        isSeries: !isMovie,
        source: 'anizium'
      };
    });
  } catch (err) {
    return [];
  }
}

/**
 * Get anime details, seasons, and episodes from Anizium
 * @param {string|number} animeId
 * @returns {Promise<{ title: string, description: string, poster: string, imdb: string, seasons: Array }>}
 */
export async function getAniziumDetails(animeId) {
  const data = await aniziumFetch('/anime/get', { id: animeId });
  if (!data?.success || !data.data) {
    throw new Error('Anizium anime detayları alınamadı.');
  }

  const d = data.data;
  const isMovie = d.type === 'movie';
  const seasonsMap = new Map();

  if (!isMovie && Array.isArray(d.seasons) && d.seasons.length > 0) {
    for (const s of d.seasons) {
      const sNum = parseInt(s.number, 10) || 1;
      const eps = Array.isArray(s.episodes) ? s.episodes : [];
      const episodeList = eps.map((ep, idx) => {
        const eNum = parseInt(ep.number, 10) || (idx + 1);
        const epName = ep.name ? `${sNum}. Sezon ${eNum}. Bölüm - ${ep.name}` : `${sNum}. Sezon ${eNum}. Bölüm`;
        return {
          season: sNum,
          episode: eNum,
          name: epName,
          animeId: String(d.ID),
          id: `${d.ID}:${sNum}:${eNum}`,
          url: `https://anizium.co/anime/${d.ID}/sezon/${sNum}/bolum/${eNum}`
        };
      });

      seasonsMap.set(sNum, {
        season: sNum,
        name: s.name || `${sNum}. Sezon`,
        episodes: episodeList.sort((a, b) => a.episode - b.episode)
      });
    }
  } else {
    // Single episode / movie
    seasonsMap.set(1, {
      season: 1,
      name: 'Film / Bölüm',
      episodes: [
        {
          season: 1,
          episode: 1,
          name: d.name || 'Film',
          animeId: String(d.ID),
          id: `${d.ID}:1:1`,
          url: `https://anizium.co/anime/${d.ID}`
        }
      ]
    });
  }

  const seasons = Array.from(seasonsMap.values()).sort((a, b) => a.season - b.season);

  return {
    title: d.name || 'Anime',
    description: d.overview || '',
    poster: d.poster || d.details_banner || d.banner || '',
    imdb: d.imdb_point ? String(d.imdb_point) : '',
    seasons
  };
}

/**
 * Get direct video stream from Anizium
 * @param {string|number} animeId
 * @param {number} season
 * @param {number} episode
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, quality: string, subtitles: Array, allStreams: Array, referer: string }>}
 */
export async function getAniziumStream(animeId, season = 1, episode = 1) {
  const data = await aniziumFetch('/anime/source', {
    id: animeId,
    site: 'main',
    server: '1',
    season,
    episode
  });

  if (!data?.success || !Array.isArray(data.groups) || data.groups.length === 0) {
    throw new Error('Anizium video kaynağı bulunamadı.');
  }

  const subtitles = (data.subtitles || [])
    .filter(s => Boolean(s.link))
    .map((s, idx) => ({
      id: `sub_${idx + 1}`,
      url: s.link,
      lang: /türkçe|tr/i.test(s.name || s.group || '') ? 'tur' : 'eng',
      label: s.name || 'Türkçe',
      title: s.name || 'Türkçe'
    }));

  const allStreams = [];

  for (const group of data.groups) {
    const isDub = group.group === 'trdub';
    const isOriginal = group.group === 'original';
    const groupLabel = isDub ? 'Türkçe Dublaj' : isOriginal ? 'Japonca [TR Altyazılı]' : (group.name || 'Orijinal');

    const items = Array.isArray(group.items) ? group.items : [];
    items.sort((a, b) => (parseInt(b.quality, 10) || 0) - (parseInt(a.quality, 10) || 0));

    for (const it of items) {
      if (!it.link) continue;
      const q = parseInt(it.quality, 10);
      const qLabel = q === 2160 ? '4K UHD' : q === 1440 ? '2K QHD' : q ? `${q}p` : '1080p';

      allStreams.push({
        url: it.link,
        quality: qLabel,
        group: groupLabel,
        format: it.type || 'mp4',
        label: `${groupLabel} [${qLabel}]`
      });
    }
  }

  if (allStreams.length === 0) {
    throw new Error('Anizium üzerinde oynatılabilir video akışı bulunamadı.');
  }

  const bestStream = allStreams[0];

  return {
    streamUrl: bestStream.url,
    isDirect: true,
    quality: bestStream.quality,
    subtitles,
    allStreams,
    referer: `${SITE_ORIGIN}/`
  };
}
