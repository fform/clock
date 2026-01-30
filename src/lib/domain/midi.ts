export type MidiChannel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export type MidiStepCommon = {
  id: string;
  label?: string;
  description?: string;
  delayMs?: number;
};

export type MidiCCStep = MidiStepCommon & {
  kind: "cc";
  controller: number;
  value: number;
  channel: MidiChannel;
};

export type MidiPCStep = MidiStepCommon & {
  kind: "pc";
  program: number;
  channel: MidiChannel;
  bank?: {
    msb?: number;
    lsb?: number;
  };
};

export type MidiCustomStep = MidiStepCommon & {
  kind: "custom";
  bytes: number[];
};

export type MidiPartialStep = MidiStepCommon & {
  kind: "partial";
  partialId: string;
  name: string; // Cached name for display
};

export type MidiStep = MidiCCStep | MidiPCStep | MidiCustomStep | MidiPartialStep;

// A reusable named group of MIDI commands
export type MidiPartial = {
  id: string;
  name: string;
  description?: string;
  commands: (MidiCCStep | MidiPCStep | MidiCustomStep)[]; // Only raw commands, no nested partials
  deviceId?: string; // Optional - which device this is for
  tags?: string[]; // For categorization/search
  updatedAt: string;
};

export type MidiMacro = {
  id: string;
  name: string;
  deviceId?: string; // Deprecated: use channelDeviceMap instead
  channelDeviceMap?: Record<MidiChannel, string>; // Maps channel number to device ID
  category?: string;
  tags?: string[];
  steps: MidiStep[];
  notes?: string;
  updatedAt: string;
};

export type MidiMacroInstance = {
  id: string;
  macroId: string;
  label?: string;
  enabled: boolean;
};

export type MidiTemplateCommand = {
  id: string;
  label: string;
  summary?: string;
  step: MidiStep;
};

export type MidiTemplateCategory = {
  id: string;
  label: string;
  commands: MidiTemplateCommand[];
};

export type MidiDeviceTemplate = {
  id: string;
  manufacturer: string;
  model: string;
  description?: string;
  categories: MidiTemplateCategory[];
};

