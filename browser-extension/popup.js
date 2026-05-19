/* global chrome, document, fetch */

var apiBase = document.getElementById('apiBase');
var token = document.getElementById('token');
var result = document.getElementById('result');

chrome.storage.local.get(['apiBase', 'token'], function (stored) {
  if (stored.apiBase) apiBase.value = stored.apiBase;
  if (stored.token) token.value = stored.token;
});

document.getElementById('collect').addEventListener('click', function () {
  chrome.storage.local.set({ apiBase: apiBase.value, token: token.value });
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'collectMetrics' }, function (metrics) {
      if (!metrics) {
        result.textContent = '未能采集当前页面';
        return;
      }
      result.textContent = JSON.stringify(metrics, null, 2);
      fetch(apiBase.value.replace(/\/$/, '') + '/api/platform-metrics/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token.value
        },
        body: JSON.stringify({ records: [metrics] })
      }).catch(function () {});
    });
  });
});
