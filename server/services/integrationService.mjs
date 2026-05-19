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
