import dns from 'node:dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': '*/*'
};

/**
 * Deanonymize/unpack packed JS (p,a,c,k,e,d unpacker)
 */
export function unpackJs(packed) {
  try {
    const match = packed.match(/eval\(function\(p,a,c,k,e,[rd]\)\{.*\}\('.*'\.split\('\|'\).*\)\)/);
    if (!match) return packed;
    // Extract parameters
    const code = match[0];
    const funcMatch = code.match(/}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)/);
    if (!funcMatch) return packed;
    const [, p, aStr, cStr, kStr] = funcMatch;
    const a = parseInt(aStr, 10);
    let c = parseInt(cStr, 10);
    const k = kStr.split('|');
    const e = (c) => (c < a ? '' : e(Math.floor(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));

    let unpacked = p;
    while (c--) {
      if (k[c]) {
        unpacked = unpacked.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
      }
    }
    return unpacked;
  } catch {
    return packed;
  }
}

/**
 * Universal video extractor from an HTML page or embed URL
 * Finds direct .m3u8 (HLS) or .mp4 streams
 */
export async function extractDirectVideo(pageUrl, referer = '') {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        ...HEADERS,
        'Referer': referer || pageUrl
      }
    });

    if (!res.ok) {
      return { success: false, url: pageUrl, error: `HTTP ${res.status}` };
    }

    const html = await res.text();

    // 1. Check unpacked code if present
    const unpacked = unpackJs(html);
    const targetText = html + '\n' + unpacked;

    // 2. Look for HLS .m3u8 sources (including multi-bitrate urlsets with commas)
    const m3u8Match = targetText.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (m3u8Match) {
      return {
        success: true,
        type: 'm3u8',
        streamUrl: m3u8Match[0],
        originalUrl: pageUrl
      };
    }

    // 3. Look for direct .mp4 sources
    const mp4Match = targetText.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
    if (mp4Match) {
      return {
        success: true,
        type: 'mp4',
        streamUrl: mp4Match[0],
        originalUrl: pageUrl
      };
    }

    // 4. Look for video source tags: <source src="..."
    const sourceMatch = targetText.match(/<source[^>]+src=["']([^"']+)["']/i);
    if (sourceMatch) {
      let src = sourceMatch[1];
      if (src.startsWith('//')) src = 'https:' + src;
      return {
        success: true,
        type: src.includes('.m3u8') ? 'm3u8' : 'mp4',
        streamUrl: src,
        originalUrl: pageUrl
      };
    }

    return {
      success: false,
      streamUrl: pageUrl,
      error: 'Doğrudan video akışı tespit edilemedi, embed olarak kullanılacak'
    };
  } catch (err) {
    return {
      success: false,
      streamUrl: pageUrl,
      error: err.message
    };
  }
}

/**
 * Headless browser dynamic sniffer to extract direct media streams (.m3u8 / .mp4 / blob)
 * from complex JavaScript web players (JWPlayer, VideoJS, Molystream, etc.) for MPV playback.
 */
export async function sniffDirectStreamFromWebPlayer(pageUrl, referer = '') {
  try {
    const { findBrowserExecutable } = await import('./hdfilm.js');
    const puppeteer = (await import('puppeteer-core')).default;
    const exePath = findBrowserExecutable();
    if (!exePath) return { success: false, url: pageUrl };

    let browser = null;
    try {
      browser = await puppeteer.launch({
        executablePath: exePath,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--autoplay-policy=no-user-gesture-required'
        ]
      });

      const page = await browser.newPage();
      await page.setUserAgent(HEADERS['User-Agent']);
      if (referer) {
        await page.setExtraHTTPHeaders({ 'Referer': referer });
      }

      let detectedStream = null;
      page.on('response', resp => {
        const u = resp.url();
        if (!detectedStream && (
          u.includes('.m3u8') ||
          (u.includes('.mp4') && !u.includes('trailer') && !u.includes('banner') && !u.includes('preview')) ||
          u.includes('videoplayback') ||
          u.includes('/m3/') ||
          u.includes('googlevideo.com') ||
          u.includes('fastcdn')
        )) {
          detectedStream = u;
        }
      });

      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

      // Poll for up to 6 seconds while inspecting frames & DOM
      const start = Date.now();
      while (Date.now() - start < 6000) {
        if (detectedStream) break;

        for (const frame of page.frames()) {
          try {
            const stream = await frame.evaluate(() => {
              if (window.jwplayer) {
                try {
                  const item = window.jwplayer().getPlaylistItem();
                  if (item?.file) return item.file;
                  if (item?.sources?.[0]?.file) return item.sources[0].file;
                } catch {}
              }
              const v = document.querySelector('video');
              return v ? (v.src || v.currentSrc) : null;
            });
            if (stream && (stream.includes('.m3u8') || stream.includes('.mp4') || stream.includes('videoplayback') || stream.includes('googlevideo'))) {
              detectedStream = stream;
              break;
            }
          } catch {}
        }

        if (detectedStream) break;

        // Try triggering play buttons if present
        try {
          await page.evaluate(() => {
            const btn = document.querySelector('.jw-preview, .jw-display-icon-display, button.play, .play-button, .vjs-big-play-button, #play, #player, video');
            if (btn) btn.click();
          });
        } catch {}

        await new Promise(r => setTimeout(r, 600));
      }

      if (detectedStream) {
        return { success: true, streamUrl: detectedStream };
      }
      return { success: false, url: pageUrl };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  } catch (err) {
    return { success: false, url: pageUrl, error: err.message };
  }
}

