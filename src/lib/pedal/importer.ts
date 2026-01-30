import { ensurePedalBridge, requestFirmwareVersion } from "./bridge";
import {
  DISPLAY_KEYS,
  DISPLAY_ORIENTATION_LOOKUP,
  FOOTSWITCH_ACTION_LOOKUP,
  FOOTSWITCH_HOLD_ACTION_LOOKUP,
  GLOBAL_BOOLEAN_KEYS,
  GLOBAL_KEYS,
  JACK_PARAM_KEYS,
  JACK_TYPE_LOOKUP,
  MACRO_SLOT_COUNT,
  METRONOME_DIVISION_LOOKUP,
  METRONOME_SOUND_LOOKUP,
  MIDI_PACKET_MAX_PAYLOAD,
  PedalCommand,
  SETLIST_SECTION_COUNT,
  SETLIST_SLOT_COUNT,
  SONG_SLOT_COUNT,
  SYNC_DIVISION_LOOKUP,
  SYNC_FREQUENCY_LOOKUP,
  SYNC_IO_LOOKUP,
  TEMPO_OUT_DIVISION_LOOKUP,
  TEMPO_OUT_POLARITY_LOOKUP,
  TIME_SIGNATURE_LOOKUP,
} from "./constants";

import type {
  MidiChannel,
  MidiMacro,
  MidiMacroInstance,
  MidiStep,
  MidiPartial,
} from "@/lib/domain/midi";
import type { Setlist, Song, TimeSignature } from "@/lib/domain/project";
import type { DisplaySettings, GlobalSettings } from "@/lib/domain/settings";
import { useClockStore } from "@/lib/store";

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const shouldLogDebug =
  typeof window !== "undefined" && process.env.NODE_ENV !== "production";

const logDebug = (...args: unknown[]) => {
  if (shouldLogDebug) {
    console.debug("[PedalImporter]", ...args);
  }
};

const startTimer = (label: string) => {
  if (!shouldLogDebug) {
    return () => {};
  }
  logDebug(`${label} started.`);
  const start = now();
  return () => {
    const duration = now() - start;
    logDebug(`${label} finished in ${duration.toFixed(1)}ms.`);
  };
};

export type ImportProgress =
  | { stage: "connect" }
  | { stage: "firmware" }
  | { stage: "global"; index: number; total: number }
  | { stage: "display"; index: number; total: number }
  | { stage: "jacks"; index: number; total: number }
  | { stage: "songs"; index: number; total: number }
  | { stage: "setlists"; index: number; total: number }
  | { stage: "macros"; index: number; total: number }
  | { stage: "finalize" };

export type ImportOptions = {
  onProgress?: (progress: ImportProgress) => void;
  preferredDeviceName?: string;
  importAll?: boolean;
};

export type ImportResult = {
  firmwareVersion?: string;
  songs: number;
  macros: number;
  setlists: number;
  warnings: string[];
};

type PedalResponse = {
  status?: "success" | "error";
  reason?: string;
  value?: unknown;
  songs?: number[];
  active_slots?: number[];
  name?: string;
  maj?: number;
  min?: number;
  pat?: number;
  [key: string]: unknown;
};

const DEFAULT_SONG_BPM = 80;
const DEFAULT_TIME_SIGNATURE_ID = 3; // 4/4

const isHttpSuccess = (response: PedalResponse | unknown): response is PedalResponse =>
  !!response && typeof response === "object" && "status" in response;

/**
 * Import only MIDI macros from the pedal
 */
