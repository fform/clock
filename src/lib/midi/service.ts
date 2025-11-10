import type { MidiMacro, MidiStep } from "@/lib/domain/midi";
import { isBrowser } from "@/lib/utils";

export type MidiPortSummary = {
  id: string;
  name: string;
  manufacturer?: string;
};

export type MidiServiceOptions = {
  sysex?: boolean;
};

export class MidiService {
  private subscribers = new Set<(snapshot: MidiPortsSnapshot) => void>();
  private access?: MIDIAccess;
  private outputs = new Map<string, MIDIOutput>();
  private inputs = new Map<string, MIDIInput>();
  private initialized = false;

  constructor(private readonly options: MidiServiceOptions = { sysex: false }) {}

  async initialize() {
    if (this.initialized || !isBrowser) {
      return;
    }

    if (!navigator.requestMIDIAccess) {
      throw new Error("WebMIDI is not available in this browser.");
    }

    this.access = await navigator.requestMIDIAccess({
      sysex: this.options.sysex ?? false,
    });

    this.access.addEventListener("statechange", () => {
      this.refreshPorts();
    });

    this.refreshPorts();
    this.emitPorts();
    this.initialized = true;
  }

  getOutputs(): MidiPortSummary[] {
    return Array.from(this.outputs.values()).map((output) => ({
      id: output.id,
      name: output.name ?? "Unknown output",
      manufacturer: output.manufacturer ?? undefined,
    }));
  }

  getInputs(): MidiPortSummary[] {
    return Array.from(this.inputs.values()).map((input) => ({
      id: input.id,
      name: input.name ?? "Unknown input",
      manufacturer: input.manufacturer ?? undefined,
    }));
  }

  subscribePorts(listener: (snapshot: MidiPortsSnapshot) => void) {
    this.subscribers.add(listener);
    listener(this.snapshotPorts());
    return () => {
      this.subscribers.delete(listener);
    };
  }

  async sendStep(portId: string, step: MidiStep) {
    const output = this.outputs.get(portId);
    if (!output) throw new Error(`Unknown MIDI output: ${portId}`);

    const message = encodeMidiStep(step);
    if (!message) return;

    const send = () => {
      output.send(message);
    };

    if (step.delayMs && step.delayMs > 0) {
      await new Promise((resolve) => {
        setTimeout(() => {
          send();
          resolve(undefined);
        }, step.delayMs);
      });
      return;
    }

    send();
  }

  async sendMacro(portId: string, macro: MidiMacro) {
    for (const step of macro.steps) {
      await this.sendStep(portId, step);
    }
  }

  private refreshPorts() {
    if (!this.access) return;
    this.outputs.clear();
    this.inputs.clear();

    for (const output of this.access.outputs.values()) {
      this.outputs.set(output.id, output);
    }

    for (const input of this.access.inputs.values()) {
      this.inputs.set(input.id, input);
    }

    this.emitPorts();
  }

  private emitPorts() {
    const snapshot = this.snapshotPorts();
    this.subscribers.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn("[MidiService] subscriber errored", error);
      }
    });
  }

  private snapshotPorts(): MidiPortsSnapshot {
    return {
      inputs: this.getInputs(),
      outputs: this.getOutputs(),
    };
  }
}

export type MidiPortsSnapshot = {
  inputs: MidiPortSummary[];
  outputs: MidiPortSummary[];
};

export function encodeMidiStep(step: MidiStep): Uint8Array | undefined {
  switch (step.kind) {
    case "cc": {
      const status = 0xb0 | clampChannel(step.channel);
      return new Uint8Array([status, clampByte(step.controller), clampByte(step.value)]);
    }
    case "pc": {
      const status = 0xc0 | clampChannel(step.channel);
      const bytes = [status, clampByte(step.program)];

      if (step.bank) {
        const msb = step.bank.msb ?? 0;
        const lsb = step.bank.lsb ?? 0;
        return new Uint8Array([
          0xb0 | clampChannel(step.channel),
          0x00,
          clampByte(msb),
          0xb0 | clampChannel(step.channel),
          0x20,
          clampByte(lsb),
          ...bytes,
        ]);
      }

      return new Uint8Array(bytes);
    }
    case "custom": {
      return new Uint8Array(step.bytes.map(clampByte));
    }
    default:
      return undefined;
  }
}

const clampByte = (value: number) => Math.max(0, Math.min(value, 127));
const clampChannel = (channel: number) => clampByte(channel - 1);

