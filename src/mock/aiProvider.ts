/**
 * Mock AI Provider
 * 基于 Vercel AI SDK 标准实现的 Mock 模型
 * 
 * 【阶段四重构】
 * - Provider 创建逻辑已迁移到 src/services/ai/providerFactory.ts
 * - 本文件仅保留 Mock 模型实现和响应模板
 * - 用于开发环境下的快速测试
 */

import {
  generateText as vercelGenerateText,
  streamText as vercelStreamText,
} from 'ai';

import type {
  AIProvider,
  GenerateTextOptions,
  GenerateTextResult,
  StreamTextOptions,
  StreamTextResult,
  LanguageModelV1,
  LanguageModelV1StreamPart,
} from '@/types/ai';

// ==================== Mock 响应模板 ====================

export const MOCK_RESPONSES: Record<string, string[]> = {
  'chat.reply': [
    '好的，我明白了！今天天气确实不错呢 ☀️',
    '哈哈，你说得对！我也是这么想的～',
    '嗯嗯，那我们就这么定了！明天见 👋',
    '真的吗？太好了！我超级期待的！',
    '好呀好呀，我这边没问题的～',
  ],
  'chat.new_conversation': [
    '嗨！最近怎么样？好久没聊天了～',
    '哇，你终于上线啦！我正想找你呢！',
    '你好呀！今天有什么开心的事吗？',
    '嘿！看到你上线我就知道有好事要发生了 😄',
  ],
  'live.danmaku': [
    '主播加油！！！',
    '666666',
    '哈哈哈哈笑死我了',
    '这波操作太秀了！',
    '前排留名～',
    '来了来了，终于等到了',
  ],
  'email.compose': [
    '【主题】关于明天的会议安排\n\n尊敬的同事：\n\n明天上午10点将在3号会议室召开项目进度汇报会议，请准时参加。\n\n此致\n敬礼',
    '【主题】项目进度更新\n\n各位好：\n\n本周的开发任务已完成80%，预计下周可以进入测试阶段。详细进度请查看附件。\n\n谢谢！',
  ],
  'browser.article': [
    '【标题】深度解析：人工智能的未来发展\n\n随着技术的不断进步，人工智能正在改变我们的生活方式...',
    '【标题】2024年最值得关注的科技趋势\n\n本文将为您解读今年最热门的科技发展方向...',
  ],
  'moments.post': [
    '今天天气真好！出门晒太阳去～ 🌞',
    '周末愉快！和朋友们一起聚餐 🍜',
    '新买的书终于到了，开心！📚',
  ],
  'forum.post': [
    '【求助】有人知道这个问题怎么解决吗？\n\n具体情况是这样的...',
    '【分享】我的使用心得\n\n用了一段时间后，想和大家分享一下...',
  ],
  'weibo.post': [
    '今天又是元气满满的一天！💪 #每日打卡#',
    '刚刚吃了超好吃的甜点 🍰 推荐给大家！',
    '周末看了一部超棒的电影，强烈推荐！🎬',
    '生活需要仪式感，给自己泡杯茶放松一下 🍵',
  ],
  'weibo.comment': [
    '说得太对了！👍',
    '哈哈哈笑死我了 😂',
    '已收藏，感谢分享！',
    '这个也太棒了吧！',
    '完全同意！',
  ],
  'default': [
    '这是一个模拟的AI响应。',
    '收到您的消息了！',
    '好的，我来处理一下。',
  ],
};

/**
 * 获取随机响应
 */
export function getRandomResponse(scene?: string): string {
  const responses = scene && MOCK_RESPONSES[scene] 
    ? MOCK_RESPONSES[scene] 
    : MOCK_RESPONSES['default'];
  return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * 从提示词推断场景
 */
export function inferSceneFromPrompt(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('reply') || lowerPrompt.includes('回复')) return 'chat.reply';
  if (lowerPrompt.includes('conversation') || lowerPrompt.includes('开场')) return 'chat.new_conversation';
  if (lowerPrompt.includes('danmaku') || lowerPrompt.includes('弹幕')) return 'live.danmaku';
  if (lowerPrompt.includes('email') || lowerPrompt.includes('邮件')) return 'email.compose';
  if (lowerPrompt.includes('article') || lowerPrompt.includes('文章')) return 'browser.article';
  if (lowerPrompt.includes('moments') || lowerPrompt.includes('朋友圈')) return 'moments.post';
  if (lowerPrompt.includes('forum') || lowerPrompt.includes('论坛')) return 'forum.post';
  if (lowerPrompt.includes('weibo') || lowerPrompt.includes('微博')) return 'weibo.post';
  if (lowerPrompt.includes('comment') || lowerPrompt.includes('评论')) return 'weibo.comment';
  
  return 'default';
}

/**
 * 估算 Token 数量
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// ==================== Mock Language Model V1 ====================

/**
 * Mock 语言模型实现
 * 实现 LanguageModelV1 接口，用于开发测试
 * 
 * 注意：此类实现自定义的 LanguageModelV1 接口（见 @/types/ai.ts）
 * 而非 Vercel AI SDK 的 LanguageModel 类型
 */
