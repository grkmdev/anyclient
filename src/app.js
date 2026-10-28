import { select, input, confirm, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import {
  searchAllAnime,
  searchOpenAni,
  searchAnime,
  getRecentEpisodes,
  getAnimeDetailsUnified,
  getEpisodeVideosUnified,
  extractStreamUnified
} from './api.js';
import { searchHdFilm, getHdFilmStream, getHdFilmSeriesEpisodes } from './hdfilm.js';
import { searchHdFilmLand, getHdFilmLandStream } from './hdfilmland.js';
import { searchFilmMakinesi, getFilmMakinesiDetails, getFilmMakinesiStream } from './filmmakinesi.js';
import { searchDiziKorea, getDiziDetails, getDiziKoreaStream } from './dizikorea.js';
import { searchAnizium, getAniziumDetails, getAniziumStream } from './anizium.js';
import { searchAnizm, getAnizmDetails, getAnizmStream } from './anizm.js';
import { searchWebDramaTurkey, getWebDramaTurkeyDetails, getWebDramaTurkeyStream } from './webdramaturkey.js';
import { searchDiziAsya, getDiziAsyaDetails, getDiziAsyaStream } from './diziasya.js';
import { searchDDiziBox, getDDiziBoxDetails, getDDiziBoxStream } from './ddizibox.js';
import { searchYabanciDizi, getYabanciDiziDetails, getYabanciDiziStream } from './yabancidizi.js';
import { searchTrDizi, getTrDiziDetails, getTrDiziStream } from './trdizi.js';
import { getSportChannels, getSportStreams, searchSportChannels } from './sport.js';
import { detectPlayers, playStream, installMpvViaWinget, setDownloadMode } from './player.js';
import { getConfig, saveConfig, resetConfig, getHistory, addToHistory, clearHistory } from './storage.js';
import {
  showBanner,
  printHeader,
  displayMediaCard,
  displayAnimeCard,
  formatResultBadge,
  createSpinner,
  displayConfigSummary,
  displayKeybindsModal
} from './ui.js';

export async function startApp() {
  while (true) {
    showBanner();
    const config = getConfig();
    let activePlayer = config.player.toUpperCase();
    if (config.player === 'borderless') activePlayer = 'Çerçevesiz 1080p';
    else if (config.player === 'fullscreen') activePlayer = 'Tam Ekran MPV';
    else if (config.player === 'terminal') activePlayer = 'Terminal Karakter';
    else if (config.player === 'mpv') activePlayer = 'Standart MPV';

    let autoNextStatus = 'Geri Sayım (3s)';
    if (config.autoNext === 'instant') autoNextStatus = 'Anında';
    else if (config.autoNext === 'countdown') autoNextStatus = `${config.autoNextDelay || 3}s Geri Sayım`;
    else if (config.autoNext === 'prompt') autoNextStatus = 'Onaylı';
    else if (config.autoNext === 'off') autoNextStatus = 'Kapalı';

    console.log(
      chalk.dim(`  oynatıcı: `) + chalk.white(activePlayer) +
      chalk.gray(`  │  `) +
      chalk.dim(`kalite: `) + chalk.white(config.quality.toUpperCase()) +
      chalk.gray(`  │  `) +
      chalk.dim(`otomatik bölüm: `) + chalk.white(autoNextStatus) + '\n'
    );

    try {
      const choice = await select({
        message: 'Ne izlemek istiyorsun?',
        pageSize: 12,
        choices: [
          {
            name: 'Animeler (Anizm, OpenAnime, AnimeciX)',
            value: 'search_anime',
            description: 'Tüm anime kaynaklarında eşzamanlı arama'
          },
          {
            name: 'Kore & Asya Dizileri (DiziKorea, DiziAsya, WebDrama)',
            value: 'search_kdrama',
            description: 'K-Drama, C-Drama ve Asya dizileri'
          },
          {
            name: 'Film & Yabancı Dizi (HDFilm, Film Makinesi, DiziBOX, YabancıDizi)',
            value: 'search_movies',
            description: '1080p sinema filmleri ve popüler yabancı diziler'
          },
          {
            name: 'Yerli Türk Dizileri (TRDiziİzle /tr2/)',
            value: 'search_trdizi',
            description: '1000+ yerli Türk dizisi arşivi (Kurtlar Vadisi, Ezel vb.)'
          },
          {
            name: 'Canlı Spor & TV Kanalları',
            value: 'live_sports',
            description: 'Canlı spor karşılaşmaları, ulusal ve tematik spor kanalları'
          },
          {
            name: 'Evrensel Akıllı Arama (Tüm Kaynaklar)',
            value: 'search_universal',
            description: 'Tek kelimeyle tüm kategorilerde ara'
          },
          {
            name: 'Son Eklenen Anime Bölümleri',
            value: 'recent',
            description: 'En son yayınlanan yeni bölümler'
          },
          {
            name: '📥 Çevrimdışı İndir (Anime, Dizi veya Film)',
            value: 'download_media',
            description: 'İçerikleri doğrudan 1080p MP4 formatında bilgisayarına indir'
          },
          {
            name: 'İzleme Geçmişi',
            value: 'history',
            description: 'Kaldığın yerden devam et'
          },
          {
            name: 'Yapılandırma & Ayarlar',
            value: 'settings',
            description: 'Oynatıcı, çözünürlük, altyazı ve kısayollar'
          },
          new Separator(),
          { name: 'Çıkış', value: 'exit' }
        ]
      });

      if (choice === 'exit') {
        console.log(chalk.dim('\nGörüşmek üzere.\n'));
        process.exit(0);
      }

      if (choice === 'search_anime') {
        await handleUnifiedAnimeFlow();
      } else if (choice === 'search_kdrama') {
        await handleUnifiedDramaFlow();
      } else if (choice === 'search_movies') {
        await handleUnifiedMovieFlow();
      } else if (choice === 'search_trdizi') {
        await handleTrDiziFlow();
      } else if (choice === 'live_sports') {
        await handleLiveSportsFlow();
      } else if (choice === 'search_universal') {
        await handleUniversalSearchFlow();
      } else if (choice === 'download_media') {
        await handleDownloadFlow();
      } else if (choice === 'recent') {
        await handleRecentFlow();
      } else if (choice === 'history') {
        await handleHistoryFlow();
      } else if (choice === 'settings') {
        await handleSettingsFlow();
      }
    } catch (err) {
      if (err.name === 'ExitPromptError') {
        console.log(chalk.hex('#c084fc')('\nÇıkış yapıldı. İyi seyirler! 🖤\n'));
        process.exit(0);
      }
      console.error(chalk.red('\nBir hata oluştu:'), err.message);
      await pause();
    }
  }
}

/**
 * Handle Offline Media Download Flow
 */
export async function handleDownloadFlow(prefillQuery = null) {
  printHeader('📥 ÇEVRİMDIŞI MEDYA İNDİRME');
  console.log(chalk.gray('Anime, film, yerli ve yabancı dizileri arayın ve doğrudan bilgisayarınıza MP4 formatında kaydedin.\n'));

  let query = prefillQuery;
  if (!query) {
    query = await input({
      message: 'İndirmek istediğiniz içerik adı (veya direkt URL):',
      validate: (v) => v.trim().length > 0 ? true : 'Lütfen geçerli bir isim girin'
    });
  }

  setDownloadMode(true);
  try {
    await handleUniversalSearchFlow(query);
  } finally {
    setDownloadMode(false);
  }
}

/**
 * Handle Unified Movie & Series Flow (HDFilmcehennemi 1080p)
 */
export async function handleUnifiedMovieFlow(prefillQuery = null) {
  printHeader('🎬 FİLM & YABANCI DİZİ ARA & İZLE');
  console.log(chalk.gray('HDFilmcehennemi, DiziBOX ve YabancıDizi (yabancidizi.news) arşivleri üzerinden 1080p içerik arayın.\n'));

  let query = prefillQuery;
  if (!query) {
    query = await input({
      message: 'Aranacak Film veya Dizi Adı (veya direkt URL):',
      validate: (v) => v.trim().length > 0 ? true : 'Lütfen geçerli bir arama terimi girin'
    });
  }

  // Direct URL support
  if (query.startsWith('http://') || query.startsWith('https://')) {
    await handleHdFilmDirectUrl(query.trim());
    return;
  }

  const spinner = createSpinner(`"${query}" sinema ve yabancı dizi arşivlerinde (HDFilm, Film Makinesi, DiziBOX & YabancıDizi) aranıyor...`).start();

  const [hdfilmRes, hdfilmLandRes, filmMakRes, diziboxRes, ydRes] = await Promise.allSettled([
    searchHdFilm(query.trim()),
    searchHdFilmLand(query.trim()),
    searchFilmMakinesi(query.trim()),
    searchDDiziBox(query.trim()),
    searchYabanciDizi(query.trim())
  ]);

  const hdList = (hdfilmRes.status === 'fulfilled' && Array.isArray(hdfilmRes.value)) ? hdfilmRes.value : [];
  const hdLandList = (hdfilmLandRes.status === 'fulfilled' && Array.isArray(hdfilmLandRes.value)) ? hdfilmLandRes.value : [];
  const fmList = (filmMakRes.status === 'fulfilled' && Array.isArray(filmMakRes.value)) ? filmMakRes.value : [];
  const dbxList = (diziboxRes.status === 'fulfilled' && Array.isArray(diziboxRes.value)) ? diziboxRes.value : [];
  const ydList = (ydRes.status === 'fulfilled' && Array.isArray(ydRes.value)) ? ydRes.value : [];
  const results = [...hdList, ...hdLandList, ...fmList, ...dbxList, ...ydList];

  spinner.succeed(`Toplam ${results.length} içerik bulundu (HDFilm: ${hdList.length + hdLandList.length}, FilmMak: ${fmList.length}, DiziBOX: ${dbxList.length}, Y.Dizi: ${ydList.length}).`);

  if (results.length === 0) {
    console.log(chalk.yellow('\nHerhangi bir film veya dizi bulunamadı.'));
    await pause();
    return;
  }

  const choices = results.map(item => ({
    name: formatResultBadge(item),
    value: item
  }));

  choices.push(new Separator());
  choices.push({ name: '🔙 İptal / Ana Menüye Dön', value: null });

  const selected = await select({
    message: 'İzlemek istediğin içeriği seç:',
    pageSize: 15,
    choices
  });

  if (!selected) return;

  displayMediaCard(selected);

  if (selected.source === 'ddizibox' || selected.source === 'dizibox') {
    await handleDiziBoxDetailFlow(selected);
  } else if (selected.source === 'filmmakinesi') {
    await handleFilmMakinesiPlayFlow(selected);
  } else if (selected.source === 'hdfilmland') {
    await handleHdFilmLandPlayFlow(selected);
  } else if (selected.source === 'yabancidizi') {
    await handleYabanciDiziDetailFlow(selected);
  } else {
    await handleHdFilmPlayFlow(selected);
  }
}

/**
 * Handle Film Makinesi (filmmakinesi.co) Movie Playback Flow
 */
export async function handleFilmMakinesiPlayFlow(selected) {
  const playSpinner = createSpinner(`Film Makinesi 1080p akışı çözülüyor (${selected.title})...`).start();
  try {
    const streamData = await getFilmMakinesiStream(selected.url);
    playSpinner.succeed('Film Makinesi akışı hazırlandı!');
    const config = getConfig();

    addToHistory({
      id: selected.url,
      titleId: selected.url,
      titleName: selected.title,
      name: selected.title,
      source: 'filmmakinesi',
      season: 1,
      episode: 1,
      episodeName: selected.year || 'Film',
      timestamp: Date.now()
    });

    await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: streamData.isDirect,
      embedUrl: streamData.embedUrl,
      title: selected.title,
      episodeName: selected.year || 'Film',
      season: 1,
      episode: 1,
      captions: streamData.subtitles || [],
      anime: { name: selected.title, source: 'filmmakinesi' }
    });
  } catch (err) {
    playSpinner.fail(`Oynatma başlatılamadı: ${err.message}`);
    await pause();
  }
}

/**
 * Handle HDFilmCehennemi.land Movie Playback Flow
 */
export async function handleHdFilmLandPlayFlow(selected) {
  const playSpinner = createSpinner(`HDFilmCehennemi.land 1080p akışı çözülüyor (${selected.title})...`).start();
  try {
    const streamData = await getHdFilmLandStream(selected.url, 'tr-dub');
    playSpinner.succeed('HDFilmCehennemi.land akışı hazırlandı!');
    const config = getConfig();

    addToHistory({
      id: selected.url,
      titleId: selected.url,
      titleName: selected.title,
      name: selected.title,
      source: 'hdfilmland',
      season: 1,
      episode: 1,
      episodeName: selected.year || 'Film',
      timestamp: Date.now()
    });

    await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: streamData.isDirect,
      embedUrl: streamData.embedUrl,
      title: selected.title,
      episodeName: selected.year || 'Film',
      season: 1,
      episode: 1,
      captions: [],
      anime: { name: selected.title, source: 'hdfilmland' }
    });
  } catch (err) {
    playSpinner.fail(`Oynatma başlatılamadı: ${err.message}`);
    await pause();
  }
}

/**
 * Handle DiziBox Season and Episode Selection Flow
 */
