/**
 * HotSearchParser - 热搜解析器（分部）
 * 
 * Phase 5: 总部-分部解析器架构
 * 负责解析和保存热搜数据
 * 
 * @see docs/systems/social-content-types.md Section 11
 */

import { v4 as uuidv4 } from 'uuid';
import { useHotSearchStore } from '../../hotSearchStore';
import type {
  ContentParser,
  ParseContext,
  ValidationResult,
  PersistResult,
  HotSearchInput,
  HotSearchOutput,
} from './types';

/**
 * 热搜解析器
 */
export const HotSearchParser: ContentParser<HotSearchInput | HotSearchInput[], HotSearchOutput> = {
  key: 'hotSearches',
  aliases: ['hotSearches', 'hotsearch', 'trending', 'trends', 'hotlist'],
  dependencies: [],  // 热搜不依赖其他解析器
  description: '解析热搜话题数据',
  
  validate(input): ValidationResult {
    const items = Array.isArray(input) ? input : [input];
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (items.length === 0) {
      errors.push('热搜数组为空');
    }
    
    items.forEach((item, i) => {
      if (!item.keyword) {
        errors.push(`hotSearches[${i}]: 缺少 keyword 字段`);
      }
      if (item.heat !== undefined && (item.heat < 0 || item.heat > 100)) {
        warnings.push(`hotSearches[${i}]: heat 值 ${item.heat} 超出范围 [0, 100]，将被截断`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
  
  async transform(input, context): Promise<HotSearchOutput[]> {
    const items = Array.isArray(input) ? input : [input];
    const results: HotSearchOutput[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 规范化 keyword
      let keyword = item.keyword.trim();
      if (!keyword.startsWith('#')) {
        keyword = `#${keyword}`;
      }
      if (!keyword.endsWith('#')) {
        keyword = `${keyword}#`;
      }
      
      const id = uuidv4();
      
      // 规范化 heat
      let heat = item.heat ?? Math.floor(Math.random() * 40 + 60);
      heat = Math.max(0, Math.min(100, heat));
      
      const hotSearch: HotSearchOutput = {
        id,
        keyword,
        heat,
        summary: item.summary || '',
        category: item.category || '综合',
        createdAt: context.timestamp - i * 60000,
        platformId: context.platformId,
        isNew: item.isNew ?? (i < 3),
        isHot: item.isHot ?? (heat > 80),
        isExplosive: item.isExplosive ?? (heat > 95),
      };
      
      // 记录映射
      context.resolved.hotSearches.set(keyword, id);
      
      results.push(hotSearch);
    }
    
    return results;
  },
  
  async persist(items, context): Promise<PersistResult> {
    const ids: string[] = [];
    const errors: string[] = [];
    
    try {
      // 使用 hotSearchStore 的 applyHotSearchFromJSON 方法
      // 这里我们手动构建 JSON 并调用
      const hotSearchStore = useHotSearchStore();
      
      // 转换为 store 期望的格式
      const hotSearchData = items.map(item => ({
        keyword: item.keyword,
        heat: item.heat,
        summary: item.summary,
        category: item.category,
        isNew: item.isNew,
        isHot: item.isHot,
        isExplosive: item.isExplosive,
      }));
      
      const jsonString = JSON.stringify(hotSearchData);
      const result = await hotSearchStore.applyHotSearchFromJSON(jsonString, 'prepend');
      
      if (result.success) {
        items.forEach(item => ids.push(item.id));
        context.log('info', `成功应用 ${result.count} 条热搜到榜单`);
      } else {
        errors.push(result.error || '应用热搜失败');
      }
    } catch (e: any) {
      errors.push(`保存热搜失败: ${e.message}`);
    }
    
    return {
      ids,
      count: ids.length,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};