export class MockLanguageModelV1 implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly defaultObjectGenerationMode = undefined;
  readonly provider: string;
  readonly modelId: string;
  
  // 新版 SDK 需要的属性（可选实现）
  readonly supportedUrls?: undefined;

  constructor(provider: string = 'mock', modelId: string = 'mock-gpt-4') {
    this.provider = provider;
    this.modelId = modelId;
  }

  /**
   * 非流式生成
   */
  async doGenerate(options: any) {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

    const promptText = this.extractPromptText(options.prompt);
    const scene = inferSceneFromPrompt(promptText);
    const text = getRandomResponse(scene);
    const promptTokens = estimateTokens(promptText);
    const completionTokens = estimateTokens(text);
    const timestamp = new Date();

    return {
      text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: 'stop' as const,
      rawCall: { rawPrompt: options.prompt, rawSettings: {} },
      warnings: [],
      response: {
        id: `mock-${timestamp.getTime()}`,
        timestamp,
        modelId: this.modelId,
      }
    };
  }

  /**
   * 流式生成
   */
  async doStream(options: any) {
    const promptText = this.extractPromptText(options.prompt);
    const scene = inferSceneFromPrompt(promptText);
    const fullText = getRandomResponse(scene);
    const promptTokens = estimateTokens(promptText);
    const completionTokens = estimateTokens(fullText);

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      async start(controller) {
        // 模拟首字延迟
        await new Promise(resolve => setTimeout(resolve, 300));

        // 逐字符输出
        for (let i = 0; i < fullText.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 40));
          controller.enqueue({
            type: 'text-delta',
            textDelta: fullText[i],
            text: fullText[i], // 新版 SDK 使用 text
          });
        }

        // 发送完成信号
        controller.enqueue({
          type: 'finish',
          finishReason: 'stop',
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
        });
        
        controller.close();
      }
    });

    return {
      stream,
      rawCall: { rawPrompt: options.prompt, rawSettings: {} },
      warnings: [],
    };
  }

  /**
   * 从 prompt 数组中提取文本
   */
  private extractPromptText(prompt: any[]): string {
    if (!Array.isArray(prompt)) return '';
    return prompt.map((p: any) => 
      p.content?.map?.((c: any) => c.type === 'text' ? c.text : '').join('') || ''
    ).join('\n');
  }
}

// ==================== Provider Implementation ====================

/**
 * 创建 Mock Provider
 */
export function createMockProvider(): AIProvider {
  const models = new Map<string, MockLanguageModelV1>();
  
  return {
    name: 'mock',
    createModel(modelId: string) {
      if (!models.has(modelId)) {
        models.set(modelId, new MockLanguageModelV1('mock', modelId));
      }
      return models.get(modelId)!;
    },
    async listModels() {
      return ['mock-gpt-4', 'mock-claude-3', 'mock-gemini'];
    }
  };
}

// 默认 Provider 实例
const defaultProvider = createMockProvider();

/**
 * 获取 Mock 模型（快捷方法）
 */
export const getMockModel = () => defaultProvider.createModel('mock-gpt-4');

// ==================== Public API ====================

/**
 * 生成文本（非流式）
 * 兼容层：包装 Vercel AI SDK 的 generateText
 */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const commonOptions: any = {
    model: options.model,
    system: options.system,
    maxOutputTokens: options.maxTokens,
    temperature: options.temperature,
    abortSignal: options.abortSignal,
  };

  // 处理 prompt 或 messages
  if (options.messages && options.messages.length > 0) {
    commonOptions.messages = options.messages;
  } else if (options.prompt) {
    commonOptions.prompt = options.prompt;
  }

  return vercelGenerateText(commonOptions);
}

/**
 * 流式生成文本
 * 兼容层：包装 Vercel AI SDK 的 streamText
 */
export async function streamText(options: StreamTextOptions): Promise<StreamTextResult> {
  const commonOptions: any = {
    model: options.model,
    system: options.system,
    maxOutputTokens: options.maxTokens,
    temperature: options.temperature,
    abortSignal: options.abortSignal,
  };

  // 处理 prompt 或 messages
  if (options.messages && options.messages.length > 0) {
    commonOptions.messages = options.messages;
  } else if (options.prompt) {
    commonOptions.prompt = options.prompt;
  }

  const result = await vercelStreamText(commonOptions);

  // 兼容层：处理 onChunk 和 onFinish 回调
  if (options.onChunk || options.onFinish) {
    (async () => {
      try {
        for await (const chunk of result.fullStream) {
          if (chunk.type === 'text-delta') {
            // 新版 SDK 使用 text，旧版使用 textDelta
            const textDelta = (chunk as any).text || (chunk as any).textDelta || '';
            options.onChunk?.({ type: 'text-delta', textDelta });
          } else if (chunk.type === 'finish') {
            // @ts-ignore: usage type mismatch workaround
            const usage = (chunk as any).usage || (chunk as any).totalUsage;
            options.onChunk?.({
              type: 'finish',
              finishReason: chunk.finishReason,
              usage: usage
            });
          }
        }
        options.onFinish?.(result);
      } catch (e) {
        console.error('Error in stream callback:', e);
      }
    })();
  }

  return result;
}

// ==================== 导出工具函数供其他模块使用 ====================

export {
  MOCK_RESPONSES as mockResponses,
};
