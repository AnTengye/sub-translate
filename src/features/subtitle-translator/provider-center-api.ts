import type { ProviderId } from '../../lib/providers/types';

export interface ProviderCenterModel {
  id: string;
  label: string;
  enabled: boolean;
  source: 'auto' | 'manual' | 'mixed';
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
  families: Record<ProviderId, ProviderCenterFamily>;
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
  return data as ProviderCenterStateData;
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
  return data as ProviderCenterStateData;
}

export async function checkProviderProfile(
  family: ProviderId,
  profileId: string,
): Promise<{ profile: ProviderCenterProfile; status: string; summary: string; error: string | null }> {
  const response = await fetch('/api/provider-center/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ family, profileId }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `连通性检查失败 ${response.status}`);
  }
  return data as { profile: ProviderCenterProfile; status: string; summary: string; error: string | null };
}

export async function fetchProviderProfileModelCatalog(
  family: ProviderId,
  profileId: string,
): Promise<{ profile: ProviderCenterProfile; models: ProviderCenterModel[]; summary: string }> {
  const response = await fetch('/api/provider-center/models/discover', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ family, profileId }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `模型发现失败 ${response.status}`);
  }
  return data as { profile: ProviderCenterProfile; models: ProviderCenterModel[]; summary: string };
}

export const discoverProviderProfileModels = fetchProviderProfileModelCatalog;