export async function handleDiziBoxDetailFlow(selected) {
  const detailSpinner = createSpinner(`Sezonlar ve bölümler alınıyor (${selected.title})...`).start();
  let details;
  try {
    details = await getDDiziBoxDetails(selected.url);
    detailSpinner.succeed('DiziBOX bölüm listesi hazır.');
  } catch (err) {
    detailSpinner.fail(`Bölümler alınamadı: ${err.message}`);
    await pause();
    return;
  }

  const seasons = details.seasons || [];
  if (seasons.length === 0) {
    console.log(chalk.yellow('\nBu dizi için henüz bölüm bulunamadı.'));
    await pause();
    return;
  }

  let selectedSeason = seasons[0];
  if (seasons.length > 1) {
    const seasonChoices = seasons.map(s => ({
      name: `Sezon ${s.season} (${s.episodes.length} Bölüm)`,
      value: s
    }));
    seasonChoices.push(new Separator());
    seasonChoices.push({ name: '🔙 Geri Dön', value: null });

    selectedSeason = await select({
      message: 'Hangi sezonu izlemek istiyorsunuz?',
      choices: seasonChoices,
      pageSize: 10
    });
    if (!selectedSeason) return;
  }

  const episodes = selectedSeason.episodes || [];
  while (true) {
    const epChoices = episodes.map(ep => ({
      name: `${chalk.bold.hex('#60a5fa')(ep.name || `${ep.episode}. Bölüm`)}`,
      value: ep
    }));
    epChoices.push(new Separator());
    epChoices.push({ name: '🔙 Geri Dön', value: null });

    const selectedEp = await select({
      message: `${selected.title} - Bölüm seçin:`,
      choices: epChoices,
      pageSize: 14
    });

    if (!selectedEp) break;

    const playSpinner = createSpinner(`1080p HD akış hazırlanıyor (${selectedEp.name})...`).start();
    let streamData;
    try {
      streamData = await getDDiziBoxStream(selectedEp.url);
      playSpinner.succeed('DiziBOX akışı hazırlandı!');
    } catch (err) {
      playSpinner.fail(`Akış çözülemedi: ${err.message}`);
      await pause();
      continue;
    }

    const config = getConfig();

    // DiziBOX's DBX Pro player server-side blocks certain ISPs/VPNs from giving raw m3u8 streams
    if (!streamData.isDirect) {
      console.log(chalk.yellow('\n⚠️  DiziBOX DBX Pro oynatıcısı bu bölümde doğrudan video akışı vermedi (IP/VPN güvenlik duvarı devrede).'));

      const fallbackAction = await select({
        message: 'Bu bölümü nasıl izlemek istersiniz?',
        choices: [
          {
            name: '🚀 1080p MPV ile Hemen İzle (HDFilmcehennemi Otomatik Eşleştirme - Önerilen)',
            value: 'hdfilm_match',
            description: `${selected.title} Sezon ${selectedSeason.season} Bölüm ${selectedEp.episode} doğrudan 1080p Türkçe Dublaj/Altyazı ile MPV'de açılır`
          },
          {
            name: '🌐 DiziBOX Web Sayfasını Tarayıcınızda Aç',
            value: 'browser',
            description: 'Bölümü varsayılan web tarayıcınızda açar'
          },
          {
            name: '🔙 Geri Dön',
            value: 'back'
          }
        ]
      });

      if (fallbackAction === 'back') continue;

      if (fallbackAction === 'browser') {
        const openModule = await import('open');
        await openModule.default(selectedEp.url);
        console.log(chalk.cyan('\n🌐 Tarayıcınızda açıldı.'));
        await pause();
        continue;
      }

      if (fallbackAction === 'hdfilm_match') {
        const matchSpinner = createSpinner(`"${selected.title}" 1080p arşivinde aranıyor...`).start();
        try {
          const hdResults = await searchHdFilm(selected.title);
          const seriesMatch = hdResults.find(r => r.isSeries) || hdResults[0];
          if (!seriesMatch) {
            matchSpinner.fail('1080p arşivde eşleşen dizi bulunamadı.');
            await pause();
            continue;
          }
          matchSpinner.text = `Bölümler listeleniyor (${seriesMatch.title})...`;
          const allEps = await getHdFilmSeriesEpisodes(seriesMatch.href);
          const targetEp = allEps.find(e => e.season === selectedSeason.season && e.episode === selectedEp.episode);

          if (!targetEp) {
            matchSpinner.fail(`Sezon ${selectedSeason.season} Bölüm ${selectedEp.episode} 1080p arşivde bulunamadı.`);
            await pause();
            continue;
          }

          matchSpinner.succeed(`1080p Eşleşme bulundu: ${seriesMatch.title} - S${targetEp.season}E${targetEp.episode}`);

          const audioPreference = await select({
            message: 'İzleme seçeneğini belirleyin:',
            choices: [
              { name: '💬 Türkçe Altyazılı (Orijinal Ses)', value: 'sub' },
              { name: '🇹🇷 Türkçe Dublaj', value: 'dub' }
            ]
          });

          const hdPlaySpinner = createSpinner(`1080p HD akış çözülüyor (S${targetEp.season}E${targetEp.episode})...`).start();
          const hdStream = await getHdFilmStream(targetEp.url, audioPreference);
          hdPlaySpinner.succeed('1080p Akış hazır!');

          addToHistory({
            id: targetEp.url,
            titleId: seriesMatch.href,
            titleName: selected.title,
            name: selected.title,
            source: 'hdfilm',
            season: targetEp.season,
            episode: targetEp.episode,
            episodeName: `Sezon ${targetEp.season} Bölüm ${targetEp.episode}`,
            timestamp: Date.now()
          });

          await playStream({
            playerType: config.player,
            streamUrl: hdStream.streamUrl,
            isDirect: true,
            title: selected.title,
            episodeName: `S${targetEp.season}E${targetEp.episode}`,
            season: targetEp.season,
            episode: targetEp.episode,
            captions: hdStream.captions,
            audioPreference,
            anime: { name: selected.title, source: 'hdfilm' }
          });
        } catch (e) {
          matchSpinner.fail(`Eşleştirme veya oynatma başarısız: ${e.message}`);
          await pause();
        }
        continue;
      }
    }

    addToHistory({
      id: selectedEp.url,
      titleId: selected.url,
      titleName: selected.title,
      name: selected.title,
      source: 'dizibox',
      season: selectedSeason.season,
      episode: selectedEp.episode,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      timestamp: Date.now()
    });

    console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${selected.title} - S${selectedSeason.season}E${selectedEp.episode}`));

    const playResult = await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: streamData.isDirect,
      embedUrl: streamData.embedUrl,
      title: selected.title,
      episodeName: `Sezon ${selectedSeason.season} Bölüm ${selectedEp.episode}`,
      season: selectedSeason.season,
      episode: selectedEp.episode,
      captions: [],
      anime: { name: selected.title, source: 'dizibox' }
    });

    // Auto next episode
    if (playResult?.action === 'next') {
      const nextEp = episodes.find(e => e.episode === selectedEp.episode + 1);
      if (nextEp) {
        const nextSpinner = createSpinner(`Sonraki bölüm yükleniyor (S${selectedSeason.season}E${nextEp.episode})...`).start();
        try {
          const nextStream = await getDDiziBoxStream(nextEp.url);
          nextSpinner.succeed('Sonraki bölüm hazır!');
          await playStream({
            playerType: config.player,
            streamUrl: nextStream.streamUrl,
            isDirect: nextStream.isDirect,
            embedUrl: nextStream.embedUrl,
            title: selected.title,
            episodeName: `Sezon ${selectedSeason.season} Bölüm ${nextEp.episode}`,
            season: selectedSeason.season,
            episode: nextEp.episode,
            captions: [],
            anime: { name: selected.title, source: 'dizibox' }
          });
        } catch {}
      }
    }
  }
}

/**
 * Handle Yabancı Dizi (yabancidizi.news) Movie & Series Flow
 */
export async function handleYabanciDiziDetailFlow(selected) {
  if (!selected.isSeries) {
    const playSpinner = createSpinner(`1080p Film akışı çözülüyor (${selected.title})...`).start();
    try {
      const streamData = await getYabanciDiziStream(selected.href || selected.url);
      playSpinner.succeed('Film akışı hazır!');
      const config = getConfig();

      addToHistory({
        id: selected.href || selected.url,
        titleId: selected.href || selected.url,
        titleName: selected.title,
        name: selected.title,
        source: 'yabancidizi',
        season: 1,
        episode: 1,
        episodeName: selected.year || 'Film',
        timestamp: Date.now()
      });

      await playStream({
        playerType: config.player,
        streamUrl: streamData.streamUrl,
        isDirect: streamData.isDirect,
        embedUrl: streamData.embedUrl,
        title: selected.title,
        episodeName: selected.year || 'Film',
        season: 1,
        episode: 1,
        captions: [],
        anime: { name: selected.title, source: 'yabancidizi' }
      });
    } catch (err) {
      playSpinner.fail(`Oynatma başlatılamadı: ${err.message}`);
      await pause();
    }
    return;
  }

  const detailSpinner = createSpinner(`Sezonlar ve bölümler alınıyor (${selected.title})...`).start();
  let details;
  try {
    details = await getYabanciDiziDetails(selected.href || selected.url);
    detailSpinner.succeed('YabancıDizi bölüm listesi hazır.');
  } catch (err) {
    detailSpinner.fail(`Bölümler alınamadı: ${err.message}`);
    await pause();
    return;
  }

  const seasons = details.seasons || [];
  if (seasons.length === 0) {
    console.log(chalk.yellow('\nBu dizi için henüz bölüm bulunamadı.'));
    await pause();
    return;
  }

  let selectedSeason = seasons[0];
  if (seasons.length > 1) {
    const seasonChoices = seasons.map(s => ({
      name: `Sezon ${s.season} (${s.episodes.length} Bölüm)`,
      value: s
    }));
    seasonChoices.push(new Separator());
    seasonChoices.push({ name: '🔙 Geri Dön', value: null });

    selectedSeason = await select({
      message: 'Hangi sezonu izlemek istiyorsunuz?',
      choices: seasonChoices,
      pageSize: 10
    });
    if (!selectedSeason) return;
  }

  const episodes = selectedSeason.episodes || [];
  while (true) {
    const epChoices = episodes.map(ep => ({
      name: `${chalk.bold.hex('#a78bfa')(ep.name || `${ep.episode}. Bölüm`)}`,
      value: ep
    }));
    epChoices.push(new Separator());
    epChoices.push({ name: '🔙 Geri Dön', value: null });

    const selectedEp = await select({
      message: `${selected.title} - Bölüm seçin:`,
      choices: epChoices,
      pageSize: 14
    });

    if (!selectedEp) break;

    const playSpinner = createSpinner(`1080p HD akış hazırlanıyor (${selectedEp.name})...`).start();
    let streamData;
    try {
      streamData = await getYabanciDiziStream(selectedEp.url);
      playSpinner.succeed('YabancıDizi akışı hazırlandı!');
    } catch (err) {
      playSpinner.fail(`Akış çözülemedi: ${err.message}`);
      await pause();
      continue;
    }

    const config = getConfig();

    addToHistory({
      id: selectedEp.url,
      titleId: selected.href || selected.url,
      titleName: selected.title,
      name: selected.title,
      source: 'yabancidizi',
      season: selectedSeason.season,
      episode: selectedEp.episode,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      timestamp: Date.now()
    });

    console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${selected.title} - S${selectedSeason.season}E${selectedEp.episode}`));

    const playResult = await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: streamData.isDirect,
      embedUrl: streamData.embedUrl,
      title: selected.title,
      episodeName: `Sezon ${selectedSeason.season} Bölüm ${selectedEp.episode}`,
      season: selectedSeason.season,
      episode: selectedEp.episode,
      captions: [],
      anime: { name: selected.title, source: 'yabancidizi' }
    });

    if (playResult?.action === 'next') {
      const nextEp = episodes.find(e => e.episode === selectedEp.episode + 1);
      if (nextEp) {
        const nextSpinner = createSpinner(`Sonraki bölüm yükleniyor (S${selectedSeason.season}E${nextEp.episode})...`).start();
        try {
          const nextStream = await getYabanciDiziStream(nextEp.url);
          nextSpinner.succeed('Sonraki bölüm hazır!');
          await playStream({
            playerType: config.player,
            streamUrl: nextStream.streamUrl,
            isDirect: nextStream.isDirect,
            embedUrl: nextStream.embedUrl,
            title: selected.title,
            episodeName: `Sezon ${selectedSeason.season} Bölüm ${nextEp.episode}`,
            season: selectedSeason.season,
            episode: nextEp.episode,
            captions: [],
            anime: { name: selected.title, source: 'yabancidizi' }
          });
        } catch {}
      }
    }
  }
}

/**
 * Handle Turkish TV Series Dedicated Tab Flow (trdiziizle.tv /tr2/)
 */
export async function handleTrDiziFlow(prefillQuery = null) {
  printHeader('🇹🇷 YERLİ TÜRK DİZİLERİ ARA & İZLE');
  console.log(chalk.gray('TRDiziİzle (/tr2/) arşivi üzerinden 1000+ yerli Türk dizisini 1080p izleyin.\n'));

  let query = prefillQuery;
  if (!query) {
    query = await input({
      message: 'Aranacak Türk Dizisi Adı (örn. Kurtlar Vadisi, Kızılcık Şerbeti, Ezel):',
      validate: (v) => v.trim().length > 0 ? true : 'Lütfen bir dizi adı girin'
    });
  }

  const spinner = createSpinner(`"${query}" yerli Türk dizileri arşivinde aranıyor...`).start();
  let results = [];
  try {
    results = await searchTrDizi(query.trim());
    spinner.succeed(`Toplam ${results.length} yerli dizi bulundu.`);
  } catch (e) {
    spinner.fail(`Arama başarısız: ${e.message}`);
    await pause();
    return;
  }

  if (results.length === 0) {
    console.log(chalk.yellow('\nEşleşen yerli dizi bulunamadı.'));
    await pause();
    return;
  }

  const choices = results.map(item => ({
    name: formatResultBadge(item),
    value: item
  }));
  choices.push(new Separator());
  choices.push({ name: '🔙 İptal / Ana Menüye Dön', value: null });

  const selected = await select({
    message: 'İzlemek istediğin yerli diziyi seç:',
    choices,
    pageSize: 15
  });

  if (!selected) return;

  displayMediaCard(selected);
  await handleTrDiziDetailFlow(selected);
}

/**
 * Handle Turkish TV Series Episode Flow
 */
