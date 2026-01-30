import { PedalCommand, MACRO_SLOT_COUNT, SONG_SLOT_COUNT, SETLIST_SLOT_COUNT, MAX_MACRO_COMMANDS } from "./constants";
import type { PedalBridge } from "./bridge";
import type { MidiMacro, MidiStep, MidiPartial } from "@/lib/domain/midi";
import type { Song, Setlist } from "@/lib/domain/project";
import type { GlobalSettings, DisplaySettings } from "@/lib/domain/settings";

/**
 * Expand a macro's steps, converting partial references into their commands
 */
function expandMacroSteps(steps: MidiStep[], partials: MidiPartial[]): MidiStep[] {
  const expanded: MidiStep[] = [];
  const partialMap = new Map(partials.map((p) => [p.id, p]));

  for (const step of steps) {
    if (step.kind === "partial") {
      const partial = partialMap.get(step.partialId);
      if (partial && partial.commands) {
        console.log(`[Exporter] Expanding partial "${partial.name}" with ${partial.commands.length} commands`);
        // Expand the partial's commands, ensuring each is a valid MidiStep
        for (const command of partial.commands) {
          // Validate that the command has all required fields
          if (command && command.kind && (command.kind === "cc" || command.kind === "pc" || command.kind === "custom")) {
            expanded.push(command as MidiStep);
          }
        }
      } else {
        console.warn(`[Exporter] Partial reference not found or has no commands:`, {
          partialId: step.partialId,
          partialName: step.name,
          foundPartial: !!partial,
          commandCount: partial?.commands.length || 0,
        });
      }
      // If partial not found or has no commands, skip it
    } else {
      expanded.push(step);
    }
  }

  return expanded;
}

/**
 * Export a single MIDI macro to a specific slot on the device
 */
export async function exportMacroToDevice(
  bridge: PedalBridge,
  macro: MidiMacro,
  slotIndex: number,
  partials: MidiPartial[] = [],
): Promise<void> {
  if (slotIndex < 0 || slotIndex >= MACRO_SLOT_COUNT) {
    throw new Error(`Invalid macro slot index: ${slotIndex}. Must be 0-${MACRO_SLOT_COUNT - 1}`);
  }

  // Expand any partial references into their actual commands
  const expandedSteps = expandMacroSteps(macro.steps, partials);
  
  console.log(`[Exporter] Macro "${macro.name}" expansion:`, {
    originalSteps: macro.steps.length,
    expandedSteps: expandedSteps.length,
    steps: expandedSteps.map((s, i) => ({ index: i, kind: s.kind })),
  });

  // If macro has no commands, just clear it and we're done
  if (expandedSteps.length === 0) {
    await bridge.sendJsonCommand({
      cmd: PedalCommand.CLEAR_MACRO,
      index: slotIndex,
    });
    return;
  }

  // Set each MIDI command for ALL slots (including empty ones)
  // This is required for the device to properly track which slots are active
  // NOTE: Matches Walrus firmware - we send commands for all slots, then the name
  for (let slot = 0; slot < MAX_MACRO_COMMANDS; slot++) {
    const step = expandedSteps[slot];
    
    // Build the command payload
    // IMPORTANT: Empty slots need default values matching Walrus firmware
    const command = step ? encodeMidiStepForDevice(step) : {
      type: "-",      // Empty slot marker
      num: 0,         // Or.DEFAULT
      val: 0,         // Dr.DEFAULT
      "midi-ch": 1,   // ir.DEFAULT
    };
    
    await bridge.sendJsonCommand({
      cmd: PedalCommand.SET_MACRO_COMMAND,
      index: slotIndex,
      slot,
      ...command,
    });
  }

  // Set the macro name AFTER all commands (matches Walrus firmware order)
  await bridge.sendJsonCommand({
    cmd: PedalCommand.SET_MACRO_NAME,
    index: slotIndex,
    name: macro.name,
  });
}

/**
 * Export a single song to a specific slot on the device
 */
