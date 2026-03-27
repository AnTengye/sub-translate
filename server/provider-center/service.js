function findProfile(state, family, profileId) {
  const group = state.families[family];
  if (!group) {
    throw new Error(`Unknown provider family: ${family}`);
  }

  const profile = group.profiles.find((item) => item.id === profileId);
  if (!profile) {
    throw new Error(`Unknown provider profile: ${profileId}`);
  }

  return { group, profile };
}

function updateProfile(state, family, profileId, updater) {
  const group = state.families[family];
  return {
    ...state,
    families: {
      ...state.families,
      [family]: {
        ...group,
        profiles: group.profiles.map((profile) =>
          profile.id === profileId ? updater(profile) : profile,
        ),
      },
    },
  };
}

export function createProviderCenterService({ storage, discoverModelsForProfile, checkProfileHealth }) {
  return {
    async read() {
      return storage.read();
    },

    async save(nextState) {
      return storage.write(nextState);
    },

    async getProfile(family, profileId) {
      const state = await storage.read();
      return findProfile(state, family, profileId).profile;
    },

    async discoverModels({ family, profileId }) {
      const state = await storage.read();
      const { profile } = findProfile(state, family, profileId);
      const result = await discoverModelsForProfile(profile);
      const nextState = updateProfile(state, family, profileId, (current) => ({
        ...current,
        availableModels: result.models,
        modelDiscovery: {
          ...current.modelDiscovery,
          lastCheckedAt: new Date().toISOString(),
          lastStatus: 'success',
          lastError: null,
          supportsModelDiscovery: result.supportsModelDiscovery,
        },
      }));

      await storage.write(nextState);
      return {
        profile: nextState.families[family].profiles.find((item) => item.id === profileId),
        models: result.models,
        summary: result.summary,
      };
    },

    async check({ family, profileId }) {
      const state = await storage.read();
      const { profile } = findProfile(state, family, profileId);
      const result = await checkProfileHealth(profile);
      const nextState = updateProfile(state, family, profileId, (current) => ({
        ...current,
        health: {
          ...current.health,
          ...result,
          lastCheckedAt: new Date().toISOString(),
        },
      }));
      await storage.write(nextState);

      return {
        profile: nextState.families[family].profiles.find((item) => item.id === profileId),
        ...result,
      };
    },
  };
}