export async function importMacrosFromPedal(importAll = false): Promise<{ macros: MidiMacro[]; warnings: string[] }> {
  const bridge = await ensurePedalBridge();
  const warnings: string[] = [];
  const macros: MidiMacro[] = [];
  let consecutiveDefaults = 0;

  for (let index = 0; index < MACRO_SLOT_COUNT; index += 1) {
    try {
      const nameResponse = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_MACRO_NAME,
        index,
      });

      if (!isHttpSuccess(nameResponse) || nameResponse.status !== "success") {
        continue;
      }

      const mapResponse = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_MACRO_MAP,
        index,
      });

      if (!isHttpSuccess(mapResponse) || mapResponse.status !== "success") {
        continue;
      }

      const activeSlots: number[] = Array.isArray(mapResponse.active_slots)
        ? (mapResponse.active_slots as number[])
        : [];
      const steps: MidiStep[] = [];

      for (const slot of activeSlots) {
        try {
          const commandResponse = await bridge.sendJsonCommand({
            cmd: PedalCommand.GET_MACRO_COMMAND,
            index,
            slot,
          });

          if (isHttpSuccess(commandResponse) && commandResponse.status === "success") {
            const step = mapMidiCommand(commandResponse, index, slot);
            if (step) {
              steps.push(step);
            }
          }
        } catch (error) {
          warnings.push(`Error loading macro ${index + 1} step ${slot + 1}: ${(error as Error).message}`);
        }
      }

      const macro = mapMacroResponse(nameResponse, index, steps);
      const isDefault = macro.steps.length === 0 && isDefaultMacroName(macro.name, index);
      
      if (!isDefault) {
        macros.push(macro);
        consecutiveDefaults = 0;
      } else if (!importAll) {
        consecutiveDefaults++;
        // Stop if we've seen 5 consecutive default macros
        if (consecutiveDefaults >= 5) {
          break;
        }
      } else {
        macros.push(macro);
      }
    } catch (error) {
      warnings.push(`Error loading macro ${index + 1}: ${(error as Error).message}`);
    }
  }

  bridge.disconnect();

  // Replace command sequences with partial references where possible
  const partials = useClockStore.getState().partials;
  const optimizedMacros = macros.map((macro) => replaceWithPartials(macro, partials));

  // Merge with existing macros
  useClockStore.setState((state) => ({
    macros: optimizedMacros,
    unsyncedMacroIds: [],
  }));

  return { macros, warnings };
}

/**
 * Import only songs from the pedal
 */
export async function importSongsFromPedal(importAll = false): Promise<{ songs: Song[]; warnings: string[] }> {
  const bridge = await ensurePedalBridge();
  const warnings: string[] = [];
  const songs: Song[] = [];
  let consecutiveDefaults = 0;

  for (let index = 0; index < SONG_SLOT_COUNT; index += 1) {
    try {
      const response = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_SONG_DETAILS,
        index,
      });

      if (isHttpSuccess(response) && response.status === "success") {
        const song = mapSongResponse(response, index);
        const isUsed = isSongUsed(song);
        
        if (isUsed) {
          songs.push(song);
          consecutiveDefaults = 0;
        } else if (!importAll) {
          consecutiveDefaults++;
          // Stop if we've seen 5 consecutive default songs
          if (consecutiveDefaults >= 5) {
            break;
          }
        } else {
          songs.push(song);
        }
      }
    } catch (error) {
      warnings.push(`Error loading song ${index + 1}: ${(error as Error).message}`);
    }
  }

  bridge.disconnect();

  // Merge with existing songs
  useClockStore.setState((state) => ({
    songs,
    unsyncedSongIds: [],
  }));

  return { songs, warnings };
}

/**
 * Import only setlists from the pedal
 */
export async function importSetlistsFromPedal(importAll = false): Promise<{ setlists: Setlist[]; warnings: string[] }> {
  const bridge = await ensurePedalBridge();
  const warnings: string[] = [];
  const setlists: Setlist[] = [];
  let consecutiveDefaults = 0;

  const firmwareVersion = await requestFirmwareVersion(bridge).catch(() => undefined);

  for (let index = 0; index < SETLIST_SLOT_COUNT; index += 1) {
    try {
      const nameResponse = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_SETLIST_NAME,
        index,
      });

      if (!isHttpSuccess(nameResponse) || nameResponse.status !== "success") {
        continue;
      }

      const songIds = await loadSetlistSongs(bridge, index, firmwareVersion);
      const setlist = mapSetlistResponse(nameResponse, index, songIds);
      const isDefault = setlist.entries.length === 0 && isDefaultSetlistName(setlist.name, index);
      
      if (!isDefault) {
        setlists.push(setlist);
        consecutiveDefaults = 0;
      } else if (!importAll) {
        consecutiveDefaults++;
        // Stop if we've seen 3 consecutive default setlists (fewer slots)
        if (consecutiveDefaults >= 3) {
          break;
        }
      } else {
        setlists.push(setlist);
      }
    } catch (error) {
      warnings.push(`Error loading setlist ${index + 1}: ${(error as Error).message}`);
    }
  }

  bridge.disconnect();

  // Merge with existing setlists
  useClockStore.setState((state) => ({
    setlists,
    unsyncedSetlistIds: [],
  }));

  return { setlists, warnings };
}

