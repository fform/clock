import { create, type StoreApi } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { sampleMacros, sampleSetlists, sampleSongs } from "@/data/sample-project";
import type { Setlist, Song } from "@/lib/domain/project";
import type { DisplaySettings, GlobalSettings } from "@/lib/domain/settings";
import type { MidiMacro, MidiPartial } from "@/lib/domain/midi";
import { DEVICE_TEMPLATES } from "@/lib/midi/templates";

import { createPersistedStorage } from "./storage";
import type {
  ClockState,
  ConnectionSlice,
  MidiSlice,
  ProjectSlice,
  SetlistSlice,
  SongSlice,
  SyncSlice,
  TemplateSlice,
  UiSlice,
  SettingsSlice,
} from "./types";

type ClockStoreSet = StoreApi<ClockState>["setState"];
type ClockStoreGet = StoreApi<ClockState>["getState"];

type SliceCreator<Slice> = (
  set: ClockStoreSet,
  get: ClockStoreGet,
  api: unknown,
) => Slice;

const clone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const addUnique = (list: string[], id: string | undefined | null) => {
  if (!id) return list;
  return list.includes(id) ? list : [...list, id];
};

const addUniqueMany = (list: string[], ids: string[]) => {
  let next = list;
  ids.forEach((id) => {
    next = addUnique(next, id);
  });
  return next;
};

const removeValue = (list: string[], id: string | undefined | null) => {
  if (!id) return list;
  return list.filter((item) => item !== id);
};

const defaultGlobalSettings: GlobalSettings = {
  metronome: {
    accentEnabled: true,
    division: "1/4",
    sound: "Click",
    volume: 100,
  },
  sync: {
    io: "in",
    division: "1/4",
    clockFrequency: "1x",
  },
  tapTempo: {
    overrideEnabled: false,
  },
  midiRouting: {
    sendClock: true,
    thru: false,
    channelIn: 1,
    threshold: 1,
    receiveClock: false,
    clockThru: false,
    clockPulses: 21,
  },
  footswitch: {
    leftTap: "Next song",
    leftHold: "Prev song",
    rightTap: "Tap Tempo",
    rightHold: "Metronome Start/Stop",
  },
  jacks: [],
  channelDeviceMap: {},
  raw: {},
};

const defaultDisplaySettings: DisplaySettings = {
  brightness: 2,
  tempoLedPulses: 16,
  orientation: 270,
};

const createProjectSlice: SliceCreator<ProjectSlice> = (set) => ({
  projectName: "Pedal Project",
  projectVersion: "v0.1.0",
  setProjectName: (name) =>
    set({ projectName: name }),
  setProjectVersion: (version) =>
    set({ projectVersion: version }),
});

const createUiSlice: SliceCreator<UiSlice> = (set, get) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set({ sidebarCollapsed: !get().sidebarCollapsed }),
});

const createMidiSlice: SliceCreator<MidiSlice> = (set, get) => ({
  macros: clone(sampleMacros),
  upsertMacro: (macro) =>
    set((state) => {
      const nextMacros = new Map(state.macros.map((item) => [item.id, item]));
      nextMacros.set(macro.id, { ...macro, updatedAt: new Date().toISOString() });
      return {
        macros: Array.from(nextMacros.values()),
        unsyncedMacroIds: addUnique(state.unsyncedMacroIds, macro.id),
      };
    }),
  createMacro: () => {
    const newMacro: MidiMacro = {
      id: `macro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: "New Macro",
      steps: [],
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      macros: [...state.macros, newMacro],
      unsyncedMacroIds: addUnique(state.unsyncedMacroIds, newMacro.id),
    }));
    return newMacro;
  },
  removeMacro: (macroId) =>
    set((state) => {
      const affectedSongIds: string[] = [];
      const updatedSongs = state.songs.map((song) => {
        const filteredInstances = song.macros.filter(
          (instance) => instance.macroId !== macroId,
        );
        if (filteredInstances.length !== song.macros.length) {
          affectedSongIds.push(song.id);
        }
        return {
          ...song,
          macros: filteredInstances,
        };
      });

      return {
        macros: state.macros.filter((macro) => macro.id !== macroId),
        songs: updatedSongs,
        unsyncedMacroIds: addUnique(state.unsyncedMacroIds, macroId),
        unsyncedSongIds:
          affectedSongIds.length > 0
            ? addUniqueMany(state.unsyncedSongIds, affectedSongIds)
            : state.unsyncedSongIds,
      };
    }),
  partials: [],
  upsertPartial: (partial) =>
    set((state) => {
      const nextPartials = new Map(state.partials.map((item) => [item.id, item]));
      nextPartials.set(partial.id, { ...partial, updatedAt: new Date().toISOString() });
      return {
        partials: Array.from(nextPartials.values()),
      };
    }),
  createPartial: () => {
    const newPartial: MidiPartial = {
      id: `partial-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: "New Partial",
      commands: [],
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      partials: [...state.partials, newPartial],
    }));
    return newPartial;
  },
  removePartial: (partialId) =>
    set((state) => {
      // Remove the partial and update any macros that reference it
      const updatedMacros = state.macros.map((macro) => ({
        ...macro,
        steps: macro.steps.filter(
          (step) => !(step.kind === "partial" && step.partialId === partialId),
        ),
      }));

      return {
        partials: state.partials.filter((partial) => partial.id !== partialId),
        macros: updatedMacros,
      };
    }),
});