export async function handleTrDiziDetailFlow(selected) {
  const detailSpinner = createSpinner(`Bölümler alınıyor (${selected.title})...`).start();
  let details;
  try {
    details = await getTrDiziDetails(selected.href || selected.url);
    detailSpinner.succeed(`${details.episodes.length} bölüm hazırlandı.`);
  } catch (err) {
    detailSpinner.fail(`Bölümler alınamadı: ${err.message}`);
    await pause();
    return;
  }

  const episodes = details.episodes || [];
  if (episodes.length === 0) {
    console.log(chalk.yellow('\nBu dizi için bölüm bulunamadı.'));
    await pause();
    return;
  }

  while (true) {
    const epChoices = episodes.map(ep => ({
      name: `${chalk.bold.hex('#f43f5e')(ep.name || `${ep.episode}. Bölüm`)}`,
      value: ep
    }));
    epChoices.push(new Separator());
    epChoices.push({ name: '🔙 Geri Dön', value: null });

    const selectedEp = await select({
      message: `${selected.title} - Bölüm seçin:`,
      choices: epChoices,
      pageSize: 15
    });

    if (!selectedEp) break;

    const playSpinner = createSpinner(`1080p Akış hazırlanıyor (${selectedEp.name})...`).start();
    let streamData;
    try {
      streamData = await getTrDiziStream(selectedEp.url);
      playSpinner.succeed('Yerli dizi akışı hazır!');
    } catch (err) {
      playSpinner.fail(`Akış çözülemedi: ${err.message}`);
      await pause();
      continue;
    }

    const config = getConfig();

    addToHistory({
      id: selectedEp.url,
      titleId: selected.href || selected.url,
      titleName: selected.title,
      name: selected.title,
      source: 'trdizi',
      season: 1,
      episode: selectedEp.episode,
      episodeName: selectedEp.name,
      timestamp: Date.now()
    });

    console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${selected.title} - ${selectedEp.name}`));

    const playResult = await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: streamData.isDirect,
      embedUrl: streamData.embedUrl,
      title: selected.title,
      episodeName: selectedEp.name,
      season: 1,
      episode: selectedEp.episode,
      captions: [],
      anime: { name: selected.title, source: 'trdizi' }
    });

    if (playResult?.action === 'next') {
      const nextEp = episodes.find(e => e.episode === selectedEp.episode + 1);
      if (nextEp) {
        const nextSpinner = createSpinner(`Sonraki bölüm yükleniyor (${nextEp.name})...`).start();
        try {
          const nextStream = await getTrDiziStream(nextEp.url);
          nextSpinner.succeed('Sonraki bölüm hazır!');
          await playStream({
            playerType: config.player,
            streamUrl: nextStream.streamUrl,
            isDirect: nextStream.isDirect,
            embedUrl: nextStream.embedUrl,
            title: selected.title,
            episodeName: nextEp.name,
            season: 1,
            episode: nextEp.episode,
            captions: [],
            anime: { name: selected.title, source: 'trdizi' }
          });
        } catch {}
      }
    }
  }
}

/**
 * Handle Live Sports & Matches Flow
 */
export async function handleLiveSportsFlow() {
  while (true) {
    printHeader('⚽ CANLI SPOR & TV KANALLARI');
    console.log(chalk.gray('Canlı spor ve açık yayın kanalları.\n'));

    const spinner = createSpinner('Canlı spor kanalları listeleniyor...').start();
    let channels = [];
    try {
      channels = await getSportChannels();
      spinner.succeed(`${channels.length} spor kanalı hazır.`);
    } catch (err) {
      spinner.fail(`Kanallar alınamadı: ${err.message}`);
      await pause();
      return;
    }

    if (channels.length === 0) {
      console.log(chalk.yellow('\nCanlı spor kanalı bulunamadı.'));
      await pause();
      return;
    }

    const channelChoices = [
      {
        name: chalk.yellow('🔍 Kanal Ara (Filtrele)'),
        value: '__SEARCH__'
      },
      new Separator(),
      ...channels.map(ch => ({
        name: `${chalk.bold.hex('#22c55e')('[CANLI]')} ${chalk.white(ch.name)}`,
        value: ch
      })),
      new Separator(),
      { name: '🔙 Ana Menüye Dön', value: null }
    ];

    const selected = await select({
      message: 'İzlemek istediğiniz canlı spor kanalını seçin:',
      choices: channelChoices,
      pageSize: 16
    });

    if (!selected) break;

    if (selected === '__SEARCH__') {
      const q = await input({
        message: 'Aramak istediğiniz kanal adı (örn: trt, spor, tv):',
        validate: v => v.trim().length > 0 ? true : 'Lütfen geçerli bir isim girin'
      });
      const filtered = channels.filter(ch => ch.name.toLowerCase().includes(q.trim().toLowerCase()));
      if (filtered.length === 0) {
        console.log(chalk.yellow(`\n"${q}" ile eşleşen spor kanalı bulunamadı.`));
        await pause();
        continue;
      }
      const filterChoices = filtered.map(ch => ({
        name: `${chalk.bold.hex('#22c55e')('[CANLI]')} ${chalk.white(ch.name)}`,
        value: ch
      }));
      filterChoices.push(new Separator());
      filterChoices.push({ name: '🔙 Geri Dön', value: null });

      const pickedCh = await select({
        message: 'Arama sonuçlarından kanal seçin:',
        choices: filterChoices,
        pageSize: 14
      });
      if (pickedCh) {
        await handleSportChannelPlayFlow(pickedCh);
      }
      continue;
    }

    await handleSportChannelPlayFlow(selected);
  }
}

/**
 * Handle Sport Channel Stream Resolution & Playback
 */
export async function handleSportChannelPlayFlow(channel) {
  const streamSpinner = createSpinner(`"${channel.name}" canlı akışları çözümleniyor...`).start();
  let streams = [];
  try {
    streams = await getSportStreams(channel.id);
  } catch (err) {
    streamSpinner.fail(`Akışlar alınamadı: ${err.message}`);
    await pause();
    return;
  }

  if (!streams || streams.length === 0) {
    streamSpinner.fail('Bu kanal için şu an aktif canlı yayın bulunamadı.');
    await pause();
    return;
  }

  streamSpinner.succeed(`${streams.length} canlı yayın akışı hazırlandı.`);

  let chosenStream = streams[0];
  if (streams.length > 1) {
    const streamChoices = streams.map(s => ({
      name: `${chalk.bold.hex('#c084fc')(s.name)} - ${chalk.white(s.title || channel.name)}`,
      value: s,
      description: `HLS / m3u8 Akışı: ${s.url}`
    }));
    streamChoices.push(new Separator());
    streamChoices.push({ name: '🔙 Geri Dön', value: null });

    const picked = await select({
      message: `${channel.name} için yayın sunucusu / kaynağı seçin:`,
      choices: streamChoices,
      pageSize: 10
    });

    if (!picked) return;
    chosenStream = picked;
  }

  const config = getConfig();
  console.log(chalk.gray(`\nCanlı yayın oynatıcıya gönderiliyor: ${channel.name} (${chosenStream.name})`));

  try {
    await playStream({
      playerType: config.player,
      streamUrl: chosenStream.url,
      isDirect: true,
      title: channel.name,
      episodeName: chosenStream.title || 'Canlı Maç',
      season: 1,
      episode: 1,
      anime: { name: channel.name, source: 'sport' },
      headers: chosenStream.headers
    });
  } catch (err) {
    console.error(chalk.red('\nOynatma başlatılamadı:'), err.message);
    await pause();
  }
}

// Backward-compatible alias
export const handleHdFilmFlow = handleUnifiedMovieFlow;

export async function handleHdFilmDirectUrl(url) {
  const playSpinner = createSpinner(`1080p HD akış ve altyazılar çözülüyor...`).start();
  try {
    const streamData = await getHdFilmStream(url);
    playSpinner.succeed('1080p Akış başarıyla hazırlandı!');

    const config = getConfig();
    addToHistory({
      id: url,
      name: streamData.title || 'HDFilm İçeriği',
      source: 'hdfilm',
      season: 1,
      episode: 1,
      timestamp: Date.now()
    });

    await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: true,
      title: streamData.title || 'HDFilm İzle',
      episodeName: 'Film / Dizi',
      season: 1,
      episode: 1,
      captions: streamData.captions,
      anime: { name: streamData.title, source: 'hdfilm' }
    });
  } catch (err) {
    playSpinner.fail(`Oynatma başlatılamadı: ${err.message}`);
    await pause();
  }
}

export async function handleHdFilmPlayFlow(selected) {
  let targetUrl = selected.href || selected.url;
  let season = 1;
  let episode = 1;

  if (selected.isSeries) {
    const epSpinner = createSpinner(`Bölümler alınıyor (${selected.title})...`).start();
    let allEps = [];
    try {
      allEps = await getHdFilmSeriesEpisodes(targetUrl);
      epSpinner.succeed(`${allEps.length} bölüm listelendi.`);
    } catch (e) {
      epSpinner.fail(`Bölümler alınamadı: ${e.message}`);
      await pause();
      return;
    }

    if (allEps.length === 0) {
      console.log(chalk.yellow('\nBu dizi için bölüm bulunamadı.'));
      await pause();
      return;
    }

    // Group by season
    const seasonsMap = new Map();
    for (const ep of allEps) {
      if (!seasonsMap.has(ep.season)) {
        seasonsMap.set(ep.season, []);
      }
      seasonsMap.get(ep.season).push(ep);
    }

    let chosenSeason = 1;
    const seasonKeys = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
    if (seasonKeys.length > 1) {
      chosenSeason = await select({
        message: 'Hangi sezonu izlemek istiyorsunuz?',
        choices: seasonKeys.map(s => ({
          name: `Sezon ${s} (${seasonsMap.get(s).length} Bölüm)`,
          value: s
        }))
      });
    } else {
      chosenSeason = seasonKeys[0];
    }

    const seasonEps = seasonsMap.get(chosenSeason);
    const chosenEp = await select({
      message: `${selected.title} - Bölüm seçin:`,
      choices: seasonEps.map(e => ({
        name: chalk.bold.hex('#60a5fa')(e.name || `${e.episode}. Bölüm`),
        value: e
      })),
      pageSize: 14
    });

    season = chosenEp.season;
    episode = chosenEp.episode;
    targetUrl = chosenEp.url;
  }

  // Directly ask user: Türkçe Dublaj mı, Türkçe Altyazılı mı?
  const audioPreference = await select({
    message: 'İzleme seçeneğini belirleyin:',
    choices: [
      {
        name: '💬 Türkçe Altyazılı (Orijinal Ses)',
        value: 'sub',
        description: 'Orijinal ses dili ile Türkçe altyazı otomatik aktif başlar'
      },
      {
        name: '🇹🇷 Türkçe Dublaj',
        value: 'dub',
        description: 'Türkçe seslendirme ile başlar (altyazı varsayılan kapalı)'
      }
    ]
  });

  const playSpinner = createSpinner(`1080p HD akış ve altyazılar çözülüyor (${selected.title})...`).start();
  try {
    const streamData = await getHdFilmStream(targetUrl, audioPreference);
    playSpinner.succeed('1080p Akış başarıyla hazırlandı!');

    const config = getConfig();
    addToHistory({
      id: targetUrl,
      titleId: targetUrl,
      titleName: selected.title,
      name: selected.title,
      source: 'hdfilm',
      season,
      episode,
      episodeName: selected.isSeries ? `Sezon ${season} Bölüm ${episode}` : (selected.year || 'Film'),
      timestamp: Date.now()
    });

    console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${streamData.title}`));
    console.log(chalk.cyan(`İzleme Tercihi: ${audioPreference === 'dub' ? '🇹🇷 Türkçe Dublaj' : '💬 Türkçe Altyazılı (Orijinal Ses)'}`));
    if (streamData.captions && streamData.captions.length > 0) {
      console.log(chalk.gray(`Altyazılar: ${streamData.captions.map(c => c.label).join(', ')}`));
    }

    await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: true,
      title: selected.title,
      episodeName: selected.isSeries ? `S${season}E${episode}` : (selected.year || 'Film'),
      season,
      episode,
      captions: streamData.captions,
      audioPreference,
      anime: { name: selected.title, source: 'hdfilm' }
    });
  } catch (err) {
    playSpinner.fail(`Oynatma başlatılamadı: ${err.message}`);
    await pause();
  }
}

/**
 * Handle DiziKorea (Kore & Asya Dizileri) Flow
 */
