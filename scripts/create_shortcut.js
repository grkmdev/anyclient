import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export function createDesktopShortcut() {
  const desktopDir = path.join(os.homedir(), 'Desktop');
  const projectDir = path.resolve();
  const shortcutPath = path.join(desktopDir, 'AnyClient.lnk');

  const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$Shortcut.TargetPath = 'cmd.exe'
$Shortcut.Arguments = '/k anyclient'
$Shortcut.WorkingDirectory = '${projectDir.replace(/'/g, "''")}'
$Shortcut.WindowStyle = 1
$Shortcut.Description = 'AnyClient - Canlı Spor, Film, Dizi, Anime'
$Shortcut.Save()
`;

  try {
    execSync(`powershell -NoProfile -Command "${psScript.replace(/\r?\n/g, '; ')}"`, { stdio: 'inherit' });
    console.log(`\n✨ Masaüstü kısayolu başarıyla oluşturuldu: ${shortcutPath}`);
    return true;
  } catch (err) {
    console.error('Kısayol oluşturulurken hata oluştu:', err.message);
    return false;
  }
}

// Run directly if invoked
if (process.argv[1] && process.argv[1].endsWith('create_shortcut.js')) {
  createDesktopShortcut();
}
