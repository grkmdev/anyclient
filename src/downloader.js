import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import open from 'open';
import { findYtDlpExecutable } from './player.js';

/**
 * Locate FFmpeg executable across PATH, WinGet, Chocolatey and portable directories
 */
export function findFfmpegExecutable() {
  // Check PATH first
  try {
    execSync('where.exe ffmpeg', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {}

  const localAppData = process.env.LOCALAPPDATA || '';
  const wingetLinks = path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe');
  if (fs.existsSync(wingetLinks)) return wingetLinks;

  // Search WinGet Packages for Gyan.FFmpeg or similar
  const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetPackages)) {
    try {
      const entries = fs.readdirSync(wingetPackages);
      const ffmpegDir = entries.find(e => e.toLowerCase().includes('ffmpeg'));
      if (ffmpegDir) {
        const fullDir = path.join(wingetPackages, ffmpegDir);
        // Find nested bin/ffmpeg.exe
        const checkSub = (dir, depth = 0) => {
          if (depth > 3) return null;
          const files = fs.readdirSync(dir);
          for (const f of files) {
            const fp = path.join(dir, f);
            if (f.toLowerCase() === 'ffmpeg.exe') return fp;
            try {
              if (fs.statSync(fp).isDirectory()) {
                const found = checkSub(fp, depth + 1);
                if (found) return found;
              }
            } catch {}
          }
          return null;
        };
        const found = checkSub(fullDir);
        if (found) return found;
      }
    } catch {}
  }

  // Candidate standard paths
  const candidatePaths = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
    path.join(process.cwd(), 'ffmpeg.exe'),
    path.join(process.cwd(), 'bin', 'ffmpeg.exe'),
    path.join(path.dirname(process.execPath || ''), 'ffmpeg.exe'),
    path.join(path.dirname(process.execPath || ''), 'bin', 'ffmpeg.exe')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

/**
 * Sanitize filename for Windows & Unix filesystems
 */
export function sanitizeFileName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get default downloads directory for AnyClient
 */
export function getDownloadsDirectory() {
  const dir = path.join(os.homedir(), 'Downloads', 'AnyClient');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return dir;
}

/**
 * Format bytes to readable size
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Download a video stream (HLS .m3u8 or direct .mp4) to local disk using FFmpeg / yt-dlp / native fetch
 */
export async function downloadStream({
  streamUrl,
  title = 'Medya',
  episodeName = '',
  season = null,
  episode = null,
  referrer = 'https://animecix.tv/',
  headers = {},
  isDirect = true
}) {
  console.log('\n' + boxen(
    chalk.bold.hex('#00FFCC')('📥 GÖRKEMSTREAM ÇEVRİMDIŞI İNDİRME MOTORU') + '\n' +
    chalk.gray('İçerik en yüksek kalitede (1080p/4K) kayıpsız MP4 olarak kaydediliyor...'),
    {
      padding: { left: 2, right: 2, top: 0, bottom: 0 },
      borderStyle: 'round',
      borderColor: '#00FFCC'
    }
  ));

  const downloadDir = getDownloadsDirectory();

  // Generate clean filename
  let filenameBase = sanitizeFileName(title);
  if (season && episode) {
    filenameBase += ` - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
  } else if (episode) {
    filenameBase += ` - Bölüm ${episode}`;
  }
  if (episodeName && !filenameBase.includes(sanitizeFileName(episodeName))) {
    filenameBase += ` - ${sanitizeFileName(episodeName)}`;
  }
  const outputFileName = `${filenameBase}.mp4`;
  const outputPath = path.join(downloadDir, outputFileName);

  console.log(chalk.dim('  Hedef Klasör : ') + chalk.cyan(downloadDir));
  console.log(chalk.dim('  Dosya Adı    : ') + chalk.white.bold(outputFileName));
  console.log(chalk.dim('  Kaynak Akış  : ') + chalk.gray(streamUrl.slice(0, 75) + '...') + '\n');

  // Check if file already exists
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    if (stats.size > 1024 * 1024) {
      console.log(chalk.yellow(`⚠️ Bu dosya zaten mevcut (${formatBytes(stats.size)}).`));
      const { confirm } = await import('@inquirer/prompts');
      const overwrite = await confirm({
        message: 'Mevcut dosyanın üzerine yazılsın mı?',
        default: false
      });
      if (!overwrite) {
        console.log(chalk.gray('İndirme iptal edildi. Mevcut dosya korundu.'));
        return { success: true, path: outputPath, skipped: true };
      }
    }
  }

  const ffmpegExe = findFfmpegExecutable();
  const ytDlpExe = findYtDlpExecutable();

  // Method 1: FFmpeg (Fastest stream copy)
  if (ffmpegExe) {
    return await downloadWithFFmpeg({
      ffmpegExe,
      streamUrl,
      outputPath,
      outputFileName,
      referrer,
      headers
    });
  }

  // Method 2: yt-dlp
  if (ytDlpExe) {
    return await downloadWithYtDlp({
      ytDlpExe,
      streamUrl,
      outputPath,
      outputFileName,
      referrer
    });
  }

  // Method 3: Native Fetch fallback for direct mp4
  if (streamUrl.includes('.mp4')) {
    return await downloadWithNativeFetch({
      streamUrl,
      outputPath,
      outputFileName,
      referrer,
      headers
    });
  }

  console.log(chalk.red('\n❌ İndirme motoru (FFmpeg veya yt-dlp) sisteminizde bulunamadı.'));
  console.log(chalk.yellow('💡 FFmpeg yüklemek için Windows terminalinde şu komutu çalıştırabilirsiniz:'));
  console.log(chalk.cyan('   winget install Gyan.FFmpeg\n'));
  return { success: false, error: 'FFmpeg not found' };
}

/**
 * Download using FFmpeg with live progress tracking
 */
function downloadWithFFmpeg({ ffmpegExe, streamUrl, outputPath, outputFileName, referrer, headers }) {
  return new Promise((resolve) => {
    const spinner = ora({
      text: chalk.cyan('FFmpeg akış bağlantısı kuruluyor...'),
      color: 'cyan'
    }).start();

    // Prepare headers string
    let headerStr = `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\nReferer: ${referrer}\r\n`;
    if (headers && typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers)) {
        if (!['referer', 'user-agent'].includes(k.toLowerCase())) {
          headerStr += `${k}: ${v}\r\n`;
        }
      }
    }

    const args = [
      '-y',
      '-headers', headerStr,
      '-i', streamUrl,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-movflags', '+faststart',
      outputPath
    ];

    const proc = spawn(ffmpegExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let lastTime = '00:00:00';
    let lastSize = '0kB';
    let lastSpeed = '0x';

    proc.stderr.on('data', (data) => {
      const line = data.toString();
      const timeMatch = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
      const sizeMatch = line.match(/size=\s*(\S+)/);
      const speedMatch = line.match(/speed=\s*(\S+)/);

      if (timeMatch) lastTime = timeMatch[1];
      if (sizeMatch) lastSize = sizeMatch[1];
      if (speedMatch) lastSpeed = speedMatch[1];

      spinner.text = chalk.cyan(
        `İndiriliyor: ${chalk.white.bold(outputFileName)} ` +
        chalk.gray(`│`) + ` İndirilen Süre: ${chalk.yellow(lastTime)} ` +
        chalk.gray(`│`) + ` Boyut: ${chalk.green(lastSize)} ` +
        chalk.gray(`│`) + ` Hız: ${chalk.magenta(lastSpeed)}`
      );
    });

    proc.on('close', async (code) => {
      if (code === 0) {
        spinner.succeed(chalk.green.bold('✓ İndirme başarıyla tamamlandı!'));
        let fileSizeText = '';
        try {
          const stats = fs.statSync(outputPath);
          fileSizeText = ` (${formatBytes(stats.size)})`;
        } catch {}

        console.log('\n' + boxen(
          chalk.bold.green('🎉 DOSYA KAYDEDİLDİ!') + '\n\n' +
          chalk.dim('Konum: ') + chalk.white(outputPath) + chalk.cyan(fileSizeText) + '\n\n' +
          chalk.gray('Dosyayı dilediğiniz video oynatıcıyla internet bağlantısı olmadan izleyebilirsiniz.'),
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        ));

        // Prompt to open containing folder
        try {
          const { confirm } = await import('@inquirer/prompts');
          const shouldOpen = await confirm({
            message: 'İndirilen dosyanın klasörü açılsın mı?',
            default: true
          });
          if (shouldOpen) {
            await open(path.dirname(outputPath));
          }
        } catch {}

        resolve({ success: true, path: outputPath });
      } else {
        spinner.fail(chalk.red(`İndirme tamamlanamadı (Hata Kodu: ${code})`));
        if (fs.existsSync(outputPath)) {
          try {
            const st = fs.statSync(outputPath);
            if (st.size < 100 * 1024) fs.unlinkSync(outputPath);
          } catch {}
        }
        resolve({ success: false, code });
      }
    });

    proc.on('error', (err) => {
      spinner.fail(chalk.red(`FFmpeg çalıştırılamadı: ${err.message}`));
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Download using yt-dlp
 */
function downloadWithYtDlp({ ytDlpExe, streamUrl, outputPath, outputFileName, referrer }) {
  return new Promise((resolve) => {
    const spinner = ora({
      text: chalk.cyan(`yt-dlp ile indiriliyor: ${outputFileName}...`),
      color: 'cyan'
    }).start();

    const args = [
      '--referer', referrer,
      '--no-check-certificates',
      '-o', outputPath,
      streamUrl
    ];

    const proc = spawn(ytDlpExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', (d) => {
      const line = d.toString();
      const match = line.match(/\[download\]\s+(\d+\.?\d*%) of ~?(\S+) at (\S+)/);
      if (match) {
        spinner.text = chalk.cyan(
          `İndiriliyor: ${chalk.white.bold(outputFileName)} ` +
          chalk.gray(`│`) + ` İlerleme: ${chalk.green(match[1])} ` +
          chalk.gray(`│`) + ` Boyut: ${chalk.yellow(match[2])} ` +
          chalk.gray(`│`) + ` Hız: ${chalk.magenta(match[3])}`
        );
      }
    });

    proc.on('close', async (code) => {
      if (code === 0) {
        spinner.succeed(chalk.green.bold('✓ İndirme başarıyla tamamlandı!'));
        resolve({ success: true, path: outputPath });
      } else {
        spinner.fail(chalk.red(`yt-dlp indirme başarısız (Kod: ${code})`));
        resolve({ success: false, code });
      }
    });
  });
}

/**
 * Native Node.js stream fetch for direct MP4 files
 */
async function downloadWithNativeFetch({ streamUrl, outputPath, outputFileName, referrer, headers }) {
  const spinner = ora({
    text: chalk.cyan(`Doğrudan MP4 indiriliyor: ${outputFileName}...`),
    color: 'cyan'
  }).start();

  try {
    const res = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Referer: referrer,
        ...headers
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const totalBytes = Number(res.headers.get('content-length')) || 0;
    let downloadedBytes = 0;
    const fileStream = fs.createWriteStream(outputPath);

    const reader = res.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(Buffer.from(value));
      downloadedBytes += value.length;
      if (totalBytes > 0) {
        const pct = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        spinner.text = chalk.cyan(
          `İndiriliyor: ${chalk.white(outputFileName)} ` +
          chalk.gray(`│`) + ` %${chalk.green(pct)} ` +
          chalk.gray(`│`) + ` ${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
        );
      } else {
        spinner.text = chalk.cyan(
          `İndiriliyor: ${chalk.white(outputFileName)} ` +
          chalk.gray(`│`) + ` ${formatBytes(downloadedBytes)}`
        );
      }
    }

    fileStream.end();
    spinner.succeed(chalk.green.bold('✓ Doğrudan MP4 başarıyla kaydedildi!'));
    return { success: true, path: outputPath };
  } catch (err) {
    spinner.fail(chalk.red(`İndirme hatası: ${err.message}`));
    return { success: false, error: err.message };
  }
}