/**
 * Import only settings from the pedal
 */
export async function importSettingsFromPedal(): Promise<{ warnings: string[] }> {
  const bridge = await ensurePedalBridge();
  const warnings: string[] = [];
  const globalValues: Record<string, unknown> = {};

  for (const key of GLOBAL_KEYS) {
    try {
      const response = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_GLOBAL_VAR,
        name: key,
      });

      if (isHttpSuccess(response) && response.status === "success") {
        globalValues[key] = normalizeGlobalValue(key, response.value);
      } else {
        warnings.push(`Global setting "${key}" could not be loaded.`);
      }
    } catch (error) {
      warnings.push(`Error loading global setting "${key}": ${(error as Error).message}`);
    }
  }

  const jackConfigs: Array<Record<string, unknown>> = [];
  const JACK_COUNT = 4;

  for (let jackIndex = 0; jackIndex < JACK_COUNT; jackIndex += 1) {
    const config: Record<string, unknown> = { jack_num: jackIndex };

    for (const key of JACK_PARAM_KEYS) {
      try {
        const response = await bridge.sendJsonCommand({
          cmd: PedalCommand.GET_JACK_CONFIG,
          jack: jackIndex,
          param: key,
        });

        if (isHttpSuccess(response) && response.status === "success") {
          config[key] = response.value;
        }
      } catch (error) {
        warnings.push(`Error loading jack ${jackIndex} param "${key}": ${(error as Error).message}`);
      }
    }

    jackConfigs.push(config);
  }

  const displayValues: Record<string, number | undefined> = {};

  for (const key of DISPLAY_KEYS) {
    try {
      const response = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_GLOBAL_VAR,
        name: key,
      });

      if (isHttpSuccess(response) && response.status === "success" && typeof response.value === "number") {
        displayValues[key] = response.value;
      } else {
        warnings.push(`Display setting "${key}" could not be loaded.`);
      }
    } catch (error) {
      warnings.push(`Error loading display setting "${key}": ${(error as Error).message}`);
    }
  }

  bridge.disconnect();

  const globalSettings = mapGlobalSettings(globalValues, jackConfigs);
  const displaySettings = mapDisplaySettings(displayValues);

  useClockStore.setState((state) => ({
    globalSettings: {
      ...state.globalSettings,
      ...globalSettings,
    },
    displaySettings: {
      ...state.displaySettings,
      ...displaySettings,
    },
    hasUnsyncedGlobals: false,
    hasUnsyncedDisplay: false,
  }));

  return { warnings };
}

