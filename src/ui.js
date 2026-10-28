import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';
import ora from 'ora';

// Minimal, elegant platinum silver gradient
const silverGradient = gradient(['#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8']);

/**
 * Display minimal and aesthetic application banner
 */
export function showBanner() {
  console.clear();
  const text = figlet.textSync('AnyClient', {
    font: 'Small',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  console.log(silverGradient(text));
  console.log(
    chalk.bold.white('  anyclient') +
    chalk.gray(' • ') +
    chalk.dim('v2.0.0\n')
  );
}

export function printHeader(title) {
  console.log('\n' + chalk.bold.white('› ' + title));
  console.log(chalk.gray('─'.repeat(Math.max(40, title.length + 5))));
}

/**
 * Minimalist, elegant result badges
 */
export function formatResultBadge(item) {
  const src = item.source || 'bilinmiyor';
  let badge = '';
  let metaLeft = '';

  if (src === 'anizium') {
    badge = chalk.white.bold('ANIZIUM');
    const q = item.quality || '4K';
    const s = item.imdb ? `★${item.imdb}` : 'UHD';
    metaLeft = chalk.gray(`│ ${q.padEnd(4)} │ ${s.padEnd(5)}`);
  } else if (src === 'anizm') {
    badge = chalk.white.bold('ANİZM');
    const y = item.year || '2024';
    metaLeft = chalk.gray(`│ ${y.padEnd(4)} │ 1080p`);
  } else if (src === 'openani') {
    badge = chalk.white.bold('OPENANI');
    const y = item.year ? String(item.year) : '2024';
    const s = item.score ? `★${Number(item.score).toFixed(1)}` : '1080p';
    metaLeft = chalk.gray(`│ ${y.padEnd(4)} │ ${s.padEnd(5)}`);
  } else if (src === 'animecix') {
    badge = chalk.white.bold('ANIMECIX');
    const y = item.year ? String(item.year) : 'Anime';
    const sc = item.mal_vote_average || item.tmdb_vote_average;
    const s = sc ? `★${Number(sc).toFixed(1)}` : '1080p';
    metaLeft = chalk.gray(`│ ${y.padEnd(4)} │ ${s.padEnd(5)}`);
  } else if (src === 'dizikorea') {
    badge = chalk.white.bold('DIZIKOR');
    const y = item.year || 'Kore';
    const tag = item.isSeries ? 'Dizi' : 'Film';
    metaLeft = chalk.gray(`│ ${y.padEnd(4)} │ ${tag.padEnd(5)}`);
  } else if (src === 'diziasya') {
    badge = chalk.white.bold('DIZIASYA');
    const country = (item.country || 'Asya').slice(0, 4);
    const rate = item.rate && item.rate !== '0' ? `★${item.rate}` : (item.isMovie ? 'Film' : 'Dizi');
    metaLeft = chalk.gray(`│ ${country.padEnd(4)} │ ${rate.padEnd(5)}`);
  } else if (src === 'webdramaturkey') {
    badge = chalk.white.bold('WEBDRAMA');
    const tag = item.isMovie ? 'Film' : 'Dizi';
    metaLeft = chalk.gray(`│ Asya │ ${tag.padEnd(5)}`);
  } else if (src === 'hdfilm') {
    badge = chalk.white.bold('HDFILM');
    const y = item.year || (item.isSeries ? 'Dizi' : 'Film');
    const imdb = item.imdb ? `★${item.imdb}` : '1080p';
    metaLeft = chalk.gray(`│ ${y.padEnd(4)} │ ${imdb.padEnd(5)}`);
  } else if (src === 'hdfilmland') {
    badge = chalk.white.bold('HDFILM.LAND');
    const y = item.year || (item.isSeries ? 'Dizi' : 'Film');
    const imdb = item.imdb ? `★${item.imdb}` : '1080p';
    metaLeft = chalk.gray(`│ ${y.padEnd(4)} │ ${imdb.padEnd(5)}`);
  } else if (src === 'ddizibox' || src === 'dizibox') {
    badge = chalk.white.bold('DDIZIBOX');
    const y = item.year || 'Dizi';
    const tag = item.imdb ? `★${item.imdb}` : '1080p';
    metaLeft = chalk.gray(`│ ${y.padEnd(4)} │ ${tag.padEnd(5)}`);
  } else if (src === 'filmmakinesi') {
    badge = chalk.white.bold('FILMMAK');
    const y = item.year || 'Film';
    const tag = item.imdb ? `★${item.imdb}` : '1080p';
    metaLeft = chalk.gray(`│ ${y.padEnd(4)} │ ${tag.padEnd(5)}`);
  } else if (src === 'yabancidizi') {
    badge = chalk.white.bold('Y.DIZI');
    const y = item.year || (item.isSeries ? 'Dizi' : 'Film');
    metaLeft = chalk.gray(`│ ${y.padEnd(4)} │ 1080p`);
  } else if (src === 'trdizi') {
    badge = chalk.white.bold('TRDİZİ');
    metaLeft = chalk.gray(`│ Yerli│ 1080p`);
  } else if (src === 'sport') {
    badge = chalk.white.bold('CANLI TV');
    metaLeft = chalk.gray(`│ Spor │ Canlı`);
  } else {
    badge = chalk.white.bold('MEDYA');
    metaLeft = chalk.gray(`│ 1080p│ Akış `);
  }

  const leftBlock = chalk.gray('[ ') + badge + ' ' + metaLeft + chalk.gray(' ]');
  const title = chalk.white(item.title || item.name || 'İsimsiz İçerik');

  let extra = '';
  if (item.name_romanji && item.name_romanji !== item.name) {
    extra = chalk.gray(` (${item.name_romanji})`);
  } else if (item.extra) {
    extra = chalk.gray(` (${item.extra})`);
  }

  return `${leftBlock}  ${title}${extra}`;
}

/**
 * Display clean, minimal media synopsis card
 */
export function displayMediaCard(media) {
  const title = chalk.bold.white(media.title || media.name || 'Bilinmiyor');
  const romanji = media.name_romanji ? chalk.gray(` (${media.name_romanji})`) : '';
  const year = chalk.dim(media.year || 'N/A');
  const source = media.source ? chalk.dim(`kaynak: ${media.source}`) : '';

  let seasons = '';
  if (media.season_count) {
    seasons = chalk.dim(`${media.season_count} sezon`);
  } else if (media.isSeries !== undefined) {
    seasons = chalk.dim(media.isSeries ? 'dizi serisi' : 'tek film');
  }

  const scoreVal = media.score || media.mal_vote_average || media.tmdb_vote_average || media.imdb || media.rate;
  const score = scoreVal
    ? chalk.white(`★ ${typeof scoreVal === 'number' ? scoreVal.toFixed(1) : scoreVal}`)
    : chalk.gray('★ N/A');

  const genres = (media.genres || [])
    .map(g => chalk.gray(`[${typeof g === 'object' ? (g.display_name || g.name) : g}]`))
    .join(' ');

  const desc = media.description
    ? chalk.dim(truncateText(media.description, 260))
    : (media.synopsis ? chalk.dim(truncateText(media.synopsis, 260)) : chalk.gray('Açıklama bulunmuyor.'));

  const metaLine = [year, seasons, score, source].filter(Boolean).join('  •  ');

  const content = [
    `${title}${romanji}`,
    metaLine,
    genres ? `\ntürler: ${genres}` : '',
    `\n${desc}`
  ].filter(Boolean).join('\n');

  console.log(
    boxen(content, {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: '#475569',
      title: chalk.dim(' görkemstream • detay '),
      titleAlignment: 'left'
    })
  );
}

// Backward-compatible alias
export const displayAnimeCard = displayMediaCard;

/**
 * Create a minimal clean spinner
 */
export function createSpinner(text) {
  return ora({
    text: chalk.white(text),
    color: 'white',
    spinner: 'dots'
  });
}

function truncateText(str, max) {
  if (!str) return '';
  const clean = str.replace(/<[^>]*>/g, '').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max) + '...';
}

/**
 * Display minimal settings summary card
 */
export function displayConfigSummary(config) {
  const providerLabel = config.provider === 'openani' ? 'OpenAnime' : (config.provider === 'animecix' ? 'AnimeciX' : 'OpenAnime & AnimeciX');

  let playerLabel = config.player;
  if (config.player === 'borderless') playerLabel = 'Çerçevesiz 1080p';
  else if (config.player === 'fullscreen') playerLabel = 'Tam Ekran MPV';
  else if (config.player === 'terminal') playerLabel = 'Terminal Karakter';
  else if (config.player === 'mpv') playerLabel = 'Standart MPV';
  else if (config.player === 'browser') playerLabel = 'Web Oynatıcı';

  let autoNextLabel = 'Geri Sayım (3s)';
  if (config.autoNext === 'instant') autoNextLabel = 'Anında Geçiş';
  else if (config.autoNext === 'countdown') autoNextLabel = `Geri Sayım (${config.autoNextDelay || 3}s)`;
  else if (config.autoNext === 'prompt') autoNextLabel = 'Onay Sor';
  else if (config.autoNext === 'off') autoNextLabel = 'Kapalı';

  let aniSkipLabel = 'Otomatik Atla';
  if (config.aniSkip === 'auto') {
    aniSkipLabel = config.skipEnding ? 'Otomatik (Açılış + Kapanış)' : 'Otomatik (Açılış)';
  } else if (config.aniSkip === 'manual') {
    aniSkipLabel = 'Manuel (Tab / i)';
  } else if (config.aniSkip === 'off') {
    aniSkipLabel = 'Kapalı';
  }

  const windowInfo = `Boyut: ${config.windowSize || '75%'} • Üstte Sabit: ${config.alwaysOnTop ? 'Açık' : 'Kapalı'}`;
  const subInfo = `Boyut: ${config.subSize || 'medium'} • Renk: ${config.subColor || 'white'}`;

  const content = [
    `${chalk.dim('Anime Motoru:')}    ${chalk.white(providerLabel)}`,
    `${chalk.dim('Oynatıcı:')}        ${chalk.white(playerLabel)}`,
    `${chalk.dim('Otomatik Bölüm:')}  ${chalk.white(autoNextLabel)}`,
    `${chalk.dim('Kalite:')}          ${chalk.white(config.quality.toUpperCase())}`,
    `${chalk.dim('AniSkip:')}         ${chalk.white(aniSkipLabel)}`,
    `${chalk.dim('Pencere:')}         ${chalk.gray(windowInfo)}`,
    `${chalk.dim('Altyazı:')}         ${chalk.gray(subInfo)}`
  ].join('\n');

  console.log(
    boxen(content, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: '#475569',
      title: chalk.dim(' görkemstream • yapılandırma '),
      titleAlignment: 'left'
    })
  );
}

