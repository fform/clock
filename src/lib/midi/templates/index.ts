import type { MidiDeviceTemplate } from "@/lib/domain/midi";

import { quadCortexTemplate } from "./quad-cortex";
import { loadAllOpenMidiTemplates } from "./openmidi-registry";

export const DEVICE_TEMPLATES: MidiDeviceTemplate[] = [quadCortexTemplate];

export const templateMap = new Map(
  DEVICE_TEMPLATES.map((template) => [template.id, template]),
);

// Load OpenMIDI templates asynchronously
let openMidiTemplatesLoaded = false;

export async function loadOpenMidiTemplates(): Promise<MidiDeviceTemplate[]> {
  if (openMidiTemplatesLoaded) {
    return [];
  }
  
  try {
    const templates = await loadAllOpenMidiTemplates();
    templates.forEach((template) => {
      templateMap.set(template.id, template);
    });
    openMidiTemplatesLoaded = true;
    return templates;
  } catch (error) {
    console.error("Failed to load OpenMIDI templates:", error);
    return [];
  }
}

export function getAllTemplates(): MidiDeviceTemplate[] {
  return Array.from(templateMap.values());
}

export function getTemplateById(id: string): MidiDeviceTemplate | undefined {
  return templateMap.get(id);
}

