import dns from 'node:dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Client-Protocol-Model': 'RCSA-14402/05',
  'Origin': 'https://openani.me',
  'Referer': 'https://openani.me/'
};

/**
 * Search anime on OpenAnime (openani.me)
 * @param {string} query 
 * @returns {Promise<Array>}
 */
export async function searchOpenAni(query) {
  const url = `https://api.openani.me/anime/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map(item => ({
      id: item.slug,
      slug: item.slug,
      name: item.turkish || item.english || item.romaji,
      name_english: item.english,
      name_romanji: item.romaji,
      poster: item.pictures?.banner || item.pictures?.avatar || '',
      type: item.type,
      source: 'openani'
    }));
  } catch (err) {
    console.error('OpenAni search error:', err.message);
    return [];
  }
}

/**
 * Get anime details & season listing from OpenAnime
 * @param {string} slug 
 * @returns {Promise<object>}
 */
export async function getOpenAniDetails(slug) {
  const url = `https://api.openani.me/anime/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`OpenAni anime detayları alınamadı (HTTP ${res.status})`);
  }
  const data = await res.json();

  const seasons = (data.seasons || [])
    .filter(s => (s.episode_count || s.episodeCount) > 0)
    .map(s => {
      const count = s.episode_count || s.episodeCount || 1;
      const sNum = s.season_number ?? s.seasonNumber ?? 1;
      const epList = [];
      for (let i = 1; i <= count; i++) {
        epList.push({
          episode: i,
          number: i,
          name: `Bölüm ${i}`,
          slug: slug,
          season: sNum
        });
      }
      return {
        season_number: sNum,
        season: sNum,
        name: s.name || `Sezon ${sNum}`,
        episodes: epList
      };
    });

  return {
    title: {
      id: slug,
      slug: slug,
      name: data.turkish || data.english || data.romaji,
      name_romanji: data.romaji,
      name_english: data.english,
      poster: data.pictures?.banner || data.pictures?.avatar,
      description: data.summary || '',
      year: data.firstAirDate ? new Date(data.firstAirDate).getFullYear() : null,
      score: data.malRating || data.tmdbScore,
      genres: (data.genres || []).map(g => ({ name: g, display_name: g }))
    },
    seasons
  };
}

/**
 * Get direct video stream from OpenAnime episode
 * @param {string} slug 
 * @param {number} season 
 * @param {number} episode 
 * @returns {Promise<object>}
 */
export async function getOpenAniEpisodeStream(slug, season = 1, episode = 1) {
  const url = `https://openani.me/anime/${encodeURIComponent(slug)}/${season}/${episode}/__data.json`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`OpenAni bölüm akışı alınamadı (HTTP ${res.status})`);
  }

  const text = await res.text();
  const firstLine = text.split('\n')[0];
  const json = JSON.parse(firstLine);

  // Discover random_cdn_host from SvelteKit node data
  let cdnHost = 'https://de2---vn-t9g4tsan-5qcl.yeshi.eu.org';
  for (const n of json.nodes || []) {
    if (n?.data) {
      const match = n.data.find(x => typeof x === 'string' && (x.includes('yeshi.eu.org') || x.includes('zyapbot.eu.org')));
      if (match) {
        cdnHost = match.replace(/\/+$/, '').replace(/\/animes\/?$/, '').replace(/\/+$/, '');
        break;
      }
    }
  }

  // Parse available files from node 1
  const data = json.nodes?.[1]?.data || [];
  const qualities = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (typeof item === 'object' && item !== null && item.resolution && item.file) {
      const resVal = data[item.resolution];
      const fileName = data[item.file];
      if (typeof fileName === 'string' && fileName.includes('.mp4')) {
        const cleanHost = cdnHost.replace(/\/+$/, '').replace(/\/animes\/?$/, '').replace(/\/+$/, '');
        const fullUrl = `${cleanHost}/animes/${slug}/${season}/${fileName}`;
        qualities.push({
          label: `${resVal}p`,
          filename: fileName,
          url: fullUrl,
          size: item.size ? data[item.size] : 0
        });
      }
    }
  }

  // Sort highest resolution first
  qualities.sort((a, b) => parseInt(b.label, 10) - parseInt(a.label, 10));

  if (qualities.length === 0) {
    throw new Error('Bu bölüm için video dosyası bulunamadı.');
  }

  return {
    isDirect: true,
    type: 'mp4',
    server: 'OpenAnime CDN',
    extra: 'OpenAnime Türkçe Fansub',
    captions: [],
    qualities,
    url: qualities[0].url,
    embedUrl: qualities[0].url
  };
}
