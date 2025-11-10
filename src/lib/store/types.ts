import type { MidiDeviceTemplate, MidiMacro } from "@/lib/domain/midi";
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
  removeMacro: (macroId: string) => void;
};

export type SongSlice = {
  songs: Song[];
  upsertSong: (song: Song) => void;
  removeSong: (songId: string) => void;
};

export type SetlistSlice = {
  setlists: Setlist[];
  upsertSetlist: (setlist: Setlist) => void;
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

export type SettingsSlice = {
  globalSettings: GlobalSettings;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
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
  SettingsSlice;

