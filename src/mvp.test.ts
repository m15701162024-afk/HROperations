import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import { evaluateMvpMatrix, mvpReportMarkdown, summarizeMvp } from './mvp';

describe('MVP 验收矩阵', () => {
  it('evaluates every business module against the eight MVP criteria', () => {
    const results = evaluateMvpMatrix(emptyData);

    expect(results.length).toBeGreaterThanOrEqual(12);
    expect(results.every((item) => Object.keys(item.criteria).length === 8)).toBe(true);
    expect(results.find((item) => item.module === '数据分析')?.status).toBe('达标');
  });

  it('summarizes and exports an end-to-end MVP acceptance report', () => {
    const results = evaluateMvpMatrix(emptyData);
    const summary = summarizeMvp(results);
    const report = mvpReportMarkdown(results);

    expect(summary.total).toBe(results.length);
    expect(report).toContain('招聘运营助手 MVP 验收报告');
    expect(report).toContain('| 数据分析 |');
    expect(report).toContain('当前无岗位数据');
  });
});
