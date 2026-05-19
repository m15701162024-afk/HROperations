import { emptyData } from './data';
import type { AppData } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';
const DISABLE_API = import.meta.env.MODE === 'test' || import.meta.env.VITE_DISABLE_API === 'true';

export async function loadRemoteData(): Promise<AppData | null> {
  if (DISABLE_API) return null;
  try {
    const payload = await requestJson<Partial<AppData>>(`${API_BASE}/api/data`, 'GET');
    return normalizeAppData(payload);
  } catch {
    return null;
  }
}

export async function saveRemoteData(data: AppData) {
  if (DISABLE_API) return false;
  try {
    await requestJson(`${API_BASE}/api/data`, 'PUT', data);
    return true;
  } catch {
    return false;
  }
}

function requestJson<T>(url: string, method: 'GET' | 'PUT', body?: unknown): Promise<T> {
  if (typeof fetch === 'function') {
    return fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() as T;
    });
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('Content-Type', 'application/json');
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`HTTP ${request.status}`));
        return;
      }
      resolve(JSON.parse(request.responseText) as T);
    };
    request.onerror = () => reject(new Error('Network error'));
    request.send(body === undefined ? undefined : JSON.stringify(body));
  });
}

export function normalizeAppData(data: Partial<AppData>): AppData {
  return {
    ...emptyData,
    ...data,
    jobs: data.jobs ?? [],
    accounts: data.accounts ?? [],
    contents: data.contents ?? [],
    contentVersions: data.contentVersions ?? [],
    assets: data.assets ?? [],
    goals: data.goals ?? [],
    reports: data.reports ?? [],
    entries: data.entries ?? [],
    beisenResults: data.beisenResults ?? [],
    integrations: data.integrations ?? [],
    landingPages: data.landingPages ?? [],
    roles: data.roles ?? [],
    users: data.users ?? [],
    workflowRules: data.workflowRules ?? [],
    sensitiveRules: data.sensitiveRules ?? [],
    costs: data.costs ?? [],
    notifications: data.notifications ?? [],
    auditLogs: data.auditLogs ?? [],
  };
}
