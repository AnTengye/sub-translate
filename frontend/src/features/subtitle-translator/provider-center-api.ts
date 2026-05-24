import type { ProviderId } from '../../lib/providers/types';

export interface ProviderCenterModel {
  id: string;
  label: string;
  enabled: boolean;
  source: 'auto' | 'manual' | 'mixed';
  rpmLimit: number;
  rpdLimit: number;
}

export interface ProviderCenterLimits {
  globalRpmLimit: number;
  globalRpdLimit: number;
  rateLimitInterruptThreshold: number;
}

export interface ProviderCenterProfile {
  id: string;
  family: ProviderId;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  connection: Record<string, string>;
  settings: Record<string, string>;
  capabilities: Record<string, boolean>;
  rpmLimit: number;
  rpdLimit: number;
  models: ProviderCenterModel[];
  modelDiscovery: {
    sourceMode: string;
    supportsModelDiscovery: boolean;
    lastCheckedAt: string | null;
    lastStatus: string;
    lastError: string | null;
  };
  health: {
    status: string;
    summary: string;
    lastCheckedAt: string | null;
    error: string | null;
  };
  availableModels?: ProviderCenterModel[];
}

export type ProviderModelAvailabilityStatus = 'available' | 'unavailable' | 'error';

export interface ProviderModelAvailabilityResult {
  status: ProviderModelAvailabilityStatus;
  summary: string;
  error: string | null;
}

export interface ProviderCenterFamily {
  id: ProviderId;
  label: string;
  description: string;
  activeProfileId: string;
  profiles: ProviderCenterProfile[];
}

export interface ProviderCenterStateData {
  version: 1;
  defaultProvider: ProviderId;
  limits: ProviderCenterLimits;
  families: Record<ProviderId, ProviderCenterFamily>;
}

function normalizeProviderCenterState(input: ProviderCenterStateData): ProviderCenterStateData {
  return {
    ...input,
    limits: {
      globalRpmLimit: Number(input.limits?.globalRpmLimit ?? 0),
      globalRpdLimit: Number(input.limits?.globalRpdLimit ?? 0),
      rateLimitInterruptThreshold: Math.max(1, Number(input.limits?.rateLimitInterruptThreshold ?? 3)),
    },
    families: Object.fromEntries(
      (Object.entries(input.families) as [ProviderId, ProviderCenterFamily][]).map(([familyId, family]) => [
        familyId,
        {
          ...family,
          profiles: (Array.isArray(family.profiles) ? family.profiles : []).map((profile) => ({
            ...profile,
            rpmLimit: Number(profile.rpmLimit ?? 0),
            rpdLimit: Number(profile.rpdLimit ?? 0),
            models: Array.isArray(profile.models)
              ? profile.models.map((model) => ({
                  ...model,
                  rpmLimit: Number(model.rpmLimit ?? 0),
                  rpdLimit: Number(model.rpdLimit ?? 0),
                }))
              : [],
            availableModels: Array.isArray(profile.availableModels) ? profile.availableModels : [],
          })),
        },
      ]),
    ) as Record<ProviderId, ProviderCenterFamily>,
  };
}

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

export async function fetchProviderCenterState(): Promise<ProviderCenterStateData> {
  const response = await fetch('/api/provider-center');
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `加载 Provider Center 失败 ${response.status}`);
  }
  return normalizeProviderCenterState(data as ProviderCenterStateData);
}

export async function saveProviderCenterState(
  state: ProviderCenterStateData,
): Promise<ProviderCenterStateData> {
  const response = await fetch('/api/provider-center', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(state),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `保存 Provider Center 失败 ${response.status}`);
  }
  return normalizeProviderCenterState(data as ProviderCenterStateData);
}

export async function checkProviderProfile(
  family: ProviderId,
  profileId: string,
  profile?: ProviderCenterProfile,
): Promise<{ profile: ProviderCenterProfile; status: string; summary: string; error: string | null }> {
  const response = await fetch('/api/provider-center/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ family, profileId, profile }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `连通性检查失败 ${response.status}`);
  }
  return {
    ...(data as { profile: ProviderCenterProfile; status: string; summary: string; error: string | null }),
    profile: normalizeProviderCenterState({
      version: 1,
      defaultProvider: family,
      limits: {
        globalRpmLimit: 0,
        globalRpdLimit: 0,
        rateLimitInterruptThreshold: 3,
      },
      families: {
        [family]: {
          id: family,
          label: '',
          description: '',
          activeProfileId: profileId,
          profiles: [(data as { profile: ProviderCenterProfile }).profile],
        },
      } as Record<ProviderId, ProviderCenterFamily>,
    }).families[family].profiles[0],
  };
}

export async function fetchProviderProfileModelCatalog(
  family: ProviderId,
  profileId: string,
  profile?: ProviderCenterProfile,
): Promise<{ profile: ProviderCenterProfile; models: ProviderCenterModel[]; summary: string }> {
  const response = await fetch('/api/provider-center/models/discover', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ family, profileId, profile }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `模型发现失败 ${response.status}`);
  }
  const normalizedProfile = normalizeProviderCenterState({
    version: 1,
    defaultProvider: family,
    limits: {
      globalRpmLimit: 0,
      globalRpdLimit: 0,
      rateLimitInterruptThreshold: 3,
    },
    families: {
      [family]: {
        id: family,
        label: '',
        description: '',
        activeProfileId: profileId,
        profiles: [(data as { profile: ProviderCenterProfile }).profile],
      },
    } as Record<ProviderId, ProviderCenterFamily>,
  }).families[family].profiles[0];

  return {
    ...(data as { profile: ProviderCenterProfile; models: ProviderCenterModel[]; summary: string }),
    profile: normalizedProfile,
    models: Array.isArray((data as { models?: ProviderCenterModel[] }).models)
      ? (data as { models: ProviderCenterModel[] }).models
      : [],
  };
}

export const discoverProviderProfileModels = fetchProviderProfileModelCatalog;

export async function checkProviderProfileModelAvailability(
  family: ProviderId,
  profileId: string,
  modelId: string,
  profile?: ProviderCenterProfile,
): Promise<ProviderModelAvailabilityResult> {
  const response = await fetch('/api/provider-center/models/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ family, profileId, modelId, profile }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `模型探测失败 ${response.status}`);
  }
  return {
    status: ((data as { status?: ProviderModelAvailabilityStatus }).status ?? 'error') as ProviderModelAvailabilityStatus,
    summary: String((data as { summary?: string }).summary ?? ''),
    error: (data as { error?: string | null }).error ?? null,
  };
}
