// عامل خدمة بسيط: يجعل الموقع قابلًا للتثبيت كتطبيق. لا يخزّن شيئًا (كل الطلبات تمرّ للشبكة).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
