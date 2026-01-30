import type { MidiDeviceTemplate, MidiMacro, MidiPartial } from "@/lib/domain/midi";
import type { Setlist, Song } from "@/lib/domain/project";
import type { DisplaySettings, GlobalSettings } from "@/lib/domain/settings";

export type ProjectSlice = {
  projectName: string;
  projectVersion: string;
  setProjectName: (name: string) => void;
  setProjectVersion: (version: string) => void;
};

export type UiSlice = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

export type MidiSlice = {
  macros: MidiMacro[];
  upsertMacro: (macro: MidiMacro) => void;
  createMacro: () => MidiMacro;
  removeMacro: (macroId: string) => void;
  partials: MidiPartial[];
  upsertPartial: (partial: MidiPartial) => void;
  createPartial: () => MidiPartial;
  removePartial: (partialId: string) => void;
};

export type SongSlice = {
  songs: Song[];
  upsertSong: (song: Song) => void;
  createSong: () => Song;
  removeSong: (songId: string) => void;
};

export type SetlistSlice = {
  setlists: Setlist[];
  upsertSetlist: (setlist: Setlist) => void;
  createSetlist: () => Setlist;
  removeSetlist: (setlistId: string) => void;
};

export type TemplateSlice = {
  templates: MidiDeviceTemplate[];
  registerTemplates: (templates: MidiDeviceTemplate[]) => void;
};

export type ConnectionSlice = {
  connectedOutputId?: string;
  setConnectedOutput: (outputId?: string) => void;
};

export type SyncSlice = {
  unsyncedSongIds: string[];
  unsyncedSetlistIds: string[];
  unsyncedMacroIds: string[];
  hasUnsyncedGlobals: boolean;
  hasUnsyncedDisplay: boolean;
  markSongUnsynced: (id: string) => void;
  clearSongUnsynced: (id: string) => void;
  markSetlistUnsynced: (id: string) => void;
  clearSetlistUnsynced: (id: string) => void;
  markMacroUnsynced: (id: string) => void;
  clearMacroUnsynced: (id: string) => void;
  markGlobalsUnsynced: () => void;
  clearGlobalsUnsynced: () => void;
  markDisplayUnsynced: () => void;
  clearDisplayUnsynced: () => void;
  resetUnsyncedState: () => void;
};

export type SettingsSlice = {
  globalSettings: GlobalSettings;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  updateChannelDeviceMap: (channel: number, deviceId: string) => void;
  displaySettings: DisplaySettings;
  updateDisplaySettings: (settings: Partial<DisplaySettings>) => void;
};

export type ClockState = ProjectSlice &
  UiSlice &
  MidiSlice &
  SongSlice &
  SetlistSlice &
  TemplateSlice &
  ConnectionSlice &
  SyncSlice &
  SettingsSlice;

