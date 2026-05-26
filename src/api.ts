import { emptyData } from './data';
import type { AppData, DrillQuery, DrillResult } from './types';
import type { AssetItem, IntegrationConfig, IntegrationSyncRun, ModelApiConfig } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? defaultApiBase();
const DISABLE_API = import.meta.env.MODE === 'test' || import.meta.env.VITE_DISABLE_API === 'true';

function defaultApiBase() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5173';
}

export interface ApiUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export type RemoteLoadResult =
  | { status: 'disabled' | 'offline' }
  | { status: 'unauthorized' }
  | { status: 'ok'; data: AppData; user?: ApiUser };

export async function loginLocalApi(username: string, password: string) {
  const payload = await requestJson<{ token: string; user: ApiUser }>(`${API_BASE}/api/login`, 'POST', undefined, { username, password });
  return payload;
}

export async function loadRemoteData(token?: string): Promise<RemoteLoadResult> {
  if (DISABLE_API) return { status: 'disabled' };
  try {
    const session = token ? await requestJson<{ user: ApiUser }>(`${API_BASE}/api/session`, 'GET', token) : undefined;
    const payload = await requestJson<Partial<AppData>>(`${API_BASE}/api/data`, 'GET', token);
    return { status: 'ok', data: normalizeAppData(payload), user: session?.user };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { status: 'unauthorized' };
    return { status: 'offline' };
  }
}

export async function saveRemoteData(data: AppData, token?: string) {
  if (DISABLE_API) return false;
  try {
    await requestJson(`${API_BASE}/api/data`, 'PUT', token, data);
    return true;
  } catch {
    return false;
  }
}

export async function testIntegrationConfig(integration: IntegrationConfig, token?: string) {
  return await requestJson<{
    ok: boolean;
    status: IntegrationConfig['status'];
    statusCode?: number;
    message: string;
  }>(`${API_BASE}/api/integrations/test`, 'POST', token, integration);
}

export async function sendIntegrationMessage(integration: IntegrationConfig, message: string, token?: string) {
  return await requestJson<{
    ok: boolean;
    statusCode?: number;
    message: string;
  }>(`${API_BASE}/api/integrations/send`, 'POST', token, { integration, message });
}

export async function runIntegrationSync(
  integration: IntegrationConfig,
  syncType: IntegrationSyncRun['syncType'],
  payload: unknown,
  token?: string,
) {
  return await requestJson<{
    ok: boolean;
    statusCode?: number;
    message: string;
    recordCount: number;
    retryCount?: number;
    data?: unknown;
  }>(`${API_BASE}/api/integrations/sync`, 'POST', token, { integration, syncType, payload });
}

export async function testModelApiConfig(config: ModelApiConfig, token?: string) {
  return await requestJson<{
    ok: boolean;
    status: ModelApiConfig['status'];
    statusCode?: number;
    message: string;
  }>(`${API_BASE}/api/model-apis/test`, 'POST', token, config);
}

export async function runModelTask(
  config: ModelApiConfig,
  task: '内容生成' | '风险识别' | '复盘建议',
  input: unknown,
  token?: string,
) {
  return await requestJson<{ ok: boolean; text?: string; message?: string }>(`${API_BASE}/api/model-apis/run`, 'POST', token, {
    config,
    task,
    input,
  });
}

export async function uploadAssetFile(file: File, token?: string): Promise<Pick<AssetItem, 'fileName' | 'fileUrl' | 'mimeType' | 'fileSize' | 'uploadedAt'>> {
  const dataUrl = await readFileAsDataUrl(file);
  const payload = await requestJson<{
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: string;
  }>(`${API_BASE}/api/assets/upload`, 'POST', token, {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    dataUrl,
  });

  return {
    ...payload,
    fileUrl: payload.fileUrl.startsWith('http') ? payload.fileUrl : `${API_BASE}${payload.fileUrl}`,
  };
}

export async function loadSystemHealth(token?: string) {
  return await requestJson<{
    ok: boolean;
    storage: string;
    dataFileSize: number;
    backupCount: number;
    latestBackup?: string;
    counts: Record<string, number>;
  }>(`${API_BASE}/api/system/health`, 'GET', token);
}

export async function createSystemBackup(token?: string) {
  return await requestJson<{
    ok: boolean;
    backupFile: string;
    createdAt: string;
  }>(`${API_BASE}/api/system/backup`, 'POST', token, {});
}

export async function loadAnalyticsSummary(query: DrillQuery, token?: string) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return await requestJson<DrillResult>(`${API_BASE}/api/analytics/summary?${params.toString()}`, 'GET', token);
}

export async function loadAnalyticsDrill(query: DrillQuery, token?: string) {
  const pathByDimension: Record<DrillQuery['dimension'], string> = {
    summary: 'summary',
    platform: 'platform',
    account: 'account',
    content: 'content',
    job: 'job',
    contentType: 'content',
    funnel: 'funnel',
  };
  const path = pathByDimension[query.dimension] ?? 'platform';
  return await requestJson<DrillResult>(`${API_BASE}/api/analytics/drill/${path}`, 'POST', token, query);
}

class ApiError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

function headers(token?: string) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function requestJson<T>(url: string, method: 'GET' | 'PUT' | 'POST', token?: string, body?: unknown): Promise<T> {
  if (typeof fetch === 'function') {
    return fetch(url, {
      method,
      headers: headers(token),
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async (response) => {
      if (!response.ok) throw new ApiError(response.status);
      return await response.json() as T;
    });
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    Object.entries(headers(token)).forEach(([key, value]) => request.setRequestHeader(key, value));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new ApiError(request.status));
        return;
      }
      resolve(JSON.parse(request.responseText) as T);
    };
    request.onerror = () => reject(new Error('Network error'));
    request.send(body === undefined ? undefined : JSON.stringify(body));
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
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
    reviewComments: data.reviewComments ?? [],
    assets: data.assets ?? [],
    goals: data.goals ?? [],
    reports: data.reports ?? [],
    entries: data.entries ?? [],
    beisenResults: data.beisenResults ?? [],
    integrations: data.integrations ?? [],
    integrationSyncRuns: data.integrationSyncRuns ?? [],
    modelApis: data.modelApis ?? [],
    landingPages: data.landingPages ?? [],
    landingLeads: data.landingLeads ?? [],
    roles: data.roles ?? [],
    users: data.users ?? [],
    workflowRules: data.workflowRules ?? [],
    sensitiveRules: data.sensitiveRules ?? [],
    costs: data.costs ?? [],
    notifications: data.notifications ?? [],
    auditLogs: data.auditLogs ?? [],
    integrationMappings: data.integrationMappings ?? [],
    compliancePolicies: data.compliancePolicies ?? [],
    deploymentTasks: data.deploymentTasks ?? [],
    importRuns: data.importRuns ?? [],
    reportActions: data.reportActions ?? [],
    promptTemplates: data.promptTemplates ?? [],
    modelRunLogs: data.modelRunLogs ?? [],
    pluginRules: data.pluginRules ?? [],
    tasks: data.tasks ?? [],
    taskCompletions: data.taskCompletions ?? [],
    candidateLeads: data.candidateLeads ?? [],
    leadFollowUps: data.leadFollowUps ?? [],
    contentQualityScores: data.contentQualityScores ?? [],
    topics: data.topics ?? [],
    accountHealthSnapshots: data.accountHealthSnapshots ?? [],
    calendarMilestones: data.calendarMilestones ?? [],
    dataExplanations: data.dataExplanations ?? [],
    reviewMentions: data.reviewMentions ?? [],
    operationSettings: data.operationSettings ?? emptyData.operationSettings,
  };
}