export async function importProjectFromPedal(
  options: ImportOptions = {},
): Promise<ImportResult> {
  options.onProgress?.({ stage: "connect" });

  const finishImport = startTimer("Entire import");

  const bridge = await ensurePedalBridge({
    preferredName: options.preferredDeviceName,
  });

  const warnings: string[] = [];

  options.onProgress?.({ stage: "firmware" });
  const firmwareVersion = await requestFirmwareVersion(bridge).catch((error) => {
    warnings.push(`Failed to read firmware version: ${(error as Error).message}`);
    return undefined;
  });
  logDebug("Firmware version", firmwareVersion ?? "unknown");

  const globalValues: Record<string, unknown> = {};

  options.onProgress?.({ stage: "global", index: 0, total: GLOBAL_KEYS.length });
  const finishGlobal = startTimer("Global settings");
  for (let index = 0; index < GLOBAL_KEYS.length; index += 1) {
    const key = GLOBAL_KEYS[index];
    options.onProgress?.({ stage: "global", index, total: GLOBAL_KEYS.length });
    try {
      const response = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_GLOBAL_VAR,
        name: key,
      });

      if (isHttpSuccess(response) && response.status === "success") {
        globalValues[key] = normalizeGlobalValue(key, response.value);
      } else {
        warnings.push(`Global setting "${key}" could not be loaded.`);
      }
    } catch (error) {
      warnings.push(
        `Error while loading global setting "${key}": ${(error as Error).message}`,
      );
    }
  }
  finishGlobal();
  logDebug("Global settings snapshot", globalValues);

  const jackConfigs: Array<Record<string, unknown>> = [];
  const JACK_COUNT = 4;

  const finishJacks = startTimer("Jack configuration");
  for (let jackIndex = 0; jackIndex < JACK_COUNT; jackIndex += 1) {
    const config: Record<string, unknown> = { jack_num: jackIndex };

    options.onProgress?.({
      stage: "jacks",
      index: jackIndex,
      total: JACK_COUNT,
    });

    for (const param of JACK_PARAM_KEYS) {
      try {
        const response = await bridge.sendJsonCommand({
          cmd: PedalCommand.GET_JACK_CONFIG,
          jack_num: jackIndex,
          param,
        });

        if (isHttpSuccess(response) && response.status === "success") {
          config[param] = response.value;
        } else {
          warnings.push(`Jack ${jackIndex} parameter "${param}" could not be loaded.`);
        }
      } catch (error) {
        warnings.push(
          `Error while loading jack ${jackIndex} parameter "${param}": ${(error as Error).message}`,
        );
      }
    }

    jackConfigs.push(config);
    logDebug(`Jack ${jackIndex} config`, config);
  }
  finishJacks();

  const displayValues: Record<string, number | undefined> = {};

  const finishDisplay = startTimer("Display settings");
  for (let index = 0; index < DISPLAY_KEYS.length; index += 1) {
    const key = DISPLAY_KEYS[index];
    options.onProgress?.({ stage: "display", index, total: DISPLAY_KEYS.length });
    try {
      const response = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_GLOBAL_VAR,
        name: key,
      });
      if (isHttpSuccess(response) && response.status === "success") {
        displayValues[key] = typeof response.value === "number" ? response.value : undefined;
      } else {
        warnings.push(`Display setting "${key}" could not be loaded.`);
      }
    } catch (error) {
      warnings.push(
        `Error while loading display setting "${key}": ${(error as Error).message}`,
      );
    }
  }
  finishDisplay();
  logDebug("Display settings snapshot", displayValues);

  const songs: Song[] = [];
  const finishSongs = startTimer("Songs");
  let consecutiveDefaultSongs = 0;
  for (let index = 0; index < SONG_SLOT_COUNT; index += 1) {
    options.onProgress?.({ stage: "songs", index, total: SONG_SLOT_COUNT });
    try {
      const response = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_SONG_DETAILS,
        index,
      });

      if (isHttpSuccess(response) && response.status === "success") {
        const song = mapSongResponse(response, index);
        const isUsed = isSongUsed(song);
        
        if (isUsed) {
          songs.push(song);
          consecutiveDefaultSongs = 0;
        } else if (!options.importAll) {
          consecutiveDefaultSongs++;
          if (consecutiveDefaultSongs >= 5) {
            break;
          }
        } else {
          songs.push(song);
        }
      }
    } catch (error) {
      warnings.push(
        `Error while loading song ${index + 1}: ${(error as Error).message}`,
      );
    }
  }
  finishSongs();
  logDebug(`Collected ${songs.length} song(s)`, songs);

  const setlists: Setlist[] = [];
  const finishSetlists = startTimer("Setlists");
  let consecutiveDefaultSetlists = 0;
  for (let index = 0; index < SETLIST_SLOT_COUNT; index += 1) {
    options.onProgress?.({ stage: "setlists", index, total: SETLIST_SLOT_COUNT });
    try {
      const nameResponse = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_SETLIST_NAME,
        index,
      });

      if (!isHttpSuccess(nameResponse) || nameResponse.status !== "success") {
        continue;
      }

      const songIds = await loadSetlistSongs(bridge, index, firmwareVersion);
      const setlist = mapSetlistResponse(nameResponse, index, songIds);
      const isDefault = setlist.entries.length === 0 && isDefaultSetlistName(setlist.name, index);
      
      if (!isDefault) {
        setlists.push(setlist);
        consecutiveDefaultSetlists = 0;
      } else if (!options.importAll) {
        consecutiveDefaultSetlists++;
        if (consecutiveDefaultSetlists >= 3) {
          break;
        }
      } else {
        setlists.push(setlist);
      }
    } catch (error) {
      warnings.push(
        `Error while loading setlist ${index + 1}: ${(error as Error).message}`,
      );
    }
  }
  finishSetlists();
  logDebug(`Collected ${setlists.length} setlist(s)`, setlists);

  const macros: MidiMacro[] = [];
  const finishMacros = startTimer("MIDI macros");
  let consecutiveDefaultMacros = 0;
  for (let index = 0; index < MACRO_SLOT_COUNT; index += 1) {
    options.onProgress?.({ stage: "macros", index, total: MACRO_SLOT_COUNT });
    try {
      const nameResponse = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_MACRO_NAME,
        index,
      });
      if (!isHttpSuccess(nameResponse) || nameResponse.status !== "success") {
        continue;
      }

      const mapResponse = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_MACRO_MAP,
        index,
      });
      if (!isHttpSuccess(mapResponse) || mapResponse.status !== "success") {
        continue;
      }

      const activeSlots = Array.isArray(mapResponse.active_slots)
        ? (mapResponse.active_slots as number[])
        : [];
      const steps: MidiStep[] = [];

      for (const slot of activeSlots) {
        try {
          const commandResponse = await bridge.sendJsonCommand({
            cmd: PedalCommand.GET_MACRO_COMMAND,
            index,
            slot,
          });

          if (isHttpSuccess(commandResponse) && commandResponse.status === "success") {
            const step = mapMidiCommand(commandResponse, index, slot);
            if (step) {
              steps.push(step);
            }
          }
        } catch (error) {
          warnings.push(
            `Error while loading macro ${index + 1} step ${slot + 1}: ${(error as Error).message}`,
          );
        }
      }

      const macro = mapMacroResponse(nameResponse, index, steps);
      const isDefault = macro.steps.length === 0 && isDefaultMacroName(macro.name, index);
      
      if (!isDefault) {
        macros.push(macro);
        consecutiveDefaultMacros = 0;
      } else if (!options.importAll) {
        consecutiveDefaultMacros++;
        if (consecutiveDefaultMacros >= 5) {
          break;
        }
      } else {
        macros.push(macro);
      }
    } catch (error) {
      warnings.push(
        `Error while loading macro ${index + 1}: ${(error as Error).message}`,
      );
    }
  }
  finishMacros();
  logDebug(`Collected ${macros.length} macro(s)`, macros);

  options.onProgress?.({ stage: "finalize" });
  logDebug(
    `Applying import: ${songs.length} song(s), ${setlists.length} setlist(s), ${macros.length} macro(s).`,
  );

  // Replace command sequences with partial references where possible
  const partials = useClockStore.getState().partials;
  const optimizedMacros = macros.map((macro) => replaceWithPartials(macro, partials));

  applyImportToStore({
    firmwareVersion,
    songs,
    macros: optimizedMacros,
    setlists,
    globalValues,
    displayValues,
    jackConfigs,
  });

  finishImport();

  return {
    firmwareVersion,
    songs: songs.length,
    macros: macros.length,
    setlists: setlists.length,
    warnings,
  };
}

