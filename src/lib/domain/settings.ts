export type MetronomeDivision =
  | "1/4"
  | ".1/4"
  | "1/4t"
  | "1/8"
  | ".1/8"
  | "1/8t"
  | "1/16";

export type MetronomeSound = "Click" | "808" | "Clav" | "Tri";

export type MetronomeSettings = {
  accentEnabled: boolean;
  division: MetronomeDivision;
  sound: MetronomeSound;
  volume: number;
};

export type SyncSettings = {
  io: "in" | "out";
  division: MetronomeDivision;
  clockFrequency: "1x" | "2x";
};

export type TapTempoSettings = {
  overrideEnabled: boolean;
};

export type MidiRoutingSettings = {
  sendClock: boolean;
  thru: boolean;
  channelIn: number;
  threshold: number;
  receiveClock: boolean;
  clockThru: boolean;
  clockPulses: number;
};

export type FootswitchSettings = {
  leftTap: string;
  leftHold: string;
  rightTap: string;
  rightHold: string;
};

export type JackConfig = {
  jackNumber: number;
  type: string;
  tempoOutDivision: string;
  tempoOutPolarity: string;
  raw: Record<string, unknown>;
};

export type DisplaySettings = {
  brightness: number;
  tempoLedPulses: number;
  orientation: 0 | 90 | 180 | 270;
};

export type GlobalSettings = {
  metronome: MetronomeSettings;
  sync: SyncSettings;
  tapTempo: TapTempoSettings;
  midiRouting: MidiRoutingSettings;
  footswitch?: FootswitchSettings;
  jacks?: JackConfig[];
  channelDeviceMap?: Record<number, string>; // MIDI channel (1-16) -> device ID
  raw?: Record<string, unknown>;
};

