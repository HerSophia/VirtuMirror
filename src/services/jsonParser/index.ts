// src/services/jsonParser/index.ts

import { JsonParserServiceImpl } from './JsonParserService';
import type { JsonParserService, ParseOptions } from './types';

export * from './types';
export { BUILTIN_REPAIR_STRATEGIES } from './strategies';

let instance: JsonParserService | null = null;

/**
 * 获取 JSON 解析服务实例
 */
export function getJsonParserService(): JsonParserService {
  if (!instance) {
    instance = new JsonParserServiceImpl();
  }
  return instance;
}

/**
 * 重置服务实例（用于测试）
 */
export function resetJsonParserService(): void {
  instance = null;
}

// 便捷方法导出
export const jsonParser = {
  parse: <T>(text: string, options?: ParseOptions) =>
    getJsonParserService().parse<T>(text, options),

  parseStrict: <T>(text: string, options?: ParseOptions) =>
    getJsonParserService().parseStrict<T>(text, options),

  extractJson: (text: string) => getJsonParserService().extractJson(text),

  extractAllJson: (text: string) => getJsonParserService().extractAllJson(text),

  cleanMarkdown: (text: string) => getJsonParserService().cleanMarkdown(text),

  repair: (text: string) => getJsonParserService().repair(text),
};
