#!/usr/bin/env node

import { Command } from 'commander';
import {
  startApp,
  handleUnifiedAnimeFlow,
  handleUnifiedDramaFlow,
  handleUnifiedMovieFlow,
  handleTrDiziFlow,
  handleUniversalSearchFlow,
  handleRecentFlow,
  handleHistoryFlow,
  handleDownloadFlow
} from '../src/app.js';
import { getConfig, saveConfig } from '../src/storage.js';

const program = new Command();

program
  .name('anyclient')
  .description('AnyClient • Medya İstemcisi')
  .version('2.0.0')
  .option('-s, --search <query>', 'Doğrudan akıllı arama yap')
  .option('-d, --download [query]', 'İçeriği bilgisayara MP4 olarak indir')
  .option('-a, --anime <anime>', 'Anime ara')
  .option('-k, --kdrama <kdrama>', 'Kore / Asya dizisi ara')
  .option('-m, --movie <movie>', 'Film veya yabancı dizi ara')
  .option('-t, --turkish <turkish>', 'Yerli Türk dizisi ara')
  .option('-c, --spor <spor>', 'Canlı spor ve maç kanalı ara')
  .option('-r, --recent', 'Son eklenen bölümleri listele')
  .option('-H, --history', 'İzleme geçmişini göster')
  .option('-p, --player <player>', 'Oynatıcı seçimi (mpv, borderless, fullscreen, terminal, browser)')
  .option('-q, --quality <quality>', 'Kalite seçimi (best, 1080p, 720p, 480p)');

program.parse(process.argv);
const options = program.opts();

// Update runtime config options if provided
const config = getConfig();
let updated = false;

if (options.player) {
  config.player = options.player.toLowerCase();
  updated = true;
}
if (options.quality) {
  config.quality = options.quality.toLowerCase();
  updated = true;
}
if (updated) {
  saveConfig(config);
}

async function main() {
  if (options.spor) {
    const { handleSportChannelPlayFlow, handleLiveSportsFlow } = await import('../src/app.js');
    const { searchSportChannels } = await import('../src/sport.js');
    const chs = await searchSportChannels(options.spor);
    if (chs && chs.length > 0) {
      await handleSportChannelPlayFlow(chs[0]);
    } else {
      await handleLiveSportsFlow();
    }
  } else if (options.download) {
    await handleDownloadFlow(typeof options.download === 'string' ? options.download : null);
  } else if (options.anime) {
    await handleUnifiedAnimeFlow(options.anime);
  } else if (options.kdrama) {
    await handleUnifiedDramaFlow(options.kdrama);
  } else if (options.movie) {
    await handleUnifiedMovieFlow(options.movie);
  } else if (options.turkish) {
    await handleTrDiziFlow(options.turkish);
  } else if (options.search) {
    await handleUniversalSearchFlow(options.search);
  } else if (options.recent) {
    await handleRecentFlow();
  } else if (options.history) {
    await handleHistoryFlow();
  } else {
    await startApp();
  }
}

main().catch((err) => {
  if (err.name !== 'ExitPromptError') {
    console.error('Hata:', err);
  }
  process.exit(0);
});
