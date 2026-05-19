import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJsonRepository } from './repositories/jsonRepository.mjs';
import { createAuthService } from './services/authService.mjs';
import { runModelApi, testIntegration, testModelApi } from './services/integrationService.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = resolve(rootDir, 'data/hr-assistant-data.json');
const authFile = resolve(rootDir, 'data/hr-assistant-auth.json');
const port = Number(process.env.HR_ASSISTANT_API_PORT ?? 8787);

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

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    send(response, 204, {});
    return;
  }

  if (request.url === '/api/health') {
    send(response, 200, { ok: true, storage: 'json', auth: 'local' });
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

  send(response, 404, { ok: false, error: 'Not found' });
});

server.listen(port, () => {
  console.log(`HRAssistant local API listening on http://localhost:${port}`);
  console.log(`Data file: ${dataFile}`);
});