function mapSongResponse(response: PedalResponse, index: number): Song {
  const id = `song-${index.toString().padStart(3, "0")}`;
  const title = typeof response.name === "string" && response.name.length > 0
    ? response.name
    : defaultSongName(index);

  const tempo = typeof response.bpm === "number" ? response.bpm : DEFAULT_SONG_BPM;
  const timeSignatureId =
    typeof response.metro_time_sig === "number"
      ? response.metro_time_sig
      : DEFAULT_TIME_SIGNATURE_ID;
  const rawTimeSignature = TIME_SIGNATURE_LOOKUP[timeSignatureId];
  const timeSignature: TimeSignature = rawTimeSignature
    ? {
        beatsPerBar: rawTimeSignature.beatsPerBar,
        beatUnit: rawTimeSignature.beatUnit as TimeSignature["beatUnit"],
      }
    : {
        beatsPerBar: 4,
        beatUnit: 4,
      };

  const macroInstances: MidiMacroInstance[] = [];
  if (typeof response.midi_macro === "number" && response.midi_macro >= 0) {
    const macroId = `macro-${response.midi_macro.toString().padStart(3, "0")}`;
    macroInstances.push({
      id: `${id}-macro-${macroId}`,
      macroId,
      enabled: true,
    });
  }

  return {
    id,
    title,
    key: "",
    tempo,
    timeSignature,
    macros: macroInstances,
    updatedAt: new Date().toISOString(),
  };
}

