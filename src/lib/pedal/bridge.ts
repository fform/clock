import { isBrowser } from "@/lib/utils";

import {
  MIDI_MANUFACTURER_ID,
  PedalCommand,
  PedalResponseType,
} from "./constants";
import {
  buildJsonPayloadChunks,
  decodePedalMessage,
  sendChunks,
  type PedalDecodedMessage,
} from "./protocol";

type WebMidiModule = typeof import("webmidi");
type WebMidiOutput = import("webmidi").Output;
type WebMidiInput = import("webmidi").Input;
type WebMidiSysexEvent = import("webmidi").MessageEvent;

type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 500;

let webMidiModulePromise: Promise<WebMidiModule> | null = null;

async function loadWebMidiModule(): Promise<WebMidiModule> {
  if (webMidiModulePromise) {
    return webMidiModulePromise;
  }

  if (!isBrowser) {
    throw new Error("WebMIDI is only available in the browser.");
  }

  webMidiModulePromise = import("webmidi");
  return webMidiModulePromise;
}

async function ensureWebMidi(): Promise<WebMidiModule["WebMidi"]> {
  const { WebMidi } = await loadWebMidiModule();
  if (!WebMidi.enabled) {
    await WebMidi.enable({ sysex: true });
  }
  return WebMidi;
}

export type ConnectOptions = {
  preferredName?: string;
};

export type SendOptions = {
  timeoutMs?: number;
  retries?: number;
};

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const shouldLogDebug =
  typeof window !== "undefined" && process.env.NODE_ENV !== "production";

const logDebug = (...args: unknown[]) => {
  if (shouldLogDebug) {
    console.debug("[PedalBridge]", ...args);
  }
};

export class PedalBridge {
  private output?: WebMidiOutput;
  private input?: WebMidiInput;
  private listener?: (event: WebMidiSysexEvent) => void;
  private pending?: PendingRequest;
  private firmwareVersions = new Map<"micro" | "dsp", string>();

  async connect(options: ConnectOptions = {}) {
    const WebMidi = await ensureWebMidi();

    if (!WebMidi.outputs.length) {
      throw new Error("No MIDI outputs detected. Connect the pedal and try again.");
    }

    this.output = this.selectOutput(WebMidi.outputs, options.preferredName);
    if (!this.output) {
      throw new Error("Unable to select a MIDI output for the pedal.");
    }

    this.input = this.selectInput(WebMidi.inputs, this.output.name ?? options.preferredName);

    if (!this.input) {
      throw new Error("Unable to find a matching MIDI input for the pedal.");
    }

    this.attachListener();
  }

  disconnect() {
    this.detachListener();
    this.output = undefined;
    this.input = undefined;
    this.pending?.reject(new Error("Pedal bridge disconnected."));
    this.pending = undefined;
  }

