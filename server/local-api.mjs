import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJsonRepository } from './repositories/jsonRepository.mjs';
import { createAuthService } from './services/authService.mjs';
import { runIntegrationSync, runModelApi, sendIntegrationMessage, testIntegration, testModelApi } from './services/integrationService.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = resolve(rootDir, 'data/hr-assistant-data.json');
const authFile = resolve(rootDir, 'data/hr-assistant-auth.json');
const uploadDir = resolve(rootDir, 'data/uploads');
const backupDir = resolve(rootDir, 'data/backups');
const exportDir = resolve(rootDir, 'data/exports');
const analyticsCacheDir = resolve(rootDir, 'data/analytics-cache');
const distDir = resolve(rootDir, 'dist');
const port = Number(process.env.HR_ASSISTANT_API_PORT ?? 5173);
const SECRET_MASK = '********';
const JSON_BODY_LIMIT = 1024 * 1024;
const UPLOAD_BODY_LIMIT = 20 * 1024 * 1024;
const requirePublicSecret = process.env.HR_ASSISTANT_REQUIRE_PUBLIC_SECRET === 'true' || process.env.NODE_ENV === 'production';

const repository = createJsonRepository(dataFile);
const authService = createAuthService(authFile);
const analyticsCache = new Map();

async function readBody(request, limitBytes = JSON_BODY_LIMIT) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limitBytes) throw new Error(`Request body too large. Limit is ${Math.round(limitBytes / 1024 / 1024)} MB`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept,Authorization',
  });
  response.end(JSON.stringify(body));
}

function sendFile(response, status, body, contentType) {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept,Authorization',
  });
  response.end(body);
}

function getBearerToken(request) {
  const header = request.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
}

function requireSession(request, response) {
  const session = authService.getSession(getBearerToken(request));
  if (!session) {
    send(response, 401, { ok: false, error: 'Unauthorized' });
    return null;
  }
  return session;
}

function verifyPublicSignature(request) {
  const expected = process.env.HR_ASSISTANT_PUBLIC_SECRET;
  if (!expected) return !requirePublicSecret;
  return request.headers['x-hr-signature'] === expected;
}

function sanitizeFileName(fileName) {
  const plainName = basename(String(fileName || 'asset-file')).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
  return plainName || 'asset-file';
}

