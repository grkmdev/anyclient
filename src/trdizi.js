import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { findBrowserExecutable } from './hdfilm.js';

const BASE_URL = 'https://www.trdiziizle.tv';
const INDEX_URL = 'https://www.trdiziizle.tv/tr2/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let trSeriesMemoryCache = null;
let lastCacheTime = 0;

/**
 * Fetch and cache all Turkish TV series from /tr2/ index
 * @returns {Promise<Array>}
 */
export async function getAllTrSeries() {
  if (trSeriesMemoryCache && Date.now() - lastCacheTime < 3600000) {
    return trSeriesMemoryCache;
  }

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

    await page.goto(INDEX_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // Wait if Cloudflare challenge is present
    for (let i = 0; i < 4; i++) {
      const t = await page.title();
      if (!t.includes('Just a moment') && !t.includes('Attention Required')) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    const list = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('a').forEach(a => {
        const text = a.innerText.trim();
        const href = a.href;
        if (text && href && href.includes('/diziler/') && !items.some(i => i.href === href)) {
          const cleanTitle = text.replace(/\s*(?:izle|son bölüm|hd|full|\d+)\s*$/gi, '').trim();
          items.push({
            title: cleanTitle || text,
            rawTitle: text,
            href,
            url: href,
            type: 'Yerli Dizi',
            isSeries: true,
            source: 'trdizi'
          });
        }
      });
      return items;
    });

    if (list.length > 0) {
      trSeriesMemoryCache = list;
      lastCacheTime = Date.now();
    }
    return list;
  } catch (err) {
    console.error('TrDizi fetch error:', err.message);
    return trSeriesMemoryCache || [];
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Search Turkish TV series from trdiziizle.tv /tr2/
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchTrDizi(query) {
  const all = await getAllTrSeries();
  const q = query.toLowerCase().trim();
  const matched = all.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.rawTitle.toLowerCase().includes(q)
  );
  return matched;
}

/**
 * Get all available episodes for a Turkish series from trdiziizle.tv
 * @param {string} seriesUrl
 * @returns {Promise<{ title: string, episodes: Array }>}
 */