/**
 * Display MPV keyboard cheat sheet modal
 */
export function displayKeybindsModal() {
  const content = [
    `${chalk.bold.white('[Tab / i]')}      AniSkip: Açılış (OP) & Kapanış (ED) Jeneriğini Atla`,
    `${chalk.bold.white('[n]')}            Sıradaki Bölüme Geç`,
    `${chalk.bold.white('[p]')}            Önceki Bölüme Dön`,
    `${chalk.bold.white('[Boşluk]')}       Videoyu Duraklat / Devam Ettir`,
    `${chalk.bold.white('[f]')}            Tam Ekran Moduna Geç / Çık`,
    `${chalk.bold.white('[← / →]')}        5 Saniye Geri / İleri Sar`,
    `${chalk.bold.white('[↓ / ↑]')}        1 Dakika Geri / İleri Sar`,
    `${chalk.bold.white('[9 / 0]')}        Sesi Azalt / Yükselt`,
    `${chalk.bold.white('[m]')}            Sesi Kapat / Aç (Mute)`,
    `${chalk.bold.white('[[ / ]]')}        Oynatma Hızını %10 Düşür / Arttır`,
    `${chalk.bold.white('[s]')}            Anlık Ekran Görüntüsü Al`,
    `${chalk.bold.white('[v]')}            Altyazıyı Aç / Gizle`,
    `${chalk.bold.white('[ESC / q]')}      Oynatıcıyı Kapat ve Terminale Dön`
  ].join('\n');

  console.log(
    boxen(content, {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: '#475569',
      title: chalk.dim(' kısayol rehberi '),
      titleAlignment: 'center'
    })
  );
}
