import type { MidiMacroInstance } from "./midi";

export type TimeSignature = {
  beatsPerBar: number;
  beatUnit: 1 | 2 | 4 | 8 | 16;
};

export type Song = {
  id: string;
  title: string;
  key: string;
  tempo: number;
  timeSignature: TimeSignature;
  macros: MidiMacroInstance[];
  notes?: string;
  updatedAt: string;
};

export type SetlistEntry = {
  id: string;
  songId: string;
  notes?: string;
};

export type Setlist = {
  id: string;
  name: string;
  description?: string;
  entries: SetlistEntry[];
  updatedAt: string;
};

export type ProjectSnapshot = {
  id: string;
  name: string;
  version: string;
  exportedAt?: string;
};

