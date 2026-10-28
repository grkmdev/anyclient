const BASE_URL = 'https://www.hdfilmcehennemi.land';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function xorB64(cipher, key) {
  const c = Buffer.from(cipher, 'base64').toString('binary');
  const k = Buffer.from(key, 'base64').toString('binary');
  let out = '';
  for (let i = 0; i < c.length; i++) {
    out += String.fromCharCode(c.charCodeAt(i) ^ k.charCodeAt(i % k.length));
  }
  return out.split('|')[0];
}

export function generateXSp(sp) {
  const n = Math.floor(Date.now() / 1000);
  const r = Math.floor(2176782336 * Math.random()).toString(36);
  let hash = 2166136261;
  const str = `${sp}|${n}|${r}`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${n}.${r}.${hash.toString(16)}`;
}

/**
 * Search movies and TV series on HDFilmCehennemi (hdfilmcehennemi.land)
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchHdFilmLand(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const results = [];
  const seenUrls = new Set();

  try {
    const searchUrl = `${BASE_URL}/wp-json/stmovie/search/?keyword=${encodeURIComponent(trimmed)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': `${BASE_URL}/`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && !('error' in data)) {
        for (const item of Object.values(data)) {
          if (!item || !item.url || !item.title) continue;
          if (seenUrls.has(item.url)) continue;
          seenUrls.add(item.url);

          const isSeries = item.url.includes('/dizi/');
          const year = item.extra?.date || '';
          const imdb = item.extra?.imdb || '';
          const dil = item.extra?.sdil || '';

          const descParts = [];
          if (year) descParts.push(year);
          if (imdb) descParts.push(`★ ${imdb}`);
          if (dil) descParts.push(dil.replace(/&amp;/g, '&'));

          results.push({
            id: item.url.split('/').filter(Boolean).pop(),
            title: item.title,
            slug: item.url.split('/').filter(Boolean).pop(),
            url: item.url,
            poster: item.img || '',
            description: descParts.join(' · '),
            year,
            imdb,
            type: isSeries ? 'Dizi' : 'Film',
            isSeries,
            source: 'hdfilmland'
          });
        }
      }
    }
  } catch {}

  // Fallback: standard HTML search ?s=
  if (results.length === 0) {
    try {
      const sRes = await fetch(`${BASE_URL}/?s=${encodeURIComponent(trimmed)}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': `${BASE_URL}/`
        }
      });

      if (sRes.ok) {
        const html = await sRes.text();
        const linkRegex = /<a[^>]+href=["']((?:https:\/\/[^"']+\/)?(?:dizi|film)\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        for (const m of html.matchAll(linkRegex)) {
          let linkUrl = m[1];
          if (linkUrl.startsWith('/')) linkUrl = `${BASE_URL}${linkUrl}`;
          if (linkUrl.endsWith('/dizi/') || linkUrl.endsWith('/film/') || linkUrl.includes('/page/')) continue;
          if (seenUrls.has(linkUrl)) continue;
          seenUrls.add(linkUrl);

          const isSeries = linkUrl.includes('/dizi/');
          const text = m[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
          if (!text || text.length < 2) continue;

          results.push({
            id: linkUrl.split('/').filter(Boolean).pop(),
            title: text,
            slug: linkUrl.split('/').filter(Boolean).pop(),
            url: linkUrl,
            poster: '',
            description: isSeries ? 'Dizi · hdfilmcehennemi.land' : 'Film · hdfilmcehennemi.land',
            type: isSeries ? 'Dizi' : 'Film',
            isSeries,
            source: 'hdfilmland'
          });
        }
      }
    } catch {}
  }

  return results;
}

/**
 * Extract streaming URL from hdfilmcehennemi.land via SetPlay -> FastPlay API
 * @param {string} pageUrl
 * @param {'tr-dub'|'tr-sub'} preferredLang
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, audios?: Array, referer?: string, headers?: Object, title?: string, embedUrl?: string }>}
 */
export async function getHdFilmLandStream(pageUrl, preferredLang = 'tr-dub') {
  try {
    const pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${BASE_URL}/`
      }
    });

    if (!pageRes.ok) {
      throw new Error(`Sayfa açılamadı: HTTP ${pageRes.status}`);
    }

    const html = await pageRes.text();

    const nonceMatch = html.match(/nonce:\s*['"]([a-zA-Z0-9]+)['"]/);
    const postId = html.match(/data-post-id=["']([^"']+)["']/)?.[1];
    const playerName = html.match(/data-player-name=["']([^"']+)["']/)?.[1] || html.match(/data-player=["']([^"']+)["']/)?.[1];

    if (!nonceMatch || !postId || !playerName) {
      return {
        streamUrl: pageUrl,
        isDirect: false,
        embedUrl: pageUrl,
        title: pageUrl
      };
    }

    const partKeys = [...html.matchAll(/data-part-key=["']([^"']*)["']/g)].map(m => m[1]);
    let targetPartKey = partKeys[0] || '';
    if (preferredLang === 'tr-sub') {
      const subKey = partKeys.find(k => k.includes('altyazi'));
      if (subKey) targetPartKey = subKey;
    } else {
      const dubKey = partKeys.find(k => k.includes('dublaj'));
      if (dubKey) targetPartKey = dubKey;
    }

    const body = new URLSearchParams({
      action: 'get_video_url',
      nonce: nonceMatch[1],
      post_id: postId,
      player_name: playerName,
      part_key: targetPartKey
    }).toString();

    const ajaxRes = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': pageUrl,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body
    });

    if (!ajaxRes.ok) {
      throw new Error(`Player API çağrısı başarısız: HTTP ${ajaxRes.status}`);
    }

    const ajaxJson = await ajaxRes.json();
    const setPlayUrl = ajaxJson?.data?.url;

    if (!setPlayUrl) {
      return {
        streamUrl: pageUrl,
        isDirect: false,
        embedUrl: pageUrl,
        title: pageUrl
      };
    }

    // Fetch setplay page to get FastPlay URL
    const setPlayRes = await fetch(setPlayUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': pageUrl
      }
    });

    if (!setPlayRes.ok) {
      return { streamUrl: setPlayUrl, isDirect: false, embedUrl: setPlayUrl, title: pageUrl };
    }

    const setPlayHtml = await setPlayRes.text();
    const cerceveMatch = setPlayHtml.match(/SPG\.cerceve\s*\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/);

    if (!cerceveMatch) {
      return { streamUrl: setPlayUrl, isDirect: false, embedUrl: setPlayUrl, title: pageUrl };
    }

    const fastPlayUrl = xorB64(cerceveMatch[1], cerceveMatch[2]);

    // Fetch fastplay page to get manifest and SPG_A token
    const fpRes = await fetch(fastPlayUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': setPlayUrl
      }
    });

    if (!fpRes.ok) {
      return { streamUrl: fastPlayUrl, isDirect: false, embedUrl: fastPlayUrl, title: pageUrl };
    }

    const fpHtml = await fpRes.text();
    const streamMatch = fpHtml.match(/stream:\s*["']([^"']+)["']/);
    const spgMatch = fpHtml.match(/window\.SPG_A\s*=\s*({[^}]+})/);

    let rawSp = '';
    if (spgMatch) {
      try {
        const parsed = JSON.parse(spgMatch[1]);
        if (parsed.sp) rawSp = parsed.sp;
      } catch {}
    }

    if (streamMatch) {
      const manifestUrl = `https://fastplay.mom${streamMatch[1]}`;
      const headers = {
        'User-Agent': USER_AGENT,
        'Referer': fastPlayUrl,
        ...(rawSp ? { 'x-sp-key': rawSp, 'x-sp': generateXSp(rawSp) } : {})
      };

      return {
        streamUrl: manifestUrl,
        isDirect: true,
        referer: fastPlayUrl,
        headers,
        title: pageUrl
      };
    }

    return {
      streamUrl: fastPlayUrl,
      isDirect: false,
      embedUrl: fastPlayUrl,
      title: pageUrl
    };
  } catch (err) {
    return {
      streamUrl: pageUrl,
      isDirect: false,
      embedUrl: pageUrl,
      title: pageUrl
    };
  }
}
