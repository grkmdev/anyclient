import { findBrowserExecutable } from './hdfilm.js';

const BASE_URL = 'https://filmmakinesi.co';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/**
 * Search movies on Film Makinesi (filmmakinesi.co)
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchFilmMakinesi(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const results = [];
  const seenUrls = new Set();

  try {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(trimmed)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': `${BASE_URL}/`
      }
    });

    if (res.ok) {
      const html = await res.text();
      // Match posters section
      const posterRegex = /<a[^>]+href=["'](https:\/\/filmmakinesi\.co\/(?!yil|kategori|film-arsivi|film-robotu|page)[^"']+\/)["'][^>]*title=["']([^"']+)["'][^>]*class=["'][^"']*poster[^"']*["'][\s\S]*?<\/a>/gi;

      for (const m of html.matchAll(posterRegex)) {
        const fullCard = m[0];
        const linkUrl = m[1];
        if (seenUrls.has(linkUrl)) continue;
        seenUrls.add(linkUrl);

        const title = m[2].replace(/<[^>]+>/g, '').trim();

        const imgMatch = fullCard.match(/<img[^>]+src=["']([^"']+)["']/i);
        const poster = imgMatch ? imgMatch[1] : '';

        const yearMatch = fullCard.match(/<span>(\d{4})<\/span>/i);
        const year = yearMatch ? yearMatch[1] : '';

        const imdbMatch = fullCard.match(/class=["']imdb["'][^>]*>[\s\S]*?(\d+\.\d+)/i);
        const imdb = imdbMatch ? imdbMatch[1] : '';

        const langMatch = fullCard.match(/class=["']poster-lang["'][^>]*>[\s\S]*?<span>([^<]+)<\/span>/i);
        const lang = langMatch ? langMatch[1].trim() : '';

        const descParts = [];
        if (year) descParts.push(year);
        if (imdb) descParts.push(`★ ${imdb}`);
        if (lang) descParts.push(lang);

        results.push({
          id: linkUrl.split('/').filter(Boolean).pop(),
          title,
          slug: linkUrl.split('/').filter(Boolean).pop(),
          url: linkUrl,
          poster,
          description: descParts.join(' · '),
          year,
          imdb,
          type: 'Film',
          isSeries: false,
          source: 'filmmakinesi'
        });
      }
    }
  } catch (err) {
    // live search error
  }

  // Fallback: If 0 results found on .co, try searching via puppeteer on filmmakinesi.to (has older catalog)
  if (results.length === 0) {
    try {
      const exePath = findBrowserExecutable();
      if (exePath) {
        const puppeteer = (await import('puppeteer-core')).default;
        const browser = await puppeteer.launch({
          executablePath: exePath,
          headless: 'new',
          args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
        });
        try {
          const page = await browser.newPage();
          await page.setUserAgent(USER_AGENT);
          await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          });
          await page.goto(`https://filmmakinesi.to/arama/?s=${encodeURIComponent(trimmed)}`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          });

          const items = await page.evaluate(() => {
            const list = [];
            document.querySelectorAll('a').forEach(a => {
              if (a.href.includes('/film/') && !a.href.includes('/arama/')) {
                const text = a.innerText.trim();
                const titleMatch = text.match(/(?:Matrix|[\w\sğüşıöçĞÜŞİÖÇ]+)\s*\d*(?:\s*Resurrections|\s*Reloaded|\s*Revolutions)?/i);
                list.push({
                  url: a.href,
                  rawText: text
                });
              }
            });
            return list;
          });

          for (const it of items) {
            if (!seenUrls.has(it.url)) {
              seenUrls.add(it.url);
              const cleanTitle = it.rawText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
              const yearMatch = cleanTitle.match(/\b(19\d{2}|20\d{2})\b/);
              const year = yearMatch ? yearMatch[1] : '';
              const imdbMatch = cleanTitle.match(/\b(\d\.\d)\b/);
              const imdb = imdbMatch ? imdbMatch[1] : '';

              results.push({
                id: it.url.split('/').filter(Boolean).pop(),
                title: cleanTitle || it.url.split('/').filter(Boolean).pop(),
                slug: it.url.split('/').filter(Boolean).pop(),
                url: it.url,
                poster: '',
                description: `${year ? year + ' · ' : ''}${imdb ? '★ ' + imdb + ' · ' : ''}Film Makinesi`,
                year,
                imdb,
                type: 'Film',
                isSeries: false,
                source: 'filmmakinesi'
              });
            }
          }
        } finally {
          await browser.close().catch(() => {});
        }
      }
    } catch {}
  }

  return results;
}

/**
 * Get movie details from Film Makinesi
 * @param {string} movieUrl
 * @returns {Promise<{ title: string, description: string, imdb: string, year: string, poster: string }>}
 */
