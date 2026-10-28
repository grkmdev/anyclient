import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WINGEO_EXE = path.join(__dirname, '..', 'bin', 'wingeo.exe');

/**
 * Get active terminal window geometry (WidthxHeight+X+Y) on Windows.
 * Fast native binary execution (<10ms).
 * @returns {string|null} e.g. "1200x750+100+100" or null
 */
export function getTerminalGeometry() {
  if (process.platform !== 'win32') return null;

  if (fs.existsSync(WINGEO_EXE)) {
    try {
      const out = execFileSync(WINGEO_EXE, [], {
        timeout: 800,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8'
      }).trim();

      if (out && /^\d+x\d+\+\d+\+\d+$/.test(out)) {
        return out;
      }
    } catch {}
  }

  return null;
}