function mapSetlistResponse(
  response: PedalResponse,
  index: number,
  songIds: number[],
): Setlist {
  const id = `setlist-${index.toString().padStart(2, "0")}`;
  const name = typeof response.name === "string" && response.name.length > 0
    ? response.name
    : defaultSetlistName(index);
  const entries = songIds.map((songIndex, order) => ({
    id: `${id}-entry-${order.toString().padStart(3, "0")}`,
    songId: `song-${songIndex.toString().padStart(3, "0")}`,
  }));

  return {
    id,
    name,
    description: undefined,
    entries,
    updatedAt: new Date().toISOString(),
  };
}

function mapMacroResponse(
  response: PedalResponse,
  index: number,
  steps: MidiStep[],
): MidiMacro {
  const id = `macro-${index.toString().padStart(3, "0")}`;
  const name = typeof response.name === "string" && response.name.length > 0
    ? response.name
    : defaultMacroName(index);

  return {
    id,
    name,
    steps,
    notes: undefined,
    updatedAt: new Date().toISOString(),
  };
}

function mapMidiCommand(
  response: PedalResponse,
  macroIndex: number,
  slot: number,
): MidiStep | null {
  const type = typeof response.type === "string" ? response.type.toUpperCase() : "";
  const channel = clampChannel(typeof response["midi-ch"] === "number" ? response["midi-ch"] : 1);

  if (type === "CC") {
    const controller = clampByte(typeof response.num === "number" ? response.num : 0);
    const value = clampByte(typeof response.val === "number" ? response.val : 0);
    return {
      id: `${macroIndex.toString().padStart(3, "0")}-cc-${slot.toString().padStart(2, "0")}`,
      kind: "cc",
      controller,
      value,
      channel,
    };
  }

  if (type === "PC") {
    const program = clampByte(typeof response.num === "number" ? response.num : 0);
    return {
      id: `${macroIndex.toString().padStart(3, "0")}-pc-${slot.toString().padStart(2, "0")}`,
      kind: "pc",
      program,
      channel,
    };
  }

  return null;
}

async function loadSetlistSongs(
  bridge: Awaited<ReturnType<typeof ensurePedalBridge>>,
  setlistIndex: number,
  firmwareVersion?: string,
): Promise<number[]> {
  const songIndexes: number[] = [];

  if (firmwareVersion && isVersionAtLeast(firmwareVersion, "1.0.2")) {
    for (let section = 1; section <= SETLIST_SECTION_COUNT; section += 1) {
      try {
        const response = await bridge.sendJsonCommand({
          cmd: PedalCommand.GET_SETLIST_SONGS_SECTION,
          index: setlistIndex,
          section,
        });

        if (isHttpSuccess(response) && response.status === "success" && Array.isArray(response.songs)) {
          songIndexes.push(
            ...response.songs.filter((value): value is number => typeof value === "number"),
          );
        }
      } catch (error) {
        console.warn(
          `[PedalImporter] Failed to load setlist ${setlistIndex} section ${section}: ${(error as Error).message}`,
        );
      }
    }
  } else {
    try {
      const response = await bridge.sendJsonCommand({
        cmd: PedalCommand.GET_SETLIST_SONGS_LEGACY,
        index: setlistIndex,
      });

      if (isHttpSuccess(response) && response.status === "success" && Array.isArray(response.songs)) {
        songIndexes.push(
          ...response.songs.filter((value): value is number => typeof value === "number"),
        );
      }
    } catch (error) {
      console.warn(
        `[PedalImporter] Failed to load legacy setlist ${setlistIndex}: ${(error as Error).message}`,
      );
    }
  }

  return songIndexes;
}

function normalizeGlobalValue(key: string, value: unknown): unknown {
  if (GLOBAL_BOOLEAN_KEYS.has(key)) {
    return value === 2 || value === true;
  }
  return value;
}