export async function handleDiziKoreaFlow() {
  printHeader('🎎 DIZIKOREA (KORE & ASYA DİZİLERİ)');
  console.log(chalk.gray('dizikorea3.com arşivi üzerinden 1080p Kore, Çin ve Japon dizilerini izleyin.\n'));

  const query = await input({
    message: 'Aranacak Dizi veya Film Adı (veya direkt URL):',
    validate: (v) => v.trim().length > 0 ? true : 'Lütfen geçerli bir arama terimi girin'
  });

  // Direct URL support
  if (query.startsWith('http://') || query.startsWith('https://')) {
    const playSpinner = createSpinner(`1080p HD akış çözülüyor...`).start();
    try {
      const streamData = await getDiziKoreaStream(query.trim());
      playSpinner.succeed('1080p Akış başarıyla hazırlandı!');

      const config = getConfig();
      addToHistory({
        id: query.trim(),
        titleId: query.trim(),
        name: streamData.title || 'DiziKorea İçeriği',
        titleName: streamData.title || 'DiziKorea İçeriği',
        source: 'dizikorea',
        season: 1,
        episode: 1,
        episodeName: 'Bölüm',
        timestamp: Date.now()
      });

      console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${streamData.title}`));

      await playStream({
        playerType: config.player,
        streamUrl: streamData.streamUrl,
        isDirect: true,
        title: streamData.title,
        episodeName: 'DiziKorea',
        season: 1,
        episode: 1,
        captions: [],
        anime: { name: streamData.title, source: 'dizikorea' }
      });
      return;
    } catch (err) {
      playSpinner.fail(`Oynatma başlatılamadı: ${err.message}`);
      await pause();
      return;
    }
  }

  const spinner = createSpinner(`"${query}" DiziKorea arşivinde aranıyor...`).start();
  let results = [];
  try {
    results = await searchDiziKorea(query.trim());
    spinner.succeed(`${results.length} içerik bulundu.`);
  } catch (err) {
    spinner.fail(`Arama başarısız: ${err.message}`);
    await pause();
    return;
  }

  if (results.length === 0) {
    console.log(chalk.yellow('\nHerhangi bir Kore veya Asya dizisi bulunamadı.'));
    await pause();
    return;
  }

  const choices = results.map(item => {
    const badge = item.isSeries ? chalk.bgMagenta.black(' DİZİ ') : chalk.bgBlue.black(' FİLM ');
    const metaParts = [];
    if (item.year) metaParts.push(item.year);
    if (item.imdb) metaParts.push(`⭐ IMDb: ${item.imdb}`);
    const meta = metaParts.length > 0 ? `(${metaParts.join(' • ')})` : '';

    return {
      name: `${badge} ${chalk.white.bold(item.title)} ${chalk.gray(meta)}`,
      value: item
    };
  });

  choices.push(new Separator());
  choices.push({ name: '🔙 İptal / Geri Dön', value: 'back' });

  const selected = await select({
    message: 'İzlemek istediğiniz içeriği seçin:',
    pageSize: 12,
    choices
  });

  if (selected === 'back') return;
  displayMediaCard(selected);
  await handleDiziKoreaDetailFlow(selected);
}

export async function handleDiziKoreaDetailFlow(selected) {
  const detailSpinner = createSpinner(`Sezonlar ve bölümler alınıyor (${selected.title})...`).start();
  let details;
  try {
    details = await getDiziDetails(selected.url);
    detailSpinner.succeed('Bölüm listesi hazır.');
  } catch (err) {
    detailSpinner.fail(`Bölümler alınamadı: ${err.message}`);
    await pause();
    return;
  }

  const seasons = details.seasons || [];
  if (seasons.length === 0) {
    console.log(chalk.yellow('\nBu yapım için henüz bölüm bulunamadı.'));
    await pause();
    return;
  }

  // Choose Season
  let selectedSeason = seasons[0];
  if (seasons.length > 1) {
    const seasonChoices = seasons.map(s => ({
      name: `Sezon ${s.season} (${s.episodes.length} Bölüm)`,
      value: s
    }));
    seasonChoices.push(new Separator());
    seasonChoices.push({ name: '🔙 Geri Dön', value: null });

    selectedSeason = await select({
      message: 'Hangi sezonu izlemek istiyorsunuz?',
      choices: seasonChoices,
      pageSize: 10
    });
    if (!selectedSeason) return;
  }

  // Choose Episode loop
  const episodes = selectedSeason.episodes || [];
  while (true) {
    const epChoices = episodes.map(ep => ({
      name: `${chalk.bold.cyan(`${ep.name || `${ep.episode}. Bölüm`}`)}${ep.title && ep.title !== ep.name ? chalk.white(` - ${ep.title}`) : ''}`,
      value: ep
    }));
    epChoices.push(new Separator());
    epChoices.push({ name: '🔙 Geri Dön', value: null });

    const selectedEp = await select({
      message: `${selected.title} - Bölüm seçin:`,
      choices: epChoices,
      pageSize: 14
    });

    if (!selectedEp) break;

    const playSpinner = createSpinner(`1080p HD akış çözülüyor (S${selectedSeason.season}E${selectedEp.episode})...`).start();
    let streamData;
    try {
      streamData = await getDiziKoreaStream(selectedEp.url);
      playSpinner.succeed('1080p Akış başarıyla hazırlandı!');
    } catch (err) {
      playSpinner.fail(`Akış çözülemedi: ${err.message}`);
      await pause();
      continue;
    }

    const config = getConfig();
    addToHistory({
      id: selectedEp.url,
      titleId: selected.url,
      titleName: selected.title,
      name: selected.title,
      source: 'dizikorea',
      season: selectedSeason.season,
      episode: selectedEp.episode,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      timestamp: Date.now()
    });

    console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${selected.title} - S${selectedSeason.season}E${selectedEp.episode}`));

    const playResult = await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: true,
      title: selected.title,
      episodeName: `Sezon ${selectedSeason.season} Bölüm ${selectedEp.episode}`,
      season: selectedSeason.season,
      episode: selectedEp.episode,
      captions: [],
      anime: { name: selected.title, source: 'dizikorea' }
    });

    // Auto next episode
    if (playResult?.action === 'next') {
      const nextEp = episodes.find(e => e.episode === selectedEp.episode + 1);
      if (nextEp) {
        const nextSpinner = createSpinner(`Sonraki bölüm yükleniyor (S${selectedSeason.season}E${nextEp.episode})...`).start();
        try {
          const nextStream = await getDiziKoreaStream(nextEp.url);
          nextSpinner.succeed('Sonraki bölüm hazır!');
          await playStream({
            playerType: config.player,
            streamUrl: nextStream.streamUrl,
            isDirect: true,
            title: selected.title,
            episodeName: `Sezon ${selectedSeason.season} Bölüm ${nextEp.episode}`,
            season: selectedSeason.season,
            episode: nextEp.episode,
            captions: [],
            anime: { name: selected.title, source: 'dizikorea' }
          });
        } catch {}
      }
    }
  }
}

/**
 * Handle Anizm (Türkçe Anime Arşivi) Flow
 */
export async function handleAnizmFlow() {
  printHeader('🎌 ANIZM (TÜRKÇE ANİME ARŞİVİ)');
  console.log(chalk.gray('anizm.net arşivi üzerinden anime dizilerini ve filmlerini 1080p Türkçe altyazılı izleyin.\n'));

  const query = await input({
    message: 'Aranacak Anime veya Film Adı (veya direkt URL):',
    validate: (v) => v.trim().length > 0 ? true : 'Lütfen geçerli bir arama terimi girin'
  });

  // Direct URL support
  if (query.startsWith('http://') || query.startsWith('https://')) {
    const playSpinner = createSpinner(`1080p HD akış çözülüyor...`).start();
    try {
      const streamData = await getAnizmStream(query.trim());
      playSpinner.succeed(`1080p Akış başarıyla hazırlandı! (${streamData.sourceName || 'Anizm'})`);

      const config = getConfig();
      addToHistory({
        id: query.trim(),
        titleId: query.trim(),
        name: streamData.title || 'Anizm İçeriği',
        titleName: streamData.title || 'Anizm İçeriği',
        source: 'anizm',
        season: 1,
        episode: 1,
        episodeName: 'Bölüm',
        timestamp: Date.now()
      });

      console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${streamData.title || query.trim()}`));

      await playStream({
        playerType: config.player,
        streamUrl: streamData.streamUrl,
        isDirect: true,
        title: streamData.title || 'Anizm',
        episodeName: 'Anizm Anime',
        season: 1,
        episode: 1,
        captions: [],
        anime: { name: streamData.title || 'Anizm Anime', source: 'anizm' }
      });
      return;
    } catch (err) {
      playSpinner.fail(`Oynatma başlatılamadı: ${err.message}`);
      await pause();
      return;
    }
  }

  const spinner = createSpinner(`"${query}" Anizm arşivinde aranıyor...`).start();
  let results = [];
  try {
    results = await searchAnizm(query.trim());
    spinner.succeed(`${results.length} anime bulundu.`);
  } catch (err) {
    spinner.fail(`Arama başarısız: ${err.message}`);
    await pause();
    return;
  }

  if (results.length === 0) {
    console.log(chalk.yellow('\nHerhangi bir anime bulunamadı.'));
    await pause();
    return;
  }

  const choices = results.map(item => {
    const badge = chalk.bgRed.white(' 🎌 ANİME ');
    const meta = item.year ? chalk.gray(`(${item.year})`) : '';

    return {
      name: `${badge} ${chalk.white.bold(item.title)} ${meta}`,
      value: item
    };
  });

  choices.push(new Separator());
  choices.push({ name: '🔙 İptal / Geri Dön', value: 'back' });

  const selected = await select({
    message: 'İzlemek istediğiniz animeyi seçin:',
    pageSize: 12,
    choices
  });

  if (selected === 'back') return;
  displayMediaCard(selected);
  await handleAnizmDetailFlow(selected);
}

export async function handleAnizmDetailFlow(selected) {
  const detailSpinner = createSpinner(`Bölüm listesi alınıyor (${selected.title})...`).start();
  let details;
  try {
    details = await getAnizmDetails(selected.url);
    detailSpinner.succeed(`${details.episodes.length} bölüm hazır.`);
  } catch (err) {
    detailSpinner.fail(`Bölümler alınamadı: ${err.message}`);
    await pause();
    return;
  }

  const episodes = details.episodes || [];
  if (episodes.length === 0) {
    console.log(chalk.yellow('\nBu yapım için henüz izlenebilir bölüm bulunamadı.'));
    await pause();
    return;
  }

  // Episode Selection loop
  while (true) {
    const epChoices = episodes.map(ep => ({
      name: `${chalk.bold.hex('#f472b6')(ep.name || `${ep.episode}. Bölüm`)}${ep.title && ep.title !== ep.name ? chalk.white(` - ${ep.title}`) : ''}`,
      value: ep
    }));
    epChoices.push(new Separator());
    epChoices.push({ name: '🔙 Geri Dön', value: null });

    const selectedEp = await select({
      message: `${selected.title} - Bölüm seçin:`,
      choices: epChoices,
      pageSize: 14
    });

    if (!selectedEp) break;

    const playSpinner = createSpinner(`1080p HD akış çözülüyor (${selectedEp.name})...`).start();
    let streamData;
    try {
      streamData = await getAnizmStream(selectedEp.url);
      playSpinner.succeed(`1080p Akış başarıyla hazırlandı! (${streamData.sourceName || 'Anizm Player'})`);
    } catch (err) {
      playSpinner.fail(`Akış çözülemedi: ${err.message}`);
      await pause();
      continue;
    }

    const config = getConfig();
    addToHistory({
      id: selectedEp.url,
      titleId: selected.url,
      titleName: selected.title,
      name: selected.title,
      source: 'anizm',
      season: 1,
      episode: selectedEp.episode,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      timestamp: Date.now()
    });

    console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${selected.title} - ${selectedEp.name}`));

    const playResult = await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: true,
      title: selected.title,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      season: 1,
      episode: selectedEp.episode,
      captions: [],
      anime: { name: selected.title, source: 'anizm' }
    });

    // Auto next episode
    if (playResult?.action === 'next') {
      const nextEp = episodes.find(e => e.episode === selectedEp.episode + 1);
      if (nextEp) {
        const nextSpinner = createSpinner(`Sonraki bölüm yükleniyor (${nextEp.name})...`).start();
        try {
          const nextStream = await getAnizmStream(nextEp.url);
          nextSpinner.succeed('Sonraki bölüm hazır!');
          await playStream({
            playerType: config.player,
            streamUrl: nextStream.streamUrl,
            isDirect: true,
            title: selected.title,
            episodeName: nextEp.name || `${nextEp.episode}. Bölüm`,
            season: 1,
            episode: nextEp.episode,
            captions: [],
            anime: { name: selected.title, source: 'anizm' }
          });
        } catch {}
      }
    }
  }
}

/**
 * Handle WebDramaTurkey (Asya & BL Dizileri) Flow
 */
export async function handleWebDramaTurkeyFlow() {
  printHeader('🏮 WEBDRAMATURKEY (ASYA & BL DİZİLERİ)');
  console.log(chalk.gray('webdramaturkey2.com arşivi üzerinden Asya, Kore, Çin ve BL dizilerini 1080p izleyin.\n'));

  const query = await input({
    message: 'Aranacak Dizi veya Film Adı (veya direkt URL):',
    validate: (v) => v.trim().length > 0 ? true : 'Lütfen geçerli bir arama terimi girin'
  });

  // Direct URL support
  if (query.startsWith('http://') || query.startsWith('https://')) {
    const playSpinner = createSpinner(`1080p HD akış çözülüyor...`).start();
    try {
      const streamData = await getWebDramaTurkeyStream(query.trim());
      playSpinner.succeed(`1080p Akış başarıyla hazırlandı! (${streamData.sourceName || 'WDT'})`);

      const config = getConfig();
      addToHistory({
        id: query.trim(),
        titleId: query.trim(),
        name: streamData.title || 'WebDrama İçeriği',
        titleName: streamData.title || 'WebDrama İçeriği',
        source: 'webdramaturkey',
        season: 1,
        episode: 1,
        episodeName: 'Bölüm',
        timestamp: Date.now()
      });

      console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${streamData.title || query.trim()}`));

      await playStream({
        playerType: config.player,
        streamUrl: streamData.streamUrl,
        isDirect: streamData.isDirect,
        embedUrl: streamData.embedUrl,
        title: streamData.title || 'WebDramaTurkey',
        episodeName: 'WebDrama',
        season: 1,
        episode: 1,
        captions: [],
        anime: { name: streamData.title || 'WebDramaTurkey', source: 'webdramaturkey' }
      });
      return;
    } catch (err) {
      playSpinner.fail(`Oynatma başlatılamadı: ${err.message}`);
      await pause();
      return;
    }
  }

  const spinner = createSpinner(`"${query}" WebDramaTurkey arşivinde aranıyor...`).start();
  let results = [];
  try {
    results = await searchWebDramaTurkey(query.trim());
    spinner.succeed(`${results.length} içerik bulundu.`);
  } catch (err) {
    spinner.fail(`Arama başarısız: ${err.message}`);
    await pause();
    return;
  }

  if (results.length === 0) {
    console.log(chalk.yellow('\nHerhangi bir dizi veya film bulunamadı.'));
    await pause();
    return;
  }

  const choices = results.map(item => {
    const badge = item.isMovie ? chalk.bgBlue.white(' 🎬 FİLM ') : chalk.bgMagenta.white(' 🏮 DİZİ ');
    return {
      name: `${badge} ${chalk.white.bold(item.title)}`,
      value: item
    };
  });

  choices.push(new Separator());
  choices.push({ name: '🔙 İptal / Geri Dön', value: 'back' });

  const selected = await select({
    message: 'İzlemek istediğiniz içeriği seçin:',
    pageSize: 12,
    choices
  });

  if (selected === 'back') return;
  displayMediaCard(selected);
  await handleWebDramaTurkeyDetailFlow(selected);
}

export async function handleWebDramaTurkeyDetailFlow(selected) {
  const detailSpinner = createSpinner(`Bölüm listesi alınıyor (${selected.title})...`).start();
  let details;
  try {
    details = await getWebDramaTurkeyDetails(selected.url);
    detailSpinner.succeed(`${details.episodes.length} bölüm hazır.`);
  } catch (err) {
    detailSpinner.fail(`Bölümler alınamadı: ${err.message}`);
    await pause();
    return;
  }

  const episodes = details.episodes || [];
  if (episodes.length === 0) {
    console.log(chalk.yellow('\nBu yapım için henüz izlenebilir bölüm bulunamadı.'));
    await pause();
    return;
  }

  // Episode Selection loop
  while (true) {
    const epChoices = episodes.map(ep => ({
      name: `${chalk.bold.hex('#ec4899')(ep.name || `${ep.episode}. Bölüm`)}${ep.title && ep.title !== ep.name ? chalk.white(` - ${ep.title}`) : ''}`,
      value: ep
    }));
    epChoices.push(new Separator());
    epChoices.push({ name: '🔙 Geri Dön', value: null });

    const selectedEp = await select({
      message: `${selected.title} - Bölüm seçin:`,
      choices: epChoices,
      pageSize: 14
    });

    if (!selectedEp) break;

    const playSpinner = createSpinner(`1080p HD akış çözülüyor (${selectedEp.name})...`).start();
    let streamData;
    try {
      streamData = await getWebDramaTurkeyStream(selectedEp.url);
      playSpinner.succeed(`1080p Akış başarıyla hazırlandı! (${streamData.sourceName || 'WDT'})`);
    } catch (err) {
      playSpinner.fail(`Akış çözülemedi: ${err.message}`);
      await pause();
      continue;
    }

    const config = getConfig();
    addToHistory({
      id: selectedEp.url,
      titleId: selected.url,
      titleName: selected.title,
      name: selected.title,
      source: 'webdramaturkey',
      season: selectedEp.season || 1,
      episode: selectedEp.episode,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      timestamp: Date.now()
    });

    console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${selected.title} - ${selectedEp.name}`));

    const playResult = await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: streamData.isDirect,
      embedUrl: streamData.embedUrl,
      title: selected.title,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      season: selectedEp.season || 1,
      episode: selectedEp.episode,
      captions: [],
      anime: { name: selected.title, source: 'webdramaturkey' }
    });

    // Auto next episode
    if (playResult?.action === 'next') {
      const nextEp = episodes.find(e => e.episode === selectedEp.episode + 1 && e.season === selectedEp.season);
      if (nextEp) {
        const nextSpinner = createSpinner(`Sonraki bölüm yükleniyor (${nextEp.name})...`).start();
        try {
          const nextStream = await getWebDramaTurkeyStream(nextEp.url);
          nextSpinner.succeed('Sonraki bölüm hazır!');
          await playStream({
            playerType: config.player,
            streamUrl: nextStream.streamUrl,
            isDirect: nextStream.isDirect,
            embedUrl: nextStream.embedUrl,
            title: selected.title,
            episodeName: nextEp.name || `${nextEp.episode}. Bölüm`,
            season: nextEp.season || 1,
            episode: nextEp.episode,
            captions: [],
            anime: { name: selected.title, source: 'webdramaturkey' }
          });
        } catch {}
      }
    }
  }
}