export async function exportSongToDevice(
  bridge: PedalBridge,
  song: Song,
  slotIndex: number,
): Promise<void> {
  if (slotIndex < 0 || slotIndex >= SONG_SLOT_COUNT) {
    throw new Error(`Invalid song slot index: ${slotIndex}. Must be 0-${SONG_SLOT_COUNT - 1}`);
  }

  // Set song name
  await bridge.sendJsonCommand({
    cmd: PedalCommand.SET_SONG_NAME,
    index: slotIndex,
    name: song.title,
  });

  // Set song parameters using correct field names: 'song' and 'param' (not 'index' and 'key')
  await bridge.sendJsonCommand({
    cmd: PedalCommand.SET_PARAM_VALUE,
    song: slotIndex,
    param: "bpm",
    value: song.tempo,
  });

  const { beatsPerBar, beatUnit } = song.timeSignature || { beatsPerBar: 4, beatUnit: 4 };
  const timeSignatureValue = getTimeSignatureValue(beatsPerBar, beatUnit);
  
  await bridge.sendJsonCommand({
    cmd: PedalCommand.SET_PARAM_VALUE,
    song: slotIndex,
    param: "metro_time_sig",
    value: timeSignatureValue,
  });

  // Set the MIDI macro assignment
  // The device supports ONE macro per song (stored as 'midi_macro')
  // Use -1 for no macro assigned
  // Extract the macro slot index from the macro ID (format: "macro-000", "macro-001", etc.)
  let macroValue = -1;
  if (song.macros.length > 0 && song.macros[0].enabled) {
    const macroId = song.macros[0].macroId;
    const match = macroId.match(/macro-(\d+)/);
    if (match) {
      macroValue = parseInt(match[1], 10);
    }
  }
  
  await bridge.sendJsonCommand({
    cmd: PedalCommand.SET_PARAM_VALUE,
    song: slotIndex,
    param: "midi_macro",
    value: macroValue,
  });
}

/**
 * Export a single setlist to a specific slot on the device
 */
export async function exportSetlistToDevice(
  bridge: PedalBridge,
  setlist: Setlist,
  slotIndex: number,
): Promise<void> {
  if (slotIndex < 0 || slotIndex >= SETLIST_SLOT_COUNT) {
    throw new Error(`Invalid setlist slot index: ${slotIndex}. Must be 0-${SETLIST_SLOT_COUNT - 1}`);
  }

  // Set setlist name
  await bridge.sendJsonCommand({
    cmd: PedalCommand.SET_SETLIST_NAME,
    index: slotIndex,
    name: setlist.name,
  });

  // Set setlist songs
  // The device expects song slot indices (numbers), not IDs
  // Extract indices from song IDs (format: "song-000", "song-001", etc.)
  const songIndices = setlist.entries
    .map((entry) => {
      const match = entry.songId.match(/song-(\d+)/);
      return match ? parseInt(match[1], 10) : -1;
    })
    .filter((index) => index >= 0);
  
  await bridge.sendJsonCommand({
    cmd: "set_setlist_songs" as PedalCommand, // May need to use sections for larger setlists
    index: slotIndex,
    songs: songIndices,
  });
}

/**
 * Export global settings to the device
 */
export async function exportGlobalSettingsToDevice(
  bridge: PedalBridge,
  settings: GlobalSettings,
): Promise<void> {
  const globalValues = unmapGlobalSettings(settings);

  for (const [key, value] of Object.entries(globalValues)) {
    await bridge.sendJsonCommand({
      cmd: PedalCommand.SET_GLOBAL_VAR,
      name: key,
      value,
    });
  }

  // Set jack configurations
  if (settings.jacks) {
    for (const jack of settings.jacks) {
      if (jack.raw) {
        await bridge.sendJsonCommand({
          cmd: PedalCommand.SET_JACK_CONFIG,
          ...jack.raw,
        });
      }
    }
  }
}

/**
 * Export display settings to the device
 */
export async function exportDisplaySettingsToDevice(
  bridge: PedalBridge,
  settings: DisplaySettings,
): Promise<void> {
  const displayValues = unmapDisplaySettings(settings);

  for (const [key, value] of Object.entries(displayValues)) {
    if (value !== undefined) {
      await bridge.sendJsonCommand({
        cmd: PedalCommand.SET_GLOBAL_VAR,
        name: key,
        value,
      });
    }
  }
}

// Helper functions

