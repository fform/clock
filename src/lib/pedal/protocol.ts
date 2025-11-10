import {
  MIDI_MANUFACTURER_ID,
  MIDI_PACKET_HEADER,
  MIDI_PACKET_JSON_TYPE,
  MIDI_PACKET_MAX_PAYLOAD,
  PedalResponseType,
} from "./constants";

type SysexSender = (manufacturer: number[], data: number[]) => void;

const HEADER_LENGTH = MIDI_PACKET_HEADER.length + 2; // header bytes + length + type

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function buildJsonPayloadChunks(json: unknown): number[][] {
  const payload = Array.from(
    textEncoder.encode(JSON.stringify(json)),
  );
  return buildPayloadChunks(payload, MIDI_PACKET_JSON_TYPE);
}

export function buildPayloadChunks(
  payload: number[],
  type: number,
): number[][] {
  if (payload.length > MIDI_PACKET_MAX_PAYLOAD) {
    throw new Error(
      `Packet length too large (${payload.length}). Maximum is ${MIDI_PACKET_MAX_PAYLOAD}.`,
    );
  }

  const buffer: number[] = [
    ...MIDI_PACKET_HEADER,
    payload.length ? payload.length - 1 : 0,
    type & 0xff,
    ...payload,
  ];

  while (buffer.length % 4 !== 0) {
    buffer.push(0);
  }

  const chunks: number[][] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    chunks.push(encodeWord(buffer.slice(i, i + 4)));
  }

  return chunks;
}

export async function sendChunks(
  chunks: number[][],
  send: SysexSender,
  interChunkDelay = 1,
): Promise<void> {
  for (let index = 0; index < chunks.length; index += 1) {
    send(MIDI_MANUFACTURER_ID, chunks[index]);
    if (interChunkDelay > 0) {
      await delay(interChunkDelay);
    }
  }
}

export type PedalDecodedMessage =
  | {
      type: "ack";
    }
  | {
      type: "nack";
      code: number;
    }
  | {
      type: "firmware";
      domain: "micro" | "dsp";
      version: string;
    }
  | {
      type: "json";
      payload: unknown;
    }
  | {
      type: "printf";
      message: string;
    }
  | {
      type: "raw";
      payload: number[];
    };

export function decodePedalMessage(
  rawData: Uint8Array | number[],
): PedalDecodedMessage | null {
  let sanitized = sanitizeSysex(Array.from(rawData));

  if (!startsWithHeader(sanitized)) {
    const unpacked = tryUnpackPayload(sanitized);
    if (unpacked) {
      sanitized = unpacked;
    }
  }

  if (sanitized.length < 1) {
    return null;
  }

  let messageType: number | undefined;
  let payloadStart = 0;

  if (startsWithHeader(sanitized) && sanitized.length >= HEADER_LENGTH) {
    messageType = sanitized[HEADER_LENGTH - 1];
    payloadStart = HEADER_LENGTH;
  } else {
    messageType = sanitized[0];
    payloadStart = 1;
  }

  if (typeof messageType !== "number") {
    return null;
  }

  let payload = sanitized.slice(payloadStart);
  if (payload.length && payload[payload.length - 1] === 0) {
    payload = payload.slice(0, -1);
  }

  switch (messageType) {
    case PedalResponseType.ACK:
    case PedalResponseType.ACK_V2:
      return { type: "ack" };
    case PedalResponseType.NACK:
    case PedalResponseType.NACK_V2: {
      const code = payload[0] ?? 0;
      return { type: "nack", code };
    }
    case PedalResponseType.MICRO_FIRMWARE:
    case PedalResponseType.DSP_FIRMWARE: {
      const domain = messageType === PedalResponseType.MICRO_FIRMWARE ? "micro" : "dsp";
      if (payload.length >= 2) {
        const major = payload[0] ?? 0;
        const minor = payload[1] ?? 0;
        return {
          type: "firmware",
          domain,
          version: `${major}.${minor}`,
        };
      }
      break;
    }
    case PedalResponseType.PRINTF: {
      const message = decodeText(payload);
      return { type: "printf", message };
    }
    case PedalResponseType.JSON: {
      const jsonText = decodeText(payload).split("\0")[0] ?? "";
      if (!jsonText.length) {
        return null;
      }
      try {
        return {
          type: "json",
          payload: JSON.parse(jsonText),
        };
      } catch (error) {
        console.warn("[PedalBridge] Failed to parse JSON payload", error, jsonText);
        return null;
      }
    }
    default:
      break;
  }

  const fallbackText = decodeText(payload).trim();
  if (fallbackText.startsWith("{") && fallbackText.endsWith("}")) {
    try {
      return {
        type: "json",
        payload: JSON.parse(fallbackText),
      };
    } catch {
      // ignore parse error
    }
  }

  return {
    type: "raw",
    payload,
  };
}

function encodeWord(bytes: number[]): number[] {
  const padded = [...bytes];
  while (padded.length < 4) {
    padded.push(0);
  }

  let header = 0;
  const output = padded.map((value, index) => {
    if (value & 0x80) {
      header |= 1 << index;
    }
    return value & 0x7f;
  });

  output.push(header);
  return output;
}

function decodeWord(chunk: number[]): number[] {
  if (chunk.length !== 5) {
    return [];
  }

  const header = chunk[4];
  return chunk.slice(0, 4).map((value, index) => {
    if (header & (1 << index)) {
      return value | 0x80;
    }
    return value & 0x7f;
  });
}

function startsWithHeader(bytes: number[]): boolean {
  return (
    bytes.length >= MIDI_PACKET_HEADER.length &&
    MIDI_PACKET_HEADER.every((value, index) => bytes[index] === value)
  );
}

function sanitizeSysex(buffer: number[]): number[] {
  const copy = [...buffer];

  if (copy.length && copy[0] === 0xf0) {
    copy.shift();
  }

  if (copy.length && copy[copy.length - 1] === 0xf7) {
    copy.pop();
  }

  while (copy.length && copy[0] === 0x00) {
    copy.shift();
  }

  return copy;
}

function tryUnpackPayload(buffer: number[]): number[] | null {
  if (buffer.length % 5 !== 0) {
    return null;
  }

  const words: number[] = [];
  for (let i = 0; i < buffer.length; i += 5) {
    const decoded = decodeWord(buffer.slice(i, i + 5));
    if (!decoded.length) {
      return null;
    }
    words.push(...decoded);
  }

  if (!startsWithHeader(words)) {
    return null;
  }

  while (words.length && words[words.length - 1] === 0) {
    words.pop();
  }

  return words;
}

function decodeText(bytes: number[]): string {
  if (!bytes.length) return "";
  return textDecoder.decode(new Uint8Array(bytes));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}


