import { eventBus } from '@/services/eventBus';
import { loggerService } from '@/services/logger';
import type { TrendingUpdatedEvent } from '@/types/eventBus';
import type { TrendingUpdateEvent } from './types';

export class TrendingEventBridge {
  private readonly callbacks = new Set<(event: TrendingUpdateEvent) => void>();
  private readonly logger = loggerService.child('service:trending:eventBridge');

  subscribe(callback: (event: TrendingUpdateEvent) => void): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  publish(event: TrendingUpdateEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Failed to notify trending callback', error);
      }
    }

    if (event.type === 'topic_created') {
      eventBus.emit('trending:topic:created', {
        platformId: event.platformId,
        topicIds: event.topicIds ?? [],
        timestamp: event.timestamp,
      });
      return;
    }

    if (event.type === 'ranking_updated') {
      const payload: TrendingUpdatedEvent = {
        platformId: event.platformId ?? 'unknown',
        count: event.topicIds?.length ?? 0,
        updatedAt: event.timestamp,
        hasNewTopics: false,
      };
      eventBus.emit('content:trending:updated', payload);
      return;
    }

    if (event.type === 'policy_changed') {
      eventBus.emit('trending:policy:changed', {
        platformId: event.platformId,
        policy: event.policy,
        timestamp: event.timestamp,
      });
    }
  }
}
