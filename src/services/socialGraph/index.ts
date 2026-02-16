export {
  SocialGraphError,
  SocialGraphService,
  getSocialGraphService,
  resetSocialGraphService,
} from './socialGraphService'

export type {
  BatchFollowOptions,
  BatchFollowResult,
  BlockOptions,
  FollowOptions,
  FollowRecommendation,
  GraphAccountNode,
  ISocialGraphService,
  MuteOptions,
  RecommendationOptions,
  RecommendationReason,
  RecommendationReasonType,
  RelationshipStats,
  SocialGraphErrorCode,
  SocialGraphEvent,
  SocialGraphEventType,
  SocialGraphPageResult,
  SocialGraphQueryOptions,
  SocialGraphRelation,
  SocialGraphRelationScope,
  SocialGraphRelationStatus,
  SocialGraphRelationType,
} from '@/types/socialGraph'

import { getSocialGraphService } from './socialGraphService'

export const socialGraphService = getSocialGraphService()
