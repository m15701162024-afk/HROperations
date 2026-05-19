import { createServer } from 'node:http';
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = resolve(rootDir, 'data/hr-assistant-data.json');
const authFile = resolve(rootDir, 'data/hr-assistant-auth.json');
const port = Number(process.env.HR_ASSISTANT_API_PORT ?? 8787);
const sessions = new Map();

const emptyData = {
  jobs: [],
  accounts: [],
  contents: [],
  contentVersions: [],
  assets: [],
  goals: [],
  reports: [],
  entries: [],
  beisenResults: [],
  integrations: [],
  landingPages: [],
  roles: [],
  users: [],
  workflowRules: [],
  sensitiveRules: [],
  costs: [],
  notifications: [],
  auditLogs: [],
};

async function readData() {
  try {
    const raw = await readFile(dataFile, 'utf-8');
    return { ...emptyData, ...JSON.parse(raw) };
  } catch {
    await writeData(emptyData);
    return emptyData;
  }
}

async function readAuth() {
  try {
    const raw = await readFile(authFile, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const initial = {
      users: [
        {
          id: 'local-admin',
          username: 'admin',
          name: '本地管理员',
          role: '系统管理员',
          password: hashPassword('HRAssistant@2026'),
        },
      ],
    };
    await mkdir(dirname(authFile), { recursive: true });
    await writeFile(authFile, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

async function writeData(data) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify({ ...emptyData, ...data }, null, 2), 'utf-8');
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept,Authorization',
  });
  response.end(JSON.stringify(body));
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = pbkdf2Sync(password, salt, 120000, 32, 'sha256');
  return timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}

function getBearerToken(request) {
  const header = request.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
}

function requireSession(request, response) {
  const token = getBearerToken(request);
  const session = token ? sessions.get(token) : null;
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
    send(response, 200, { ok: true });
    return;
  }

  if (request.url === '/api/login' && request.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(request));
      const auth = await readAuth();
      const user = auth.users.find((item) => item.username === body.username);
      if (!user || !verifyPassword(String(body.password ?? ''), user.password)) {
        send(response, 401, { ok: false, error: 'Invalid username or password' });
        return;
      }
      const token = randomUUID();
      const publicUser = { id: user.id, username: user.username, name: user.name, role: user.role };
      sessions.set(token, publicUser);
      send(response, 200, { token, user: publicUser });
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
    send(response, 200, await readData());
    return;
  }

  if (request.url === '/api/data' && request.method === 'PUT') {
    if (!requireSession(request, response)) return;
    try {
      const body = await readBody(request);
      const data = JSON.parse(body);
      await writeData(data);
      send(response, 200, { ok: true });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
    }
    return;
  }

  send(response, 404, { ok: false, error: 'Not found' });
});

server.listen(port, () => {
  console.log(`HRAssistant local API listening on http://localhost:${port}`);
  console.log(`Data file: ${dataFile}`);
});
