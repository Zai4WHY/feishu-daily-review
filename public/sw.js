// Service Worker: Web Push 通知 + 点击打开页面
const CACHE_NAME = 'daily-review-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 接收 Push 通知
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, icon, data } = payload;

    event.waitUntil(
      self.registration.showNotification(title, {
        body: body || '',
        icon: icon || '/icon-192.png',
        badge: '/icon-192.png',
        data: data || {},
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
          { action: 'open', title: '查看复盘' },
          { action: 'close', title: '关闭' },
        ],
      })
    );
  } catch {
    // 如果 payload 不是 JSON，直接显示
    event.waitUntil(
      self.registration.showNotification('日程复盘助手', {
        body: event.data.text(),
        icon: '/icon-192.png',
      })
    );
  }
});

// 通知点击 → 打开页面
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // 如果已有打开的页面，聚焦它
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 否则打开新页面
      if (self.clients.openWindow) {
        const date = event.notification.data?.date;
        const url = date
          ? `${self.location.origin}/?date=${date}`
          : self.location.origin;
        return self.clients.openWindow(url);
      }
    })
  );
});

// 离线缓存策略：网络优先
self.addEventListener('fetch', (event) => {
  // 跳过 API 请求
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
