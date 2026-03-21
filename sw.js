const CACHE = 'vvs-gaming-v2';
const ASSETS = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

// ── INSTALL / ACTIVATE ──────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── CACHE FETCH ─────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── BACKGROUND ALARM CHECKER ────────────────────────────────
// The page posts alarm targets here; SW checks every 5s and
// fires a push notification + wakes the page when time is up.

var alarmTargets = {}; // { key: { time, label, fired } }

self.addEventListener('message', e => {
  var data = e.data;
  if (!data) return;

  if (data.type === 'REGISTER_ALARM') {
    // { type, key, time (ms epoch), label }
    alarmTargets[data.key] = { time: data.time, label: data.label, fired: false };
  }

  if (data.type === 'CANCEL_ALARM') {
    delete alarmTargets[data.key];
  }

  if (data.type === 'CLEAR_ALL_ALARMS') {
    alarmTargets = {};
  }
});

// Poll every 5 seconds
setInterval(checkAlarms, 5000);

function checkAlarms() {
  var now = Date.now();
  Object.keys(alarmTargets).forEach(function(key) {
    var a = alarmTargets[key];
    if (!a.fired && now >= a.time) {
      a.fired = true;
      fireAlarm(key, a.label);
    }
  });
}

function fireAlarm(key, label) {
  // 1. Show OS notification (wakes screen on most Android devices)
  self.registration.showNotification('⏰ VVS Gaming — Time Up!', {
    body: label,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'alarm-' + key,
    requireInteraction: true,   // stays on screen until dismissed
    vibrate: [400, 200, 400, 200, 400],
    renotify: true
  }).catch(function() {});

  // 2. Tell the open page tab to play sound
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({ type: 'PLAY_ALARM', key: key, label: label });
    });
  });
}

// Clicking the notification brings the app to foreground
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      if (clients.length > 0) { clients[0].focus(); return; }
      self.clients.openWindow('./index.html');
    })
  );
});
