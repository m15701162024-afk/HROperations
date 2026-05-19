/* global chrome, document, location */

function detectPlatform(host) {
  if (host.includes('xiaohongshu')) return '小红书';
  if (host.includes('maimai')) return '脉脉';
  if (host.includes('bilibili')) return 'B站';
  if (host.includes('weixin')) return '公众号';
  if (host.includes('douyin')) return '抖音';
  if (host.includes('zhihu')) return '知乎';
  return '技术社区';
}

function textNumber(patterns) {
  var body = document.body ? document.body.innerText : '';
  for (var i = 0; i < patterns.length; i += 1) {
    var match = body.match(patterns[i]);
    if (match) return Number(String(match[1]).replace(/[^\d]/g, '')) || 0;
  }
  return 0;
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.type !== 'collectMetrics') return;
  var title = document.title || '';
  var metrics = {
    platform: detectPlatform(location.hostname),
    title: title,
    url: location.href,
    views: textNumber([/阅读\s*(\d+)/, /播放\s*(\d+)/, /浏览\s*(\d+)/]),
    likes: textNumber([/点赞\s*(\d+)/, /赞\s*(\d+)/]),
    comments: textNumber([/评论\s*(\d+)/]),
    saves: textNumber([/收藏\s*(\d+)/]),
    shares: textNumber([/分享\s*(\d+)/, /转发\s*(\d+)/]),
    clicks: 0
  };
  sendResponse(metrics);
});
