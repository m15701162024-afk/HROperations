import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from './App';
import { scanRisks } from './data';

beforeEach(() => {
  localStorage.clear();
});

describe('招聘运营助手', () => {
  it('renders the main dashboard metrics', () => {
    render(<App />);

    expect(screen.getByText('招聘新媒体运营中台')).toBeInTheDocument();
    expect(screen.getByText('内容发布数量')).toBeInTheDocument();
    expect(screen.getByText('招聘入口点击')).toBeInTheDocument();
  });

  it('generates content and creates a new content task', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /内容运营/ }));
    await user.click(screen.getByRole('button', { name: /生成平台内容/ }));
    expect(screen.getByDisplayValue(/内容初稿/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /保存为内容任务/ }));
    expect(screen.getByText(/小红书｜资深自动驾驶云平台开发 Java 方向内容初稿/)).toBeInTheDocument();
  });

  it('detects high risk expressions', () => {
    const result = scanRisks('这里包含薪酬、奖金、算法、客户信息和转正承诺');

    expect(result.level).toBe('高');
    expect(result.risks.length).toBeGreaterThan(1);
  });
});