export async function getTrDiziDetails(seriesUrl) {
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
      const episodes = [];
      document.querySelectorAll('a').forEach(a => {
        const text = a.innerText.trim();
        const href = a.href;
        if (href && !href.includes('#') && (text.match(/(\d+)\.\s*bölüm/i) || href.match(/(\d+)-bolum/i))) {
          const match = text.match(/(\d+)\.\s*bölüm/i) || href.match(/(\d+)-bolum/i);
          const epNum = match ? parseInt(match[1], 10) : 0;
          if (!episodes.some(e => e.url === href)) {
            const cleanName = text.split('\n')[0].trim();
            episodes.push({
              name: cleanName || `${epNum}. Bölüm`,
              episode: epNum,
              season: 1,
              url: href
            });
          }
        }
      });

      return {
        title: document.title.replace(/son bölüm izle.*$/i, '').trim(),
        episodes
      };
    });

    let sortedEpisodes = info.episodes.sort((a, b) => a.episode - b.episode);

    // Special handling for Kurtlar Vadisi:
    // If Kurtlar Vadisi (original), ensure all 1 to 97 episodes are available.
    // For missing episodes (1-55 not on trdizi), link directly to official Pana Film 4K/1080p release!
    const isKV = seriesUrl.includes('kurtlar-vadisi-izle') && !seriesUrl.includes('pusu');
    const isPusu = seriesUrl.includes('kurtlar-vadisi-pusu');

    if (isKV) {
      const fullKVList = [];
      const epMap = new Map(sortedEpisodes.map(e => [e.episode, e]));

      for (let ep = 1; ep <= 97; ep++) {
        if (epMap.has(ep)) {
          fullKVList.push(epMap.get(ep));
        } else {
          fullKVList.push({
            name: `Kurtlar Vadisi ${ep}. Bölüm (Pana Film 4K/1080p)`,
            episode: ep,
            season: 1,
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`Kurtlar Vadisi ${ep}. Bölüm Pana Film`)}`,
            isYouTube: true,
            query: `Kurtlar Vadisi ${ep}. Bölüm`
          });
        }
      }
      sortedEpisodes = fullKVList;
    } else if (isPusu && sortedEpisodes.length === 0) {
      // Provide full episode catalogue for Kurtlar Vadisi Pusu
      const pusuList = [];
      for (let ep = 1; ep <= 300; ep++) {
        pusuList.push({
          name: `Kurtlar Vadisi Pusu ${ep}. Bölüm (Pana Film 1080p)`,
          episode: ep,
          season: 1,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`Kurtlar Vadisi Pusu ${ep}. Bölüm Pana Film`)}`,
          isYouTube: true,
          query: `Kurtlar Vadisi Pusu ${ep}. Bölüm`
        });
      }
      sortedEpisodes = pusuList;
    }

    return {
      title: info.title || (isKV ? 'Kurtlar Vadisi' : (isPusu ? 'Kurtlar Vadisi Pusu' : 'Yerli Dizi')),
      episodes: sortedEpisodes
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Extract streaming URL or embed player for a Turkish TV series episode
 * @param {string} episodeUrl
 * @returns {Promise<{ streamUrl: string, isDirect: boolean, embedUrl?: string, title?: string }>}
 */
export async function getTrDiziStream(episodeUrl) {
  if (episodeUrl.includes('youtube.com/watch') || episodeUrl.includes('youtu.be/')) {
    return {
      streamUrl: episodeUrl,
      isDirect: true,
      title: 'YouTube HD Akış',
      embedUrl: episodeUrl
    };
  }

  if (episodeUrl.includes('youtube.com/results') || episodeUrl.startsWith('ytdl://')) {
    const qMatch = episodeUrl.match(/search_query=([^&]+)/);
    const query = qMatch ? decodeURIComponent(qMatch[1]) : 'Kurtlar Vadisi';
    try {
      const { execSync } = await import('node:child_process');
      const { findYtDlpExecutable } = await import('./player.js');
      const ytDlp = findYtDlpExecutable() || 'yt-dlp';
      const videoId = execSync(`"${ytDlp}" "ytsearch1:${query}" --get-id`, { encoding: 'utf-8', timeout: 10000 }).trim().split('\n').pop().trim();
      if (videoId && videoId.length > 5) {
        return {
          streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
          isDirect: true,
          title: query,
          embedUrl: `https://www.youtube.com/watch?v=${videoId}`
        };
      }
    } catch {}
  }

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
    await page.setExtraHTTPHeaders({ 'Referer': BASE_URL });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    let directStreamUrl = null;
    page.on('response', resp => {
      const u = resp.url();
      if (!directStreamUrl && (u.includes('.m3u8') || u.includes('videoplayback') || (u.includes('.mp4') && !u.includes('trailer')))) {
        directStreamUrl = u;
      }
    });

    await page.goto(episodeUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

    for (let i = 0; i < 4; i++) {
      const t = await page.title();
      if (!t.includes('Just a moment') && !t.includes('Attention Required')) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    const pageInfo = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe')).map(i => i.src);
      const video = document.querySelector('video');
      return {
        title: document.title,
        iframes,
        videoSrc: video ? (video.src || video.currentSrc) : null
      };
    });

    if (pageInfo.videoSrc) {
      directStreamUrl = pageInfo.videoSrc;
    }

    // 1. Check if an iframe has player/telif/index.php?id=... (e.g. YouTube or direct video)
    const telifIframe = pageInfo.iframes.find(i => i.includes('player/telif') && i.includes('id='));
    if (telifIframe) {
      try {
        const uObj = new URL(telifIframe);
        const rawTarget = uObj.searchParams.get('id');
        if (rawTarget && (rawTarget.includes('youtube.com') || rawTarget.includes('youtu.be') || rawTarget.includes('dailymotion.com') || rawTarget.includes('.mp4') || rawTarget.includes('.m3u8'))) {
          return {
            streamUrl: rawTarget,
            isDirect: true,
            title: pageInfo.title,
            embedUrl: telifIframe
          };
        }
      } catch {}
    }

    // 2. Check if an iframe is player/oynat/...
    const oynatIframe = pageInfo.iframes.find(i => i.includes('player/oynat'));
    if (oynatIframe) {
      const oynatPage = await browser.newPage();
      await oynatPage.setUserAgent(USER_AGENT);
      await oynatPage.setExtraHTTPHeaders({ 'Referer': BASE_URL });

      let oynatMedia = null;
      oynatPage.on('response', resp => {
        const u = resp.url();
        if (!oynatMedia && (u.includes('videoplayback') || u.includes('.m3u8') || u.includes('.mp4'))) {
          oynatMedia = u;
        }
      });

      try {
        await oynatPage.goto(oynatIframe, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2500));

        const jwStream = await oynatPage.evaluate(() => {
          if (window.jwplayer) {
            try {
              const item = window.jwplayer().getPlaylistItem();
              if (item?.file) return item.file;
              if (item?.sources?.[0]?.file) return item.sources[0].file;
            } catch {}
          }
          return null;
        });

        const chosenMedia = jwStream || oynatMedia;
        if (chosenMedia) {
          await oynatPage.close().catch(() => {});
          return {
            streamUrl: chosenMedia,
            isDirect: true,
            title: pageInfo.title,
            embedUrl: oynatIframe
          };
        }
      } catch {} finally {
        await oynatPage.close().catch(() => {});
      }
    }

    // 3. Check any other iframe (YouTube, Dailymotion, Vidmoly, etc.)
    for (const iframe of pageInfo.iframes) {
      if (
        iframe.includes('youtube.com') ||
        iframe.includes('youtu.be') ||
        iframe.includes('dailymotion.com') ||
        iframe.includes('vidmoly') ||
        iframe.includes('.mp4') ||
        iframe.includes('.m3u8')
      ) {
        return {
          streamUrl: iframe,
          isDirect: true,
          title: pageInfo.title,
          embedUrl: iframe
        };
      }
    }

    if (directStreamUrl) {
      return {
        streamUrl: directStreamUrl,
        isDirect: true,
        title: pageInfo.title,
        embedUrl: pageInfo.iframes[0] || episodeUrl
      };
    }

    return {
      streamUrl: pageInfo.iframes[0] || episodeUrl,
      isDirect: false,
      embedUrl: pageInfo.iframes[0] || episodeUrl,
      title: pageInfo.title
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
