import { create, type StoreApi } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { sampleMacros, sampleSetlists, sampleSongs } from "@/data/sample-project";
import type { Setlist, Song } from "@/lib/domain/project";
import type { DisplaySettings, GlobalSettings } from "@/lib/domain/settings";
import { DEVICE_TEMPLATES } from "@/lib/midi/templates";

import { createPersistedStorage } from "./storage";
import type {
  ClockState,
  ConnectionSlice,
  MidiSlice,
  ProjectSlice,
  SetlistSlice,
  SongSlice,
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

const createMidiSlice: SliceCreator<MidiSlice> = (set) => ({
  macros: clone(sampleMacros),
  upsertMacro: (macro) =>
    set((state) => {
      const nextMacros = new Map(state.macros.map((item) => [item.id, item]));
      nextMacros.set(macro.id, { ...macro, updatedAt: new Date().toISOString() });
      return { macros: Array.from(nextMacros.values()) };
    }),
  removeMacro: (macroId) =>
    set((state) => ({
      macros: state.macros.filter((macro) => macro.id !== macroId),
      songs: state.songs.map((song) => ({
        ...song,
        macros: song.macros.filter((instance) => instance.macroId !== macroId),
      })),
    })),
});

const createSongSlice: SliceCreator<SongSlice> = (set) => ({
  songs: clone(sampleSongs),
  upsertSong: (song) =>
    set((state) => {
      const byId = new Map<string, Song>(
        state.songs.map((item) => [item.id, item]),
      );
      byId.set(song.id, { ...song, updatedAt: new Date().toISOString() });
      return { songs: Array.from(byId.values()) };
    }),
  removeSong: (songId) =>
    set((state) => ({
      songs: state.songs.filter((song) => song.id !== songId),
      setlists: state.setlists.map((setlist) => ({
        ...setlist,
        entries: setlist.entries.filter((entry) => entry.songId !== songId),
      })),
    })),
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
      return { setlists: Array.from(byId.values()) };
    }),
  removeSetlist: (setlistId) =>
    set((state) => ({
      setlists: state.setlists.filter((setlist) => setlist.id !== setlistId),
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
        raw: {
          ...state.globalSettings.raw,
          ...settings?.raw,
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
export const songsSelector = (state: ClockState) => state.songs;
export const setlistsSelector = (state: ClockState) => state.setlists;
export const templatesSelector = (state: ClockState) => state.templates;
export const connectedOutputSelector = (state: ClockState) =>
  state.connectedOutputId;
export const globalSettingsSelector = (state: ClockState) =>
  state.globalSettings;
export const displaySettingsSelector = (state: ClockState) =>
  state.displaySettings;

export const getMacroById = (macroId: string) => (state: ClockState) =>
  state.macros.find((macro) => macro.id === macroId);