const createSongSlice: SliceCreator<SongSlice> = (set) => ({
  songs: clone(sampleSongs),
  upsertSong: (song) =>
    set((state) => {
      const byId = new Map<string, Song>(
        state.songs.map((item) => [item.id, item]),
      );
      byId.set(song.id, { ...song, updatedAt: new Date().toISOString() });
      return {
        songs: Array.from(byId.values()),
        unsyncedSongIds: addUnique(state.unsyncedSongIds, song.id),
      };
    }),
  createSong: () => {
    const newSong: Song = {
      id: `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: "New Song",
      key: "",
      tempo: 120,
      timeSignature: {
        beatsPerBar: 4,
        beatUnit: 4,
      },
      macros: [],
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      songs: [...state.songs, newSong],
      unsyncedSongIds: addUnique(state.unsyncedSongIds, newSong.id),
    }));
    return newSong;
  },
  removeSong: (songId) =>
    set((state) => {
      const affectedSetlistIds: string[] = [];
      const updatedSetlists = state.setlists.map((setlist) => {
        const filteredEntries = setlist.entries.filter(
          (entry) => entry.songId !== songId,
        );
        if (filteredEntries.length !== setlist.entries.length) {
          affectedSetlistIds.push(setlist.id);
        }
        return {
          ...setlist,
          entries: filteredEntries,
        };
      });
      return {
        songs: state.songs.filter((song) => song.id !== songId),
        setlists: updatedSetlists,
        unsyncedSongIds: addUnique(state.unsyncedSongIds, songId),
        unsyncedSetlistIds:
          affectedSetlistIds.length > 0
            ? addUniqueMany(state.unsyncedSetlistIds, affectedSetlistIds)
            : state.unsyncedSetlistIds,
      };
    }),
});

const createSetlistSlice: SliceCreator<SetlistSlice> = (set) => ({
  setlists: clone(sampleSetlists),
  upsertSetlist: (setlist) =>
    set((state) => {
      const byId = new Map<string, Setlist>(
        state.setlists.map((item) => [item.id, item]),
      );
      byId.set(setlist.id, {
        ...setlist,
        updatedAt: new Date().toISOString(),
      });
      return {
        setlists: Array.from(byId.values()),
        unsyncedSetlistIds: addUnique(state.unsyncedSetlistIds, setlist.id),
      };
    }),
  createSetlist: () => {
    const newSetlist: Setlist = {
      id: `setlist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: "New Setlist",
      description: "",
      entries: [],
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      setlists: [...state.setlists, newSetlist],
      unsyncedSetlistIds: addUnique(state.unsyncedSetlistIds, newSetlist.id),
    }));
    return newSetlist;
  },
  removeSetlist: (setlistId) =>
    set((state) => ({
      setlists: state.setlists.filter((setlist) => setlist.id !== setlistId),
      unsyncedSetlistIds: addUnique(state.unsyncedSetlistIds, setlistId),
    })),
});