function encodeMidiStepForDevice(step: MidiStep): Record<string, unknown> {
  switch (step.kind) {
    case "cc":
      return {
        type: "CC",
        "midi-ch": step.channel,
        num: step.controller,
        val: step.value,
      };
    case "pc":
      return {
        type: "PC",
        "midi-ch": step.channel,
        num: step.program,
      };
    case "custom":
      // Custom/sysex commands: encode as raw bytes if possible
      // For now, we'll skip them as the device may not support arbitrary sysex
      console.warn(`[Exporter] Skipping custom/sysex command with ${step.bytes?.length || 0} bytes`);
      return {
        type: undefined,
        "midi-ch": undefined,
        num: undefined,
        val: undefined,
      };
    case "partial":
      // Partials should have been expanded before reaching this function
      throw new Error(`[Exporter] Partial step "${step.name}" was not expanded before encoding. This is a bug.`);
  }
}

function getTimeSignatureValue(beatsPerBar: number, beatUnit: number): number {
  // Map time signatures to device values
  if (beatsPerBar === 2 && beatUnit === 4) return 1;
  if (beatsPerBar === 3 && beatUnit === 4) return 2;
  if (beatsPerBar === 4 && beatUnit === 4) return 3;
  if (beatsPerBar === 6 && beatUnit === 8) return 4;
  return 3; // Default to 4/4
}

function unmapGlobalSettings(settings: GlobalSettings): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  if (settings.metronome) {
    values.met_accent = settings.metronome.accentEnabled ? 2 : 1;
    values.met_division = getDivisionValue(settings.metronome.division);
    values.met_sound = getSoundValue(settings.metronome.sound);
    values.met_volume = settings.metronome.volume;
  }

  if (settings.sync) {
    values.var_sync_io = settings.sync.io === "in" ? 1 : 2;
    values.var_sync_division = getDivisionValue(settings.sync.division);
    values.var_sync_divide_by_2 = settings.sync.clockFrequency === "1x" ? 1 : 2;
  }

  if (settings.tapTempo) {
    values.var_tap_tempo_override = settings.tapTempo.overrideEnabled ? 2 : 1;
  }

  if (settings.midiRouting) {
    values.var_midi_send_clk = settings.midiRouting.sendClock ? 2 : 1;
    values.var_midi_thru_en = settings.midiRouting.thru ? 2 : 1;
    values.var_midi_channel_in = settings.midiRouting.channelIn;
    values.var_midi_threshold = settings.midiRouting.threshold;
    values.var_midi_rx_clk_en = settings.midiRouting.receiveClock ? 2 : 1;
    values.var_midi_clk_thru_en = settings.midiRouting.clockThru ? 2 : 1;
    values.var_midi_clk_pulses = settings.midiRouting.clockPulses;
  }

  if (settings.footswitch) {
    values.footsw_l_tap = getFootswitchValue(settings.footswitch.leftTap);
    values.footsw_l_hold = getFootswitchHoldValue(settings.footswitch.leftHold);
    values.footsw_r_tap = getFootswitchValue(settings.footswitch.rightTap);
    values.footsw_r_hold = getFootswitchHoldValue(settings.footswitch.rightHold);
  }

  return values;
}

function unmapDisplaySettings(settings: DisplaySettings): Record<string, number | undefined> {
  return {
    var_brightness: settings.brightness,
    var_tempo_led_pulses: settings.tempoLedPulses,
    var_display_orientation: getOrientationValue(settings.orientation),
  };
}

function getDivisionValue(division: string): number {
  const lookup: Record<string, number> = { "1/4": 1, ".1/4": 2, "1/4t": 3, "1/8": 4, ".1/8": 5, "1/8t": 6, "1/16": 7 };
  return lookup[division] ?? 1;
}

function getSoundValue(sound: string): number {
  const lookup: Record<string, number> = { "Click": 1, "808": 2, "Clav": 3, "Tri": 4 };
  return lookup[sound] ?? 1;
}

function getFootswitchValue(action: string): number {
  const lookup: Record<string, number> = {
    "None": 0,
    "Next song": 1,
    "Prev song": 2,
    "Next setlist": 3,
    "Prev setlist": 4,
    "Metronome Start/Stop": 5,
    "Tap Tempo": 6,
  };
  return lookup[action] ?? 0;
}

function getFootswitchHoldValue(action: string): number {
  const lookup: Record<string, number> = {
    "None": 0,
    "Next song": 1,
    "Prev song": 2,
    "Next setlist": 3,
    "Prev setlist": 4,
    "Metronome Start/Stop": 5,
  };
  return lookup[action] ?? 0;
}

function getOrientationValue(orientation: number): number {
  const lookup: Record<number, number> = { 0: 0, 90: 1, 180: 2, 270: 3 };
  return lookup[orientation] ?? 0;
}
