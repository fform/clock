import type { MidiMacro } from "@/lib/domain/midi";
import type { Setlist, Song } from "@/lib/domain/project";

const now = () => new Date().toISOString();

export const sampleMacros: MidiMacro[] = [
  {
    id: "macro-soldano",
    name: "Soldano & VOX",
    deviceId: "quad-cortex",
    category: "Presets",
    tags: ["amp", "scene"],
    updatedAt: now(),
    steps: [
      {
        id: "soldano-bank-msb",
        kind: "cc",
        controller: 0,
        value: 0,
        channel: 1,
        description: "Bank select MSB",
      },
      {
        id: "soldano-bank-lsb",
        kind: "cc",
        controller: 32,
        value: 9,
        channel: 1,
        description: "Bank select LSB",
      },
      {
        id: "soldano-program",
        kind: "pc",
        program: 2,
        channel: 1,
        description: "Load preset",
      },
    ],
    notes: "Loads the Soldano/VOX hybrid preset on the Quad Cortex.",
  },
  {
    id: "macro-stomp-mode",
    name: "Enter Stomp mode",
    deviceId: "quad-cortex",
    category: "Modes",
    tags: ["mode"],
    updatedAt: now(),
    steps: [
      {
        id: "stomp-mode",
        kind: "cc",
        controller: 47,
        value: 2,
        channel: 1,
        description: "Switch Quad Cortex to stomp mode",
      },
    ],
  },
  {
    id: "macro-foot-b",
    name: "Trigger Footswitch B",
    deviceId: "quad-cortex",
    category: "Performance",
    tags: ["stomp"],
    updatedAt: now(),
    steps: [
      {
        id: "foot-b",
        kind: "cc",
        controller: 36,
        value: 1,
        channel: 1,
        description: "Activate footswitch B",
      },
    ],
  },
];

export const sampleSongs: Song[] = [
  {
    id: "song-swing-swing",
    title: "Swing Swing",
    key: "G",
    tempo: 128,
    timeSignature: { beatsPerBar: 4, beatUnit: 4 },
    updatedAt: now(),
    macros: [
      { id: "song-swing-swing-step-1", macroId: "macro-soldano", enabled: true },
      { id: "song-swing-swing-step-2", macroId: "macro-stomp-mode", enabled: true },
      { id: "song-swing-swing-step-3", macroId: "macro-foot-b", enabled: true },
    ],
    notes: "Default opening patch with stomp control for the solo.",
  },
  {
    id: "song-boys-of-summer",
    title: "Boys of Summer",
    key: "D#",
    tempo: 115,
    timeSignature: { beatsPerBar: 4, beatUnit: 4 },
    updatedAt: now(),
    macros: [
      { id: "song-boys-step-1", macroId: "macro-soldano", enabled: true },
      { id: "song-boys-step-2", macroId: "macro-stomp-mode", enabled: true },
    ],
  },
];

export const sampleSetlists: Setlist[] = [
  {
    id: "setlist-starlight",
    name: "Starlight",
    description: "Default weekend setlist",
    updatedAt: now(),
    entries: [
      { id: "entry-1", songId: "song-swing-swing" },
      { id: "entry-2", songId: "song-boys-of-summer" },
    ],
  },
];

