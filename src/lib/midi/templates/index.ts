import type { MidiDeviceTemplate } from "@/lib/domain/midi";

import { quadCortexTemplate } from "./quad-cortex";

export const DEVICE_TEMPLATES: MidiDeviceTemplate[] = [quadCortexTemplate];

export const templateMap = new Map(
  DEVICE_TEMPLATES.map((template) => [template.id, template]),
);

export function getAllTemplates(): MidiDeviceTemplate[] {
  return Array.from(templateMap.values());
}

export function getTemplateById(id: string): MidiDeviceTemplate | undefined {
  return templateMap.get(id);
}

// Re-export lazy-loading functions from openmidi-registry
export { loadDeviceList, loadTemplateById, type DeviceInfo } from "./openmidi-registry";

