from flask import make_response


def register_service_worker(app):
    @app.route('/sw.js')
    @app.route('/app/sw.js')
    def service_worker_js():  # noqa: F401
        sw_code = r"""
    const CACHE_NAME = 'uploads-cache-v1';

    self.addEventListener('install', (event) => {
      self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
      event.waitUntil(self.clients.claim());
    });

    async function cachePut(url, resp) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, resp.clone());
    }

    self.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type === 'prefetch' && Array.isArray(data.urls)) {
        event.waitUntil((async () => {
          const cache = await caches.open(CACHE_NAME);
          for (const url of data.urls) {
            try {
              const u = new URL(url, self.location.origin);
              if (u.origin !== self.location.origin) continue;
              if (!u.pathname.startsWith('/uploads/')) continue;
              const exists = await cache.match(u.toString());
              if (!exists) {
                const resp = await fetch(u.toString(), { credentials: 'same-origin' });
                if (resp && resp.ok) await cache.put(u.toString(), resp.clone());
              }
            } catch (e) { /* ignore */ }
          }
        })());
      }
    });

    self.addEventListener('fetch', (event) => {
      const req = event.request;
      if (req.method !== 'GET') return;
      const url = new URL(req.url);
      if (url.origin !== self.location.origin) return;
      if (!url.pathname.startsWith('/uploads/')) return;

      const rangeHeader = req.headers.get('range') || req.headers.get('Range');
      if (rangeHeader) {
        event.respondWith(handleRangeRequest(req, rangeHeader));
        return;
      }
      event.respondWith(cacheFirst(req));
    });

    async function cacheFirst(req) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req.url);
      if (cached) return cached;
      const resp = await fetch(req);
      if (resp && resp.ok) {
        try { await cache.put(req.url, resp.clone()); } catch (e) {}
      }
      return resp;
    }

    async function handleRangeRequest(req, rangeHeader) {
      try {
        const url = req.url;
        const cache = await caches.open(CACHE_NAME);
        let full = await cache.match(url);
        if (!full) {
          const netResp = await fetch(req);
          try {
            const u = new URL(url);
            const isVideo = /\.(mp4|mkv|mov|avi|wmv)$/i.test(u.pathname);
            if (!isVideo) {
              fetch(url).then(r => { if (r && r.ok) cache.put(url, r.clone()); }).catch(() => {});
            }
          } catch (e) { /* ignore */ }
          return netResp;
        }

        const buf = await full.arrayBuffer();
        const size = buf.byteLength;
        const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
        if (!m) return full;
        let start = Number(m[1]);
        let end = m[2] ? Number(m[2]) : (size - 1);
        if (isNaN(start) || isNaN(end) || start > end || end >= size) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        }
        const chunk = buf.slice(start, end + 1);
        const headers = new Headers(full.headers);
        headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
        headers.set('Content-Length', String(chunk.byteLength));
        headers.set('Accept-Ranges', 'bytes');
        return new Response(chunk, { status: 206, statusText: 'Partial Content', headers });
      } catch (e) {
        return fetch(req);
      }
    }
    """
        resp = make_response(sw_code)
        resp.headers['Content-Type'] = 'application/javascript'
        resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return resp
