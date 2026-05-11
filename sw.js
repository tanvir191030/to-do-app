const CACHE_NAME = 'do-it-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/public/manifest.json',
  '/public/app-brand-logo.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching assets...');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Background Notification Handler
self.addEventListener('showNotification', (event) => {
  const options = {
    body: event.data.text(),
    icon: '/public/app-brand-logo.png',
    badge: '/public/app-brand-logo.png',
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open App' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification('Do-It Task Reminder', options)
  );
});
