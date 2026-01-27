import yaml from "js-yaml";
import type {
  MidiDeviceTemplate,
  MidiTemplateCategory,
  MidiTemplateCommand,
  MidiStep,
} from "@/lib/domain/midi";

type OpenMidiYaml = {
  midi_in?: string;
  midi_thru?: string;
  phantom_power?: string;
  midi_clock?: string;
  midi_channel?: {
    instructions?: string;
  };
  pc?: {
    description?: string;
  };
  cc?: Array<{
    name: string;
    value: number;
    description?: string;
    type?: "Parameter" | "System";
    min?: number;
    max?: number;
  }>;
  instructions?: string;
};

export function parseOpenMidiYaml(yamlContent: string): OpenMidiYaml {
  try {
    return yaml.load(yamlContent) as OpenMidiYaml;
  } catch (error) {
    console.error("Failed to parse YAML:", error);
    return {};
  }
}

export function convertYamlToTemplate(
  yamlData: OpenMidiYaml,
  deviceId: string,
  manufacturer: string,
  model: string,
): MidiDeviceTemplate {
  const categories: MidiTemplateCategory[] = [];

  // Create PC category if PC is supported
  if (yamlData.pc?.description) {
    const pcCommands: MidiTemplateCommand[] = [];
    
    // Generate PC commands for programs 0-127
    for (let program = 0; program <= 127; program++) {
      pcCommands.push({
        id: `${deviceId}-pc-${program}`,
        label: `Program ${program}`,
        summary: `PC ${program}`,
        step: {
          id: `${deviceId}-pc-step-${program}`,
          kind: "pc",
          program,
          channel: 1,
        } as MidiStep,
      });
    }

    if (pcCommands.length > 0) {
      categories.push({
        id: "program-change",
        label: "Program Change",
        commands: pcCommands,
      });
    }
  }

  // Group CC commands by type/functionality
  if (yamlData.cc && yamlData.cc.length > 0) {
    const ccByCategory = new Map<string, MidiTemplateCommand[]>();

    yamlData.cc.forEach((cc) => {
      // Determine category based on name patterns
      let categoryId = "controls";
      let categoryLabel = "Controls";

      const nameLower = cc.name.toLowerCase();
      if (nameLower.includes("toggle") || nameLower.includes("bypass") || nameLower.includes("enable")) {
        categoryId = "bypass-toggle";
        categoryLabel = "Bypass / Toggle";
      } else if (nameLower.includes("pedal") || nameLower.includes("expression")) {
        categoryId = "expression";
        categoryLabel = "Expression Pedals";
      } else if (nameLower.includes("volume") || nameLower.includes("level") || nameLower.includes("mix")) {
        categoryId = "levels";
        categoryLabel = "Levels / Mix";
      } else if (nameLower.includes("delay") || nameLower.includes("reverb") || nameLower.includes("time")) {
        categoryId = "time-based";
        categoryLabel = "Time-Based Effects";
      } else if (nameLower.includes("gain") || nameLower.includes("drive") || nameLower.includes("distortion")) {
        categoryId = "gain";
        categoryLabel = "Gain / Drive";
      } else if (nameLower.includes("tempo") || nameLower.includes("tap")) {
        categoryId = "tempo";
        categoryLabel = "Tempo / Timing";
      } else if (nameLower.includes("tuner")) {
        categoryId = "tuner";
        categoryLabel = "Tuner";
      } else if (nameLower.includes("mode") || nameLower.includes("scene") || nameLower.includes("preset")) {
        categoryId = "modes";
        categoryLabel = "Modes / Presets";
      } else if (cc.type === "System") {
        categoryId = "system";
        categoryLabel = "System Commands";
      }

      const min = cc.min ?? 0;
      const max = cc.max ?? 127;

      // For toggle/on-off commands, create two commands (on/off)
      if (
        (nameLower.includes("toggle") || nameLower.includes("on/off") || nameLower.includes("enable")) &&
        (min === 0 && max === 127)
      ) {
        // On command
        const onCommand: MidiTemplateCommand = {
          id: `${deviceId}-cc-${cc.value}-on`,
          label: `${cc.name} (On)`,
          summary: `CC ${cc.value} Value 1-127`,
          step: {
            id: `${deviceId}-cc-${cc.value}-on-step`,
            kind: "cc",
            controller: cc.value,
            value: 127,
            channel: 1,
          } as MidiStep,
        };

        // Off command
        const offCommand: MidiTemplateCommand = {
          id: `${deviceId}-cc-${cc.value}-off`,
          label: `${cc.name} (Off)`,
          summary: `CC ${cc.value} Value 0`,
          step: {
            id: `${deviceId}-cc-${cc.value}-off-step`,
            kind: "cc",
            controller: cc.value,
            value: 0,
            channel: 1,
          } as MidiStep,
        };

        if (!ccByCategory.has(categoryId)) {
          ccByCategory.set(categoryId, []);
        }
        ccByCategory.get(categoryId)!.push(onCommand, offCommand);
      } else {
        // For parameter commands, create commands for min, mid, max values
        const command: MidiTemplateCommand = {
          id: `${deviceId}-cc-${cc.value}`,
          label: cc.name,
          summary: `CC ${cc.value} (${min}-${max})`,
          step: {
            id: `${deviceId}-cc-${cc.value}-step`,
            kind: "cc",
            controller: cc.value,
            value: Math.floor((min + max) / 2), // Default to middle value
            channel: 1,
          } as MidiStep,
        };

        if (!ccByCategory.has(categoryId)) {
          ccByCategory.set(categoryId, []);
        }
        ccByCategory.get(categoryId)!.push(command);
      }
    });

    // Convert map to categories
    ccByCategory.forEach((commands, categoryId) => {
      const categoryLabel = commands[0]?.label.includes("Toggle")
        ? "Bypass / Toggle"
        : commands[0]?.label.includes("Pedal")
          ? "Expression Pedals"
          : commands[0]?.label.includes("Volume")
            ? "Levels / Mix"
            : "Controls";

      categories.push({
        id: categoryId,
        label: categoryLabel,
        commands,
      });
    });
  }

  return {
    id: deviceId,
    manufacturer,
    model,
    description: yamlData.pc?.description || yamlData.instructions || undefined,
    categories,
  };
}