/**
 * Handle DiziAsya (Kore, Çin & Asya Arşivi) Flow
 */
export async function handleDiziAsyaFlow() {
  printHeader('🐉 DIZIASYA (KORE, ÇİN & ASYA ARŞİVİ)');
  console.log(chalk.gray('diziasya.com arşivi üzerinden popüler Asya dizilerini ve filmlerini 1080p Türkçe altyazılı izleyin.\n'));

  const query = await input({
    message: 'Aranacak Dizi veya Film Adı (veya direkt URL):',
    validate: (v) => v.trim().length > 0 ? true : 'Lütfen geçerli bir arama terimi girin'
  });

  // Direct URL support
  if (query.startsWith('http://') || query.startsWith('https://')) {
    const playSpinner = createSpinner(`1080p HD akış çözülüyor...`).start();
    try {
      const streamData = await getDiziAsyaStream(query.trim());
      playSpinner.succeed(`1080p Akış başarıyla hazırlandı! (${streamData.sourceName || 'DiziAsya'})`);

      const config = getConfig();
      addToHistory({
        id: query.trim(),
        titleId: query.trim(),
        name: streamData.title || 'DiziAsya İçeriği',
        titleName: streamData.title || 'DiziAsya İçeriği',
        source: 'diziasya',
        season: 1,
        episode: 1,
        episodeName: 'Bölüm',
        timestamp: Date.now()
      });

      console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${streamData.title || query.trim()}`));

      await playStream({
        playerType: config.player,
        streamUrl: streamData.streamUrl,
        isDirect: streamData.isDirect,
        embedUrl: streamData.embedUrl,
        title: streamData.title || 'DiziAsya',
        episodeName: 'DiziAsya',
        season: 1,
        episode: 1,
        captions: [],
        anime: { name: streamData.title || 'DiziAsya', source: 'diziasya' }
      });
      return;
    } catch (err) {
      playSpinner.fail(`Oynatma başlatılamadı: ${err.message}`);
      await pause();
      return;
    }
  }

  const spinner = createSpinner(`"${query}" DiziAsya arşivinde aranıyor...`).start();
  let results = [];
  try {
    results = await searchDiziAsya(query.trim());
    spinner.succeed(`${results.length} içerik bulundu.`);
  } catch (err) {
    spinner.fail(`Arama başarısız: ${err.message}`);
    await pause();
    return;
  }

  if (results.length === 0) {
    console.log(chalk.yellow('\nHerhangi bir dizi veya film bulunamadı.'));
    await pause();
    return;
  }

  const choices = results.map(item => {
    const badge = item.isMovie ? chalk.bgBlue.white(' 🎬 FİLM ') : chalk.bgMagenta.white(' 🐉 DİZİ ');
    const metaParts = [];
    if (item.year) metaParts.push(item.year);
    if (item.country) metaParts.push(item.country);
    if (item.rate && item.rate !== '0') metaParts.push(`⭐ ${item.rate}`);
    const meta = metaParts.length > 0 ? chalk.gray(`(${metaParts.join(' • ')})`) : '';

    return {
      name: `${badge} ${chalk.white.bold(item.title)} ${meta}`,
      value: item
    };
  });

  choices.push(new Separator());
  choices.push({ name: '🔙 İptal / Geri Dön', value: 'back' });

  const selected = await select({
    message: 'İzlemek istediğiniz içeriği seçin:',
    pageSize: 12,
    choices
  });

  if (selected === 'back') return;
  displayMediaCard(selected);
  await handleDiziAsyaDetailFlow(selected);
}

export async function handleDiziAsyaDetailFlow(selected) {
  const detailSpinner = createSpinner(`Bölüm listesi alınıyor (${selected.title})...`).start();
  let details;
  try {
    details = await getDiziAsyaDetails(selected.url);
    detailSpinner.succeed(`${details.episodes.length} bölüm hazır.`);
  } catch (err) {
    detailSpinner.fail(`Bölümler alınamadı: ${err.message}`);
    await pause();
    return;
  }

  const episodes = details.episodes || [];
  if (episodes.length === 0) {
    console.log(chalk.yellow('\nBu yapım için henüz izlenebilir bölüm bulunamadı.'));
    await pause();
    return;
  }

  // Episode Selection loop
  while (true) {
    const epChoices = episodes.map(ep => ({
      name: `${chalk.bold.hex('#8b5cf6')(ep.name || `${ep.episode}. Bölüm`)}${ep.title && ep.title !== ep.name ? chalk.white(` - ${ep.title}`) : ''}`,
      value: ep
    }));
    epChoices.push(new Separator());
    epChoices.push({ name: '🔙 Geri Dön', value: null });

    const selectedEp = await select({
      message: `${selected.title} - Bölüm seçin:`,
      choices: epChoices,
      pageSize: 14
    });

    if (!selectedEp) break;

    const playSpinner = createSpinner(`1080p HD akış çözülüyor (${selectedEp.name})...`).start();
    let streamData;
    try {
      streamData = await getDiziAsyaStream(selectedEp.url);
      playSpinner.succeed(`1080p Akış başarıyla hazırlandı! (${streamData.sourceName || 'DiziAsya'})`);
    } catch (err) {
      playSpinner.fail(`Akış çözülemedi: ${err.message}`);
      await pause();
      continue;
    }

    const config = getConfig();
    addToHistory({
      id: selectedEp.url,
      titleId: selected.url,
      titleName: selected.title,
      name: selected.title,
      source: 'diziasya',
      season: selectedEp.season || 1,
      episode: selectedEp.episode,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      timestamp: Date.now()
    });

    console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${selected.title} - ${selectedEp.name}`));

    const playResult = await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: streamData.isDirect,
      embedUrl: streamData.embedUrl,
      title: selected.title,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      season: selectedEp.season || 1,
      episode: selectedEp.episode,
      captions: [],
      anime: { name: selected.title, source: 'diziasya' }
    });

    // Auto next episode
    if (playResult?.action === 'next') {
      const nextEp = episodes.find(e => e.episode === selectedEp.episode + 1 && e.season === selectedEp.season);
      if (nextEp) {
        const nextSpinner = createSpinner(`Sonraki bölüm yükleniyor (${nextEp.name})...`).start();
        try {
          const nextStream = await getDiziAsyaStream(nextEp.url);
          nextSpinner.succeed('Sonraki bölüm hazır!');
          await playStream({
            playerType: config.player,
            streamUrl: nextStream.streamUrl,
            isDirect: nextStream.isDirect,
            embedUrl: nextStream.embedUrl,
            title: selected.title,
            episodeName: nextEp.name || `${nextEp.episode}. Bölüm`,
            season: nextEp.season || 1,
            episode: nextEp.episode,
            captions: [],
            anime: { name: selected.title, source: 'diziasya' }
          });
        } catch {}
      }
    }
  }
}

/**
 * Handle Unified Anime Search Flow (Anizm, OpenAnime, AnimeciX)
 */
export async function handleUnifiedAnimeFlow(prefillQuery = null) {
  printHeader('🎌 ANİME ARA & İZLE');
  console.log(chalk.gray('Anizium (4K UHD), Anizm, OpenAnime ve AnimeciX arşivlerinde eşzamanlı anime arayın.\n'));

  let query = prefillQuery;
  if (!query) {
    query = await input({
      message: 'Aranacak Anime Adı:',
      validate: (v) => v.trim().length > 0 ? true : 'Lütfen geçerli bir isim yazın'
    });
  }

  const spinner = createSpinner(`"${query}" tüm anime arşivlerinde (Anizium 4K, Anizm, OpenAnime, AnimeciX) aranıyor...`).start();

  const [aniziumRes, anizmRes, openAniRes, animecixRes] = await Promise.allSettled([
    searchAnizium(query),
    searchAnizm(query),
    searchOpenAni(query),
    searchAnime(query)
  ]);

  const aniziumList = (aniziumRes.status === 'fulfilled' && Array.isArray(aniziumRes.value)) ? aniziumRes.value : [];
  const anizmList = (anizmRes.status === 'fulfilled' && Array.isArray(anizmRes.value)) ? anizmRes.value : [];
  const openAniList = (openAniRes.status === 'fulfilled' && Array.isArray(openAniRes.value)) ? openAniRes.value : [];
  const animecixList = (animecixRes.status === 'fulfilled' && Array.isArray(animecixRes.value)) ? animecixRes.value : [];

  const results = [...aniziumList, ...anizmList, ...openAniList, ...animecixList];
  spinner.succeed(`Toplam ${results.length} anime bulundu (Anizium 4K: ${aniziumList.length}, Anizm: ${anizmList.length}, OpenAnime: ${openAniList.length}, AnimeciX: ${animecixList.length}).`);

  if (results.length === 0) {
    console.log(chalk.yellow('\nÜzgünüz, aramanıza uygun bir anime bulunamadı.'));
    await pause();
    return;
  }

  const choices = results.map(item => ({
    name: formatResultBadge(item),
    value: item
  }));
  choices.push(new Separator());
  choices.push({ name: '🔙 Ana Menüye Dön', value: null });

  const selectedAnime = await select({
    message: 'İzlemek istediğin animeyi seç:',
    choices,
    pageSize: 15
  });

  if (!selectedAnime) return;

  displayMediaCard(selectedAnime);

  if (selectedAnime.source === 'anizium') {
    await handleAniziumDetailFlow(selectedAnime);
  } else if (selectedAnime.source === 'anizm') {
    await handleAnizmDetailFlow(selectedAnime);
  } else {
    await handleAnimeDetailFlow(selectedAnime);
  }
}

/**
 * Handle Anizium (4K UHD & 1080p) Anime Flow
 */
export async function handleAniziumDetailFlow(selected) {
  const detailSpinner = createSpinner(`Bölümler alınıyor (${selected.title})...`).start();
  let details;
  try {
    details = await getAniziumDetails(selected.id);
    detailSpinner.succeed('Anizium bölüm listesi hazır.');
  } catch (err) {
    detailSpinner.fail(`Bölümler alınamadı: ${err.message}`);
    await pause();
    return;
  }

  const seasons = details.seasons || [];
  if (seasons.length === 0) {
    console.log(chalk.yellow('\nBu anime için bölüm bulunamadı.'));
    await pause();
    return;
  }

  let selectedSeason = seasons[0];
  if (seasons.length > 1) {
    const seasonChoices = seasons.map(s => ({
      name: `Sezon ${s.season} (${s.episodes.length} Bölüm)`,
      value: s
    }));
    seasonChoices.push(new Separator());
    seasonChoices.push({ name: '🔙 Geri Dön', value: null });

    selectedSeason = await select({
      message: 'Hangi sezonu izlemek istiyorsunuz?',
      choices: seasonChoices,
      pageSize: 10
    });
    if (!selectedSeason) return;
  }

  const episodes = selectedSeason.episodes || [];
  while (true) {
    const epChoices = episodes.map(ep => ({
      name: `${chalk.bold.hex('#38bdf8')(ep.name || `${ep.episode}. Bölüm`)}`,
      value: ep
    }));
    epChoices.push(new Separator());
    epChoices.push({ name: '🔙 Geri Dön', value: null });

    const selectedEp = await select({
      message: `${selected.title} - Bölüm seçin:`,
      choices: epChoices,
      pageSize: 14
    });

    if (!selectedEp) break;

    const playSpinner = createSpinner(`4K UHD / 1080p video akışı çözülüyor (${selectedEp.name})...`).start();
    let streamData;
    try {
      streamData = await getAniziumStream(selected.id, selectedSeason.season, selectedEp.episode);
      playSpinner.succeed(`Anizium akışı hazırlandı! [${streamData.quality}]`);
    } catch (err) {
      playSpinner.fail(`Akış çözülemedi: ${err.message}`);
      await pause();
      continue;
    }

    const config = getConfig();

    addToHistory({
      id: `${selected.id}:${selectedSeason.season}:${selectedEp.episode}`,
      titleId: selected.id,
      titleName: selected.title,
      name: selected.title,
      source: 'anizium',
      season: selectedSeason.season,
      episode: selectedEp.episode,
      episodeName: selectedEp.name || `${selectedEp.episode}. Bölüm`,
      timestamp: Date.now()
    });

    console.log(chalk.gray(`\nOynatıcı başlatılıyor: ${selected.title} - S${selectedSeason.season}E${selectedEp.episode} [${streamData.quality}]`));

    const playResult = await playStream({
      playerType: config.player,
      streamUrl: streamData.streamUrl,
      isDirect: true,
      title: selected.title,
      episodeName: `Sezon ${selectedSeason.season} Bölüm ${selectedEp.episode}`,
      season: selectedSeason.season,
      episode: selectedEp.episode,
      captions: streamData.subtitles || [],
      anime: { name: selected.title, source: 'anizium' }
    });

    if (playResult?.action === 'next') {
      const nextEp = episodes.find(e => e.episode === selectedEp.episode + 1);
      if (nextEp) {
        const nextSpinner = createSpinner(`Sonraki bölüm yükleniyor (S${selectedSeason.season}E${nextEp.episode})...`).start();
        try {
          const nextStream = await getAniziumStream(selected.id, selectedSeason.season, nextEp.episode);
          nextSpinner.succeed(`Sonraki bölüm hazır! [${nextStream.quality}]`);
          await playStream({
            playerType: config.player,
            streamUrl: nextStream.streamUrl,
            isDirect: true,
            title: selected.title,
            episodeName: `Sezon ${selectedSeason.season} Bölüm ${nextEp.episode}`,
            season: selectedSeason.season,
            episode: nextEp.episode,
            captions: nextStream.subtitles || [],
            anime: { name: selected.title, source: 'anizium' }
          });
        } catch {}
      }
    }
  }
}

