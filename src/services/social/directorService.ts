import { timeService } from '../timeService';
import AIGenerateService from '../aiGenerateService';
import { PromptService } from '../promptService';
import { TrendService } from './trendService';
import { WorldEvent } from '../../types/social';
import { v4 as uuidv4 } from 'uuid';

export class DirectorService {
  private static instance: DirectorService;
  private lastEventTime: number = 0;
  private isGenerating: boolean = false;

  private config = {
    worldSetting: "现代都市背景，科技与魔法轻微共存 (参考赛博朋克或现代奇幻)", // 默认背景
    frequency: 'medium' as 'low' | 'medium' | 'high',
    isEnabled: false,
    costLimit: 10000 // Placeholder for token budget
  };

  private constructor() {
    this.startListening();
  }

  public static getInstance(): DirectorService {
    if (!DirectorService.instance) {
      DirectorService.instance = new DirectorService();
    }
    return DirectorService.instance;
  }

  public setConfig(config: Partial<typeof DirectorService.prototype.config>) {
    Object.assign(this.config, config);
  }

  private startListening() {
    timeService.addTickListener((date: Date) => {
      this.onTick(date.getTime());
    });
  }

  private onTick(worldTime: number) {
    if (!this.config.isEnabled) return;
    if (this.isGenerating) return;

    // Check interval
    const intervalMap = {
      low: 1000 * 60 * 60 * 12,    // 12h
      medium: 1000 * 60 * 60 * 6,  // 6h
      high: 1000 * 60 * 60 * 2     // 2h
    };
    const interval = intervalMap[this.config.frequency];

    if (worldTime - this.lastEventTime > interval) {
      // 随机性：不一定每次整点都触发，增加 20% 的随机跳过概率
      if (Math.random() > 0.8) return;
      
      this.generateGlobalEvent(worldTime);
    }
  }

  private async generateGlobalEvent(time: number) {
    this.isGenerating = true;
    try {
      console.log('[Director] Generating global event...');
      
      const prompt = PromptService.getPromptByScene('social.event.generate');
      let systemPrompt = '';
      let userPrompt = '';

      if (prompt) {
        const rendered = PromptService.renderPrompt(prompt, {
          timeContext: new Date(time).toLocaleString(),
          eventType: '随机',
          intensity: '中'
        });
        systemPrompt = rendered.systemPrompt || "你是虚拟世界的导演，负责生成世界背景事件。";
        userPrompt = rendered.userPrompt;
      } else {
        // Fallback
        systemPrompt = "你是虚拟世界的导演，负责生成世界背景事件。";
        userPrompt = `
基于当前世界观：${this.config.worldSetting}
编造一个刚刚发生的突发事件。
可以是科技突破、娱乐八卦、政治丑闻或自然灾害。
不要与主角直接相关，而是作为世界背景新闻。

输出 JSON:
{
  "title": "事件标题",
  "topic": "简短话题关键词 (如 #某事爆发#)",
  "summary": "事件详细描述 (50-100字)",
  "category": "tech|entertainment|politics|disaster|game|life",
  "magnitude": 1-100 (事件影响力),
  "platforms": ["weibo", "bilibili", "zhihu"] (受影响的平台，可选多个)
}
`.trim();
      }

      const result = await AIGenerateService.generate({
        systemPrompt,
        userPrompt
      }, {
        temperature: 0.9
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      let eventData;
      try {
        const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
        eventData = JSON.parse(cleanJson);
      } catch (e) {
        console.error('[Director] Failed to parse event JSON', e);
        return;
      }

      const event: WorldEvent = {
        id: uuidv4(),
        source: 'director',
        topic: eventData.topic || eventData.keyword || eventData.title,
        summary: eventData.summary,
        priority: (eventData.magnitude || eventData.baseScore) > 80 ? 'breaking' : 'normal',
        affectedPlatforms: eventData.platforms || ['weibo'],
        timestamp: time
      };

      // Push to TrendService
      await TrendService.getInstance().createTopicFromEvent(event);
      
      this.lastEventTime = time;
      console.log(`[Director] Event generated: ${event.topic}`);

    } catch (err) {
      console.error('[Director] Error generating event', err);
    } finally {
      this.isGenerating = false;
    }
  }
  
  /**
   * 手动触发事件 (用于测试)
   */
  public async triggerManualEvent() {
    return this.generateGlobalEvent(timeService.getCurrentTime().getTime());
  }
}
