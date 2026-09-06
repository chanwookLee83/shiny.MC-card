// ⚙️ 머신카드 Service Worker v6.5
const CACHE_NAME = 'machine-card-v79';
const STATIC_CACHE = 'machine-card-static-v79';

// 캐시할 파일 목록
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
];

// ── 설치 ──
self.addEventListener('install', event => {
  console.log('[SW] 설치 중...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] 정적 파일 캐싱');
      return Promise.allSettled(CACHE_FILES.map(f => cache.add(f)));
    })
    // skipWaiting은 배너에서 사용자가 확인 후 메시지로 호출
  );
});

// ── skipWaiting 메시지 수신 ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// ── 활성화 ──
self.addEventListener('activate', event => {
  console.log('[SW] 활성화');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map(key => {
            console.log('[SW] 구버전 캐시 삭제:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── 요청 인터셉트 (Cache First → Network Fallback) ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // http(s) 이외 요청은 무시
  if (!url.protocol.startsWith('http')) return;

  // 구글 폰트: 네트워크 우선
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request)
          .then(r => r || new Response('', { status: 408 }))
        )
    );
    return;
  }

  // 나머지: 캐시 우선
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response || new Response('', { status: 404 });
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        return response;
      }).catch(() => {
        if (request.destination === 'document') {
          return caches.match('./index.html')
            .then(r => r || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }));
        }
        return new Response('', { status: 408 });
      });
    })
  );
});

// ── 푸시 알림 (향후 확장용) ──
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || '조립생산현황 모니터링 시스템';
  const options = {
    body: data.body || '새 알림이 있습니다',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

console.log('[SW] 조립생산현황 모니터링 시스템 Service Worker 로드됨');
