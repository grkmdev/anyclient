import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let sporProvider = null;

function getSporProvider() {
  if (sporProvider) return sporProvider;
  try {
    const sporPath = path.resolve(__dirname, 'lib', 'anthology_spor.cjs');
    sporProvider = require(sporPath);
  } catch (err) {
    console.error('Spor modülü yüklenemedi:', err.message);
  }
  return sporProvider;
}

/**
 * Get all available live sports channels
 * @returns {Promise<Array>}
 */
export async function getSportChannels() {
  const provider = getSporProvider();
  if (!provider) return [];
  try {
    const catalog = await provider.getCatalog({ type: 'tv' });
    const metas = catalog?.metas || [];
    return metas.map(ch => ({
      id: ch.id,
      title: ch.name,
      name: ch.name,
      poster: ch.logo || ch.poster || '',
      logo: ch.logo || '',
      description: 'Canlı Spor & Maç Yayını',
      type: 'Canlı TV',
      isSeries: false,
      source: 'sport'
    }));
  } catch {
    return [];
  }
}

/**
 * Get all resolved live stream sources for a given sport channel
 * @param {string} channelId
 * @returns {Promise<Array<{ name: string, title: string, url: string, headers: Object }>>}
 */
export async function getSportStreams(channelId) {
  const provider = getSporProvider();
  if (!provider) return [];
  try {
    const streams = await provider.getStreams(channelId);
    return Array.isArray(streams) ? streams : [];
  } catch {
    return [];
  }
}

/**
 * Search live sport channels by title / keyword
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchSportChannels(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const channels = await getSportChannels();
  return channels.filter(ch =>
    (ch.name && ch.name.toLowerCase().includes(q)) ||
    (ch.title && ch.title.toLowerCase().includes(q)) ||
    (ch.id && ch.id.toLowerCase().includes(q))
  );
}

