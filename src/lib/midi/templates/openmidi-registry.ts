import type { MidiDeviceTemplate } from "@/lib/domain/midi";
import { parseOpenMidiYaml, convertYamlToTemplate } from "./openmidi-loader";
import { templateMap } from "./index";

export type DeviceInfo = {
  id: string;
  manufacturer: string;
  model: string;
  hasTemplate: boolean;
};

// Cache for loaded templates
const templateCache = new Map<string, MidiDeviceTemplate>();
const loadingPromises = new Map<string, Promise<MidiDeviceTemplate | null>>();

// Cache for device list
let devicesCache: DeviceInfo[] = [];
let devicesLoadingPromise: Promise<DeviceInfo[]> | null = null;

/**
 * Load the list of available devices (lightweight, no template data)
 */
export async function loadDeviceList(): Promise<DeviceInfo[]> {
  if (devicesCache.length > 0) {
    return devicesCache;
  }

  if (devicesLoadingPromise) {
    return devicesLoadingPromise;
  }

  devicesLoadingPromise = (async () => {
    try {
      const response = await fetch("/api/openmidi/devices");
      if (!response.ok) {
        console.error("Failed to load device list:", response.statusText);
        return [];
      }
      const data = await response.json();
      devicesCache = data.devices || [];
      return devicesCache;
    } catch (error) {
      console.error("Failed to load device list:", error);
      return [];
    } finally {
      devicesLoadingPromise = null;
    }
  })();

  return devicesLoadingPromise;
}

/**
 * Lazy-load a single template by device ID
 */
export async function loadTemplateById(deviceId: string): Promise<MidiDeviceTemplate | null> {
  // Check cache first
  if (templateCache.has(deviceId)) {
    return templateCache.get(deviceId)!;
  }

  // Check if already loading
  if (loadingPromises.has(deviceId)) {
    return loadingPromises.get(deviceId)!;
  }

  // Start loading
  const loadingPromise = (async () => {
    try {
      // Parse device ID to get brand and model
      const [brand, ...modelParts] = deviceId.split("-");
      const model = modelParts.join("-");

      if (!brand || !model) {
        console.error(`Invalid device ID format: ${deviceId}`);
        return null;
      }

      // Fetch the template YAML
      const response = await fetch(`/api/openmidi/template/${brand}/${model}`);
      if (!response.ok) {
        console.warn(`Template not found for ${deviceId}`);
        return null;
      }

      const yamlText = await response.text();
      const yamlData = parseOpenMidiYaml(yamlText);

      // Get device info for manufacturer/model names
      const devices = await loadDeviceList();
      const deviceInfo = devices.find((d) => d.id === deviceId);

      if (!deviceInfo) {
        console.warn(`Device info not found for ${deviceId}`);
        return null;
      }

      const template = convertYamlToTemplate(
        yamlData,
        deviceId,
        deviceInfo.manufacturer,
        deviceInfo.model,
      );

      // Cache the template
      templateCache.set(deviceId, template);
      templateMap.set(deviceId, template);

      return template;
    } catch (error) {
      console.error(`Failed to load template for ${deviceId}:`, error);
      return null;
    } finally {
      loadingPromises.delete(deviceId);
    }
  })();

  loadingPromises.set(deviceId, loadingPromise);
  return loadingPromise;
}

/**
 * Get all cached templates (does not trigger loading)
 */
export function getCachedTemplates(): MidiDeviceTemplate[] {
  return Array.from(templateCache.values());
}

/**
 * Search cached templates by query
 */
export function searchCachedTemplates(query: string): MidiDeviceTemplate[] {
  const lowerQuery = query.toLowerCase();
  return getCachedTemplates().filter(
    (template) =>
      template.manufacturer.toLowerCase().includes(lowerQuery) ||
      template.model.toLowerCase().includes(lowerQuery) ||
      template.id.toLowerCase().includes(lowerQuery),
  );
}

/**
 * @deprecated Use loadDeviceList() and loadTemplateById() instead
 */
export async function loadAllOpenMidiTemplates(): Promise<MidiDeviceTemplate[]> {
  console.warn("loadAllOpenMidiTemplates is deprecated. Use loadDeviceList() and loadTemplateById() instead.");
  return getCachedTemplates();
}
