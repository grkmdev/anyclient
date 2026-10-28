import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { findBrowserExecutable } from './hdfilm.js';

const BASE_URL = 'https://yabancidizi.news';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Search movies and TV series on yabancidizi.news
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchYabanciDizi(query) {
  const exePath = findBrowserExecutable();
  if (!exePath) return [];

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
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    for (let i = 0; i < 4; i++) {
      const t = await page.title();
      if (!t.includes('Just a moment') && !t.includes('Attention Required')) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    const data = await page.evaluate(async (q) => {
      try {
        const resp = await fetch('/search?qr=' + encodeURIComponent(q), {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        if (!resp.ok) return [];
        const json = await resp.json();
        return json?.data?.result || [];
      } catch {
        return [];
      }
    }, query.trim());

    return (data || []).map(item => {
      const isMovie = item.s_type === '1';
      const pathType = isMovie ? 'film' : 'dizi';
      const url = `${BASE_URL}/${pathType}/${item.s_link}`;
      return {
        title: item.s_name || 'İçerik',
        href: url,
        url: url,
        type: isMovie ? 'Film' : 'Dizi',
        year: item.s_year || '',
        imdb: '',
        isSeries: !isMovie,
        source: 'yabancidizi'
      };
    });
  } catch (err) {
    console.error('YabancıDizi search error:', err.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Get seasons and episodes for a series from yabancidizi.news
 * @param {string} seriesUrl
 * @returns {Promise<{ title: string, description: string, seasons: Array }>}
 */
export async function getYabanciDiziDetails(seriesUrl) {
  const exePath = findBrowserExecutable();
  if (!exePath) throw new Error('Tarayıcı bulunamadı.');

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
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    await page.goto(seriesUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

    for (let i = 0; i < 4; i++) {
      const t = await page.title();
      if (!t.includes('Just a moment') && !t.includes('Attention Required')) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    const info = await page.evaluate(() => {
      const title = document.querySelector('h1')?.innerText?.trim() || document.title.replace(/izle.*$/i, '').trim();
      const desc = document.querySelector('.story, .description, .ozet, p')?.innerText?.trim() || '';

      const episodeMap = new Map();
      document.querySelectorAll('a').forEach(a => {
        const href = a.href || '';
        const match = href.match(/\/sezon-(\d+)\/bolum-(\d+)/i);
        if (match) {
          const s = parseInt(match[1], 10);
          const e = parseInt(match[2], 10);
          const key = `S${s}E${e}`;
          if (!episodeMap.has(key)) {
            const raw = a.innerText.trim();
            const clean = raw.replace(/\n+/g, ' - ').replace(/\s+/g, ' ');
            episodeMap.set(key, {
              season: s,
              episode: e,
              url: href,
              name: clean || `Sezon ${s} Bölüm ${e}`
            });
          }
        }
      });

      return {
        title,
        desc,
        episodes: Array.from(episodeMap.values())
      };
    });

    const seasonsMap = new Map();
    for (const ep of info.episodes) {
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
      title: info.title,
      description: info.desc,
      seasons
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Extract streaming URL or embed player for yabancidizi.news episode or movie
 * @param {string} pageUrl
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, embedUrl?: string, title?: string }>}
 */
export async function getYabanciDiziStream(pageUrl) {
  const exePath = findBrowserExecutable();
  if (!exePath) throw new Error('Tarayıcı bulunamadı.');

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
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    let directStreamUrl = null;
    page.on('response', resp => {
      const u = resp.url();
      if (!directStreamUrl && (u.includes('.m3u8') || (u.includes('.mp4') && !u.includes('trailer') && !u.includes('pre-roll')))) {
        directStreamUrl = u;
      }
    });

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await new Promise(r => setTimeout(r, 3500));

    const pageInfo = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      const video = document.querySelector('video');
      return {
        title: document.title,
        iframeSrc: iframe ? iframe.src : null,
        videoSrc: video ? (video.src || video.currentSrc) : null
      };
    });

    if (pageInfo.videoSrc) {
      directStreamUrl = pageInfo.videoSrc;
    }

    if (directStreamUrl) {
      return {
        streamUrl: directStreamUrl,
        isDirect: true,
        title: pageInfo.title,
        embedUrl: pageInfo.iframeSrc || pageUrl
      };
    }

    // Inspect frames for JWPlayer or child iframes
    for (const frame of page.frames()) {
      try {
        const fVideo = await frame.evaluate(() => {
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

        if (fVideo && (fVideo.includes('.m3u8') || fVideo.includes('.mp4') || fVideo.includes('googlevideo'))) {
          return {
            streamUrl: fVideo,
            isDirect: true,
            title: pageInfo.title,
            embedUrl: pageInfo.iframeSrc || pageUrl
          };
        }
      } catch {}
    }

    return {
      streamUrl: pageInfo.iframeSrc || pageUrl,
      isDirect: false,
      embedUrl: pageInfo.iframeSrc || pageUrl,
      title: pageInfo.title
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
