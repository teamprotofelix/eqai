const CACHE_NAME = 'ai-futures-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/quality.html',
  '/aicenter.jpg',
  '/futures01.jpg',
  // 아이콘도 캐시 (선택)
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// 설치 이벤트: 정적 자원 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// fetch 이벤트: 네트워크 우선, 실패 시 캐시 폴백
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 네트워크 성공: 캐시를 업데이트하지만 응답은 그대로 반환
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // 네트워크 실패: 캐시에서 찾기
        return caches.match(event.request);
      })
  );
});

// 오래된 캐시 삭제 (버전 업데이트 시)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});