function applyImportToStore({
  firmwareVersion,
  songs,
  macros,
  setlists,
  globalValues,
  displayValues,
  jackConfigs,
}: {
  firmwareVersion?: string;
  songs: Song[];
  macros: MidiMacro[];
  setlists: Setlist[];
  globalValues: Record<string, unknown>;
  displayValues: Record<string, number | undefined>;
  jackConfigs: Array<Record<string, unknown>>;
}) {
  const projectName = `Pedal Import ${new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })}`;

  const globalSettings = mapGlobalSettings(globalValues, jackConfigs);
  const displaySettings = mapDisplaySettings(displayValues);

  useClockStore.setState((state) => ({
    projectName,
    projectVersion: firmwareVersion ?? state.projectVersion,
    macros,
    songs,
    setlists,
    globalSettings: {
      ...state.globalSettings,
      ...globalSettings,
    },
    displaySettings: {
      ...state.displaySettings,
      ...displaySettings,
    },
    unsyncedSongIds: [],
    unsyncedSetlistIds: [],
    unsyncedMacroIds: [],
    hasUnsyncedGlobals: false,
    hasUnsyncedDisplay: false,
  }));
}

function mapGlobalSettings(
  globalValues: Record<string, unknown>,
  jackConfigs: Array<Record<string, unknown>>,
): Partial<GlobalSettings> {
  const metronomeDivision = mapLookup(globalValues.met_division, METRONOME_DIVISION_LOOKUP, "1/4");
  const metronomeSound = mapLookup(globalValues.met_sound, METRONOME_SOUND_LOOKUP, "Click");
  const syncDivision = mapLookup(globalValues.var_sync_division, SYNC_DIVISION_LOOKUP, "1/4");
  const syncFrequency = mapLookup(globalValues.var_sync_divide_by_2, SYNC_FREQUENCY_LOOKUP, "1x");

  const footswitch = {
    leftTap: mapLookup(globalValues.footsw_l_tap, FOOTSWITCH_ACTION_LOOKUP, "None"),
    leftHold: mapLookup(globalValues.footsw_l_hold, FOOTSWITCH_HOLD_ACTION_LOOKUP, "None"),
    rightTap: mapLookup(globalValues.footsw_r_tap, FOOTSWITCH_ACTION_LOOKUP, "Tap Tempo"),
    rightHold: mapLookup(globalValues.footsw_r_hold, FOOTSWITCH_HOLD_ACTION_LOOKUP, "Metronome Start/Stop"),
  };

  const jacks = jackConfigs.map((config) => ({
    jackNumber: typeof config.jack_num === "number" ? config.jack_num : -1,
    type: mapLookup(config.jack_type, JACK_TYPE_LOOKUP, "Tempo Out"),
    tempoOutDivision: mapLookup(config.tempo_out_division, TEMPO_OUT_DIVISION_LOOKUP, "1/4"),
    tempoOutPolarity: mapLookup(config.tempo_out_polarity, TEMPO_OUT_POLARITY_LOOKUP, "Open"),
    raw: config,
  }));

  return {
    metronome: {
      accentEnabled: Boolean(globalValues.met_accent),
      division: metronomeDivision as GlobalSettings["metronome"]["division"],
      sound: metronomeSound as GlobalSettings["metronome"]["sound"],
      volume: clampByte(Number(globalValues.met_volume ?? 100)),
    },
    sync: {
      io: mapLookup(globalValues.var_sync_io, SYNC_IO_LOOKUP, "in"),
      division: syncDivision as GlobalSettings["sync"]["division"],
      clockFrequency: syncFrequency as GlobalSettings["sync"]["clockFrequency"],
    },
    tapTempo: {
      overrideEnabled: Boolean(globalValues.var_tap_tempo_override),
    },
    midiRouting: {
      sendClock: Boolean(globalValues.var_midi_send_clk),
      thru: Boolean(globalValues.var_midi_thru_en),
      channelIn: clampChannel(Number(globalValues.var_midi_channel_in ?? 1)),
      threshold: clampRange(Number(globalValues.var_midi_threshold ?? 1), 1, 5),
      receiveClock: Boolean(globalValues.var_midi_rx_clk_en),
      clockThru: Boolean(globalValues.var_midi_clk_thru_en),
      clockPulses: clampRange(Number(globalValues.var_midi_clk_pulses ?? 21), 1, 32),
    },
    footswitch,
    jacks,
    raw: globalValues,
  };
}