const createTemplateSlice: SliceCreator<TemplateSlice> = (set) => ({
  templates: clone(DEVICE_TEMPLATES),
  registerTemplates: (templates) =>
    set((state) => {
      const registry = new Map(state.templates.map((t) => [t.id, t]));
      templates.forEach((template) => {
        registry.set(template.id, template);
      });
      return { templates: Array.from(registry.values()) };
    }),
});

const createConnectionSlice: SliceCreator<ConnectionSlice> = (set) => ({
  connectedOutputId: undefined,
  setConnectedOutput: (outputId) =>
    set({ connectedOutputId: outputId }),
});

const createSyncSlice: SliceCreator<SyncSlice> = (set) => ({
  unsyncedSongIds: [],
  unsyncedSetlistIds: [],
  unsyncedMacroIds: [],
  hasUnsyncedGlobals: false,
  hasUnsyncedDisplay: false,
  markSongUnsynced: (id) => {
    if (!id) return;
    set((state) => ({
      unsyncedSongIds: addUnique(state.unsyncedSongIds, id),
    }));
  },
  clearSongUnsynced: (id) => {
    if (!id) return;
    set((state) => ({
      unsyncedSongIds: removeValue(state.unsyncedSongIds, id),
    }));
  },
  markSetlistUnsynced: (id) => {
    if (!id) return;
    set((state) => ({
      unsyncedSetlistIds: addUnique(state.unsyncedSetlistIds, id),
    }));
  },
  clearSetlistUnsynced: (id) => {
    if (!id) return;
    set((state) => ({
      unsyncedSetlistIds: removeValue(state.unsyncedSetlistIds, id),
    }));
  },
  markMacroUnsynced: (id) => {
    if (!id) return;
    set((state) => ({
      unsyncedMacroIds: addUnique(state.unsyncedMacroIds, id),
    }));
  },
  clearMacroUnsynced: (id) => {
    if (!id) return;
    set((state) => ({
      unsyncedMacroIds: removeValue(state.unsyncedMacroIds, id),
    }));
  },
  markGlobalsUnsynced: () => set({ hasUnsyncedGlobals: true }),
  clearGlobalsUnsynced: () => set({ hasUnsyncedGlobals: false }),
  markDisplayUnsynced: () => set({ hasUnsyncedDisplay: true }),
  clearDisplayUnsynced: () => set({ hasUnsyncedDisplay: false }),
  resetUnsyncedState: () =>
    set({
      unsyncedSongIds: [],
      unsyncedSetlistIds: [],
      unsyncedMacroIds: [],
      hasUnsyncedGlobals: false,
      hasUnsyncedDisplay: false,
    }),
});

const createSettingsSlice: SliceCreator<SettingsSlice> = (set) => ({
  globalSettings: clone(defaultGlobalSettings),
  updateGlobalSettings: (settings) =>
    set((state) => ({
      globalSettings: {
        ...state.globalSettings,
        ...settings,
        metronome: {
          ...state.globalSettings.metronome,
          ...settings?.metronome,
        },
        sync: {
          ...state.globalSettings.sync,
          ...settings?.sync,
        },
        tapTempo: {
          ...state.globalSettings.tapTempo,
          ...settings?.tapTempo,
        },
        midiRouting: {
          ...state.globalSettings.midiRouting,
          ...settings?.midiRouting,
        },
        footswitch: {
          leftTap:
            settings?.footswitch?.leftTap ??
            state.globalSettings.footswitch?.leftTap ??
            defaultGlobalSettings.footswitch!.leftTap,
          leftHold:
            settings?.footswitch?.leftHold ??
            state.globalSettings.footswitch?.leftHold ??
            defaultGlobalSettings.footswitch!.leftHold,
          rightTap:
            settings?.footswitch?.rightTap ??
            state.globalSettings.footswitch?.rightTap ??
            defaultGlobalSettings.footswitch!.rightTap,
          rightHold:
            settings?.footswitch?.rightHold ??
            state.globalSettings.footswitch?.rightHold ??
            defaultGlobalSettings.footswitch!.rightHold,
        },
        jacks: settings?.jacks ?? state.globalSettings.jacks ?? [],
        channelDeviceMap: settings?.channelDeviceMap ?? state.globalSettings.channelDeviceMap,
        raw: {
          ...state.globalSettings.raw,
          ...settings?.raw,
        },
      },
      hasUnsyncedGlobals: true,
    })),
  updateChannelDeviceMap: (channel, deviceId) =>
    set((state) => ({
      globalSettings: {
        ...state.globalSettings,
        channelDeviceMap: {
          ...(state.globalSettings.channelDeviceMap || {}),
          [channel]: deviceId,
        },
      },
    })),
  displaySettings: clone(defaultDisplaySettings),
  updateDisplaySettings: (settings) =>
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        ...settings,
      },
      hasUnsyncedDisplay: true,
    })),
});

