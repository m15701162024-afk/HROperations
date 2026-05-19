/* global document, fetch, location, window */

(function () {
  var script = document.currentScript;
  var apiBase = script && script.dataset.apiBase ? script.dataset.apiBase.replace(/\/$/, '') : 'http://localhost:8787';
  var landingPageId = script && script.dataset.landingPageId ? script.dataset.landingPageId : '';
  var sourcePlatform = script && script.dataset.sourcePlatform ? script.dataset.sourcePlatform : '未知';
  var publicSecret = script && script.dataset.publicSecret ? script.dataset.publicSecret : '';

  function post(path, payload) {
    return fetch(apiBase + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, publicSecret ? { 'X-HR-Signature': publicSecret } : {}),
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {});
  }

  function track(eventType, extra) {
    if (!landingPageId) return;
    post('/api/track', Object.assign({
      landingPageId: landingPageId,
      sourcePlatform: sourcePlatform,
      eventType: eventType,
      url: location.href,
      referrer: document.referrer,
      occurredAt: new Date().toISOString()
    }, extra || {}));
  }

  window.HRAssistantTracker = {
    track: track,
    submitLead: function (lead) {
      return post('/api/landing/leads', Object.assign({
        landingPageId: landingPageId,
        sourcePlatform: sourcePlatform
      }, lead || {}));
    }
  };

  track('visit');
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-hr-track="click"], a[href]') : null;
    if (!target) return;
    track('click', {
      targetText: (target.textContent || '').trim().slice(0, 80),
      targetHref: target.href || ''
    });
  });
})();