export async function getFilmMakinesiDetails(movieUrl) {
  const res = await fetch(movieUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': `${BASE_URL}/`
    }
  });

  if (!res.ok) {
    throw new Error(`Film Makinesi sayfası açılamadı: HTTP ${res.status}`);
  }

  const html = await res.text();

  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Film';

  const descMatch = html.match(/<div class=["'][^"']*film-synopsis[^"']*["']>([\s\S]*?)<\/div>/i) ||
                    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  const imdbMatch = html.match(/class=["']imdb["'][^>]*>[\s\S]*?(\d+\.\d+)/i) || html.match(/(\d+\.\d+)\s*\/\s*10/);
  const imdb = imdbMatch ? imdbMatch[1] : '';

  const yearMatch = html.match(/<span>(\d{4})<\/span>/) || html.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : '';

  const imgMatch = html.match(/<img[^>]+class=["'][^"']*poster[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
                   html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const poster = imgMatch ? imgMatch[1] : '';

  return {
    title,
    description,
    imdb,
    year,
    poster
  };
}

/**
 * Extract streaming URL from Film Makinesi movie via OynatLoLoad API (Instant 1080p HLS)
 * @param {string} movieUrl
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, subtitles?: Array, audios?: Array, referer?: string, embedUrl?: string, title?: string }>}
 */
export async function getFilmMakinesiStream(movieUrl) {
  let html = '';
  try {
    const res = await fetch(movieUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${BASE_URL}/`
      }
    });
    if (res.ok) {
      html = await res.text();
    }
  } catch {}

  // 1. Check for OynatLoLoad / VerseneLoad iframe in raw HTML
  let embedUrl = null;
  const iframeMatch = html.match(/<iframe\b[^>]*src=["'](https:\/\/(?:oynatloload\.top|verseneload\.site)\/embed\/[a-zA-Z0-9_-]+)["']/i) ||
                     html.match(/data-(?:lazy-)?src=["'](https:\/\/(?:oynatloload\.top|verseneload\.site)\/embed\/[a-zA-Z0-9_-]+)["']/i);

  if (iframeMatch) {
    embedUrl = iframeMatch[1];
  } else {
    // If not found in raw html (e.g. closeload or dynamic iframe), sniff via browser executable if available
    const anyIframe = html.match(/<iframe\b[^>]*src=["'](https:\/\/[^"']+)["']/i) ||
                      html.match(/data-(?:lazy-)?src=["'](https:\/\/[^"']+)["']/i);
    if (anyIframe) {
      embedUrl = anyIframe[1];
    }
  }

  if (embedUrl && (embedUrl.includes('oynatloload.top') || embedUrl.includes('verseneload.site'))) {
    try {
      const embedRes = await fetch(embedUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': movieUrl
        }
      });

      if (embedRes.ok) {
        const embedHtml = await embedRes.text();
        const eauthMatch = embedHtml.match(/window\.__ULTRA_EAUTH\s*=\s*["']([^"']+)["']/);

        if (eauthMatch) {
          const eauth = eauthMatch[1];
          const decoded = JSON.parse(Buffer.from(eauth, 'base64').toString('utf8'));
          const folder = decoded.folder;

          if (folder) {
            const apiUrl = `https://oynatloload.top/api/video-bilgi/${folder}?eauth=${encodeURIComponent(eauth)}`;
            const apiRes = await fetch(apiUrl, {
              headers: {
                'User-Agent': USER_AGENT,
                'Referer': embedUrl
              }
            });

            if (apiRes.ok) {
              const info = await apiRes.json();
              if (info.hls_m3u8_path) {
                const rawSubs = info.subtitle_tracks || info.subtitles || [];
                const subtitles = rawSubs
                  .filter(s => Boolean(s.file))
                  .map((s, idx) => ({
                    id: `sub-${idx}`,
                    lang: /türkçe|tr/i.test(s.label || '') ? 'tur' : 'eng',
                    label: s.label || 'Türkçe',
                    url: s.file.startsWith('http') ? s.file : `https://oynatloload.top${s.file}`
                  }));

                return {
                  streamUrl: info.hls_m3u8_path,
                  isDirect: true,
                  subtitles,
                  audios: info.audio_tracks || [],
                  referer: embedUrl,
                  title: movieUrl
                };
              }
            }
          }
        }
      }
    } catch {}
  }

  // Fallback: Return embed URL or movie URL
  return {
    streamUrl: embedUrl || movieUrl,
    isDirect: false,
    embedUrl: embedUrl || movieUrl,
    title: movieUrl
  };
}