function mapDisplaySettings(values: Record<string, number | undefined>): Partial<DisplaySettings> {
  return {
    brightness: clampRange(values.var_brightness ?? 5, 1, 10),
    tempoLedPulses: clampRange(values.var_tempo_led_pulses ?? 10, 2, 32),
    orientation: mapLookup(values.var_display_orientation, DISPLAY_ORIENTATION_LOOKUP, 0),
  };
}

function isSongUsed(song: Song): boolean {
  const defaultName = defaultSongName(parseInt(song.id.replace("song-", ""), 10));
  const hasDifferentName = song.title !== defaultName;
  const hasMacros = song.macros.length > 0;
  const hasTempoChange = song.tempo !== DEFAULT_SONG_BPM;
  return hasDifferentName || hasMacros || hasTempoChange;
}

function defaultSongName(index: number) {
  return `Song ${index + 1}`;
}

function defaultSetlistName(index: number) {
  return `Setlist ${index + 1}`;
}

function defaultMacroName(index: number) {
  return `Macro ${index + 1}`;
}

function isDefaultSetlistName(name: string, index: number) {
  return name === defaultSetlistName(index);
}

function isDefaultMacroName(name: string, index: number) {
  return name === defaultMacroName(index);
}

function clampByte(value: number) {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function clampChannel(value: number): MidiChannel {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const clamped = Math.max(1, Math.min(16, Math.round(value)));
  return clamped as MidiChannel;
}

function clampRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function mapLookup<T extends string | number>(
  value: unknown,
  lookup: Record<number, T>,
  fallback: T,
): T {
  if (typeof value === "number" && value in lookup) {
    return lookup[value];
  }
  return fallback;
}

function isVersionAtLeast(current: string, target: string): boolean {
  const currentParts = current.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const targetParts = target.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(currentParts.length, targetParts.length);

  for (let index = 0; index < length; index += 1) {
    const currentValue = currentParts[index] ?? 0;
    const targetValue = targetParts[index] ?? 0;
    if (currentValue > targetValue) return true;
    if (currentValue < targetValue) return false;
  }

  return true;
}

/**
 * Compare two MIDI steps for equality (ignoring IDs)
 */
function stepsEqual(a: MidiStep, b: MidiStep): boolean {
  if (a.kind !== b.kind) return false;
  
  switch (a.kind) {
    case "cc":
      return b.kind === "cc" &&
        a.channel === b.channel &&
        a.controller === b.controller &&
        a.value === b.value;
    case "pc":
      return b.kind === "pc" &&
        a.channel === b.channel &&
        a.program === b.program;
    case "custom":
      return b.kind === "custom" &&
        a.bytes.length === b.bytes.length &&
        a.bytes.every((byte, i) => byte === b.bytes[i]);
    case "partial":
      return b.kind === "partial" && a.partialId === b.partialId;
  }
}

/**
 * Try to replace sequences of commands in a macro with partial references
 */
function replaceWithPartials(macro: MidiMacro, partials: MidiPartial[]): MidiMacro {
  if (partials.length === 0 || macro.steps.length === 0) {
    return macro;
  }

  const optimizedSteps: MidiStep[] = [];
  let i = 0;

  while (i < macro.steps.length) {
    let matched = false;

    // Try to match each partial against the remaining steps
    for (const partial of partials) {
      if (partial.commands.length === 0) continue;
      if (i + partial.commands.length > macro.steps.length) continue;

      // Check if the next N steps match this partial
      const potentialMatch = macro.steps.slice(i, i + partial.commands.length);
      const allMatch = potentialMatch.every((step, idx) =>
        stepsEqual(step, partial.commands[idx])
      );

      if (allMatch) {
        // Replace with a partial reference
        optimizedSteps.push({
          id: `${macro.id}-partial-${i}`,
          kind: "partial",
          partialId: partial.id,
          name: partial.name,
        });
        i += partial.commands.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // No partial matched, keep the original step
      optimizedSteps.push(macro.steps[i]);
      i++;
    }
  }

  return {
    ...macro,
    steps: optimizedSteps,
  };
}

