import type { SharePolicy } from './types';

const DEFAULT_POLICY: SharePolicy = {
  enabled: false,
  allowedConsumers: [],
  excludeCategories: [],
};

export class SharePolicyManager {
  private readonly policies = new Map<string, SharePolicy>();

  setPolicy(platformId: string, policy: SharePolicy): void {
    this.policies.set(platformId, {
      enabled: policy.enabled,
      allowedConsumers: policy.allowedConsumers ?? [],
      excludeCategories: policy.excludeCategories ?? [],
    });
  }

  getPolicy(platformId: string): SharePolicy {
    return this.policies.get(platformId) ?? DEFAULT_POLICY;
  }

  canAccess(platformId: string, requesterAppId: string): boolean {
    const policy = this.getPolicy(platformId);
    if (!policy.enabled) {
      return false;
    }

    return policy.allowedConsumers.includes('*') || policy.allowedConsumers.includes(requesterAppId);
  }

  getPolicies(): Map<string, SharePolicy> {
    return new Map(this.policies);
  }
}
