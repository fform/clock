import type { MidiDeviceTemplate } from "@/lib/domain/midi";

export const quadCortexTemplate: MidiDeviceTemplate = {
  id: "quad-cortex",
  manufacturer: "Neural DSP",
  model: "Quad Cortex",
  description:
    "Preset selection, scene switching, and stomp mode commands for the Quad Cortex.",
  categories: [
    {
      id: "preset-load",
      label: "Preset recall",
      commands: [
        {
          id: "qc-preset-a",
          label: "Load preset (Bank A)",
          summary: "Bank MSB:0 / LSB:0 / Program 0",
          step: {
            id: "qc-bank-a-program-0",
            kind: "pc",
            program: 0,
            channel: 1,
            bank: { msb: 0, lsb: 0 },
          },
        },
        {
          id: "qc-preset-b",
          label: "Load preset (Bank B)",
          summary: "Bank MSB:0 / LSB:9 / Program 0",
          step: {
            id: "qc-bank-b-program-0",
            kind: "pc",
            program: 0,
            channel: 1,
            bank: { msb: 0, lsb: 9 },
          },
        },
      ],
    },
    {
      id: "scene-select",
      label: "Scenes",
      commands: Array.from({ length: 8 }, (_, index) => {
        const value = index;
        return {
          id: `qc-scene-${value}`,
          label: `Scene ${value + 1}`,
          summary: `CC 43 Value ${value}`,
          step: {
            id: `qc-scene-step-${value}`,
            kind: "cc",
            controller: 43,
            value,
            channel: 1,
          },
        };
      }),
    },
    {
      id: "modes",
      label: "Modes",
      commands: [
        {
          id: "qc-mode-stomp",
          label: "Enter Stomp mode",
          summary: "CC 47 Value 2",
          step: {
            id: "qc-stomp-mode",
            kind: "cc",
            controller: 47,
            value: 2,
            channel: 1,
          },
        },
        {
          id: "qc-mode-scene",
          label: "Enter Scene mode",
          summary: "CC 47 Value 1",
          step: {
            id: "qc-scene-mode",
            kind: "cc",
            controller: 47,
            value: 1,
            channel: 1,
          },
        },
      ],
    },
    {
      id: "stomps",
      label: "Stomp switches",
      commands: [
        {
          id: "qc-stomp-a",
          label: "Stomp switch A",
          summary: "CC 36 Value 1",
          step: {
            id: "qc-stomp-a-step",
            kind: "cc",
            controller: 36,
            value: 1,
            channel: 1,
          },
        },
        {
          id: "qc-stomp-b",
          label: "Stomp switch B",
          summary: "CC 37 Value 1",
          step: {
            id: "qc-stomp-b-step",
            kind: "cc",
            controller: 37,
            value: 1,
            channel: 1,
          },
        },
        {
          id: "qc-stomp-c",
          label: "Stomp switch C",
          summary: "CC 38 Value 1",
          step: {
            id: "qc-stomp-c-step",
            kind: "cc",
            controller: 38,
            value: 1,
            channel: 1,
          },
        },
        {
          id: "qc-stomp-d",
          label: "Stomp switch D",
          summary: "CC 39 Value 1",
          step: {
            id: "qc-stomp-d-step",
            kind: "cc",
            controller: 39,
            value: 1,
            channel: 1,
          },
        },
      ],
    },
  ],
};

