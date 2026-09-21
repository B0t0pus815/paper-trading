/* 殼層走快取優先（離線可開），資料走網路優先（打開就是最新）。
   CACHE 名稱帶建置編號，部署新版會自動淘汰舊殼層。

   ⚠ 這裡踩過一個很貴的坑：fetch() 對 401/404 是「成功 resolve」，不是 reject。
   舊版把回應無條件寫進快取，所以站台一旦開始回 401，
   service worker 就把那個 401 快取起來反覆餵給畫面 ——
   使用者看到的是「網頁永遠不會更新」，而且沒有任何錯誤訊息。
   現在只有 r.ok 才進快取，失敗一律回上一份好的資料。 */
const BUILD = '9806c35af804';
const SHELL = `shell-${BUILD}`;
const DATA = 'data-v2';          /* v1 可能存了 401，改名強制丟掉 */
const ASSETS = ['./', './index.html', './app.css', './app.js',
                './manifest.webmanifest', './icon-192.png', './icon-512.png',
                './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* data.json 與 data-<軌道>.json 都走網路優先。
   快取鍵用「去掉查詢字串的路徑」，兩條軌道才不會互相覆蓋。 */
function isData(pathname) {
  return /\/data(-[a-z0-9_-]+)?\.json$/i.test(pathname);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (isData(url.pathname)) {
    const key = url.origin + url.pathname;      /* 丟掉 ?t=… */
    e.respondWith(
      fetch(e.request).then(r => {
        if (r && r.ok) {
          caches.open(DATA).then(c => c.put(key, r.clone()));
          return r;
        }
        /* 401/404/500 一律原封不動交給畫面。
           這裡偷偷換成快取的話，使用者會看到一個「看起來正常但永遠不動」的頁面 ——
           那正是我們要修掉的症狀。真正的離線退路在下面的 catch。 */
        return r;
      }).catch(() => caches.open(DATA).then(c => c.match(key)).then(hit => {
        if (!hit) throw new Error('offline and nothing cached');
        /* 從快取撈出來的要標記，畫面才知道這不是現在的資料。 */
        return hit.blob().then(b => {
          const h = new Headers(hit.headers);
          h.set('X-From-Cache', '1');
          return new Response(b, { status: 200, headers: h });
        });
      }))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
