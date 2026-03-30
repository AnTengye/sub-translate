import type { ProviderId, ProviderRuntimeOverrides } from '../../lib/providers/types';
import type { ProviderCenterProfile, ProviderCenterStateData } from './provider-center-api';

export interface ProviderTarget {
  family: ProviderId;
  profileId: string;
  modelId: string;
}

export interface ProviderTargetOption extends ProviderTarget {
  profileName: string;
  providerLabel: string;
  summary: string;
}

function isHealthyProfile(profile: ProviderCenterProfile) {
  return profile.enabled && profile.health.status === 'success';
}

export function getEnabledModels(profile: ProviderCenterProfile) {
  return (profile.models ?? []).filter((model) => model.enabled);
}

function getProfileProviderLabel(profile: ProviderCenterProfile) {
  return profile.settings.providerLabel || profile.family;
}

export function buildProviderTargetOptions(
  providerCenter: ProviderCenterStateData | null,
): ProviderTargetOption[] {
  if (!providerCenter) {
    return [];
  }

  return (Object.keys(providerCenter.families) as ProviderId[]).flatMap((family) =>
    providerCenter.families[family].profiles.flatMap((profile) => {
      if (!isHealthyProfile(profile)) {
        return [];
      }

      return getEnabledModels(profile).map((model) => ({
        family,
        profileId: profile.id,
        modelId: model.id,
        profileName: profile.name,
        providerLabel: getProfileProviderLabel(profile),
        summary: profile.health.summary,
      }));
    }),
  );
}

export function isSameTarget(left: ProviderTarget | null, right: ProviderTarget | null) {
  if (!left || !right) {
    return false;
  }

  return (
    left.family === right.family &&
    left.profileId === right.profileId &&
    left.modelId === right.modelId
  );
}

function isSameProfile(left: ProviderTarget | null, right: ProviderTarget | null) {
  if (!left || !right) {
    return false;
  }

  return left.family === right.family && left.profileId === right.profileId;
}

export function findTargetOption(
  options: ProviderTargetOption[],
  target: ProviderTarget | null,
): ProviderTargetOption | null {
  if (!target) {
    return null;
  }

  return (
    options.find(
      (option) =>
        option.family === target.family &&
        option.profileId === target.profileId &&
        option.modelId === target.modelId,
    ) ?? null
  );
}

function getFamilyDefaultTarget(
  providerCenter: ProviderCenterStateData,
  family: ProviderId,
  options: ProviderTargetOption[],
): ProviderTargetOption | null {
  const familyState = providerCenter.families[family];
  const activeProfile = familyState.profiles.find((profile) => profile.id === familyState.activeProfileId);
  const activeModelId =
    activeProfile?.settings.model ??
    activeProfile?.settings.modelType ??
    (activeProfile ? getEnabledModels(activeProfile)[0]?.id : undefined);

  return (
    options.find(
      (option) =>
        option.family === family &&
        option.profileId === activeProfile?.id &&
        option.modelId === activeModelId,
    ) ??
    options.find((option) => option.family === family) ??
    null
  );
}

export function getDefaultTargets(providerCenter: ProviderCenterStateData | null) {
  const options = buildProviderTargetOptions(providerCenter);
  if (!providerCenter || options.length === 0) {
    return {
      primaryTarget: null,
      fallbackTarget: null,
    };
  }

  const primaryTarget =
    getFamilyDefaultTarget(providerCenter, providerCenter.defaultProvider, options) ?? options[0];
  const fallbackTarget =
    options.find((option) => !isSameProfile(option, primaryTarget)) ?? null;

  return {
    primaryTarget: primaryTarget
      ? {
          family: primaryTarget.family,
          profileId: primaryTarget.profileId,
          modelId: primaryTarget.modelId,
        }
      : null,
    fallbackTarget: fallbackTarget
      ? {
          family: fallbackTarget.family,
          profileId: fallbackTarget.profileId,
          modelId: fallbackTarget.modelId,
        }
      : null,
  };
}

export function ensureDistinctTarget(
  options: ProviderTargetOption[],
  primaryTarget: ProviderTarget | null,
  fallbackTarget: ProviderTarget | null,
) {
  const safePrimary = findTargetOption(options, primaryTarget);
  const safeFallback = findTargetOption(options, fallbackTarget);

  const nextPrimary = safePrimary
    ? { family: safePrimary.family, profileId: safePrimary.profileId, modelId: safePrimary.modelId }
    : null;

  if (!safeFallback || isSameProfile(nextPrimary, safeFallback)) {
    const replacement = options.find((option) => !isSameProfile(nextPrimary, option)) ?? null;
    return {
      primaryTarget: nextPrimary,
      fallbackTarget: replacement
        ? {
            family: replacement.family,
            profileId: replacement.profileId,
            modelId: replacement.modelId,
          }
        : null,
    };
  }

  return {
    primaryTarget: nextPrimary,
    fallbackTarget: {
      family: safeFallback.family,
      profileId: safeFallback.profileId,
      modelId: safeFallback.modelId,
    },
  };
}

export function getProfileByTarget(
  providerCenter: ProviderCenterStateData | null,
  target: ProviderTarget | null,
) {
  if (!providerCenter || !target) {
    return null;
  }

  return (
    providerCenter.families[target.family]?.profiles.find((profile) => profile.id === target.profileId) ?? null
  );
}

export function buildProviderRequestConfig(
  providerCenter: ProviderCenterStateData | null,
  target: ProviderTarget | null,
  temperature: number,
): { provider: ProviderId; profileId: string | null; config: Record<string, string>; runtimeOverrides: ProviderRuntimeOverrides } | null {
  const profile = getProfileByTarget(providerCenter, target);
  if (!target || !profile) {
    return null;
  }

  const config: Record<string, string> = {};
  const runtimeOverrides: ProviderRuntimeOverrides = {};

  if (target.family === 'openai-compatible') {
    config.model = target.modelId;
    config.temperature = String(temperature);
    if (profile.settings.disableThinking) {
      config.disableThinking = profile.settings.disableThinking;
    }
    runtimeOverrides.apiEndpoint = profile.connection.apiEndpoint || undefined;
    runtimeOverrides.apiKey = profile.connection.apiKey || undefined;
    runtimeOverrides.providerLabel = profile.settings.providerLabel || undefined;
  } else if (target.family === 'claude-compatible') {
    config.model = target.modelId;
    runtimeOverrides.apiEndpoint = profile.connection.apiEndpoint || undefined;
    runtimeOverrides.apiKey = profile.connection.apiKey || undefined;
    runtimeOverrides.providerLabel = profile.settings.providerLabel || undefined;
  } else {
    config.modelType = target.modelId;
    ['reference', 'punctuationPreprocessing'].forEach((key) => {
      const value = profile.settings[key];
      if (value) {
        config[key] = value;
      }
    });
    runtimeOverrides.apiEndpoint = profile.connection.apiEndpoint || undefined;
    runtimeOverrides.appId = profile.connection.appId || undefined;
    runtimeOverrides.apiKey = profile.connection.apiKey || undefined;
    runtimeOverrides.secretKey = profile.connection.secretKey || undefined;
  }

  return {
    provider: target.family,
    profileId: profile.id,
    config,
    runtimeOverrides,
  };
}
