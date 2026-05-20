import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJsonRepository } from './repositories/jsonRepository.mjs';
import { createAuthService } from './services/authService.mjs';
import { runIntegrationSync, runModelApi, sendIntegrationMessage, testIntegration, testModelApi } from './services/integrationService.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = resolve(rootDir, 'data/hr-assistant-data.json');
const authFile = resolve(rootDir, 'data/hr-assistant-auth.json');
const uploadDir = resolve(rootDir, 'data/uploads');
const distDir = resolve(rootDir, 'dist');
const port = Number(process.env.HR_ASSISTANT_API_PORT ?? 5173);

const repository = createJsonRepository(dataFile);
const authService = createAuthService(authFile);

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
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
  if (!expected) return true;
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

async function serveStatic(request, response) {
  try {
    const rawPath = decodeURIComponent((request.url ?? '/').split('?')[0]);
    const filePath = rawPath === '/' ? resolve(distDir, 'index.html') : resolve(distDir, rawPath.slice(1));
    if (!filePath.startsWith(distDir)) {
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
  if (request.method === 'OPTIONS') {
    send(response, 204, {});
    return;
  }

  if (request.url === '/api/health') {
    send(response, 200, { ok: true, storage: 'json', auth: 'local' });
    return;
  }

  if (request.url?.startsWith('/uploads/') && request.method === 'GET') {
    try {
      const requestedName = decodeURIComponent(request.url.replace('/uploads/', '').split('?')[0]);
      const safeName = basename(requestedName);
      const filePath = resolve(uploadDir, safeName);
      if (!filePath.startsWith(uploadDir)) {
        send(response, 400, { ok: false, error: 'Invalid file path' });
        return;
      }
      sendFile(response, 200, await readFile(filePath), contentTypeFor(filePath));
    } catch {
      send(response, 404, { ok: false, error: 'File not found' });
    }
    return;
  }

  if (request.url === '/api/login' && request.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(request));
      const result = await authService.login(body.username, body.password);
      if (!result) {
        send(response, 401, { ok: false, error: 'Invalid username or password' });
        return;
      }
      send(response, 200, result);
    } catch {
      send(response, 400, { ok: false, error: 'Invalid request' });
    }
    return;
  }

  if (request.url === '/api/track' && request.method === 'POST') {
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

  if (request.url === '/api/landing/leads' && request.method === 'POST') {
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

  if (request.url === '/api/session' && request.method === 'GET') {
    const session = requireSession(request, response);
    if (!session) return;
    send(response, 200, { user: session });
    return;
  }

  if (request.url === '/api/data' && request.method === 'GET') {
    if (!requireSession(request, response)) return;
    send(response, 200, await repository.readData());
    return;
  }

  if (request.url === '/api/data' && request.method === 'PUT') {
    if (!requireSession(request, response)) return;
    try {
      const body = await readBody(request);
      const data = JSON.parse(body);
      await repository.writeData(data);
      send(response, 200, { ok: true });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (request.url === '/api/assets/upload' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request));
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

  if (request.url === '/api/platform-metrics/import' && request.method === 'POST') {
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
      send(response, 200, { ok: true, recordCount: records.length });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (request.url === '/api/integrations/test' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const integration = JSON.parse(await readBody(request));
      send(response, 200, await testIntegration(integration));
    } catch (error) {
      send(response, 400, { ok: false, status: '连接失败', message: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (request.url === '/api/integrations/send' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request));
      send(response, 200, await sendIntegrationMessage(body.integration, body.message));
    } catch (error) {
      send(response, 400, { ok: false, message: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (request.url === '/api/integrations/sync' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request));
      send(response, 200, await runIntegrationSync(body.integration, body.syncType, body.payload));
    } catch (error) {
      send(response, 400, { ok: false, message: error instanceof Error ? error.message : 'Invalid request', recordCount: 0 });
    }
    return;
  }

  if (request.url === '/api/model-apis/test' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const config = JSON.parse(await readBody(request));
      send(response, 200, await testModelApi(config));
    } catch (error) {
      send(response, 400, { ok: false, status: '连接失败', message: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (request.url === '/api/model-apis/run' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    try {
      const body = JSON.parse(await readBody(request));
      send(response, 200, await runModelApi(body.config, body.task, body.input));
    } catch (error) {
      send(response, 400, { ok: false, message: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  if (request.method === 'GET') {
    await serveStatic(request, response);
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

server.listen(port, () => {
  console.log(`HRAssistant listening on http://localhost:${port}`);
  console.log(`Data file: ${dataFile}`);
});
