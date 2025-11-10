import type { MidiDeviceTemplate } from "@/lib/domain/midi";

import { quadCortexTemplate } from "./quad-cortex";

export const DEVICE_TEMPLATES: MidiDeviceTemplate[] = [quadCortexTemplate];

export const templateMap = new Map(
  DEVICE_TEMPLATES.map((template) => [template.id, template]),
);

