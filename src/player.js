import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import boxen from 'boxen';
import { startWebPlayer } from './webplayer.js';
import { getConfig } from './storage.js';
import { resolveMalId, getAniSkipTimes, createMpvAniSkipScript } from './aniskip.js';
import { getTerminalGeometry } from './geometry.js';

let runtimeDownloadMode = false;

export function setDownloadMode(enabled) {
  runtimeDownloadMode = Boolean(enabled);
}

export function isDownloadMode() {
  return runtimeDownloadMode;
}

function formatSeconds(sec) {
  if (!sec && sec !== 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getWinGetMpvPath() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const packagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(packagesDir)) {
    try {
      const entries = fs.readdirSync(packagesDir);
      const mpvDir = entries.find(e => e.toLowerCase().includes('mpv-player') || e.toLowerCase().includes('shinchiro.mpv'));
      if (mpvDir) {
        const fullDir = path.join(packagesDir, mpvDir);
        const comPath = path.join(fullDir, 'mpv.com');
        const exePath = path.join(fullDir, 'mpv.exe');
        if (fs.existsSync(comPath)) return { console: comPath, gui: exePath };
        if (fs.existsSync(exePath)) return { console: exePath, gui: exePath };
      }
    } catch {}
  }
  return null;
}

const MPV_CANDIDATE_PATHS = [
  path.join(process.cwd(), 'mpv.exe'),
  path.join(process.cwd(), 'mpv.com'),
  path.join(process.cwd(), 'bin', 'mpv.exe'),
  path.join(path.dirname(process.execPath || ''), 'mpv.exe'),
  path.join(path.dirname(process.execPath || ''), 'mpv.com'),
  path.join(path.dirname(process.execPath || ''), 'bin', 'mpv.exe'),
  'C:\\Program Files\\mpv\\mpv.com',
  'C:\\Program Files\\mpv\\mpv.exe',
  'C:\\Program Files\\mpv.net\\mpvnet.exe',
  'C:\\ProgramData\\chocolatey\\bin\\mpv.exe',
  'C:\\tools\\mpv\\mpv.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'mpv', 'mpv.exe')
];

const VLC_CANDIDATE_PATHS = [
  'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
  'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
];

/**
 * Check if a command is executable in PATH
 */
