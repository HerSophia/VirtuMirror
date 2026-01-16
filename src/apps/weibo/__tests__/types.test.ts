/**
 * Weibo 类型定义测试
 * 测试类型相关的工具函数和常量
 */

import { describe, it, expect } from 'vitest';
import {
  VERIFY_TYPE_CONFIGS,
  getVerifyTypeConfig,
  type WeiboVerifyType,
} from '../types';

describe('Weibo Types', () => {
  describe('VERIFY_TYPE_CONFIGS', () => {
    it('应包含所有认证类型', () => {
      const expectedTypes: WeiboVerifyType[] = [
        'personal_celebrity',
        'personal_kol',
        'personal_professional',
        'personal_writer',
        'personal_artist',
        'org_enterprise',
        'org_media',
        'org_government',
        'org_school',
        'org_ngo',
        'super_topic_host',
      ];

      expectedTypes.forEach(type => {
        const config = VERIFY_TYPE_CONFIGS.find(c => c.value === type);
        expect(config).toBeDefined();
      });
    });

    it('每个配置应有必需字段', () => {
      VERIFY_TYPE_CONFIGS.forEach(config => {
        expect(config.value).toBeDefined();
        expect(config.label).toBeDefined();
        expect(config.category).toMatch(/^(personal|org|special)$/);
        expect(config.icon).toBeDefined();
        expect(config.color).toBeDefined();
        expect(config.description).toBeDefined();
      });
    });

    it('个人认证类型应属于 personal 分类', () => {
      const personalTypes = VERIFY_TYPE_CONFIGS.filter(
        c => c.value.startsWith('personal_')
      );

      personalTypes.forEach(config => {
        expect(config.category).toBe('personal');
      });
    });

    it('机构认证类型应属于 org 分类', () => {
      const orgTypes = VERIFY_TYPE_CONFIGS.filter(
        c => c.value.startsWith('org_')
      );

      orgTypes.forEach(config => {
        expect(config.category).toBe('org');
      });
    });
  });

  describe('getVerifyTypeConfig', () => {
    it('应返回正确的认证配置', () => {
      const config = getVerifyTypeConfig('personal_celebrity');

      expect(config).toBeDefined();
      expect(config?.label).toBe('名人认证');
      expect(config?.category).toBe('personal');
    });

    it('应返回机构认证配置', () => {
      const config = getVerifyTypeConfig('org_enterprise');

      expect(config).toBeDefined();
      expect(config?.label).toBe('企业认证');
      expect(config?.category).toBe('org');
    });

    it('应返回特殊认证配置', () => {
      const config = getVerifyTypeConfig('super_topic_host');

      expect(config).toBeDefined();
      expect(config?.label).toBe('超话主持人');
      expect(config?.category).toBe('special');
    });

    it('无效类型应返回 undefined', () => {
      const config = getVerifyTypeConfig('invalid_type' as WeiboVerifyType);

      expect(config).toBeUndefined();
    });
  });
});
