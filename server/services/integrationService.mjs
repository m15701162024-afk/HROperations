export async function testIntegration(integration) {
  if (!integration?.endpoint) {
    return { ok: false, status: '未配置', message: '缺少接口地址或 Webhook' };
  }

  try {
    const requestConfig = buildIntegrationRequest(integration, '测试连接', { text: 'HRAssistant connection test' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(requestConfig.url, {
      method: requestConfig.method,
      headers: buildHeaders(integration),
      body: requestConfig.method === 'GET' ? undefined : JSON.stringify(requestConfig.payload ?? {}),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      ok: response.ok,
      status: response.ok ? '已连接' : '连接失败',
      statusCode: response.status,
      message: response.ok ? '连接测试通过' : `连接失败：HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: '连接失败',
      message: error instanceof Error ? error.message : '连接失败',
    };
  }
}

export async function runIntegrationSync(integration, syncType, payload) {
  if (!integration?.endpoint) {
    return { ok: false, message: '缺少接口地址或 Webhook', recordCount: 0 };
  }

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await requestIntegration(integration, syncType, payload);
      return { ...result, retryCount: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : '同步请求失败';
    }
  }

  return {
    ok: false,
    message: lastError,
    recordCount: 0,
    retryCount: 2,
  };
}

async function requestIntegration(integration, syncType, payload) {
    const requestConfig = buildIntegrationRequest(integration, syncType, payload);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(requestConfig.url, {
      method: requestConfig.method,
      headers: buildHeaders(integration),
      body: requestConfig.method === 'GET' ? undefined : JSON.stringify(requestConfig.payload ?? {}),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await response.text();
    const data = pickPath(parseJson(text), requestConfig.resultPath);
    const recordCount = Array.isArray(data) ? data.length : Number(data?.recordCount ?? data?.count ?? payload?.records?.length ?? 0);
    return {
      ok: response.ok,
      statusCode: response.status,
      message: response.ok ? '同步请求已完成' : `同步请求失败：HTTP ${response.status}`,
      recordCount,
      data,
    };
}

function buildIntegrationRequest(integration, syncType, payload) {
  const extra = parseExtraConfig(integration?.extraConfig);
  const scenario = extra.scenarios?.[syncType] ?? {};
  const fallbackMethod = integration.type === '企业微信' || integration.type === '飞书'
    ? 'POST'
    : syncType === '平台指标拉取' || syncType === '北森结果回流'
      ? 'GET'
      : 'POST';
  const method = String(scenario.method ?? extra.method ?? fallbackMethod).toUpperCase();
  const fieldMapping = scenario.fieldMapping ?? scenario.fields ?? extra.fieldMapping ?? extra.fields;
  return {
    method,
    url: buildUrl(integration.endpoint, scenario.endpointPath ?? extra.endpointPath, scenario.query ?? extra.query),
    payload: mapPayload(payload, fieldMapping),
    resultPath: scenario.resultPath ?? extra.resultPath,
  };
}

export async function sendIntegrationMessage(integration, message) {
  if (!integration?.endpoint) {
    return { ok: false, message: '缺少接口地址或 Webhook' };
  }
  if (integration.type !== '企业微信' && integration.type !== '飞书') {
    return { ok: false, message: '当前集成类型不支持消息发送' };
  }

  const body = integration.type === '企业微信'
    ? { msgtype: 'text', text: { content: message } }
    : { msg_type: 'text', content: { text: message } };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(integration.endpoint, {
      method: 'POST',
      headers: buildHeaders(integration),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      ok: response.ok,
      statusCode: response.status,
      message: response.ok ? '消息发送成功' : `消息发送失败：HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '消息发送失败',
    };
  }
}

function buildHeaders(integration) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(integration?.apiKey ? { Authorization: `Bearer ${integration.apiKey}`, 'X-API-Key': integration.apiKey } : {}),
  };
}

function parseJson(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function parseExtraConfig(raw) {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

function buildUrl(endpoint, endpointPath = '', query = {}) {
  const base = String(endpoint ?? '').replace(/\/$/, '');
  const path = String(endpointPath ?? '').replace(/^\//, '');
  const url = new URL(path ? `${base}/${path}` : base);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function mapPayload(payload, fieldMapping) {
  if (!fieldMapping || typeof fieldMapping !== 'object' || !Array.isArray(payload?.records)) return payload;
  return {
    ...payload,
    records: payload.records.map((record) => Object.fromEntries(
      Object.entries(fieldMapping).map(([target, source]) => [target, record[source] ?? record[target] ?? '']),
    )),
  };
}

function pickPath(data, path) {
  if (!path) return data;
  return String(path).split('.').filter(Boolean).reduce((value, key) => value?.[key], data) ?? data;
}

export async function testModelApi(config) {
  if (!config?.baseUrl || !config?.apiKey || !config?.model) {
    return { ok: false, status: '未配置', message: '请填写 Base URL、API Key 和模型名称' };
  }

  const base = config.baseUrl.replace(/\/$/, '');
  if (config.provider === 'DeepSeek') {
    return await testChatCompletion(base, config, 'DeepSeek API 连接测试通过');
  }

  const url = `${base}/models`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        return await testChatCompletion(base, config, '模型 API 连接测试通过');
      }
      return { ok: false, status: '连接失败', statusCode: response.status, message: `模型接口连接失败：HTTP ${response.status}` };
    }
    return { ok: true, status: '已连接', statusCode: response.status, message: '模型 API 连接测试通过' };
  } catch (error) {
    return {
      ok: false,
      status: '连接失败',
      message: error instanceof Error ? error.message : '模型 API 连接失败',
    };
  }
}

async function testChatCompletion(base, config, successMessage) {
  const url = `${base}/chat/completions`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, status: '连接失败', statusCode: response.status, message: `模型接口连接失败：HTTP ${response.status}${text ? `，${text.slice(0, 120)}` : ''}` };
    }
    return { ok: true, status: '已连接', statusCode: response.status, message: successMessage };
  } catch (error) {
    return {
      ok: false,
      status: '连接失败',
      message: error instanceof Error ? error.message : '模型 API 连接失败',
    };
  }
}

