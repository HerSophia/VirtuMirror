/**
 * 上下文格式化工具
 * @module services/contextSharing/formatters
 */

import type { ContextType, AggregationFormat, ContextItem } from './types';

/**
 * 格式化结果
 */
export interface FormatResult {
  /** 格式化后的文本 */
  text: string;
  /** 是否被截断 */
  truncated: boolean;
  /** 估算的 token 数 */
  estimatedTokens: number;
}

/**
 * 格式化上下文为指定格式
 *
 * @param contexts 按类型分组的上下文
 * @param format 输出格式
 * @param maxTokens 最大 token 数限制（可选）
 * @returns 格式化结果
 */
export function formatContexts(
  contexts: Map<ContextType, ContextItem[]>,
  format: AggregationFormat,
  maxTokens?: number
): FormatResult {
  if (format === 'raw') {
    // raw 格式直接返回 JSON
    const obj: Record<string, ContextItem[]> = {};
    for (const [type, items] of contexts) {
      obj[type] = items;
    }
    const text = JSON.stringify(obj, null, 2);
    const estimatedTokens = estimateTokens(text);
    return {
      text,
      truncated: false,
      estimatedTokens,
    };
  }

  const parts: string[] = [];

  for (const [type, items] of contexts) {
    switch (format) {
      case 'xml':
        parts.push(formatAsXml(type, items));
        break;
      case 'markdown':
        parts.push(formatAsMarkdown(type, items));
        break;
      case 'text':
      default:
        parts.push(formatAsText(type, items));
        break;
    }
  }

  let text = parts.join('\n');
  let truncated = false;

  // Token 限制
  if (maxTokens) {
    const estimatedTokens = estimateTokens(text);
    if (estimatedTokens > maxTokens) {
      // 简单截断策略：按字符数截断
      const maxChars = maxTokens * 4;
      text = text.slice(0, maxChars) + '\n... (内容已截断)';
      truncated = true;
    }
  }

  return {
    text,
    truncated,
    estimatedTokens: estimateTokens(text),
  };
}

/**
 * 格式化为 XML 格式
 */
function formatAsXml(type: ContextType, items: ContextItem[]): string {
  const lines: string[] = [`<context type="${escapeXml(type)}">`];

  for (const item of items) {
    const valueStr = formatValue(item.value);
    const escapedValue = escapeXml(valueStr);
    const escapedDesc = escapeXml(item.description);
    lines.push(
      `  <item id="${escapeXml(item.id)}" description="${escapedDesc}">${escapedValue}</item>`
    );
  }

  lines.push('</context>');
  return lines.join('\n');
}

/**
 * 格式化为 Markdown 格式
 */
function formatAsMarkdown(type: ContextType, items: ContextItem[]): string {
  const lines: string[] = [`## ${type}`, ''];

  for (const item of items) {
    lines.push(`### ${item.description}`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(item.value, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 格式化为纯文本格式
 */
function formatAsText(type: ContextType, items: ContextItem[]): string {
  const lines: string[] = [`[${type}]`];

  for (const item of items) {
    const valueStr = formatValue(item.value);
    lines.push(`- ${item.description}: ${valueStr}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * 格式化值为字符串
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * 转义 XML 特殊字符
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 估算 token 数量
 * 使用简单的启发式方法：约 4 个字符 = 1 个 token
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
