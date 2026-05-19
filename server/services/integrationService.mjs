export async function testIntegration(integration) {
  if (!integration?.endpoint) {
    return { ok: false, status: '未配置', message: '缺少接口地址或 Webhook' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(integration.endpoint, {
      method: integration.type === '企业微信' || integration.type === '飞书' ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: integration.type === '企业微信' || integration.type === '飞书' ? JSON.stringify({ text: 'HRAssistant connection test' }) : undefined,
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

export async function testModelApi(config) {
  if (!config?.baseUrl || !config?.apiKey || !config?.model) {
    return { ok: false, status: '未配置', message: '请填写 Base URL、API Key 和模型名称' };
  }

  const base = config.baseUrl.replace(/\/$/, '');
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
