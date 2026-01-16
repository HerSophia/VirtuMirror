/**
 * Weibo App 集成测试
 * 测试模块导出和基本集成
 */

import { describe, it, expect } from 'vitest';

describe('Weibo App Module', () => {
  describe('类型导出', () => {
    it('应导出所有必要的类型', async () => {
      const types = await import('../types');

      expect(types.VERIFY_TYPE_CONFIGS).toBeDefined();
      expect(types.getVerifyTypeConfig).toBeDefined();
    });
  });

  describe('Store 导出', () => {
    it('应导出所有 stores', async () => {
      const stores = await import('../stores');

      expect(stores.useHotSearchStore).toBeDefined();
      expect(stores.useFeedStore).toBeDefined();
      expect(stores.useComposeStore).toBeDefined();
      expect(stores.useUserActionStore).toBeDefined();
    });
  });

  describe('Composables 导出', () => {
    it('应导出 composables', async () => {
      const composables = await import('../composables');

      expect(composables.usePostDisplay).toBeDefined();
    });
  });

  describe('LLM 模块导出', () => {
    it('应导出 postTransformer', async () => {
      const transformer = await import('../stores/llm/postTransformer');

      expect(transformer.transformLLMOutputToUniversalPost).toBeDefined();
      expect(transformer.transformBatchLLMOutput).toBeDefined();
      expect(transformer.validateLLMOutput).toBeDefined();
    });

    it('应导出解析器', async () => {
      const parsers = await import('../stores/llm/parsers');

      expect(parsers.getDispatcher).toBeDefined();
      expect(parsers.PostParser).toBeDefined();
    });
  });
});