export async function runModelApi(config, task, input) {
  if (!config?.baseUrl || !config?.apiKey || !config?.model) {
    return { ok: false, message: '模型 API 未配置完整' };
  }

  const prompt = buildPrompt(task, input);
  const base = config.baseUrl.replace(/\/$/, '');
  const url = `${base}/chat/completions`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: '你是招聘新媒体运营助手，输出中文，直接给出可用结果。' },
          { role: 'user', content: prompt },
        ],
        temperature: task === '风险识别' ? 0.1 : 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      return { ok: false, message: `模型调用失败：HTTP ${response.status}` };
    }
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content ?? '';
    return text ? { ok: true, text } : { ok: false, message: '模型未返回内容' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '模型调用失败' };
  }
}

function buildPrompt(task, input) {
  if (task === '内容生成') {
    return `请根据以下岗位和平台生成招聘新媒体内容初稿。\n\n平台：${input.platform}\n岗位：${input.job?.title}\n岗位族群：${input.job?.family}\n层级：${input.job?.level}\nJD：${input.job?.jd}\n候选人画像：${input.job?.persona}\n岗位卖点：${input.job?.sellingPoints?.join('、')}\n\n要求：包含标题、正文、标签、CTA，避免夸大承诺。`;
  }
  if (task === '风险识别') {
    return `请识别以下招聘内容中的合规风险，输出 JSON，格式为 {"level":"低|中|高","risks":["风险1"],"suggestion":"修改建议"}。\n\n内容：${input.text}`;
  }
  if (task === '复盘建议') {
    return `请根据以下招聘运营数据生成复盘建议，输出 3-5 条行动建议。\n\n${JSON.stringify(input.data, null, 2)}`;
  }
  return JSON.stringify(input);
}