  async sendJsonCommand(body: Record<string, unknown>, options: SendOptions = {}) {
    if (!this.output || !this.input) {
      throw new Error("Pedal is not connected.");
    }

    const retries = options.retries ?? 3;

    logDebug("Outgoing payload", body);

    const commandName =
      typeof body.cmd === "string" ? body.cmd : JSON.stringify(body);

    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const payloadChunks = buildJsonPayloadChunks(body);
        const start = now();
        const timeoutMs =
          options.timeoutMs ??
          Math.max(DEFAULT_TIMEOUT_MS, 1200 + payloadChunks.length * 250);
        logDebug(
          `Sending ${commandName} (attempt ${attempt + 1}/${retries}) with ${
            payloadChunks.length
          } chunk(s). Timeout ${timeoutMs}ms.`,
        );
        const response = await this.sendOnce(payloadChunks, timeoutMs);
        const duration = now() - start;
        logDebug(
          `${commandName} resolved in ${duration.toFixed(1)}ms`,
          response,
        );
        if (
          response &&
          typeof response === "object" &&
          "status" in response &&
          (response as { status?: unknown }).status === "error"
        ) {
          const reason =
            (response as { reason?: string; message?: string }).reason ??
            (response as { message?: string }).message ??
            "Unknown pedal error";
          throw new Error(reason);
        }
        return response;
      } catch (error) {
        lastError = error;
        logDebug(
          `${commandName} failed on attempt ${attempt + 1}/${retries}`,
          error,
        );
        if (attempt < retries - 1) {
          await delay(RETRY_DELAY_MS);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Pedal command failed without a specific error.");
  }

  getFirmwareVersion(domain: "micro" | "dsp") {
    return this.firmwareVersions.get(domain);
  }

  private async sendOnce(chunks: number[][], timeoutMs: number) {
    if (!this.output) {
      throw new Error("Pedal output is unavailable.");
    }

    logDebug(`Queueing ${chunks.length} chunk(s) for transmission.`);

    if (this.pending) {
      this.pending.reject(new Error("Another pedal command is already pending."));
      clearTimeout(this.pending.timeoutId);
      this.pending = undefined;
    }

    return new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pending?.reject) {
          this.pending.reject(new Error(`Pedal response timed out after ${timeoutMs} ms.`));
        }
      }, timeoutMs);

      this.pending = {
        resolve: (payload) => {
          clearTimeout(timeoutId);
          this.pending = undefined;
          resolve(payload);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this.pending = undefined;
          reject(error);
        },
        timeoutId,
      };

      void sendChunks(chunks, (manufacturer, data) => {
        this.output?.sendSysex(manufacturer, data);
      });
    });
  }

  private attachListener() {
    if (!this.input || this.listener) return;

    this.listener = (event: WebMidiSysexEvent) => {
      const message = decodePedalMessage(event.data);
      if (!message) return;

      logDebug("Received message", message);

      this.handleDecodedMessage(message);
    };

    this.input.addListener("sysex", this.listener);
  }

  private detachListener() {
    if (this.input && this.listener) {
      this.input.removeListener("sysex", this.listener);
    }
    this.listener = undefined;
  }

  private handleDecodedMessage(message: PedalDecodedMessage) {
    if (message.type === "firmware") {
      this.firmwareVersions.set(message.domain, message.version);
      return;
    }

    if (message.type === "json") {
      this.pending?.resolve(message.payload);
      return;
    }

    if (message.type === "nack") {
      this.pending?.reject(
        new Error(`Pedal responded with NACK (${message.code ?? "unknown"})`),
      );
      return;
    }

    if (message.type === "ack" || message.type === "printf") {
      // Acknowledgements and printf messages do not resolve the pending promise.
      return;
    }

    if (message.type === "raw") {
      // Handle raw firmware responses that are not caught above
      if (message.payload[2] === PedalResponseType.MICRO_FIRMWARE) {
        const major = message.payload[3] ?? 0;
        const minor = message.payload[4] ?? 0;
        const version = `${major}.${minor}`;
        this.firmwareVersions.set("micro", version);
        return;
      }

      if (message.payload[2] === PedalResponseType.DSP_FIRMWARE) {
        const major = message.payload[3] ?? 0;
        const minor = message.payload[4] ?? 0;
        const version = `${major}.${minor}`;
        this.firmwareVersions.set("dsp", version);
      }
    }
  }

  private selectOutput(
    outputs: WebMidiOutput[],
    preferredName?: string,
  ): WebMidiOutput | undefined {
    if (preferredName) {
      const byName = outputs.find((output) =>
        output.name?.toLowerCase() === preferredName.toLowerCase()
      );
      if (byName) return byName;
    }

    const walrusOutput = outputs.find((output) =>
      output.manufacturer?.toLowerCase().includes("walrus"),
    );
    if (walrusOutput) {
      return walrusOutput;
    }

    const canvasOutput = outputs.find((output) =>
      output.name?.toLowerCase().includes("canvas"),
    );
    if (canvasOutput) {
      return canvasOutput;
    }

    return outputs[0];
  }

  private selectInput(inputs: WebMidiInput[], preferredName?: string) {
    if (preferredName) {
      const byName = inputs.find((input) =>
        input.name?.toLowerCase() === preferredName.toLowerCase()
      );
      if (byName) return byName;
    }

    const walrusInput = inputs.find((input) =>
      input.manufacturer?.toLowerCase().includes("walrus"),
    );
    if (walrusInput) {
      return walrusInput;
    }

    const canvasInput = inputs.find((input) =>
      input.name?.toLowerCase().includes("canvas"),
    );
    if (canvasInput) {
      return canvasInput;
    }

    return inputs[0];
  }
}

export const ensurePedalBridge = async (options?: ConnectOptions) => {
  const bridge = new PedalBridge();
  await bridge.connect(options);
  return bridge;
};

export const getFirmwareFromResponse = (payload: unknown): string | undefined => {
  if (
    payload &&
    typeof payload === "object" &&
    "maj" in payload &&
    "min" in payload &&
    "pat" in payload
  ) {
    const { maj, min, pat } = payload as Record<string, number | string>;
    return `${maj}.${min}.${pat}`;
  }
  return undefined;
};

export const requestFirmwareVersion = async (bridge: PedalBridge) => {
  const response = await bridge.sendJsonCommand({ cmd: PedalCommand.GET_FW_VERSION });
  return getFirmwareFromResponse(response);
};

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}