// Backward-compatible alias
export const handleSearchFlow = handleUnifiedAnimeFlow;

/**
 * Handle Unified Asian & Korean Drama Flow (DiziKorea, DiziAsya, WebDramaTurkey)
 */
export async function handleUnifiedDramaFlow(prefillQuery = null) {
  printHeader('🎎 KORE & ASYA DİZİLERİ ARA & İZLE');
  console.log(chalk.gray('DiziKorea, DiziAsya ve WebDramaTurkey arşivlerinde eşzamanlı Kore, Çin ve BL dizileri arayın.\n'));

  let query = prefillQuery;
  if (!query) {
    query = await input({
      message: 'Aranacak Dizi veya Film Adı:',
      validate: (v) => v.trim().length > 0 ? true : 'Lütfen geçerli bir isim yazın'
    });
  }

  const spinner = createSpinner(`"${query}" tüm Asya dizi arşivlerinde (DiziKorea, DiziAsya, WebDramaTurkey) aranıyor...`).start();

  const [koreaRes, asyaRes, webdramaRes] = await Promise.allSettled([
    searchDiziKorea(query),
    searchDiziAsya(query),
    searchWebDramaTurkey(query)
  ]);

  const koreaList = (koreaRes.status === 'fulfilled' && Array.isArray(koreaRes.value)) ? koreaRes.value : [];
  const asyaList = (asyaRes.status === 'fulfilled' && Array.isArray(asyaRes.value)) ? asyaRes.value : [];
  const webdramaList = (webdramaRes.status === 'fulfilled' && Array.isArray(webdramaRes.value)) ? webdramaRes.value : [];

  const results = [...koreaList, ...asyaList, ...webdramaList];
  spinner.succeed(`Toplam ${results.length} içerik bulundu (DiziKorea: ${koreaList.length}, DiziAsya: ${asyaList.length}, WebDrama: ${webdramaList.length}).`);

  if (results.length === 0) {
    console.log(chalk.yellow('\nHerhangi bir Kore veya Asya dizisi bulunamadı.'));
    await pause();
    return;
  }

  const choices = results.map(item => ({
    name: formatResultBadge(item),
    value: item
  }));
  choices.push(new Separator());
  choices.push({ name: '🔙 Ana Menüye Dön', value: null });

  const selectedDrama = await select({
    message: 'İzlemek istediğin içeriği seç:',
    choices,
    pageSize: 15
  });

  if (!selectedDrama) return;

  displayMediaCard(selectedDrama);

  if (selectedDrama.source === 'dizikorea') {
    await handleDiziKoreaDetailFlow(selectedDrama);
  } else if (selectedDrama.source === 'diziasya') {
    await handleDiziAsyaDetailFlow(selectedDrama);
  } else if (selectedDrama.source === 'webdramaturkey') {
    await handleWebDramaTurkeyDetailFlow(selectedDrama);
  }
}

/**
 * Handle Universal Unified Search (Anime, Drama, Movie)
 */
export async function handleUniversalSearchFlow(prefillQuery = null) {
  printHeader('🌐 EVRENSEL AKILLI ARAMA');
  console.log(chalk.gray('Anime, Kore & Asya dizileri, film ve yabancı dizileri tek aramada bulun.\n'));

  let query = prefillQuery;
  if (!query) {
    query = await input({
      message: 'Aranacak Başlık:',
      validate: (v) => v.trim().length > 0 ? true : 'Lütfen geçerli bir isim yazın'
    });
  }

  const spinner = createSpinner(`"${query}" tüm kaynaklarda (Anime 4K, Asya Dizi, Film Makinesi, DiziBOX & Yerli TR Dizi) aranıyor...`).start();

  const [aniziumRes, anizmRes, openAniRes, animecixRes, koreaRes, asyaRes, webdramaRes, hdfilmRes, hdfilmLandRes, filmMakRes, diziboxRes, ydRes, trDiziRes, sportRes] = await Promise.allSettled([
    searchAnizium(query),
    searchAnizm(query),
    searchOpenAni(query),
    searchAnime(query),
    searchDiziKorea(query),
    searchDiziAsya(query),
    searchWebDramaTurkey(query),
    searchHdFilm(query),
    searchHdFilmLand(query),
    searchFilmMakinesi(query),
    searchDDiziBox(query),
    searchYabanciDizi(query),
    searchTrDizi(query),
    searchSportChannels(query)
  ]);

  const allResults = [
    ...(aniziumRes.status === 'fulfilled' && Array.isArray(aniziumRes.value) ? aniziumRes.value : []),
    ...(anizmRes.status === 'fulfilled' && Array.isArray(anizmRes.value) ? anizmRes.value : []),
    ...(openAniRes.status === 'fulfilled' && Array.isArray(openAniRes.value) ? openAniRes.value : []),
    ...(animecixRes.status === 'fulfilled' && Array.isArray(animecixRes.value) ? animecixRes.value : []),
    ...(koreaRes.status === 'fulfilled' && Array.isArray(koreaRes.value) ? koreaRes.value : []),
    ...(asyaRes.status === 'fulfilled' && Array.isArray(asyaRes.value) ? asyaRes.value : []),
    ...(webdramaRes.status === 'fulfilled' && Array.isArray(webdramaRes.value) ? webdramaRes.value : []),
    ...(hdfilmRes.status === 'fulfilled' && Array.isArray(hdfilmRes.value) ? hdfilmRes.value : []),
    ...(hdfilmLandRes.status === 'fulfilled' && Array.isArray(hdfilmLandRes.value) ? hdfilmLandRes.value : []),
    ...(filmMakRes.status === 'fulfilled' && Array.isArray(filmMakRes.value) ? filmMakRes.value : []),
    ...(diziboxRes.status === 'fulfilled' && Array.isArray(diziboxRes.value) ? diziboxRes.value : []),
    ...(ydRes.status === 'fulfilled' && Array.isArray(ydRes.value) ? ydRes.value : []),
    ...(trDiziRes.status === 'fulfilled' && Array.isArray(trDiziRes.value) ? trDiziRes.value : []),
    ...(sportRes.status === 'fulfilled' && Array.isArray(sportRes.value) ? sportRes.value : [])
  ];

  spinner.succeed(`Toplam ${allResults.length} içerik bulundu.`);

  if (allResults.length === 0) {
    console.log(chalk.yellow('\nHerhangi bir içerik bulunamadı.'));
    await pause();
    return;
  }

  const choices = allResults.map(item => ({
    name: formatResultBadge(item),
    value: item
  }));
  choices.push(new Separator());
  choices.push({ name: '🔙 Ana Menüye Dön', value: null });

  const selected = await select({
    message: 'İzlemek istediğin içeriği seç:',
    choices,
    pageSize: 16
  });

  if (!selected) return;

  displayMediaCard(selected);

  if (selected.source === 'anizium') {
    await handleAniziumDetailFlow(selected);
  } else if (selected.source === 'anizm') {
    await handleAnizmDetailFlow(selected);
  } else if (selected.source === 'openani' || selected.source === 'animecix') {
    await handleAnimeDetailFlow(selected);
  } else if (selected.source === 'dizikorea') {
    await handleDiziKoreaDetailFlow(selected);
  } else if (selected.source === 'diziasya') {
    await handleDiziAsyaDetailFlow(selected);
  } else if (selected.source === 'webdramaturkey') {
    await handleWebDramaTurkeyDetailFlow(selected);
  } else if (selected.source === 'hdfilm') {
    await handleHdFilmPlayFlow(selected);
  } else if (selected.source === 'hdfilmland') {
    await handleHdFilmLandPlayFlow(selected);
  } else if (selected.source === 'filmmakinesi') {
    await handleFilmMakinesiPlayFlow(selected);
  } else if (selected.source === 'ddizibox' || selected.source === 'dizibox') {
    await handleDiziBoxDetailFlow(selected);
  } else if (selected.source === 'yabancidizi') {
    await handleYabanciDiziDetailFlow(selected);
  } else if (selected.source === 'trdizi') {
    await handleTrDiziDetailFlow(selected);
  } else if (selected.source === 'sport') {
    await handleSportChannelPlayFlow(selected);
  }
}

/**
 * Handle Anime Detail, Season, and Episode Selection
 */
async function handleAnimeDetailFlow(anime) {
  showBanner();
  displayAnimeCard(anime);

  const sourceName = anime.source === 'openani' ? 'OpenAnime (openani.me)' : 'AnimeciX';
  const spinner = createSpinner(`Bölümler ve sezonlar yükleniyor (${sourceName})...`).start();
  let details;
  try {
    details = await getAnimeDetailsUnified(anime);
    spinner.succeed('Bölüm listesi hazır.');
  } catch (err) {
    spinner.fail(err.message);
    await pause();
    return;
  }

  const seasons = details.seasons || [];
  if (seasons.length === 0) {
    console.log(chalk.yellow('\nBu yapım için henüz bölüm bulunmuyor.'));
    await pause();
    return;
  }

  // Choose Season
  let selectedSeason = seasons[0];
  if (seasons.length > 1) {
    const seasonChoices = seasons.map(s => ({
      name: `Sezon ${s.season_number || s.season} (${s.episodes?.length || 0} Bölüm)`,
      value: s
    }));
    seasonChoices.push(new Separator());
    seasonChoices.push({ name: '🔙 Geri Dön', value: null });

    selectedSeason = await select({
      message: 'Hangi sezonu izlemek istiyorsun?',
      choices: seasonChoices,
      pageSize: 12
    });
    if (!selectedSeason) return;
  }

  // Choose Episode
  const episodes = selectedSeason.episodes || [];
  if (episodes.length === 0) {
    console.log(chalk.yellow('\nBu sezonda henüz yayınlanmış bölüm yok.'));
    await pause();
    return;
  }

  while (true) {
    const epChoices = episodes.map(ep => {
      const epNum = ep.episode || ep.number || 1;
      const epName = ep.name ? ` - ${ep.name}` : '';
      return {
        name: `${chalk.bold.cyan(`Bölüm ${epNum}`)}${chalk.white(epName)}`,
        value: ep
      };
    });
    epChoices.push(new Separator());
    epChoices.push({ name: '🔙 Geri Dön', value: null });

    const selectedEp = await select({
      message: `${anime.name} - Bölüm seçin:`,
      choices: epChoices,
      pageSize: 15
    });

    if (!selectedEp) break;

    const playResult = await startPlayback({
      anime,
      season: selectedSeason.season_number || selectedSeason.season || 1,
      episode: selectedEp.episode || selectedEp.number || 1,
      episodeName: selectedEp.name || ''
    });

    if (playResult?.action === 'next') {
      const curEpNum = selectedEp.episode || selectedEp.number || 1;
      const nextEp = episodes.find(e => (e.episode || e.number) === curEpNum + 1);
      if (nextEp) {
        await startPlayback({
          anime,
          season: selectedSeason.season_number || selectedSeason.season || 1,
          episode: nextEp.episode || nextEp.number,
          episodeName: nextEp.name || ''
        });
      }
    }
  }
}

/**
 * Handle Recent Episodes Flow
 */
export async function handleRecentFlow() {
  const spinner = createSpinner('Son eklenen bölümler alınıyor...').start();
  let recentData;
  try {
    recentData = await getRecentEpisodes(1);
    spinner.succeed(`${recentData.episodes.length} yeni bölüm yüklendi.`);
  } catch (err) {
    spinner.fail(err.message);
    await pause();
    return;
  }

  const choices = recentData.episodes.map(item => {
    const epNum = item.episode_number || item.episode_num || 1;
    const seasonNum = item.season_number || item.season_num || 1;
    const fansub = item.videos?.[0]?.extra ? ` [${item.videos[0].extra}]` : '';
    return {
      name: `${chalk.bold.hex('#f472b6')(item.title_name)} ${chalk.cyan(`S${seasonNum}E${epNum}`)}${chalk.gray(fansub)}`,
      value: item
    };
  });
  choices.push(new Separator());
  choices.push({ name: '🔙 Ana Menüye Dön', value: null });

  const chosen = await select({
    message: 'İzlemek istediğin yeni bölümü seç:',
    choices,
    pageSize: 15
  });

  if (!chosen) return;

  const anime = {
    id: chosen.title_id,
    name: chosen.title_name,
    poster: chosen.title_poster
  };

  await startPlayback({
    anime,
    season: chosen.season_number || 1,
    episode: chosen.episode_number || 1,
    episodeName: `Bölüm ${chosen.episode_number || 1}`
  });
}

/**
 * Handle Watch History Flow
 */
