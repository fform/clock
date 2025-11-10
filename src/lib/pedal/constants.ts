export const MIDI_MANUFACTURER_ID = [0x00];

export const MIDI_PACKET_HEADER = [0xde, 0xad];
export const MIDI_PACKET_JSON_TYPE = 0x02;
export const MIDI_PACKET_MAX_PAYLOAD = 0x100; // 256 bytes

export enum PedalCommand {
  GET_FW_VERSION = "get_fw_version",
  REBOOT_TO_DFU = "reboot",
  GET_SONG_NAME = "get_song_name",
  SET_SONG_NAME = "set_song_name",
  GET_PARAM_NAMES = "get_param_names",
  GET_SONG_DETAILS = "get_song_details",
  GET_PARAM_VALUE = "get_param_value",
  SET_PARAM_VALUE = "set_param_value",
  GET_SETLIST_NAME = "get_setlist_name",
  SET_SETLIST_NAME = "set_setlist_name",
  GET_SETLIST_SONGS_SECTION = "get_setlist_songs_sect",
  GET_SETLIST_SONGS_LEGACY = "get_setlist_songs",
  GET_JACK_CONFIG = "get_jack_cfg",
  SET_JACK_CONFIG = "set_jack_cfg",
  GET_MACRO_MAP = "get_macro_map",
  GET_MACRO_NAME = "get_macro_name",
  SET_MACRO_NAME = "set_macro_name",
  GET_MACRO_LENGTH = "get_macro_length",
  CLEAR_MACRO = "clear_macro",
  GET_MACRO_COMMAND = "get_macro_cmd",
  SET_MACRO_COMMAND = "set_macro_cmd",
  GET_GLOBAL_VAR = "get_global_var",
  SET_GLOBAL_VAR = "set_global_var",
}

export enum PedalResponseType {
  NONE = 0,
  MICRO_FIRMWARE = 1,
  DSP_FIRMWARE = 2,
  IR_SLOT_STATE = 3,
  PRINTF = 4,
  ACK = 5,
  NACK = 6,
  JSON = 100,
  ACK_V2 = 200,
  NACK_V2 = 201,
}

export const SONG_SLOT_COUNT = 128;
export const SETLIST_SLOT_COUNT = 10;
export const MAX_SETLIST_SONGS = 128;
export const SETLIST_SECTION_SIZE = 32;
export const SETLIST_SECTION_COUNT = Math.ceil(
  MAX_SETLIST_SONGS / SETLIST_SECTION_SIZE,
);
export const MACRO_SLOT_COUNT = 128;

export const GLOBAL_BOOLEAN_KEYS = new Set([
  "met_accent",
  "var_midi_send_clk",
  "var_midi_thru_en",
  "var_midi_rx_clk_en",
  "var_midi_clk_thru_en",
  "var_tap_tempo_override",
]);

export const GLOBAL_KEYS = [
  "met_accent",
  "met_division",
  "met_sound",
  "met_volume",
  "var_sync_io",
  "var_sync_division",
  "var_sync_divide_by_2",
  "var_midi_send_clk",
  "var_midi_thru_en",
  "var_midi_channel_in",
  "var_midi_threshold",
  "var_midi_rx_clk_en",
  "var_midi_clk_thru_en",
  "var_midi_clk_pulses",
  "footsw_l_tap",
  "footsw_l_hold",
  "footsw_r_tap",
  "footsw_r_hold",
  "var_tap_tempo_override",
] as const;

export const JACK_PARAM_KEYS = [
  "jack_type",
  "tempo_out_division",
  "tempo_out_polarity",
  "tempo_out_tap_dur",
  "tempo_out_count",
  "cv_out_start",
  "cv_out_end",
  "cv_out_output",
  "cv_out_voltage_start",
  "cv_out_voltage_end",
  "exp_in_control",
  "exp_in_channel",
  "exp_in_heel_down",
  "exp_in_toe_down",
  "switch_in_l_press",
  "switch_in_r_press",
  "switch_in_l_hold",
  "switch_in_r_hold",
] as const;

export const DISPLAY_KEYS = [
  "var_brightness",
  "var_tempo_led_pulses",
  "var_display_orientation",
] as const;

export const METRONOME_DIVISION_LOOKUP: Record<number, string> = {
  1: "1/4",
  2: ".1/4",
  3: "1/4t",
  4: "1/8",
  5: ".1/8",
  6: "1/8t",
  7: "1/16",
};

export const METRONOME_SOUND_LOOKUP: Record<number, string> = {
  1: "Click",
  2: "808",
  3: "Clav",
  4: "Tri",
};

export const SYNC_IO_LOOKUP: Record<number, "in" | "out"> = {
  1: "in",
  2: "out",
};

export const SYNC_DIVISION_LOOKUP = METRONOME_DIVISION_LOOKUP;

export const SYNC_FREQUENCY_LOOKUP: Record<number, string> = {
  1: "1x",
  2: "2x",
};

export const FOOTSWITCH_ACTION_LOOKUP: Record<number, string> = {
  0: "None",
  1: "Next song",
  2: "Prev song",
  3: "Next setlist",
  4: "Prev setlist",
  5: "Metronome Start/Stop",
  6: "Tap Tempo",
};

export const FOOTSWITCH_HOLD_ACTION_LOOKUP: Record<number, string> = {
  0: "None",
  1: "Next song",
  2: "Prev song",
  3: "Next setlist",
  4: "Prev setlist",
  5: "Metronome Start/Stop",
};

export const DISPLAY_ORIENTATION_LOOKUP: Record<number, 0 | 90 | 180 | 270> = {
  0: 0,
  1: 90,
  2: 180,
  3: 270,
};

export const JACK_TYPE_LOOKUP: Record<number, string> = {
  1: "Tempo Out",
  2: "CV Out",
  3: "Exp In",
  4: "Switch In",
};

export const TEMPO_OUT_DIVISION_LOOKUP = METRONOME_DIVISION_LOOKUP;

export const TEMPO_OUT_POLARITY_LOOKUP: Record<number, string> = {
  1: "Open",
  2: "Closed",
  3: "RTS",
  4: "DIG",
  5: "Active 3V",
  6: "Active 5V",
};

export const TIME_SIGNATURE_LOOKUP: Record<number, { beatsPerBar: number; beatUnit: number }> =
  {
    1: { beatsPerBar: 2, beatUnit: 4 },
    2: { beatsPerBar: 3, beatUnit: 4 },
    3: { beatsPerBar: 4, beatUnit: 4 },
    4: { beatsPerBar: 6, beatUnit: 8 },
  };