function isCommandInPath(cmd) {
  try {
    execSync(`where.exe ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function findMpvExecutable(preferConsole = true) {
  // 1. Prioritize portable local executables (in ./bin or current directory)
  const portableCandidates = preferConsole
    ? [
        path.join(process.cwd(), 'bin', 'mpv.com'),
        path.join(process.cwd(), 'mpv.com'),
        path.join(process.cwd(), 'bin', 'mpv.exe'),
        path.join(process.cwd(), 'mpv.exe'),
        path.join(path.dirname(process.argv0 || ''), 'bin', 'mpv.com'),
        path.join(path.dirname(process.argv0 || ''), 'mpv.com'),
        path.join(path.dirname(process.argv0 || ''), 'bin', 'mpv.exe'),
        path.join(path.dirname(process.argv0 || ''), 'mpv.exe')
      ]
    : [
        path.join(process.cwd(), 'bin', 'mpv.exe'),
        path.join(process.cwd(), 'mpv.exe'),
        path.join(path.dirname(process.argv0 || ''), 'bin', 'mpv.exe'),
        path.join(path.dirname(process.argv0 || ''), 'mpv.exe')
      ];

  for (const p of portableCandidates) {
    if (p && fs.existsSync(p)) return p;
  }

  // 2. WinGet installed MPV
  const wingetMpv = getWinGetMpvPath();
  if (wingetMpv) {
    return preferConsole ? wingetMpv.console : wingetMpv.gui;
  }

  // 3. System PATH
  if (isCommandInPath('mpv.com') && preferConsole) return 'mpv.com';
  if (isCommandInPath('mpv')) return 'mpv';

  // 4. Standard system locations
  for (const p of MPV_CANDIDATE_PATHS) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

/**
 * Locate yt-dlp executable for MPV web player extraction
 */
export function findYtDlpExecutable() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidatePaths = [
    path.join(process.cwd(), 'yt-dlp.exe'),
    path.join(path.dirname(process.execPath || ''), 'yt-dlp.exe'),
    path.join(process.cwd(), 'bin', 'yt-dlp.exe'),
    path.join(path.dirname(process.execPath || ''), 'bin', 'yt-dlp.exe'),
    path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'mpv-player.mpv-CI.MSVC_Microsoft.Winget.Source_8wekyb3d8bbwe', 'yt-dlp.exe'),
    path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe', 'yt-dlp.exe'),
    'C:\\Program Files\\yt-dlp\\yt-dlp.exe',
    'C:\\ProgramData\\chocolatey\\bin\\yt-dlp.exe'
  ];
  if (isCommandInPath('yt-dlp.exe')) return 'yt-dlp.exe';
  if (isCommandInPath('yt-dlp')) return 'yt-dlp';
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Detect available players on the system
 */
export function detectPlayers() {
  const players = [];
  const mpvPath = findMpvExecutable(true);

  if (mpvPath) {
    players.push({
      id: 'borderless',
      name: '✨ Yöntem A: Terminal Overlay Geometri (Terminale Tam Yapışan 1080p Modlu MPV - Önerilen)',
      path: findMpvExecutable(false) || mpvPath
    });
    players.push({
      id: 'fullscreen',
      name: '🎬 Tam Ekran MPV (1080p Otomatik Fullscreen)',
      path: findMpvExecutable(false) || mpvPath
    });
    players.push({
      id: 'mpv',
      name: '🪟 Standart Pencereli MPV (Klasik Başlık Çubuklu)',
      path: findMpvExecutable(false) || mpvPath
    });
  }

  // Check VLC
  let vlcPath = null;
  if (isCommandInPath('vlc')) {
    vlcPath = 'vlc';
  } else {
    for (const p of VLC_CANDIDATE_PATHS) {
      if (fs.existsSync(p)) {
        vlcPath = p;
        break;
      }
    }
  }
  if (vlcPath) {
    players.push({ id: 'vlc', name: 'VLC Media Player', path: vlcPath });
  }

  return players;
}

/**
 * Launch playback using specified player
 */
export async function playStream({
  playerType = 'terminal',
  streamUrl,
  isDirect = true,
  embedUrl = '',
  title = '',
  episodeName = '',
  season = 1,
  episode = 1,
  qualities = [],
  server = '',
  extra = '',
  captions = [],
  audioPreference = 'sub',
  anime = null,
  malId = null,
  headers = null
}) {
  const mpvExec = findMpvExecutable(true);
  let videoTarget = isDirect ? streamUrl : embedUrl;
  const config = getConfig();

  let isDirectVideo = isDirect && Boolean(
    videoTarget && (
      videoTarget.includes('.m3u8') ||
      videoTarget.includes('.mp4') ||
      videoTarget.includes('/m3/') ||
      videoTarget.includes('master') ||
      videoTarget.includes('playlist') ||
      videoTarget.includes('googlevideo') ||
      videoTarget.includes('fastcdn') ||
      videoTarget.includes('rapidrame') ||
      videoTarget.includes('tau-video') ||
      videoTarget.includes('youtube.com') ||
      videoTarget.includes('youtu.be') ||
      videoTarget.includes('dailymotion.com')
    )
  );

  const ytDlpPath = findYtDlpExecutable();

  // If not direct video, sniff dynamically in background using headless browser before giving up
  if (!isDirectVideo && (embedUrl || videoTarget)) {
    const targetUrl = embedUrl || videoTarget;
    console.log(chalk.cyan('\n🔍 Web oynatıcısından doğrudan MPV video akışı (.m3u8/.mp4) çözümleniyor...'));
    try {
      const { sniffDirectStreamFromWebPlayer } = await import('./extractor.js');
      const sniffed = await sniffDirectStreamFromWebPlayer(targetUrl);
      if (sniffed.success && sniffed.streamUrl) {
        console.log(chalk.green('✓ Doğrudan video akışı yakalandı, MPV başlatılıyor!\n'));
        videoTarget = sniffed.streamUrl;
        isDirectVideo = true;
      }
    } catch {}
  }

  // Check if MPV can attempt to play: direct video, or yt-dlp is available
  const canPlayInMpv = isDirectVideo || Boolean(ytDlpPath);

  if (!canPlayInMpv) {
    console.log(chalk.yellow('\nℹ️ Bu içerik doğrudan video akışı (.m3u8/.mp4) yerine web oynatıcı içeriyor.'));
    console.log(chalk.cyan('🌐 Web tarayıcınızda açılıyor: ') + chalk.white(embedUrl || videoTarget));
    try {
      const openModule = await import('open');
      await openModule.default(embedUrl || videoTarget);
    } catch {
      await startWebPlayer({
        videoUrl: streamUrl,
        isDirect: false,
        embedUrl: embedUrl || videoTarget,
        title,
        episodeName,
        season,
        episode,
        qualities,
        server,
        extra
      });
    }
    console.log(chalk.gray('\nDevam etmek için Enter tuşuna basın...'));
    await new Promise(r => {
      process.stdin.resume();
      process.stdin.once('data', () => r());
    });
    return { action: 'finished' };
  }

  const subSizeMap = { small: 36, medium: 46, large: 58 };
  const subColorMap = {
    white: '#FFFFFF',
    yellow: '#FFE600',
    soft_white: '#E6E6E6'
  };
  const subFontSize = subSizeMap[config.subSize] || 46;
  const subColorHex = subColorMap[config.subColor] || '#FFFFFF';
  const windowAutofit = `${config.windowSize || '75%'}x${config.windowSize || '75%'}`;

  const isHdFilm = videoTarget.includes('rapidrame') || videoTarget.includes('hdfilmcehennemi');
  const isDiziKorea = (anime && anime.source === 'dizikorea') || videoTarget.includes('dizikorea');
  const isWDT = (anime && anime.source === 'webdramaturkey') || videoTarget.includes('webdramaturkey') || videoTarget.includes('dtpasn');
  const isDiziAsya = (anime && anime.source === 'diziasya') || videoTarget.includes('diziasya');
  const isOpenAni = (anime && anime.source === 'openani') || videoTarget.includes('zyapbot') || videoTarget.includes('yeshi') || videoTarget.includes('openani');
  const isAnizm = (anime && anime.source === 'anizm') || videoTarget.includes('anizmplayer') || videoTarget.includes('anizm');
  const isYabanciDizi = (anime && anime.source === 'yabancidizi') || videoTarget.includes('yabancidizi') || videoTarget.includes('molystream');
  const isTrDizi = (anime && anime.source === 'trdizi') || videoTarget.includes('trdiziizle');

  let referrer = 'https://animecix.tv/';
  if (videoTarget.includes('vmpx') || videoTarget.includes('vidmoly')) {
    referrer = 'https://vidmoly.org/';
  } else if (videoTarget.includes('aniziumserver') || (anime && anime.source === 'anizium')) {
    referrer = 'https://anizium.co/';
  } else if (videoTarget.includes('pilavyerplay') || (anime && (anime.source === 'ddizibox' || anime.source === 'dizibox'))) {
    referrer = 'https://pilavyerplay.top/';
  } else if (videoTarget.includes('fastplay') || videoTarget.includes('setplay') || (anime && anime.source === 'hdfilmland')) {
    referrer = 'https://fastplay.mom/';
  } else if (videoTarget.includes('oynatloload') || videoTarget.includes('verseneload') || (anime && anime.source === 'filmmakinesi')) {
    referrer = 'https://oynatloload.top/';
  } else if (videoTarget.includes('playerdkorea')) {
    referrer = 'https://playerdkorea.xyz/';
  } else if (isHdFilm) {
    referrer = 'https://www.hdfilmcehennemi.nl/';
  } else if (isDiziKorea) {
    referrer = 'https://dizikorea3.com/';
  } else if (isWDT) {
    referrer = 'https://webdramaturkey2.com/';
  } else if (isDiziAsya) {
    referrer = 'https://diziasya.com/';
  } else if (isOpenAni) {
    referrer = 'https://openani.me/';
  } else if (isAnizm) {
    referrer = 'https://anizmplayer.com/';
  } else if (isYabanciDizi) {
    referrer = 'https://yabancidizi.news/';
  } else if (isTrDizi) {
    referrer = 'https://www.trdiziizle.tv/';
  }

  if (headers && typeof headers === 'object') {
    const customRef = headers.Referer || headers.referer || headers.Origin || headers.origin;
    if (customRef) referrer = customRef;
  }

  // Handle Download Mode
  const shouldDownload = runtimeDownloadMode || config.playAction === 'ask';
  if (shouldDownload) {
    let doDownload = runtimeDownloadMode;
    if (!doDownload && config.playAction === 'ask') {
      const { select } = await import('@inquirer/prompts');
      const chosen = await select({
        message: `${title} (${episodeName || 'Bölüm'}) için ne yapmak istersiniz?`,
        choices: [
          { name: '▶️ MPV ile Oynat', value: 'play' },
          { name: '📥 Bilgisayara İndir (.mp4)', value: 'download' }
        ]
      });
      doDownload = chosen === 'download';
    }

    if (doDownload) {
      const { downloadStream } = await import('./downloader.js');
      const dlRes = await downloadStream({
        streamUrl: videoTarget,
        title,
        episodeName,
        season,
        episode,
        referrer,
        headers,
        isDirect: isDirectVideo,
        anime
      });
      return { action: 'downloaded', success: dlRes.success };
    }
  }

  const actionDir = path.join(os.homedir(), '.anyclient');
  if (!fs.existsSync(actionDir)) {
    try { fs.mkdirSync(actionDir, { recursive: true }); } catch {}
  }
  const actionFile = path.join(actionDir, 'action.txt');
  try { fs.unlinkSync(actionFile); } catch {}

  const isFullscreen = config.fullscreen === true || playerType === 'fullscreen';

  const termGeo = getTerminalGeometry();
  let geometryArgs = [];
  if (isFullscreen) {
    geometryArgs = ['--fs=yes'];
  } else if (termGeo) {
    geometryArgs = [`--geometry=${termGeo}`];
  } else {
    geometryArgs = [`--autofit=${windowAutofit}`, '--geometry=50%:50%'];
  }

  const isSport = anime?.source === 'sport';
  const isLive = isSport || (extra && String(extra).toLowerCase().includes('live')) || headers?.behaviorHints?.isLive === true;

  const windowTitle = isLive
    ? `[GörkemStream Canlı] ${title} • ${episodeName}`
    : `[GörkemStream] ${title} - S${season}E${episode}: ${episodeName}`;

  const commonMpvArgs = [
    `--title=${windowTitle}`,
    '--force-window=immediate',
    '--border=no',
    '--ontop',
    '--focus-on=open',
    '--keep-open=yes',
    '--no-taskbar-progress',
    `--referrer=${referrer}`,
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    `--sub-font=Outfit, Segoe UI, Arial, sans-serif`,
    `--sub-font-size=${subFontSize}`,
    `--sub-color=${subColorHex}`,
    `--sub-border-size=2.2`,
    `--sub-border-color=#111111`,
    `--sub-shadow-offset=1.0`,
    `--sub-shadow-color=#111111`,
    `--sub-pos=95`,
    `--osd-font=Outfit, Segoe UI, sans-serif`,
    `--osd-font-size=20`,
    `--osd-color=#FFFFFF`,
    `--osd-border-color=#1A1A1E`,
    `--osd-border-size=1.8`
  ];

  if (isLive) {
    // Canlı maç ve TV yayınlarında varsayılan 15-20 saniyelik HLS segment gecikmesini sıfırlayan ultra düşük gecikmeli canlı ayarlar
    commonMpvArgs.push(
      '--demuxer-lavf-o=live_start_index=-1',
      '--demuxer-readahead-secs=1',
      '--cache-secs=1',
      '--demuxer-max-bytes=20MiB',
      '--demuxer-max-back-bytes=5MiB',
      '--force-seekable=no',
      '--hls-bitrate=max',
      '--stream-buffer-size=128KiB'
    );
  } else {
    commonMpvArgs.push(
      '--hr-seek=yes',
      '--cache=yes',
      '--demuxer-max-bytes=150MiB'
    );
  }

  if (ytDlpPath) {
    commonMpvArgs.push(`--script-opts=ytdl_hook-ytdl_path=${ytDlpPath}`);
  }
  commonMpvArgs.push('--ytdl=yes');

  if ((isAnizm || isWDT || isDiziAsya || isDiziKorea) && (videoTarget.includes('.m3u8') || videoTarget.includes('/m3/') || videoTarget.includes('master.txt'))) {
    commonMpvArgs.push('--demuxer-lavf-format=hls');
  }

  // Subtitle and Audio Language Priority
  if (audioPreference === 'dub') {
    // Türkçe Dublaj Modu: Türkçe ses öncelikli, altyazı varsayılan kapalı (v ile açılabilir)
    commonMpvArgs.push(
      '--alang=tr,tur,Turkish,turkce',
      '--sub-visibility=no',
      '--slang=tr,tur,Turkish,turkce,en,eng'
    );
  } else {
    // Türkçe Altyazılı Modu: Orijinal ses, Türkçe altyazı otomatik aktif
    commonMpvArgs.push(
      '--alang=en,eng,ja,jpn,ko,kor,original,und,tr,tur',
      '--sub-visibility=yes',
      '--sub-auto=all',
      '--slang=tr,tur,Turkish,turkce,en,eng'
    );
  }

  if (captions && captions.length > 0) {
    const sortedCaptions = [...captions].sort((a, b) => {
      const aTr = (a.label?.toLowerCase().includes('türk') || a.url?.toLowerCase().includes('turkish') || a.url?.toLowerCase().includes('tr')) ? 1 : 0;
      const bTr = (b.label?.toLowerCase().includes('türk') || b.url?.toLowerCase().includes('turkish') || b.url?.toLowerCase().includes('tr')) ? 1 : 0;
      return bTr - aTr;
    });

    for (const cap of sortedCaptions) {
      if (cap.url) {
        commonMpvArgs.push(`--sub-file=${cap.url}`);
      }
    }
    if (audioPreference !== 'dub') {
      commonMpvArgs.push('--sid=1');
    }
  }

  // AniSkip real timestamps integration
  if (config.aniSkip !== 'off' && !isLive) {
    try {
      const resolvedMalId = malId || (await resolveMalId(anime));
      if (resolvedMalId) {
        const skipTimes = await getAniSkipTimes(resolvedMalId, episode);
        const luaPath = createMpvAniSkipScript({
          op: skipTimes?.op || null,
          ed: config.skipEnding ? skipTimes?.ed : null,
          recap: skipTimes?.recap || null,
          autoSkip: config.aniSkip === 'auto',
          animeTitle: title,
          season,
          episode
        });
        if (luaPath) {
          commonMpvArgs.push(`--script=${luaPath}`);
        }
        if (skipTimes && skipTimes.found) {
          const parts = [];
          if (skipTimes.op) parts.push(`Açılış: ${formatSeconds(skipTimes.op.start)} - ${formatSeconds(skipTimes.op.end)}`);
          if (skipTimes.ed) parts.push(`Kapanış: ${formatSeconds(skipTimes.ed.start)} - ${formatSeconds(skipTimes.ed.end)}`);
          console.log(chalk.gray('   • AniSkip: ') + chalk.white(parts.join(' | ')) + chalk.gray(` [${config.aniSkip === 'auto' ? 'Otomatik Atlanacak' : 'TAB ile Atla'}]\n`));
        }
      }
    } catch {}
  }

  // 1. Terminal Üzerine Yapışan Çerçevesiz HD Mod / Tam Ekran (Yöntem A)
  if ((playerType === 'borderless' || playerType === 'fullscreen' || playerType === 'mpv') && mpvExec) {
    const guiExe = findMpvExecutable(false) || mpvExec;
    const args = [
      ...commonMpvArgs,
      ...geometryArgs,
      videoTarget
    ];

    printMpvControlsTip(config);

    return new Promise((resolve) => {
      const proc = spawn(guiExe, args, { stdio: 'inherit' });
      proc.on('close', async (code) => {
        let action = 'finished';
        if (fs.existsSync(actionFile)) {
          try {
            const act = fs.readFileSync(actionFile, 'utf-8').trim();
            if (act) action = act;
            fs.unlinkSync(actionFile);
          } catch {}
        }
        if (code !== 0 && !isDirectVideo && (embedUrl || videoTarget)) {
          console.log(chalk.yellow('\nℹ️ MPV bu web oynatıcıyı doğrudan oynatamadı. Web tarayıcınızda açılıyor...'));
          try {
            const openModule = await import('open');
            await openModule.default(embedUrl || videoTarget);
          } catch {}
        }
        resolve({ action, code });
      });
      proc.on('error', (err) => {
        console.error(chalk.red('MPV başlatma hatası:'), err.message);
        resolve({ action: 'error' });
      });
    });
  }

  // 3. Tam Ekran MPV Modu
  if (playerType === 'fullscreen' && mpvExec) {
    const guiExe = findMpvExecutable(false) || mpvExec;
    const args = [
      ...commonMpvArgs,
      '--fs=yes',
      videoTarget
    ];

    printMpvControlsTip(config);

    return new Promise((resolve) => {
      const proc = spawn(guiExe, args, { stdio: 'inherit' });
      proc.on('close', (code) => resolve({ action: 'finished', code }));
      proc.on('error', () => {
        playInTerminal({ mpvPath: mpvExec, videoUrl: videoTarget, title, episodeName, season, episode, captions }).then(resolve);
      });
    });
  }

  // 4. Standart Pencereli MPV modu
  if (playerType === 'mpv' && mpvExec) {
    const args = [
      ...commonMpvArgs,
      `--autofit=${windowAutofit}`,
      '--geometry=50%:50%',
      videoTarget
    ];

    printMpvControlsTip(config);

    return new Promise((resolve) => {
      const proc = spawn(mpvExec, args, { stdio: 'inherit' });
      proc.on('close', (code) => resolve({ action: 'finished', code }));
      proc.on('error', () => {
        startWebPlayer({
          videoUrl: streamUrl,
          isDirect,
          embedUrl,
          title,
          episodeName,
          season,
          episode,
          qualities,
          server,
          extra
        }).then(resolve);
      });
    });
  }

  // 3. VLC
  if (playerType === 'vlc') {
    const available = detectPlayers();
    const vlcObj = available.find(p => p.id === 'vlc');
    const exe = vlcObj ? vlcObj.path : 'vlc';

    return new Promise((resolve) => {
      const proc = spawn(exe, [videoTarget, `--meta-title=[GörkemStream] ${title} - S${season}E${episode}`], { stdio: 'ignore' });
      proc.on('close', (code) => resolve({ action: 'finished', code }));
      proc.on('error', () => {
        startWebPlayer({
          videoUrl: streamUrl,
          isDirect,
          embedUrl,
          title,
          episodeName,
          season,
          episode,
          qualities,
          server,
          extra
        }).then(resolve);
      });
    });
  }

  // 4. Dahili Web Oynatıcı
  return await startWebPlayer({
    videoUrl: streamUrl,
    isDirect,
    embedUrl,
    title,
    episodeName,
    season,
    episode,
    qualities,
    server,
    extra
  });
}

/**
 * In-Terminal TrueColor ANSI video renderer using MPV TCT
 */
async function playInTerminal({ mpvPath, videoUrl, title, episodeName, season, episode, captions }) {
  console.clear();
  console.log(boxen(
    `${chalk.bold.hex('#f472b6')(title)} • ${chalk.bold.cyan(`Sezon ${season} Bölüm ${episode}`)}${episodeName ? `\n${chalk.white(episodeName)}` : ''}\n\n` +
    `${chalk.yellow('Klavye:')} ${chalk.bold.white('[q]')} Kapat/Geri  ${chalk.bold.white('[Boşluk]')} Duraklat  ${chalk.bold.white('[←/→]')} 5sn Sar  ${chalk.bold.white('[9/0]')} Ses`,
    {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: '#a855f7',
      title: chalk.bold.hex('#a855f7')(' 📺 TERMİNAL İÇİ VİDEO (Ayrı Pencere Açılmaz) '),
      titleAlignment: 'center'
    }
  ));
  console.log(chalk.gray('Akış terminal ekranına bağlanıyor, lütfen bekleyin...\n'));

  const args = [
    '--vo=tct',
    '--vo-tct-algo=half-blocks',
    '--vo-tct-buffering=frame',
    '--profile=sw-fast',
    '--force-window=no',
    '--terminal=yes',
    '--no-config',
    '--msg-level=all=no',
    '--really-quiet',
    '--referrer=https://animecix.tv/',
    '--http-header-fields=User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  ];

  if (captions && captions.length > 0 && captions[0].url) {
    args.push(`--sub-file=${captions[0].url}`);
  }
  args.push(videoUrl);

  return new Promise((resolve) => {
    // Hide cursor and clear on start
    process.stdout.write('\x1B[?25l');

    const proc = spawn(mpvPath, args, { stdio: 'inherit' });

    proc.on('close', (code) => {
      // Restore cursor and clear screen
      process.stdout.write('\x1B[?25h\x1B[2J\x1B[0;0H');
      resolve({ action: 'finished', code });
    });

    proc.on('error', (err) => {
      process.stdout.write('\x1B[?25h');
      console.error(chalk.red('Terminal içi video oynatma hatası:'), err.message);
      resolve({ action: 'error' });
    });
  });
}

/**
 * Install MPV via winget
 */
export function installMpvViaWinget() {
  try {
    const res = spawn('winget', ['install', 'mpv-player.mpv-CI.MSVC', '--accept-source-agreements', '--accept-package-agreements'], {
      stdio: 'inherit',
      shell: true
    });
    return new Promise((resolve) => {
      res.on('close', (code) => resolve(code === 0));
    });
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Print interactive MPV keyboard shortcut tips
 */
export function printMpvControlsTip(config = {}) {
  const aniSkipTip = config.aniSkip !== 'off' ? `  ${chalk.cyan('[TAB / i]')} Jenerik Atla (AniSkip)` : '';
  console.log(
    chalk.gray('  ┌─ GörkemStream MPV Mod Kısayolları ───────────────────────────────────────────┐\n') +
    chalk.gray('  │ ') + `${chalk.yellow('[Boşluk]')} Duraklat  ${chalk.yellow('[n]')} Sonraki  ${chalk.yellow('[p]')} Önceki  ${chalk.yellow('[f]')} Tam Ekran  ${chalk.yellow('[q]')} Çıkış\n` +
    chalk.gray('  │ ') + `${chalk.cyan('[v]')} Altyazı Aç/Kapat  ${chalk.cyan('[j]')} Altyazı Dili  ${chalk.cyan('[#]')} Ses Dili (Dublaj/Orijinal)\n` +
    (aniSkipTip ? chalk.gray('  │ ') + `${aniSkipTip}  ${chalk.gray('(Açılış/Kapanış jeneriklerini anında atlar)')}\n` : '') +
    chalk.gray('  └─────────────────────────────────────────────────────────────────────────────┘')
  );
}