export async function handleHistoryFlow() {
  const history = getHistory();
  if (history.length === 0) {
    console.log(chalk.yellow('\nHenüz izleme geçmişiniz bulunmuyor.'));
    await pause();
    return;
  }

  const choices = history.map(item => {
    const isOA = item.source === 'openani';
    const isHD = item.source === 'hdfilm';
    const isDK = item.source === 'dizikorea';
    const isAZ = item.source === 'anizm';
    const isWDT = item.source === 'webdramaturkey';
    const isDA = item.source === 'diziasya';
    const isYD = item.source === 'yabancidizi';
    const isTR = item.source === 'trdizi';
    const badge = isTR ? chalk.bold.hex('#e11d48')('🇹🇷 ') : (isYD ? chalk.bold.hex('#8b5cf6')('🌍 ') : (isDA ? chalk.bold.hex('#06b6d4')('🐉 ') : (isWDT ? chalk.bold.hex('#f43f5e')('🏮 ') : (isAZ ? chalk.bold.hex('#ef4444')('🎌 ') : (isDK ? chalk.bold.hex('#10b981')('🎎 ') : (isHD ? chalk.bold.hex('#f59e0b')('🎬 ') : (isOA ? chalk.bold.hex('#38bdf8')('⚡ ') : chalk.bold.hex('#f472b6')('🌸 '))))))));
    const title = item.titleName || item.name || 'İçerik';
    const epInfo = (item.source === 'hdfilm' || item.source === 'dizikorea' || item.source === 'anizm' || item.source === 'webdramaturkey' || item.source === 'diziasya' || item.source === 'trdizi') ? (item.episodeName || 'Bölüm') : `S${item.season}E${item.episode} - ${item.episodeName || ''}`;
    const dateStr = item.updatedAt ? chalk.gray(new Date(item.updatedAt).toLocaleDateString('tr-TR')) : '';
    return {
      name: `${badge}${chalk.bold.hex('#c084fc')(title)} ${chalk.cyan(epInfo)} ${dateStr}`,
      value: item
    };
  });
  choices.push(new Separator());
  choices.push({ name: '🗑️  Geçmişi Temizle', value: 'clear' });
  choices.push({ name: '🔙 Ana Menüye Dön', value: null });

  const chosen = await select({
    message: 'İzleme Geçmişi:',
    choices,
    pageSize: 15
  });

  if (!chosen) return;

  if (chosen === 'clear') {
    const confirmClear = await confirm({ message: 'Tüm izleme geçmişini silmek istediğine emin misin?' });
    if (confirmClear) {
      clearHistory();
      console.log(chalk.green('İzleme geçmişi temizlendi.'));
      await pause();
    }
    return;
  }

  // If Anizm, directly launch
  if (chosen.source === 'anizm') {
    const sSpinner = createSpinner(`1080p Akış hazırlanıyor (${chosen.titleName || chosen.name})...`).start();
    try {
      const sData = await getAnizmStream(chosen.id);
      sSpinner.succeed('Akış hazırlandı.');
      const config = getConfig();
      await playStream({
        playerType: config.player,
        streamUrl: sData.streamUrl,
        isDirect: true,
        title: chosen.titleName || chosen.name,
        episodeName: chosen.episodeName || 'Bölüm',
        season: chosen.season || 1,
        episode: chosen.episode || 1,
        captions: [],
        anime: { name: chosen.titleName || chosen.name, source: 'anizm' }
      });
    } catch (e) {
      sSpinner.fail(e.message);
      await pause();
    }
    return;
  }

  // If DiziKorea, directly launch
  if (chosen.source === 'dizikorea') {
    const sSpinner = createSpinner(`1080p Akış hazırlanıyor (${chosen.titleName || chosen.name})...`).start();
    try {
      const sData = await getDiziKoreaStream(chosen.id);
      sSpinner.succeed('Akış hazırlandı.');
      const config = getConfig();
      await playStream({
        playerType: config.player,
        streamUrl: sData.streamUrl,
        isDirect: true,
        title: chosen.titleName || chosen.name,
        episodeName: chosen.episodeName || 'Bölüm',
        season: chosen.season || 1,
        episode: chosen.episode || 1,
        captions: [],
        anime: { name: chosen.titleName || chosen.name, source: 'dizikorea' }
      });
    } catch (e) {
      sSpinner.fail(e.message);
      await pause();
    }
    return;
  }

  // If HDFilm, directly launch with audio selection
  if (chosen.source === 'hdfilm') {
    const audioPref = await select({
      message: 'İzleme seçeneğini belirleyin:',
      choices: [
        { name: '💬 Türkçe Altyazılı (Orijinal Ses)', value: 'sub' },
        { name: '🇹🇷 Türkçe Dublaj', value: 'dub' }
      ]
    });
    const sSpinner = createSpinner(`1080p Akış hazırlanıyor (${chosen.titleName || chosen.name})...`).start();
    try {
      const sData = await getHdFilmStream(chosen.id, audioPref);
      sSpinner.succeed('Akış hazırlandı.');
      const config = getConfig();
      await playStream({
        playerType: config.player,
        streamUrl: sData.streamUrl,
        isDirect: true,
        title: chosen.titleName || chosen.name,
        episodeName: chosen.episodeName || 'Film',
        season: chosen.season || 1,
        episode: chosen.episode || 1,
        captions: sData.captions,
        audioPreference: audioPref,
        anime: { name: chosen.titleName || chosen.name, source: 'hdfilm' }
      });
    } catch (e) {
      sSpinner.fail(e.message);
      await pause();
    }
    return;
  }

  // If WebDramaTurkey, directly launch
  if (chosen.source === 'webdramaturkey') {
    const sSpinner = createSpinner(`1080p Akış hazırlanıyor (${chosen.titleName || chosen.name})...`).start();
    try {
      const sData = await getWebDramaTurkeyStream(chosen.id);
      sSpinner.succeed('Akış hazırlandı.');
      const config = getConfig();
      await playStream({
        playerType: config.player,
        streamUrl: sData.streamUrl,
        isDirect: sData.isDirect,
        embedUrl: sData.embedUrl,
        title: chosen.titleName || chosen.name,
        episodeName: chosen.episodeName || 'Bölüm',
        season: chosen.season || 1,
        episode: chosen.episode || 1,
        captions: [],
        anime: { name: chosen.titleName || chosen.name, source: 'webdramaturkey' }
      });
    } catch (e) {
      sSpinner.fail(e.message);
      await pause();
    }
    return;
  }

  // If DiziAsya, directly launch
  if (chosen.source === 'diziasya') {
    const sSpinner = createSpinner(`1080p Akış hazırlanıyor (${chosen.titleName || chosen.name})...`).start();
    try {
      const sData = await getDiziAsyaStream(chosen.id);
      sSpinner.succeed('Akış hazırlandı.');
      const config = getConfig();
      await playStream({
        playerType: config.player,
        streamUrl: sData.streamUrl,
        isDirect: sData.isDirect,
        embedUrl: sData.embedUrl,
        title: chosen.titleName || chosen.name,
        episodeName: chosen.episodeName || 'Bölüm',
        season: chosen.season || 1,
        episode: chosen.episode || 1,
        captions: [],
        anime: { name: chosen.titleName || chosen.name, source: 'diziasya' }
      });
    } catch (e) {
      sSpinner.fail(e.message);
      await pause();
    }
    return;
  }

  // If Yabancı Dizi, directly launch
  if (chosen.source === 'yabancidizi') {
    const sSpinner = createSpinner(`1080p Akış hazırlanıyor (${chosen.titleName || chosen.name})...`).start();
    try {
      const sData = await getYabanciDiziStream(chosen.id);
      sSpinner.succeed('Akış hazırlandı.');
      const config = getConfig();
      await playStream({
        playerType: config.player,
        streamUrl: sData.streamUrl,
        isDirect: sData.isDirect,
        embedUrl: sData.embedUrl,
        title: chosen.titleName || chosen.name,
        episodeName: chosen.episodeName || 'Bölüm',
        season: chosen.season || 1,
        episode: chosen.episode || 1,
        captions: [],
        anime: { name: chosen.titleName || chosen.name, source: 'yabancidizi' }
      });
    } catch (e) {
      sSpinner.fail(e.message);
      await pause();
    }
    return;
  }

  // If TR Dizi, directly launch
  if (chosen.source === 'trdizi') {
    const sSpinner = createSpinner(`1080p Akış hazırlanıyor (${chosen.titleName || chosen.name})...`).start();
    try {
      const sData = await getTrDiziStream(chosen.id);
      sSpinner.succeed('Yerli dizi akışı hazırlandı.');
      const config = getConfig();
      await playStream({
        playerType: config.player,
        streamUrl: sData.streamUrl,
        isDirect: sData.isDirect,
        embedUrl: sData.embedUrl,
        title: chosen.titleName || chosen.name,
        episodeName: chosen.episodeName || 'Bölüm',
        season: 1,
        episode: chosen.episode || 1,
        captions: [],
        anime: { name: chosen.titleName || chosen.name, source: 'trdizi' }
      });
    } catch (e) {
      sSpinner.fail(e.message);
      await pause();
    }
    return;
  }

  // Action for selected history item
  const act = await select({
    message: `${chosen.titleName} için ne yapmak istiyorsun?`,
    choices: [
      { name: `▶️  Kaldığın Bölümü Tekrar Aç (S${chosen.season}E${chosen.episode})`, value: 'play_current' },
      { name: `⏭️  Sonraki Bölüme Geç (S${chosen.season}E${chosen.episode + 1})`, value: 'play_next' },
      { name: `📖 Tüm Bölüm Listesini Görüntüle`, value: 'all_episodes' },
      new Separator(),
      { name: '🔙 Geri', value: 'back' }
    ]
  });

  if (act === 'back') return;

  const anime = {
    id: chosen.titleId,
    slug: chosen.slug || chosen.titleId,
    source: chosen.source || 'animecix',
    name: chosen.titleName,
    poster: chosen.poster
  };

  if (act === 'play_current') {
    await startPlayback({
      anime,
      season: chosen.season,
      episode: chosen.episode,
      episodeName: chosen.episodeName
    });
  } else if (act === 'play_next') {
    await startPlayback({
      anime,
      season: chosen.season,
      episode: chosen.episode + 1,
      episodeName: `Bölüm ${chosen.episode + 1}`
    });
  } else if (act === 'all_episodes') {
    await handleAnimeDetailFlow(anime);
  }
}

/**
 * Handle Settings Flow
 */
