/* global document, fetch, location, window */

(function () {
  var script = document.currentScript;
  var apiBase = script && script.dataset.apiBase ? script.dataset.apiBase.replace(/\/$/, '') : 'http://localhost:8787';
  var landingPageId = script && script.dataset.landingPageId ? script.dataset.landingPageId : '';
  var sourcePlatform = script && script.dataset.sourcePlatform ? script.dataset.sourcePlatform : '未知';

  function post(path, payload) {
    return fetch(apiBase + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
