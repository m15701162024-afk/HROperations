import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = resolve(rootDir, 'data/hr-assistant-data.json');
const port = Number(process.env.HR_ASSISTANT_API_PORT ?? 8787);

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
    'Access-Control-Allow-Headers': 'Content-Type,Accept',
  });
  response.end(JSON.stringify(body));
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

  if (request.url === '/api/data' && request.method === 'GET') {
    send(response, 200, await readData());
    return;
  }

  if (request.url === '/api/data' && request.method === 'PUT') {
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