export async function handleSettingsFlow() {
  while (true) {
    const config = getConfig();
    const availablePlayers = detectPlayers();

    printHeader('⚙️  Ayarlar & Özelleştirme Merkezi');
    displayConfigSummary(config);

    const autoNextName = config.autoNext === 'instant'
      ? '🚀 Anında (Sormadan)'
      : (config.autoNext === 'countdown'
        ? `⏳ Geri Sayım (${config.autoNextDelay || 3}s)`
        : (config.autoNext === 'prompt' ? '❓ Onay Sor' : '❌ Kapalı'));

    const playerName = config.player === 'borderless'
      ? '✨ Çerçevesiz HD'
      : (config.player === 'fullscreen'
        ? '🎬 Tam Ekran MPV'
        : (config.player === 'terminal'
          ? '🖥️  Retro Terminal'
          : (config.player === 'mpv' ? '🪟 Standart MPV' : '🌐 Tarayıcı')));

    const providerName = config.provider === 'openani'
      ? '⚡ OpenAnime'
      : (config.provider === 'animecix' ? '🌸 AnimeciX' : '🔄 Birleşik');

    const action = await select({
      message: 'Hangi ayarı değiştirmek istiyorsun?',
      pageSize: 14,
      choices: [
        {
          name: `⚡ Otomatik Sonraki Bölüm [Şu an: ${autoNextName}]`,
          value: 'auto_next',
          description: 'Bölüm bittiğinde sonraki bölüme otomatik geçiş modu ve geri sayım süresi'
        },
        {
          name: `🖥️  Varsayılan Tam Ekran [Şu an: ${config.fullscreen ? 'Açık (Fullscreen)' : 'Kapalı (Terminal Boyutu)'}]`,
          value: 'fullscreen',
          description: 'Video açıldığında doğrudan monitörü kaplayan tam ekran modunda başlasın mı?'
        },
        {
          name: `🎮 Oynatıcı & Ekran Modu [Şu an: ${playerName}]`,
          value: 'player',
          description: 'Çerçevesiz HD 1080p, Tam Ekran MPV, veya Standart Pencere'
        },
        {
          name: `🌐 Varsayılan Anime Kaynağı [Şu an: ${providerName}]`,
          value: 'provider',
          description: 'OpenAnime (openani.me), Birleşik Arama veya AnimeciX'
        },
        {
          name: `📺 Varsayılan Çözünürlük [Şu an: ${config.quality.toUpperCase()}]`,
          value: 'quality',
          description: '1080p Full HD, 720p HD, 480p SD veya En Yüksek Mevcut'
        },
        {
          name: `📐 Pencere Boyutu & Konumu [${config.windowSize || '75%'}, Üstte: ${config.alwaysOnTop ? 'Açık' : 'Kapalı'}]`,
          value: 'window_size',
          description: 'Çerçevesiz mod pencere büyüklüğü ve Her Zaman Üstte kalma tercihi'
        },
        {
          name: `💬 Altyazı Görünümü [${config.subSize || 'medium'}, ${config.subColor || 'white'}]`,
          value: 'subtitles',
          description: 'MPV altyazı boyutu (büyük/orta/küçük) ve rengi (beyaz, sarı, cyan neon)'
        },
        {
          name: `⚡ AniSkip Jenerik Atlama [${config.aniSkip === 'auto' ? (config.skipEnding ? 'Otomatik OP+ED' : 'Otomatik OP') : (config.aniSkip === 'manual' ? 'Manuel (Tab)' : 'Kapalı')}]`,
          value: 'aniskip',
          description: 'Açılış (OP) ve kapanış (ED) jeneriklerini AniSkip gerçek zaman damgalarıyla otomatik veya Tab tuşuyla atla'
        },
        {
          name: '⌨️  MPV Klavye Kısayolları Rehberi',
          value: 'keybinds',
          description: 'Oynatma esnasında kullanabileceğiniz tüm tuş kombinasyonları'
        },
        {
          name: '🚀 MPV Oynatıcıyı Kur / Güncelle (winget)',
          value: 'install_mpv',
          description: 'Sistemde eksikse MPV video oynatıcıyı otomatik kurar'
        },
        {
          name: '📌 Masaüstü Kısayolu Oluştur (Windows)',
          value: 'create_shortcut',
          description: 'Masaüstünüze tek tıkla GörkemStream açan kısayol simgesi ekler'
        },
        new Separator(),
        {
          name: '🔄 Tüm Ayarları Fabrika Ayarlarına Döndür',
          value: 'reset_config',
          description: 'Varsayılan optimum ayarlara sıfırla'
        },
        {
          name: '🗑️  İzleme Geçmişini Sıfırla',
          value: 'clear_history',
          description: 'Kayıtlı tüm geçmiş bölümleri temizle'
        },
        new Separator(),
        { name: '🔙 Ana Menüye Dön', value: 'back' }
      ]
    });

    if (action === 'back') break;

    if (action === 'auto_next') {
      const newMode = await select({
        message: 'Otomatik sonraki bölüme geçiş modu:',
        choices: [
          { name: '⏳ Geri Sayımla Geç (3 saniye geri sayıp açılır, Q ile iptal edilebilir - Önerilen)', value: 'countdown' },
          { name: '🚀 Anında Geç (Sormadan ve beklemeden direkt sonraki bölüme başla)', value: 'instant' },
          { name: '❓ Her Seferinde Sor (Bölüm bitince onay ekranı bekle)', value: 'prompt' },
          { name: '❌ Kapalı (Otomatik geçiş yapma)', value: 'off' }
        ]
      });
      config.autoNext = newMode;
      if (newMode === 'countdown') {
        const delayChoice = await select({
          message: 'Geri sayım süresi kaç saniye olsun?',
          choices: [
            { name: '3 Saniye (Hızlı - Önerilen)', value: 3 },
            { name: '5 Saniye (Standart)', value: 5 },
            { name: '10 Saniye (Uzun)', value: 10 }
          ]
        });
        config.autoNextDelay = delayChoice;
      }
      saveConfig(config);
      console.log(chalk.green(`\n✓ Otomatik bölüm geçiş tercihi güncellendi.`));
      await pause();
    } else if (action === 'fullscreen') {
      const fsChoice = await select({
        message: 'Video başladığında varsayılan görünüm:',
        choices: [
          { name: '🖥️  Tam Ekran (Monitörü tamamen kaplar)', value: true },
          { name: '📐 Terminal Boyutunda (Terminalin tam koordinatlarına yapışır)', value: false }
        ]
      });
      config.fullscreen = fsChoice;
      saveConfig(config);
      console.log(chalk.green(`\n✓ Tam ekran tercihi güncellendi: ${fsChoice ? 'Tam Ekran' : 'Terminal Boyutunda'}`));
      await pause();
    } else if (action === 'player') {
      const playerChoices = availablePlayers.map(p => ({
        name: p.name,
        value: p.id
      }));
      const newPlayer = await select({
        message: 'Varsayılan oynatıcıyı seç:',
        choices: playerChoices
      });
      config.player = newPlayer;
      saveConfig(config);
      console.log(chalk.green(`\n✓ Oynatıcı tercihi güncellendi: ${newPlayer}`));
      await pause();
    } else if (action === 'provider') {
      const newProvider = await select({
        message: 'Varsayılan anime kaynağını seçin:',
        choices: [
          { name: '⚡ OpenAnime (openani.me) [Doğrudan 1080p MP4 Akışı - Önerilen]', value: 'openani' },
          { name: '🔄 Birleşik Arama (OpenAnime & AnimeciX Birlikte)', value: 'all' },
          { name: '🌸 AnimeciX (Geniş Arşiv & Alternatif Fansublar)', value: 'animecix' }
        ]
      });
      config.provider = newProvider;
      saveConfig(config);
      console.log(chalk.green(`\n✓ Varsayılan kaynak güncellendi: ${newProvider}`));
      await pause();
    } else if (action === 'quality') {
      const newQuality = await select({
        message: 'Varsayılan video kalitesi:',
        choices: [
          { name: 'En Yüksek Mevcut Kalite (Önerilen)', value: 'best' },
          { name: '1080p Full HD', value: '1080p' },
          { name: '720p HD', value: '720p' },
          { name: '480p SD (Düşük internet için)', value: '480p' }
        ]
      });
      config.quality = newQuality;
      saveConfig(config);
      console.log(chalk.green(`\n✓ Kalite tercihi güncellendi: ${newQuality}`));
      await pause();
    } else if (action === 'window_size') {
      const sizeChoice = await select({
        message: 'Çerçevesiz mod pencere boyutu:',
        choices: [
          { name: 'Ekranın %90\'ı (Geniş Ekran Sinematik)', value: '90%' },
          { name: 'Ekranın %75\'i (Dengeli Standart - Önerilen)', value: '75%' },
          { name: 'Ekranın %60\'ı (Kompakt / Çoklu Görev)', value: '60%' },
          { name: 'Ekranın %50\'si (Yarım Ekran)', value: '50%' }
        ]
      });
      const onTopChoice = await confirm({
        message: 'Pencere her zaman diğer pencerelerin üstünde kalsın mı (Always-on-Top)?',
        default: true
      });
      config.windowSize = sizeChoice;
      config.alwaysOnTop = onTopChoice;
      saveConfig(config);
      console.log(chalk.green(`\n✓ Pencere boyutu ve konumu kaydedildi.`));
      await pause();
    } else if (action === 'subtitles') {
      const size = await select({
        message: 'Altyazı boyutu:',
        choices: [
          { name: 'Büyük (58px - Uzaktan izleme için ideal)', value: 'large' },
          { name: 'Orta (46px - Standart / Önerilen)', value: 'medium' },
          { name: 'Küçük (36px - Minimalist)', value: 'small' }
        ]
      });
      const color = await select({
        message: 'Altyazı rengi:',
        choices: [
          { name: 'Temiz Beyaz (#FFFFFF) [Net & Modern - Önerilen]', value: 'white' },
          { name: 'Yumuşak Mat Beyaz (#E6E6E6) [Gözü Yormayan]', value: 'soft_white' },
          { name: 'Sarı (#FFE600) [Klasik Anime Fansub]', value: 'yellow' }
        ]
      });
      config.subSize = size;
      config.subColor = color;
      saveConfig(config);
      console.log(chalk.green(`\n✓ Altyazı görünüm ayarları kaydedildi.`));
      await pause();
    } else if (action === 'aniskip') {
      const aniSkipMode = await select({
        message: 'AniSkip jenerik atlama tercihi:',
        choices: [
          { name: '⚡ Otomatik Atla (Jenerik başlayınca sormadan hemen atlar - Önerilen)', value: 'auto' },
          { name: '⌨️  Manuel Atla (Jenerik başlayınca ekranda bildirim çıkar, [Tab] veya [i] ile atlarsınız)', value: 'manual' },
          { name: '❌ Kapalı (AniSkip devre dışı)', value: 'off' }
        ]
      });
      config.aniSkip = aniSkipMode;

      if (aniSkipMode !== 'off') {
        const endingChoice = await confirm({
          message: 'Kapanış jeneriği (Ending / ED) de otomatik atlasın mı?',
          default: false
        });
        config.skipEnding = endingChoice;
      }
      saveConfig(config);
      console.log(chalk.green(`\n✓ AniSkip jenerik atlama ayarı güncellendi.`));
      await pause();
    } else if (action === 'keybinds') {
      displayKeybindsModal();
      await pause();
    } else if (action === 'install_mpv') {
      console.log(chalk.cyan('\nMPV oynatıcısı winget aracılığıyla kuruluyor, lütfen bekleyin...\n'));
      const success = await installMpvViaWinget();
      if (success) {
        console.log(chalk.green('\n✓ MPV başarıyla kuruldu! Artık yüksek kalitede MPV ile izleyebilirsiniz.'));
        config.player = 'borderless';
        saveConfig(config);
      } else {
        console.log(chalk.red('\nMPV kurulumu tamamlanamadı veya iptal edildi. Dahili web oynatıcıyı kullanabilirsiniz.'));
      }
      await pause();
    } else if (action === 'reset_config') {
      const confirmReset = await confirm({ message: 'Tüm ayarları varsayılan fabrika ayarlarına sıfırlamak istiyor musunuz?' });
      if (confirmReset) {
        resetConfig();
        console.log(chalk.green('\n✓ Tüm ayarlar fabrika varsayılanına döndürüldü.'));
        await pause();
      }
    } else if (action === 'create_shortcut') {
      try {
        const { createDesktopShortcut } = await import('../scripts/create_shortcut.js');
        const ok = createDesktopShortcut();
        if (ok) {
          console.log(chalk.green('\n✅ Masaüstünüze "GörkemStream" kısayolu başarıyla eklendi!'));
        }
      } catch (err) {
        console.error(chalk.red('\nKısayol oluşturulamadı:'), err.message);
      }
      await pause();
    } else if (action === 'clear_history') {
      const confirmClear = await confirm({ message: 'Tüm izleme geçmişini temizlemek istiyor musunuz?' });
      if (confirmClear) {
        clearHistory();
        console.log(chalk.green('Geçmiş temizlendi.'));
        await pause();
      }
    }
  }
}

/**
 * Start episode playback flow (video source, server, stream resolution, player launch)
 */
async function startPlayback({ anime, season, episode, episodeName }) {
  const config = getConfig();
  const sourceName = anime.source === 'openani' ? 'OpenAnime' : 'AnimeciX';
  const spinner = createSpinner(`${anime.name} S${season}E${episode} video kaynakları aranıyor (${sourceName})...`).start();

  let videos = [];
  try {
    videos = await getEpisodeVideosUnified(anime, season, episode);
  } catch (err) {
    spinner.fail(err.message);
    await pause();
    return null;
  }

  if (videos.length === 0) {
    spinner.fail('Bu bölüm için henüz video sunucusu bulunamadı.');
    await pause();
    return null;
  }

  let chosenVideo = videos[0];
  if (videos.length > 1) {
    spinner.succeed(`${videos.length} video kaynağı ve fansub seçeneği bulundu.`);
    const videoChoices = videos.map((v) => {
      const sName = v.name || 'Sunucu';
      const extra = v.extra ? chalk.hex('#f43f5e')(` [${v.extra}]`) : '';
      const qBadge = v.quality && v.quality !== 'regular' ? chalk.yellow(` (${v.quality})`) : '';
      return {
        name: `${chalk.bold.hex('#a855f7')(sName)}${extra}${qBadge}`,
        value: v
      };
    });
    videoChoices.push(new Separator());
    videoChoices.push({ name: '🔙 İptal', value: null });

    chosenVideo = await select({
      message: 'Fansub / Çeviri veya Video Sunucusu Seç:',
      choices: videoChoices,
      pageSize: 14
    });
  } else {
    spinner.succeed(`Kaynak hazır: ${chosenVideo.name || 'OpenAnime CDN'}`);
  }

  if (!chosenVideo) return null;

  const streamSpinner = createSpinner('Video akışı ve çözünürlükler çözülüyor...').start();
  let streamInfo;
  try {
    streamInfo = await extractStreamUnified(chosenVideo);
    streamSpinner.succeed('Akış hazırlandı.');
  } catch (err) {
    streamSpinner.fail('Akış çözülemedi: ' + err.message);
    await pause();
    return null;
  }

  // Choose quality
  let targetUrl = streamInfo.embedUrl;
  if (streamInfo.qualities && streamInfo.qualities.length > 0) {
    if (config.quality === 'best') {
      targetUrl = streamInfo.qualities[0].url;
    } else {
      const match = streamInfo.qualities.find(q => q.label?.toLowerCase() === config.quality.toLowerCase());
      targetUrl = match ? match.url : streamInfo.qualities[0].url;
    }
  }

  // Save to History
  addToHistory({
    titleId: anime.id || anime.slug,
    slug: anime.slug || anime.id,
    source: anime.source || 'animecix',
    titleName: anime.name,
    poster: anime.poster,
    season,
    episode,
    episodeName: episodeName || `Bölüm ${episode}`
  });

  console.log('\n' + chalk.bold.green(`▶️  Oynatılıyor: `) + chalk.white(`${anime.name} - S${season}E${episode}`));
  console.log(chalk.gray(`   Kaynak: ${anime.source === 'openani' ? '⚡ OpenAnime (openani.me)' : '🌸 AnimeciX'}`));
  console.log(chalk.gray(`   Sunucu: ${streamInfo.server} ${streamInfo.extra ? `(${streamInfo.extra})` : ''}`));
  console.log(chalk.gray(`   Oynatıcı: ${config.player === 'auto' ? 'Otomatik Oynatıcı' : config.player.toUpperCase()}\n`));

  const result = await playStream({
    playerType: config.player,
    streamUrl: targetUrl,
    isDirect: streamInfo.isDirect,
    embedUrl: streamInfo.embedUrl,
    title: anime.name,
    episodeName: episodeName || `Bölüm ${episode}`,
    season,
    episode,
    qualities: streamInfo.qualities,
    server: streamInfo.server,
    extra: streamInfo.extra,
    captions: streamInfo.captions,
    anime,
    malId: anime.mal_id || anime.malID
  });

  // Check if user clicked "Next Episode" in web player
  if (result?.action === 'next') {
    return { action: 'next' };
  }

  // Handle Autoplay Next Episode Logic
  const autoNextMode = config.autoNext || 'countdown';

  if (autoNextMode === 'off') {
    return { action: 'done' };
  }

  if (autoNextMode === 'instant') {
    console.log(chalk.bold.green(`\n⚡ Sonraki bölüme geçiliyor (Bölüm ${episode + 1})...\n`));
    await new Promise(r => setTimeout(r, 600));
    return { action: 'next' };
  }

  if (autoNextMode === 'countdown') {
    const delay = config.autoNextDelay || 3;
    const confirmed = await countdownPrompt(`Bölüm ${episode + 1}`, delay);
    if (confirmed) {
      return { action: 'next' };
    }
    return { action: 'done' };
  }

  // Fallback: 'prompt'
  const wantNext = await confirm({
    message: `Sonraki bölüme geçilsin mi? (Bölüm ${episode + 1})`,
    default: true
  });

  if (wantNext) {
    return { action: 'next' };
  }

  return { action: 'done' };
}

/**
 * Interactive countdown prompt for next episode
 */
function countdownPrompt(nextEpTitle, seconds = 3) {
  return new Promise((resolve) => {
    let remaining = seconds;
    let timer = null;
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (timer) clearInterval(timer);
      try {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener('data', onData);
      } catch {}
      process.stdout.write('\n');
    };

    const onData = (data) => {
      const key = data.toString();
      // ESC (\u001b), Ctrl+C (\u0003), 'q', 'Q', 'n', 'N' -> cancel
      if (key === '\u001b' || key === '\u0003' || key.toLowerCase() === 'q' || key.toLowerCase() === 'n') {
        cleanup();
        console.log(chalk.gray('  Geçiş iptal edildi.'));
        resolve(false);
      } else if (key === '\r' || key === '\n' || key.toLowerCase() === 'y' || key === ' ') {
        cleanup();
        resolve(true);
      }
    };

    try {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.on('data', onData);
    } catch {
      // Non-tty fallback
    }

    const render = () => {
      process.stdout.write(
        `\r  ⏳ ${chalk.bold.hex('#c084fc')(nextEpTitle)} başlatılıyor... ${chalk.bold.yellow(`[ ${remaining}s ]`)} ${chalk.gray('(İptal: Q / Hemen: Enter)')}   `
      );
    };

    render();
    timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        cleanup();
        resolve(true);
      } else {
        render();
      }
    }, 1000);
  });
}

function pause() {
  return new Promise(resolve => {
    process.stdout.write(chalk.gray('\nDevam etmek için Enter tuşuna basın...'));
    process.stdin.resume();
    process.stdin.once('data', () => {
      resolve();
    });
  });
}
