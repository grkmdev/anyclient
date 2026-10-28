import { spawnSync, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outputExe = path.join(distDir, 'AnyClient.exe');
const portableDir = path.join(distDir, 'AnyClient-Portable');
const portableBinDir = path.join(portableDir, 'bin');
const zipFile = path.join(distDir, 'AnyClient-Portable.zip');

console.log('\n' + boxen(
  chalk.bold.hex('#00FFCC')('⚡ ANYCLIENT SIFIR KURULUMLU TAŞINABİLİR PAKET OLUŞTURUCU') + '\n\n' +
  chalk.gray('1. Node.js runtime & kodlar tek bir ') + chalk.white('AnyClient.exe') + chalk.gray(' dosyasına paketleniyor.\n') +
  chalk.gray('2. Taşınabilir ') + chalk.cyan('MPV Player & yt-dlp') + chalk.gray(' otomatik olarak pakete dahil ediliyor.\n') +
  chalk.gray('3. Dağıtıma hazır ') + chalk.yellow('AnyClient-Portable.zip') + chalk.gray(' arşivi üretiliyor.'),
  {
    padding: 1,
    borderStyle: 'round',
    borderColor: '#00FFCC'
  }
));

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Build Standalone Executable with caxa
const buildSpinner = ora({
  text: chalk.cyan('1/3 Standalone AnyClient.exe derleniyor (15-25 sn)...'),
  color: 'cyan'
}).start();

const caxaArgs = [
  '-y',
  'caxa',
  '--input', '.',
  '--output', 'dist/AnyClient.exe',
  '--exclude', 'dist', '.git',
  '--',
  '{{caxa}}/node_modules/.bin/node',
  '{{caxa}}/bin/anyclient.js'
];

const result = spawnSync('npx', caxaArgs, {
  cwd: rootDir,
  shell: true,
  stdio: 'pipe'
});

if (!fs.existsSync(outputExe)) {
  buildSpinner.fail(chalk.red.bold('AnyClient.exe derleme hatası!'));
  if (result.stderr) console.error(chalk.yellow(result.stderr.toString()));
  process.exit(1);
}
buildSpinner.succeed(chalk.green('✓ Standalone AnyClient.exe oluşturuldu.'));

// 2. Prepare Portable Bundle Directory with MPV
const bundleSpinner = ora({
  text: chalk.cyan('2/3 Taşınabilir MPV & yardımcı kütüphaneler toplanıyor...'),
  color: 'cyan'
}).start();

try {
  if (fs.existsSync(portableDir)) {
    fs.rmSync(portableDir, { recursive: true, force: true });
  }
  fs.mkdirSync(portableBinDir, { recursive: true });

  // Copy AnyClient.exe into portable root
  fs.copyFileSync(outputExe, path.join(portableDir, 'AnyClient.exe'));

  // Locate WinGet or local MPV files
  const localAppData = process.env.LOCALAPPDATA || '';
  const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  let mpvSourceDir = null;

  if (fs.existsSync(wingetPackages)) {
    const entries = fs.readdirSync(wingetPackages);
    const mpvEntry = entries.find(e => e.toLowerCase().includes('mpv-player') || e.toLowerCase().includes('shinchiro.mpv'));
    if (mpvEntry) {
      mpvSourceDir = path.join(wingetPackages, mpvEntry);
    }
  }

  const filesToCopy = ['mpv.exe', 'mpv.com', 'vulkan-1.dll', 'yt-dlp.exe'];
  let copiedMpv = 0;

  if (mpvSourceDir && fs.existsSync(mpvSourceDir)) {
    for (const f of filesToCopy) {
      const src = path.join(mpvSourceDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(portableBinDir, f));
        copiedMpv++;
      }
    }
  }

  // Create one-click helper bat in portable folder
  const batContent = `@echo off\r\nchcp 65001 >nul\r\nstart "" "%~dp0AnyClient.exe"\r\n`;
  fs.writeFileSync(path.join(portableDir, 'Başlat.bat'), batContent, 'utf-8');

  bundleSpinner.succeed(chalk.green(`✓ Taşınabilir paket hazırlandı (${copiedMpv} adet MPV/yt-dlp bileşeni eklendi).`));
} catch (err) {
  bundleSpinner.fail(chalk.yellow(`Taşınabilir MPV kopyalanırken uyarı: ${err.message}`));
}

// 3. Create AnyClient-Portable.zip archive
const zipSpinner = ora({
  text: chalk.cyan('3/3 Dağıtım için AnyClient-Portable.zip sıkıştırılıyor...'),
  color: 'cyan'
}).start();

try {
  if (fs.existsSync(zipFile)) {
    try { fs.unlinkSync(zipFile); } catch {}
  }

  const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${portableDir}\\*' -DestinationPath '${zipFile}' -Force"`;
  execSync(psCmd, { stdio: 'ignore' });

  let zipSizeMb = '';
  if (fs.existsSync(zipFile)) {
    const st = fs.statSync(zipFile);
    zipSizeMb = ` (${(st.size / (1024 * 1024)).toFixed(1)} MB)`;
  }

  zipSpinner.succeed(chalk.green(`✓ AnyClient-Portable.zip hazırlandı${zipSizeMb}!`));
} catch (err) {
  zipSpinner.warn(chalk.yellow(`Zip oluşturulamadı (klasör hazır): ${err.message}`));
}

console.log('\n' + boxen(
  chalk.bold.green('🎉 SIFIR KURULUMLU TAŞINABİLİR PAKET TAMAMLANDI!') + '\n\n' +
  chalk.dim('📁 Klasör : ') + chalk.white.bold(portableDir) + '\n' +
  chalk.dim('📦 ZIP    : ') + chalk.hex('#00FFCC').bold(zipFile) + '\n\n' +
  chalk.gray('✦ Bu ZIP dosyasını veya klasörü herhangi bir arkadaşınıza gönderebilirsiniz.\n') +
  chalk.gray('✦ Karşı tarafta ') + chalk.white.bold('Node.js, MPV veya FFmpeg KURUMLARINA HİÇ GEREK YOKTUR.') + '\n' +
  chalk.gray('✦ Çift tıkladıkları anda doğrudan reklamsız 4K & 1080p canlı yayın ve dizi izleyebilirler!'),
  {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'green'
  }
));

try {
  open(distDir);
} catch {}