function contentTypeFor(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.csv') return 'text/csv; charset=utf-8';
  return 'application/octet-stream';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function renderLandingPage(page, jobs) {
  const linkedJobs = jobs.filter((job) => page.linkedJobIds?.includes(job.id));
  const jobOptions = linkedJobs.length > 0 ? linkedJobs : jobs;
  const jobCards = jobOptions.map((job) => `
    <article class="job">
      <h2>${escapeHtml(job.title)}</h2>
      <p>${escapeHtml(job.city)} · ${escapeHtml(job.family)} · ${escapeHtml(job.level)}</p>
      <p>${escapeHtml(job.persona || job.jd || '欢迎了解岗位详情')}</p>
      <ul>${(job.sellingPoints ?? []).map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
    </article>
  `).join('');
  const options = jobOptions.map((job) => `<option value="${escapeHtml(job.id)}">${escapeHtml(job.title)}</option>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.title)}</title>
  <style>
    body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#172033;background:#f5f7fa}
    header{padding:48px 24px;color:#fff;background:#172235}
    main{max-width:1080px;margin:0 auto;padding:24px;display:grid;gap:18px}
    h1{margin:0 0 12px;font-size:34px}
    .job,form{padding:18px;background:#fff;border:1px solid #dce3eb;border-radius:8px}
    .job h2{margin:0 0 8px}.job p{color:#526176;line-height:1.7}
    form{display:grid;gap:12px}input,select,textarea,button{font:inherit;min-height:40px;padding:8px 10px;border:1px solid #dce3eb;border-radius:6px}
    textarea{min-height:96px}button{color:#fff;background:#1b5f9e;cursor:pointer}
    .ok{display:none;color:#147c58;background:#e7f6ef;padding:12px;border-radius:6px}
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.pageType)} · 欢迎留下联系方式，招聘团队会尽快联系你。</p>
  </header>
  <main>
    ${jobCards || '<article class="job"><h2>岗位信息待发布</h2><p>请稍后查看最新招聘机会。</p></article>'}
    <form id="leadForm">
      <strong>投递意向登记</strong>
      <input name="name" placeholder="姓名" required />
      <input name="contact" placeholder="手机号 / 邮箱 / 微信" required />
      <select name="targetJobId">${options}<option value="">其他岗位</option></select>
      <textarea name="note" placeholder="补充说明"></textarea>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;color:#526176">
        <input type="checkbox" name="privacyAccepted" value="yes" required style="width:auto;margin-top:2px" />
        我已了解并同意招聘团队用于岗位沟通、简历流转和招聘流程跟进而处理我的联系方式。
      </label>
      <button type="submit">提交联系方式</button>
      <div class="ok" id="ok">提交成功，招聘团队会尽快联系你。</div>
    </form>
  </main>
  <script src="/hr-assistant-tracker.js" data-api-base="" data-landing-page-id="${escapeHtml(page.slug || page.id)}" data-source-platform="未知"></script>
  <script>
    document.getElementById('leadForm').addEventListener('submit', async function(event){
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      if (data.privacyAccepted !== 'yes') return;
      if (window.HRAssistantTracker) {
        await window.HRAssistantTracker.submitLead(data);
      } else {
        await fetch('/api/landing/leads', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...data, landingPageId: '${escapeHtml(page.slug || page.id)}', sourcePlatform: '未知' }) });
      }
      document.getElementById('ok').style.display='block';
      event.target.reset();
    });
  </script>
</body>
</html>`;
}

function isSafeChildPath(parentDir, candidatePath) {
  const child = relative(parentDir, candidatePath);
  return child === '' || (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child));
}

function isMaskedSecret(value) {
  return typeof value === 'string' && value.length > 0 && /^[*•]+$/.test(value);
}

function redactSecrets(data) {
  return {
    ...data,
    integrations: (data.integrations ?? []).map((item) => ({ ...item, apiKey: item.apiKey ? SECRET_MASK : '' })),
    modelApis: (data.modelApis ?? []).map((item) => ({ ...item, apiKey: item.apiKey ? SECRET_MASK : '' })),
  };
}

function preserveSecrets(incoming, existing) {
  const existingIntegrations = new Map((existing.integrations ?? []).map((item) => [item.id, item]));
  const existingModelApis = new Map((existing.modelApis ?? []).map((item) => [item.id, item]));
  return {
    ...incoming,
    integrations: (incoming.integrations ?? []).map((item) => {
      const previous = existingIntegrations.get(item.id);
      return previous && isMaskedSecret(item.apiKey) ? { ...item, apiKey: previous.apiKey } : item;
    }),
    modelApis: (incoming.modelApis ?? []).map((item) => {
      const previous = existingModelApis.get(item.id);
      return previous && isMaskedSecret(item.apiKey) ? { ...item, apiKey: previous.apiKey } : item;
    }),
  };
}

async function hydrateIntegrationConfig(config) {
  if (!config?.id || (config.apiKey && !isMaskedSecret(config.apiKey))) return config;
  const data = await repository.readData();
  const stored = data.integrations.find((item) => item.id === config.id);
  return stored ? { ...config, apiKey: stored.apiKey } : config;
}

async function hydrateModelConfig(config) {
  if (!config?.id || (config.apiKey && !isMaskedSecret(config.apiKey))) return config;
  const data = await repository.readData();
  const stored = data.modelApis.find((item) => item.id === config.id);
  return stored ? { ...config, apiKey: stored.apiKey } : config;
}

async function serveStatic(pathname, response) {
  try {
    const rawPath = decodeURIComponent(pathname);
    const filePath = rawPath === '/' ? resolve(distDir, 'index.html') : resolve(distDir, rawPath.slice(1));
    if (!isSafeChildPath(distDir, filePath)) {
      send(response, 400, { ok: false, error: 'Invalid file path' });
      return;
    }
    sendFile(response, 200, await readFile(filePath), contentTypeFor(filePath));
  } catch {
    try {
      sendFile(response, 200, await readFile(resolve(distDir, 'index.html')), 'text/html; charset=utf-8');
    } catch {
      send(response, 404, { ok: false, error: 'Frontend build not found. Run npm run build first.' });
    }
  }
}

const server = createServer(async (request, response) => {
  const currentUrl = new URL(request.url ?? '/', 'http://localhost');
  const pathname = currentUrl.pathname;

  if (request.method === 'OPTIONS') {
    send(response, 204, {});
    return;
  }

  if (pathname === '/api/health') {
    send(response, 200, { ok: true, storage: 'json', auth: 'local' });
    return;
  }

  if (pathname === '/api/system/health' && request.method === 'GET') {
    if (!requireSession(request, response)) return;
    try {
      const data = await repository.readData();
      const dataFileStat = await stat(dataFile).catch(() => ({ size: 0 }));
      const backups = await readdir(backupDir).catch(() => []);
      const backupFiles = backups.filter((item) => item.endsWith('.json')).sort().reverse();
      send(response, 200, {
        ok: true,
        storage: 'json',
        dataFileSize: dataFileStat.size,
      backupCount: backupFiles.length,
      latestBackup: backupFiles[0],
      analyticsCacheSize: analyticsCache.size,
      counts: {
          jobs: data.jobs.length,
          contents: data.contents.length,
          accounts: data.accounts.length,
          integrations: data.integrations.length,
          landingLeads: data.landingLeads.length,
          auditLogs: data.auditLogs.length,
        },
      });
    } catch (error) {
      send(response, 500, { ok: false, error: error instanceof Error ? error.message : 'Health check failed' });
    }
    return;
  }

  if (pathname === '/api/system/backup' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      await mkdir(backupDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = resolve(backupDir, `hr-assistant-data-${stamp}.json`);
      await copyFile(dataFile, backupFile);
      send(response, 200, { ok: true, backupFile, createdAt: stamp });
    } catch (error) {
      send(response, 500, { ok: false, error: error instanceof Error ? error.message : 'Backup failed' });
    }
    return;
  }

  if (pathname.startsWith('/uploads/') && request.method === 'GET') {
    try {
      const requestedName = decodeURIComponent(pathname.replace('/uploads/', ''));
      const safeName = basename(requestedName);
      const filePath = resolve(uploadDir, safeName);
      if (!isSafeChildPath(uploadDir, filePath)) {
        send(response, 400, { ok: false, error: 'Invalid file path' });
        return;
      }
      sendFile(response, 200, await readFile(filePath), contentTypeFor(filePath));
    } catch {
      send(response, 404, { ok: false, error: 'File not found' });
    }
    return;
  }

  if (pathname.startsWith('/exports/') && request.method === 'GET') {
    if (!requireSession(request, response)) return;
    try {
      const requestedName = decodeURIComponent(pathname.replace('/exports/', ''));
      const safeName = basename(requestedName);
      const filePath = resolve(exportDir, safeName);
      if (!isSafeChildPath(exportDir, filePath)) {
        send(response, 400, { ok: false, error: 'Invalid file path' });
        return;
      }
      sendFile(response, 200, await readFile(filePath), contentTypeFor(filePath));
    } catch {
      send(response, 404, { ok: false, error: 'Export file not found' });
    }
    return;
  }

  if (pathname.startsWith('/landing/') && request.method === 'GET') {
    try {
      const slug = decodeURIComponent(pathname.replace('/landing/', ''));
      const data = await repository.readData();
      const page = data.landingPages.find((item) => item.slug === slug || item.id === slug);
      if (!page || page.status !== '已发布') {
        send(response, 404, { ok: false, error: 'Landing page not found' });
        return;
      }
      sendFile(response, 200, renderLandingPage(page, data.jobs), 'text/html; charset=utf-8');
    } catch (error) {
      send(response, 500, { ok: false, error: error instanceof Error ? error.message : 'Landing render failed' });
    }
    return;
  }

  if (pathname === '/api/login' && request.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(request));
      const result = await authService.login(body.username, body.password);
      if (!result) {
        send(response, 401, { ok: false, error: 'Invalid username or password' });
        return;
      }
      send(response, 200, result);
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (pathname === '/api/track' && request.method === 'POST') {
    try {
      if (!verifyPublicSignature(request)) {
        send(response, 401, { ok: false, error: 'Invalid signature' });
        return;
      }
      const body = JSON.parse(await readBody(request));
      const data = await repository.readData();
      const eventType = body.eventType === 'click' ? 'clicks' : 'visits';
      const landingPageId = String(body.landingPageId ?? '');
      const next = {
        ...data,
        landingPages: data.landingPages.map((item) => (
          item.id === landingPageId || item.slug === landingPageId
            ? { ...item, [eventType]: Number(item[eventType] ?? 0) + 1 }
            : item
        )),
        auditLogs: [{
          id: `track-${Date.now()}`,
          actor: 'landing-sdk',
          action: body.eventType === 'click' ? '落地页点击埋点' : '落地页访问埋点',
          target: landingPageId,
          createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        }, ...data.auditLogs],
      };
      await repository.writeData(next);
      send(response, 200, { ok: true });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (pathname === '/api/landing/leads' && request.method === 'POST') {
    try {
      if (!verifyPublicSignature(request)) {
        send(response, 401, { ok: false, error: 'Invalid signature' });
        return;
      }
      const body = JSON.parse(await readBody(request));
      if (!body.landingPageId || !body.name || !body.contact) {
        send(response, 400, { ok: false, error: 'landingPageId、name、contact 为必填' });
        return;
      }
      const data = await repository.readData();
      const duplicated = data.landingLeads.some((item) => item.landingPageId === String(body.landingPageId) && item.contact === String(body.contact));
      if (duplicated) {
        send(response, 200, { ok: true, duplicated: true });
        return;
      }
      const lead = {
        id: `lead-public-${Date.now()}`,
        landingPageId: String(body.landingPageId),
        name: String(body.name),
        contact: String(body.contact),
        targetJobId: String(body.targetJobId ?? ''),
        sourcePlatform: String(body.sourcePlatform ?? '未知'),
        note: String(body.note ?? ''),
        status: '待转入北森',
        submittedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      };
      await repository.writeData({
        ...data,
        landingLeads: [lead, ...data.landingLeads],
        landingPages: data.landingPages.map((item) => (
          item.id === lead.landingPageId || item.slug === lead.landingPageId ? { ...item, clicks: Number(item.clicks ?? 0) + 1 } : item
        )),
        notifications: [{
          id: `notice-${Date.now()}`,
          title: '新增公网落地页线索',
          body: `${lead.name} 提交了联系方式`,
          targetSection: '账号与平台',
          level: '待办',
          read: false,
          createdAt: lead.submittedAt,
        }, ...data.notifications],
      });
      send(response, 200, { ok: true, leadId: lead.id });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (pathname === '/api/session' && request.method === 'GET') {
    const session = requireSession(request, response);
    if (!session) return;
    send(response, 200, { user: session });
    return;
  }

  if (pathname === '/api/data' && request.method === 'GET') {
    if (!requireSession(request, response)) return;
    try {
      send(response, 200, redactSecrets(await repository.readData()));
    } catch (error) {
      send(response, 500, { ok: false, error: error instanceof Error ? error.message : 'Data store unavailable' });
    }
    return;
  }

  if (pathname === '/api/data' && request.method === 'PUT') {
    if (!requireSession(request, response)) return;
    try {
      const body = await readBody(request);
      const data = JSON.parse(body);
      const existing = await repository.readData();
      await repository.writeData(preserveSecrets(data, existing));
      await clearAnalyticsCache();
      send(response, 200, { ok: true });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (pathname === '/api/analytics/summary' && request.method === 'GET') {
    const session = requireSession(request, response);
    if (!session) return;
    try {
      const query = Object.fromEntries(currentUrl.searchParams.entries());
      const data = filterDataForAnalytics(await repository.readData(), session);
      send(response, 200, await cachedAnalyticsDrill(data, { ...query, dimension: 'summary' }, session));
    } catch (error) {
      send(response, 500, { ok: false, error: error instanceof Error ? error.message : 'Analytics summary failed' });
    }
    return;
  }

  if (pathname.startsWith('/api/analytics/drill/') && request.method === 'POST') {
    const session = requireSession(request, response);
    if (!session) return;
    try {
      const dimension = pathname.replace('/api/analytics/drill/', '') || 'platform';
      const body = JSON.parse(await readBody(request));
      const data = filterDataForAnalytics(await repository.readData(), session);
      send(response, 200, await cachedAnalyticsDrill(data, { ...body, dimension }, session));
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Analytics drill failed' });
    }
    return;
  }

  if (pathname === '/api/analytics/quality-issues' && request.method === 'GET') {
    const session = requireSession(request, response);
    if (!session) return;
    try {
      const data = filterDataForAnalytics(await repository.readData(), session);
      send(response, 200, { qualityIssues: detectMetricQualityIssues(data, Object.fromEntries(currentUrl.searchParams.entries())) });
    } catch (error) {
      send(response, 500, { ok: false, error: error instanceof Error ? error.message : 'Quality issues query failed' });
    }
    return;
  }

  if (pathname === '/api/analytics/export' && request.method === 'POST') {
    const session = requireSession(request, response);
    if (!session) return;
    try {
      const body = JSON.parse(await readBody(request));
      const data = filterDataForAnalytics(await repository.readData(), session);
      const result = await cachedAnalyticsDrill(data, body.query ?? {}, session);
      const taskId = `export-${Date.now()}`;
      const format = body.format === 'json' ? 'json' : 'csv';
      const fileName = `${taskId}.${format}`;
      await mkdir(exportDir, { recursive: true });
      const rows = result.details.map((item) => ({
        id: item.id,
        title: item.title,
        dimension: item.dimension,
        views: item.snapshot.views,
        interactions: item.snapshot.interactions,
        clicks: item.snapshot.clicks,
        applications: item.snapshot.applications,
        effectiveResumes: item.snapshot.effectiveResumes,
        hires: item.snapshot.hires,
      }));
      const bodyText = format === 'json' ? JSON.stringify(result, null, 2) : toCsv(rows);
      await writeFile(resolve(exportDir, fileName), bodyText, 'utf-8');
      send(response, 200, {
        taskId,
        status: '已完成',
        downloadUrl: `/exports/${encodeURIComponent(fileName)}`,
        format,
        result,
      });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Analytics export failed' });
    }
    return;
  }

  if (pathname === '/api/auth/users' && request.method === 'GET') {
    const session = requireSession(request, response);
    if (!session) return;
    if (!hasGlobalAnalyticsAccess(session)) {
      send(response, 403, { ok: false, error: 'Forbidden' });
      return;
    }
    try {
      send(response, 200, { users: await authService.listUsers() });
    } catch (error) {
      send(response, 500, { ok: false, error: error instanceof Error ? error.message : 'List auth users failed' });
    }
    return;
  }

  if (pathname === '/api/auth/users' && request.method === 'POST') {
    const session = requireSession(request, response);
    if (!session) return;
    if (!hasGlobalAnalyticsAccess(session)) {
      send(response, 403, { ok: false, error: 'Forbidden' });
      return;
    }
    try {
      const body = JSON.parse(await readBody(request));
      send(response, 200, { ok: true, user: await authService.createUser(body) });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Create auth user failed' });
    }
    return;
  }

  if (pathname === '/api/auth/users/update' && request.method === 'POST') {
    const session = requireSession(request, response);
    if (!session) return;
    if (!hasGlobalAnalyticsAccess(session)) {
      send(response, 403, { ok: false, error: 'Forbidden' });
      return;
    }
    try {
      const body = JSON.parse(await readBody(request));
      send(response, 200, { ok: true, user: await authService.updateUser(body.id, body) });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Update auth user failed' });
    }
    return;
  }

  if (pathname === '/api/analytics/quality-issues/resolve' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request));
      send(response, 200, { ok: true, issueId: body.issueId, resolvedAt: new Date().toLocaleString('zh-CN', { hour12: false }) });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Resolve quality issue failed' });
    }
    return;
  }

  if (pathname === '/api/assets/upload' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request, UPLOAD_BODY_LIMIT));
      const match = String(body.dataUrl ?? '').match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        send(response, 400, { ok: false, error: 'Invalid file payload' });
        return;
      }

      const buffer = Buffer.from(match[2], 'base64');
      const originalName = sanitizeFileName(body.fileName);
      const storedName = `${Date.now()}-${randomUUID()}-${originalName}`;
      await mkdir(uploadDir, { recursive: true });
      await writeFile(resolve(uploadDir, storedName), buffer);

      send(response, 200, {
        fileName: originalName,
        fileUrl: `/uploads/${encodeURIComponent(storedName)}`,
        mimeType: body.mimeType || match[1],
        fileSize: buffer.byteLength,
        uploadedAt: new Date().toISOString().slice(0, 10),
      });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (pathname === '/api/platform-metrics/import' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request));
      const records = Array.isArray(body.records) ? body.records : [];
      const mapping = typeof body.fieldMapping === 'object' && body.fieldMapping ? body.fieldMapping : {};
      const data = await repository.readData();
      const nextContents = data.contents.map((content) => {
        const normalizedRecords = records.map((item) => normalizeMetricRecord(item, mapping));
        const record = normalizedRecords.find((item) => item.contentId === content.id || item.title === content.title || item.title === content.title.replace(/^.+?｜/, ''));
        if (!record) return content;
        return {
          ...content,
          metrics: {
            views: Number(record.views ?? content.metrics.views ?? 0),
            likes: Number(record.likes ?? content.metrics.likes ?? 0),
            comments: Number(record.comments ?? content.metrics.comments ?? 0),
            saves: Number(record.saves ?? content.metrics.saves ?? 0),
            shares: Number(record.shares ?? content.metrics.shares ?? 0),
            clicks: Number(record.clicks ?? content.metrics.clicks ?? 0),
          },
        };
      });
      await repository.writeData({
        ...data,
        contents: nextContents,
        auditLogs: [{
          id: `metrics-${Date.now()}`,
          actor: 'browser-extension',
          action: '导入浏览器插件指标',
          target: `${records.length} 条`,
          createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        }, ...data.auditLogs],
      });
      await clearAnalyticsCache();
      send(response, 200, { ok: true, recordCount: records.length });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (pathname === '/api/integrations/test' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const integration = JSON.parse(await readBody(request));
      send(response, 200, await testIntegration(await hydrateIntegrationConfig(integration)));
    } catch (error) {
      send(response, 400, { ok: false, status: '连接失败', message: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (pathname === '/api/integrations/send' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request));
      send(response, 200, await sendIntegrationMessage(await hydrateIntegrationConfig(body.integration), body.message));
    } catch (error) {
      send(response, 400, { ok: false, message: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (pathname === '/api/integrations/sync' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request));
      send(response, 200, await runIntegrationSync(await hydrateIntegrationConfig(body.integration), body.syncType, body.payload));
    } catch (error) {
      send(response, 400, { ok: false, message: error instanceof Error ? error.message : 'Invalid request', recordCount: 0 });
    }
    return;
  }

  if (pathname === '/api/model-apis/test' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const config = JSON.parse(await readBody(request));
      send(response, 200, await testModelApi(await hydrateModelConfig(config)));
    } catch (error) {
      send(response, 400, { ok: false, status: '连接失败', message: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (pathname === '/api/model-apis/run' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request));
      send(response, 200, await runModelApi(await hydrateModelConfig(body.config), body.task, body.input));
    } catch (error) {
      send(response, 400, { ok: false, message: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (request.method === 'GET') {
    await serveStatic(pathname, response);
    return;
  }

  send(response, 404, { ok: false, error: 'Not found' });
});

function normalizeMetricRecord(record, mapping) {
  const valueOf = (standard, fallback) => record[mapping[standard]] ?? record[standard] ?? record[fallback];
  return {
    contentId: valueOf('contentId', '内容ID'),
    title: valueOf('title', '标题'),
    views: valueOf('views', '曝光'),
    likes: valueOf('likes', '点赞'),
    comments: valueOf('comments', '评论'),
    saves: valueOf('saves', '收藏'),
    shares: valueOf('shares', '分享'),
    clicks: valueOf('clicks', '点击'),
  };
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

function hasGlobalAnalyticsAccess(session) {
  return ['系统管理员', '管理员', '招聘运营', '招聘负责人'].includes(session.role);
}

function filterDataForAnalytics(data, session) {
  if (hasGlobalAnalyticsAccess(session)) return data;
  const userKeys = new Set([session.id, session.name, session.username].filter(Boolean));
  const contents = (data.contents ?? []).filter((content) => userKeys.has(content.owner) || userKeys.has(content.reviewer));
  const contentIds = new Set(contents.map((content) => content.id));
  const jobIds = new Set(contents.map((content) => content.jobId).filter(Boolean));
  const accountIds = new Set(contents.map((content) => content.accountId).filter(Boolean));
  const accounts = (data.accounts ?? []).filter((account) => accountIds.has(account.id) || userKeys.has(account.owner));
  accounts.forEach((account) => accountIds.add(account.id));
  const jobs = (data.jobs ?? []).filter((job) => jobIds.has(job.id));
  const beisenResults = (data.beisenResults ?? []).filter((result) => (result.sourceContentId && contentIds.has(result.sourceContentId)) || jobIds.has(result.jobId));
  const costs = (data.costs ?? []).filter((cost) => cost.targetId === 'all' || contentIds.has(cost.targetId) || jobIds.has(cost.targetId) || accountIds.has(cost.targetId));
  return {
    ...data,
    jobs,
    accounts,
    contents,
    beisenResults,
    costs,
    entries: (data.entries ?? []).filter((entry) => accounts.some((account) => account.platform === entry.platform)),
  };
}

async function cachedAnalyticsDrill(data, query, session) {
  const cacheKey = `${session.role}:${session.id}:${JSON.stringify(query)}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, cache: { hit: true, expiresAt: new Date(cached.expiresAt).toISOString() } };
  }
  const diskCache = await readAnalyticsCache(cacheKey);
  if (diskCache) {
    analyticsCache.set(cacheKey, diskCache);
    return { ...diskCache.result, cache: { hit: true, storage: 'disk', expiresAt: new Date(diskCache.expiresAt).toISOString() } };
  }
  const result = buildAnalyticsDrill(data, query);
  const entry = { result, expiresAt: Date.now() + 5 * 60 * 1000 };
  analyticsCache.set(cacheKey, entry);
  await writeAnalyticsCache(cacheKey, entry);
  return { ...result, cache: { hit: false, storage: 'memory+disk', expiresAt: new Date(entry.expiresAt).toISOString() } };
}

function analyticsCacheFile(cacheKey) {
  const hash = createHash('sha256').update(cacheKey).digest('hex');
  return resolve(analyticsCacheDir, `${hash}.json`);
}

async function readAnalyticsCache(cacheKey) {
  try {
    const entry = JSON.parse(await readFile(analyticsCacheFile(cacheKey), 'utf-8'));
    if (entry.expiresAt > Date.now()) return entry;
    return null;
  } catch {
    return null;
  }
}

async function writeAnalyticsCache(cacheKey, entry) {
  await mkdir(analyticsCacheDir, { recursive: true });
  await writeFile(analyticsCacheFile(cacheKey), JSON.stringify(entry), 'utf-8');
}

async function clearAnalyticsCache() {
  analyticsCache.clear();
  await rm(analyticsCacheDir, { recursive: true, force: true });
}

const analyticsPlatforms = ['小红书', '脉脉', 'B站', '公众号', '抖音', '知乎', '技术社区'];
const analyticsStageRank = { 已投递: 1, 有效简历: 2, 初筛通过: 3, 已约面: 4, 已面试: 5, Offer: 6, 已入职: 7 };
const emptyAnalyticsSnapshot = {
  views: 0,
  interactions: 0,
  clicks: 0,
  applications: 0,
  effectiveResumes: 0,
  interviews: 0,
  offers: 0,
  hires: 0,
  cost: 0,
  roi: 0,
  interactionRate: 0,
  clickRate: 0,
  applicationRate: 0,
  effectiveRate: 0,
  hireRate: 0,
};

function analyticsRate(value, base) {
  return base > 0 ? Number((value / base).toFixed(4)) : 0;
}

function analyticsDateInRange(date, query) {
  if (!date) return true;
  if (query.dateFrom && date < query.dateFrom) return false;
  if (query.dateTo && date > query.dateTo) return false;
  return true;
}

function analyticsContentMatches(content, query) {
  return (!query.platform || query.platform === '全部' || content.platform === query.platform)
    && (!query.accountId || content.accountId === query.accountId)
    && (!query.contentId || content.id === query.contentId)
    && (!query.jobId || content.jobId === query.jobId)
    && (!query.contentType || content.type === query.contentType)
    && (!query.status || content.status === query.status)
    && analyticsDateInRange(content.publishedAt ?? content.dueDate, query);
}

function analyticsBestStageResults(results) {
  const byCandidate = new Map();
  results.forEach((result) => {
    const key = `${result.candidateCode || result.id}:${result.jobId || 'unknown'}`;
    const previous = byCandidate.get(key);
    if (!previous || analyticsStageRank[result.stage] > analyticsStageRank[previous.stage]) byCandidate.set(key, result);
  });
  return [...byCandidate.values()];
}

function analyticsResultMatches(result, contents, query) {
  const relatedContent = result.sourceContentId ? contents.find((content) => content.id === result.sourceContentId) : undefined;
  return (!query.platform || query.platform === '全部' || result.sourcePlatform === query.platform)
    && (!query.contentId || result.sourceContentId === query.contentId)
    && (!query.jobId || result.jobId === query.jobId)
    && (!query.accountId || relatedContent?.accountId === query.accountId)
    && analyticsDateInRange(result.importedAt?.slice(0, 10), query);
}

function summarizeAnalytics(data, query) {
  const contents = (data.contents ?? []).filter((content) => analyticsContentMatches(content, query));
  const results = analyticsBestStageResults((data.beisenResults ?? []).filter((result) => analyticsResultMatches(result, data.contents ?? [], query)));
  const views = contents.reduce((sum, content) => sum + Number(content.metrics?.views || 0), 0);
  const interactions = contents.reduce((sum, content) => sum + Number(content.metrics?.likes || 0) + Number(content.metrics?.comments || 0) + Number(content.metrics?.saves || 0) + Number(content.metrics?.shares || 0), 0);
  const clicks = contents.reduce((sum, content) => sum + Number(content.metrics?.clicks || 0), 0);
  const applications = results.filter((result) => analyticsStageRank[result.stage] >= analyticsStageRank.已投递).length;
  const effectiveResumes = results.filter((result) => analyticsStageRank[result.stage] >= analyticsStageRank.有效简历).length;
  const interviews = results.filter((result) => analyticsStageRank[result.stage] >= analyticsStageRank.已约面).length;
  const offers = results.filter((result) => analyticsStageRank[result.stage] >= analyticsStageRank.Offer).length;
  const hires = results.filter((result) => result.stage === '已入职').length;
  const cost = (data.costs ?? []).reduce((sum, item) => sum + Number(item.laborCost || 0) + Number(item.mediaCost || 0) + Number(item.productionCost || 0), 0);
  return {
    views,
    interactions,
    clicks,
    applications,
    effectiveResumes,
    interviews,
    offers,
    hires,
    cost,
    roi: cost > 0 ? Number((hires / cost).toFixed(4)) : 0,
    interactionRate: analyticsRate(interactions, views),
    clickRate: analyticsRate(clicks, views),
    applicationRate: analyticsRate(applications, clicks),
    effectiveRate: analyticsRate(effectiveResumes, applications),
    hireRate: analyticsRate(hires, applications),
  };
}

function detectMetricQualityIssues(data, query) {
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const issues = [];
  const push = (item) => issues.push({ ...item, id: `quality-${issues.length + 1}-${item.targetId}`, resolved: false, createdAt: now });
  (data.contents ?? []).filter((content) => analyticsContentMatches(content, query)).forEach((content) => {
    if (!content.jobId || !(data.jobs ?? []).some((job) => job.id === content.jobId)) push({ issueType: '缺少字段', severity: '高', targetType: 'content', targetId: content.id, message: `${content.title} 未关联有效岗位。` });
    if (!content.accountId || !(data.accounts ?? []).some((account) => account.id === content.accountId)) push({ issueType: '缺少字段', severity: '中', targetType: 'content', targetId: content.id, message: `${content.title} 未绑定有效账号。` });
    if (Number(content.metrics?.views || 0) === 0 && (Number(content.metrics?.clicks || 0) > 0 || Number(content.metrics?.likes || 0) > 0)) push({ issueType: '指标异常', severity: '中', targetType: 'content', targetId: content.id, message: `${content.title} 曝光为 0 但存在点击或互动。` });
  });
  (data.beisenResults ?? []).filter((result) => analyticsResultMatches(result, data.contents ?? [], query)).forEach((result) => {
    const hasContent = result.sourceContentId && (data.contents ?? []).some((content) => content.id === result.sourceContentId);
    const hasJob = result.jobId && (data.jobs ?? []).some((job) => job.id === result.jobId);
    if (!hasContent && !hasJob) push({ issueType: '无法归因', severity: result.sourcePlatform === '未知' ? '高' : '中', targetType: 'source', targetId: result.id, message: `${result.candidateCode} 无法归因到内容或岗位。` });
  });
  const seenResults = new Set();
  (data.beisenResults ?? []).forEach((result) => {
    const key = `${result.candidateCode}:${result.jobId}:${result.stage}`;
    if (seenResults.has(key)) {
      push({ issueType: '重复数据', severity: '中', targetType: 'source', targetId: result.id, message: `${result.candidateCode} 在 ${result.jobId || '未知岗位'} 的 ${result.stage} 阶段重复导入。` });
    }
    seenResults.add(key);
  });
  (data.integrationSyncRuns ?? []).filter((run) => run.status === '失败').forEach((run) => push({ issueType: '同步失败', severity: '高', targetType: 'sync', targetId: run.id, syncBatchId: run.id, message: `${run.syncType} 失败：${run.message}` }));
  return issues;
}

function buildAnalyticsInsights(summary) {
  if (summary.views === 0) return [{ id: 'insight-1', title: '暂无真实平台指标', body: '请先导入平台指标或配置平台 API。', severity: '建议', evidence: ['曝光 0', '点击 0'] }];
  if (summary.clicks === 0) return [{ id: 'insight-1', title: '有曝光但无点击', body: '优先检查 CTA、招聘入口、岗位链接和内容落点。', severity: '风险', evidence: [`曝光 ${summary.views}`, '点击 0'] }];
  if (summary.applications === 0) return [{ id: 'insight-1', title: '有点击但无北森回流', body: '优先检查追踪码、北森导入、岗位入口和归因字段。', severity: '风险', evidence: [`点击 ${summary.clicks}`, '投递 0'] }];
  return [{ id: 'insight-1', title: '链路已有有效回流', body: '建议继续放大高点击内容和高质量岗位方向。', severity: '机会', evidence: [`投递 ${summary.applications}`, `有效 ${summary.effectiveResumes}`] }];
}

function buildAnalyticsDrill(data, query = {}) {
  const normalizedQuery = { dimension: query.dimension ?? 'summary', platform: query.platform ?? '全部', page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 20), ...query };
  const summary = summarizeAnalytics(data, normalizedQuery);
  const breakdowns = normalizedQuery.dimension === 'funnel'
    ? [
      ['views', '曝光', summary.views],
      ['interactions', '互动', summary.interactions],
      ['clicks', '点击', summary.clicks],
      ['applications', '投递', summary.applications],
      ['effectiveResumes', '有效简历', summary.effectiveResumes],
      ['interviews', '面试', summary.interviews],
      ['offers', 'Offer', summary.offers],
      ['hires', '入职', summary.hires],
    ].map(([id, label, value]) => ({ id, label, dimension: 'funnel', snapshot: { ...emptyAnalyticsSnapshot, [id]: value }, meta: { value } }))
    : normalizedQuery.dimension === 'account'
      ? (data.accounts ?? []).filter((account) => !normalizedQuery.platform || normalizedQuery.platform === '全部' || account.platform === normalizedQuery.platform).map((account) => ({ id: account.id, label: `${account.platform}｜${account.name}`, dimension: 'account', snapshot: summarizeAnalytics(data, { ...normalizedQuery, accountId: account.id, platform: account.platform }), meta: { platform: account.platform, owner: account.owner, authStatus: account.authStatus, status: account.status } }))
      : normalizedQuery.dimension === 'job'
        ? (data.jobs ?? []).map((job) => ({ id: job.id, label: job.title, dimension: 'job', snapshot: summarizeAnalytics(data, { ...normalizedQuery, jobId: job.id }), meta: { family: job.family, city: job.city, level: job.level, platformCoverage: (job.targetPlatforms ?? []).join('、') } }))
        : analyticsPlatforms.map((platform) => ({ id: platform, label: platform, dimension: 'platform', snapshot: summarizeAnalytics(data, { ...normalizedQuery, platform }), meta: { contentCount: (data.contents ?? []).filter((content) => content.platform === platform).length, accountCount: (data.accounts ?? []).filter((account) => account.platform === platform).length } }));
  const allDetails = (data.contents ?? []).filter((content) => analyticsContentMatches(content, normalizedQuery));
  const details = allDetails.slice((normalizedQuery.page - 1) * normalizedQuery.pageSize, normalizedQuery.page * normalizedQuery.pageSize).map((content) => ({ id: content.id, title: content.title, dimension: 'content', snapshot: summarizeAnalytics(data, { ...normalizedQuery, contentId: content.id }), meta: { platform: content.platform, status: content.status, contentType: content.type } }));
  return { query: normalizedQuery, summary, breakdowns, details, insights: buildAnalyticsInsights(summary), qualityIssues: detectMetricQualityIssues(data, normalizedQuery), pagination: { page: normalizedQuery.page, pageSize: normalizedQuery.pageSize, total: allDetails.length }, generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }) };
}

server.listen(port, () => {
  console.log(`HRAssistant listening on http://localhost:${port}`);
  console.log(`Data file: ${dataFile}`);
});
