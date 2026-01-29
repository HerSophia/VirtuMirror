// src/services/jsonParser/strategies.ts

import type { RepairStrategy } from './types';

/**
 * 内置修复策略列表
 */
export const BUILTIN_REPAIR_STRATEGIES: RepairStrategy[] = [
  // 策略 1: 提取边界
  {
    name: 'extract-boundaries',
    description: '提取 JSON 对象或数组的边界',
    priority: 10,
    repair: (text: string): string | null => {
      const firstBrace = text.indexOf('{');
      const firstBracket = text.indexOf('[');
      const lastBrace = text.lastIndexOf('}');
      const lastBracket = text.lastIndexOf(']');

      let start = -1;
      let end = -1;

      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        end = lastBrace;
      } else if (firstBracket !== -1) {
        start = firstBracket;
        end = lastBracket;
      }

      if (start !== -1 && end !== -1 && end > start) {
        const extracted = text.substring(start, end + 1);
        // 只有当提取的内容与原文不同时才返回
        return extracted !== text ? extracted : null;
      }

      return null;
    },
  },

  // 策略 2: 移除尾部逗号
  {
    name: 'remove-trailing-commas',
    description: '移除对象和数组中的尾部逗号',
    priority: 20,
    repair: (text: string): string | null => {
      const repaired = text.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

      return repaired !== text ? repaired : null;
    },
  },

  // 策略 3: 单引号转双引号
  {
    name: 'single-to-double-quotes',
    description: '将单引号字符串转换为双引号',
    priority: 30,
    repair: (text: string): string | null => {
      if (!text.includes("'")) {
        return null;
      }

      let result = '';
      let inString = false;
      let stringChar = '';
      let i = 0;

      while (i < text.length) {
        const char = text[i];
        const prevChar = i > 0 ? text[i - 1] : '';

        if (!inString) {
          if (char === "'" || char === '"') {
            inString = true;
            stringChar = char;
            result += '"';
          } else {
            result += char;
          }
        } else {
          if (char === stringChar && prevChar !== '\\') {
            inString = false;
            result += '"';
          } else if (char === '"' && stringChar === "'") {
            // 单引号字符串中的双引号需要转义
            result += '\\"';
          } else {
            result += char;
          }
        }

        i++;
      }

      return result !== text ? result : null;
    },
  },

  // 策略 4: 添加键名引号
  {
    name: 'quote-unquoted-keys',
    description: '为无引号的键名添加双引号',
    priority: 40,
    repair: (text: string): string | null => {
      const repaired = text.replace(
        /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
        '$1"$2":'
      );

      return repaired !== text ? repaired : null;
    },
  },

  // 策略 5: 移除注释
  {
    name: 'remove-comments',
    description: '移除 JavaScript 风格的注释',
    priority: 50,
    repair: (text: string): string | null => {
      if (!text.includes('//') && !text.includes('/*')) {
        return null;
      }

      // 移除单行注释（简化版，不使用负向后瞻以提高兼容性）
      // 我们需要避免匹配 URL 中的 //，所以只移除行尾的注释
      let repaired = text.replace(/\/\/[^\n]*$/gm, '');

      // 移除多行注释
      repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');

      return repaired !== text ? repaired : null;
    },
  },

  // 策略 6: 修复转义序列
  {
    name: 'fix-escape-sequences',
    description: '修复不正确的转义序列',
    priority: 60,
    repair: (text: string): string | null => {
      let repaired = text;
      let changed = false;

      // 修复字符串中的无效转义（如 Windows 路径中的反斜杠）
      // 匹配字符串中的单个反斜杠（后面不是有效的转义字符）
      repaired = repaired.replace(
        /"([^"]*?)\\([^"\\nrtbfu\/])/g,
        (_match, before: string, after: string) => {
          changed = true;
          return `"${before}\\\\${after}`;
        }
      );

      return changed ? repaired : null;
    },
  },
];
