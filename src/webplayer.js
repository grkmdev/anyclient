import http from 'node:http';
import open from 'open';

let currentServer = null;
let currentResolve = null;

/**
 * Start lightweight local web player server
 * @param {object} options
 * @returns {Promise<string>} returns resolution when user finishes/closes or clicks next
 */
export async function startWebPlayer({
  videoUrl,
  isDirect = true,
  embedUrl = '',
  title = '',
  episodeName = '',
  season = 1,
  episode = 1,
  qualities = [],
  server = '',
  extra = '',
  port = 4422
}) {
  // If a server is already running, close it
  if (currentServer) {
    try {
      currentServer.close();
    } catch {}
    currentServer = null;
  }

  return new Promise((resolve) => {
    currentResolve = resolve;

    const serverInstance = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname === '/api/next') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'next' }));
        if (currentResolve) {
          const r = currentResolve;
          currentResolve = null;
          r({ action: 'next' });
        }
        return;
      }

      if (url.pathname === '/api/close') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'close' }));
        if (currentResolve) {
          const r = currentResolve;
          currentResolve = null;
          r({ action: 'close' });
        }
        return;
      }

      // Serve HTML Player
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getHtmlContent({
        videoUrl,
        isDirect,
        embedUrl,
        title,
        episodeName,
        season,
        episode,
        qualities,
        server,
        extra
      }));
    });

    serverInstance.listen(port, async () => {
      currentServer = serverInstance;
      const playerUrl = `http://localhost:${port}`;
      try {
        await open(playerUrl);
      } catch (e) {
        console.error('Tarayıcı açılamadı:', e.message);
      }
    });

    serverInstance.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Try next port
        startWebPlayer({
          videoUrl,
          isDirect,
          embedUrl,
          title,
          episodeName,
          season,
          episode,
          qualities,
          server,
          extra,
          port: port + 1
        }).then(resolve);
      }
    });
  });
}

function getHtmlContent({
  videoUrl,
  isDirect,
  embedUrl,
  title,
  episodeName,
  season,
  episode,
  qualities,
  server,
  extra
}) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[GörkemStream] ${escapeHtml(title)} - S${season}E${episode}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #090a10;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }
    header {
      background: rgba(15, 17, 26, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      background: linear-gradient(135deg, #a855f7, #6366f1);
      color: white;
      font-weight: 900;
      font-size: 14px;
      padding: 6px 10px;
      border-radius: 8px;
      letter-spacing: 1px;
      box-shadow: 0 0 15px rgba(168, 85, 247, 0.4);
    }
    .anime-info h1 {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }
    .anime-info p {
      font-size: 13px;
      color: #94a3b8;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn {
      background: rgba(255, 255, 255, 0.08);
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    .btn:hover {
      background: rgba(255, 255, 255, 0.16);
      transform: translateY(-1px);
    }
    .btn-primary {
      background: linear-gradient(135deg, #a855f7, #6366f1);
      border: none;
      color: white;
      box-shadow: 0 4px 14px rgba(168, 85, 247, 0.3);
    }
    .btn-primary:hover {
      box-shadow: 0 6px 20px rgba(168, 85, 247, 0.5);
    }
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      max-width: 1300px;
      margin: 0 auto;
      width: 100%;
    }
    .player-wrapper {
      width: 100%;
      aspect-ratio: 16 / 9;
      max-height: 75vh;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08);
      position: relative;
    }
    video, iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
      background: #000;
    }
    .meta-bar {
      margin-top: 16px;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      background: rgba(15, 17, 26, 0.6);
      padding: 14px 20px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #94a3b8;
    }
    .badge {
      background: rgba(168, 85, 247, 0.15);
      color: #c084fc;
      border: 1px solid rgba(168, 85, 247, 0.3);
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .quality-select {
      background: #1e2230;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .shortcuts-guide {
      margin-top: 12px;
      font-size: 12px;
      color: #64748b;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .kbd {
      background: #1e293b;
      padding: 2px 6px;
      border-radius: 4px;
      color: #cbd5e1;
      font-family: monospace;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-logo">GÖRKEMSTREAM</div>
      <div class="anime-info">
        <h1>${escapeHtml(title)}</h1>
        <p>Sezon ${season} • Bölüm ${episode}: ${escapeHtml(episodeName || 'Bölüm ' + episode)}</p>
      </div>
    </div>
    <div class="actions">
      <button class="btn" onclick="requestClose()">Terminal'e Dön</button>
      <button class="btn btn-primary" onclick="requestNext()">Sonraki Bölüm (S${season}E${episode + 1}) ⏭️</button>
    </div>
  </header>

  <main>
    <div class="player-wrapper">
      ${isDirect ? `
        <video id="player" controls autoplay playsinline>
          <source src="${escapeHtml(videoUrl)}" type="video/mp4">
          Tarayıcınız video etiketini desteklemiyor.
        </video>
      ` : `
        <iframe src="${escapeHtml(embedUrl)}" allow="autoplay; fullscreen" allowfullscreen></iframe>
      `}
    </div>

    <div class="meta-bar">
      <div class="meta-item">
        <span>Sunucu:</span>
        <strong style="color: #fff;">${escapeHtml(server)}</strong>
        ${extra ? `<span class="badge">${escapeHtml(extra)}</span>` : ''}
      </div>

      ${qualities.length > 1 ? `
        <div class="meta-item">
          <span>Çözünürlük:</span>
          <select class="quality-select" onchange="changeQuality(this.value)">
            ${qualities.map(q => `<option value="${escapeHtml(q.url)}" ${q.url === videoUrl ? 'selected' : ''}>${escapeHtml(q.label)}</option>`).join('')}
          </select>
        </div>
      ` : ''}

      <div class="meta-item">
        <span class="badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border-color: rgba(34, 197, 94, 0.3);">⚡ HD Akış</span>
      </div>
    </div>

    <div class="shortcuts-guide">
      <span><span class="kbd">Boşluk</span> Oynat / Duraklat</span>
      <span><span class="kbd">←</span> <span class="kbd">→</span> 10 sn Geri / İleri</span>
      <span><span class="kbd">↑</span> <span class="kbd">↓</span> Ses Seviyesi</span>
      <span><span class="kbd">F</span> Tam Ekran</span>
      <span><span class="kbd">N</span> Sonraki Bölüm</span>
    </div>
  </main>

  <script>
    const player = document.getElementById('player');

    function changeQuality(newUrl) {
      if (!player) return;
      const currentTime = player.currentTime;
      const isPaused = player.paused;
      player.src = newUrl;
      player.currentTime = currentTime;
      if (!isPaused) player.play();
    }

    async function requestNext() {
      try {
        await fetch('/api/next');
        window.close();
      } catch (e) {
        alert('İstek gönderilemedi');
      }
    }

    async function requestClose() {
      try {
        await fetch('/api/close');
        window.close();
      } catch (e) {
        window.close();
      }
    }

    // Auto next episode when video ends
    if (player) {
      player.addEventListener('ended', () => {
        requestNext();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'KeyN') {
        requestNext();
      } else if (e.code === 'KeyF') {
        if (!document.fullscreenElement) {
          player?.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