const createClockStore = (
  set: ClockStoreSet,
  get: ClockStoreGet,
  api: unknown,
): ClockState => ({
  ...createProjectSlice(set, get, api),
  ...createUiSlice(set, get, api),
  ...createMidiSlice(set, get, api),
  ...createSongSlice(set, get, api),
  ...createSetlistSlice(set, get, api),
  ...createTemplateSlice(set, get, api),
  ...createConnectionSlice(set, get, api),
  ...createSyncSlice(set, get, api),
  ...createSettingsSlice(set, get, api),
});

export const useClockStore = create<ClockState>()(
  devtools(
    persist(
      (set, get, api) => createClockStore(set, get, api),
      {
        name: "canvas-clock",
        version: 1,
        storage: createPersistedStorage<Partial<ClockState>>(),
        partialize: (state): Partial<ClockState> => ({
          projectName: state.projectName,
          projectVersion: state.projectVersion,
          sidebarCollapsed: state.sidebarCollapsed,
          macros: state.macros,
          songs: state.songs,
          setlists: state.setlists,
          connectedOutputId: state.connectedOutputId,
          globalSettings: state.globalSettings,
          displaySettings: state.displaySettings,
          unsyncedSongIds: state.unsyncedSongIds,
          unsyncedSetlistIds: state.unsyncedSetlistIds,
          unsyncedMacroIds: state.unsyncedMacroIds,
          hasUnsyncedGlobals: state.hasUnsyncedGlobals,
          hasUnsyncedDisplay: state.hasUnsyncedDisplay,
        }),
      },
    ),
    { name: "CanvasClockStore" },
  ),
);

export const projectNameSelector = (state: ClockState) => state.projectName;
export const projectVersionSelector = (state: ClockState) =>
  state.projectVersion;
export const sidebarCollapsedSelector = (state: ClockState) =>
  state.sidebarCollapsed;
export const macrosSelector = (state: ClockState) => state.macros;
export const partialsSelector = (state: ClockState) => state.partials;
export const songsSelector = (state: ClockState) => state.songs;
export const setlistsSelector = (state: ClockState) => state.setlists;
export const templatesSelector = (state: ClockState) => state.templates;
export const connectedOutputSelector = (state: ClockState) =>
  state.connectedOutputId;
export const globalSettingsSelector = (state: ClockState) =>
  state.globalSettings;
export const channelDeviceMapSelector = (state: ClockState) =>
  state.globalSettings.channelDeviceMap || {};
export const displaySettingsSelector = (state: ClockState) =>
  state.displaySettings;
export const unsyncedSongIdsSelector = (state: ClockState) =>
  state.unsyncedSongIds;
export const unsyncedSetlistIdsSelector = (state: ClockState) =>
  state.unsyncedSetlistIds;
export const unsyncedMacroIdsSelector = (state: ClockState) =>
  state.unsyncedMacroIds;
export const hasUnsyncedGlobalsSelector = (state: ClockState) =>
  state.hasUnsyncedGlobals;
export const hasUnsyncedDisplaySelector = (state: ClockState) =>
  state.hasUnsyncedDisplay;
export const hasUnsyncedChangesSelector = (state: ClockState) =>
  state.unsyncedSongIds.length > 0 ||
  state.unsyncedSetlistIds.length > 0 ||
  state.unsyncedMacroIds.length > 0 ||
  state.hasUnsyncedGlobals ||
  state.hasUnsyncedDisplay;

export const getMacroById = (macroId: string) => (state: ClockState) =>
  state.macros.find((macro) => macro.id === macroId);

