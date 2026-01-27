import type { MidiDeviceTemplate } from "@/lib/domain/midi";
import { parseOpenMidiYaml, convertYamlToTemplate } from "./openmidi-loader";
import { templateMap } from "./index";

// This will be populated at runtime with all templates from the data folder
let templatesCache: MidiDeviceTemplate[] | null = null;
let loadingPromise: Promise<MidiDeviceTemplate[]> | null = null;

export async function loadAllOpenMidiTemplates(): Promise<MidiDeviceTemplate[]> {
  if (templatesCache) {
    return templatesCache;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      // Fetch mapping.json from public folder (we'll need to copy it there or use an API route)
      // For now, try to fetch from /api/openmidi/mapping or use a static import
      let mapping: { brands: Array<{ name: string; value: string; models: Array<{ name: string; value: string }> }> };
      
      try {
        // Try to fetch from API route first
        const response = await fetch("/api/openmidi/mapping");
        if (response.ok) {
          mapping = await response.json();
        } else {
          // Fallback: try to import directly (won't work for YAML but works for JSON)
          mapping = await import("@/../../data/mapping.json");
        }
      } catch {
        // If that fails, try direct import
        mapping = await import("@/../../data/mapping.json");
      }

      const templates: MidiDeviceTemplate[] = [];

      // Load templates for each device in the mapping
      for (const brand of mapping.brands) {
        for (const model of brand.models) {
          const deviceId = `${brand.value}-${model.value}`;
          
          try {
            // Try to fetch the YAML file from API route
            const yamlResponse = await fetch(`/api/openmidi/template/${brand.value}/${model.value}`);
            if (!yamlResponse.ok) {
              continue; // Skip if file doesn't exist
            }

            const yamlText = await yamlResponse.text();
            const yamlData = parseOpenMidiYaml(yamlText);
            const template = convertYamlToTemplate(yamlData, deviceId, brand.name, model.name);
            
            if (template.categories.length > 0) {
              templates.push(template);
            }
          } catch (error) {
            console.warn(`Failed to load template for ${brand.name} ${model.name}:`, error);
          }
        }
      }

      templatesCache = templates;
      // Also update the main templateMap
      templates.forEach((template) => {
        templateMap.set(template.id, template);
      });
      return templates;
    } catch (error) {
      console.error("Failed to load OpenMIDI templates:", error);
      return [];
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

export function searchTemplates(query: string): MidiDeviceTemplate[] {
  if (!templatesCache) return [];
  
  const lowerQuery = query.toLowerCase();
  return templatesCache.filter(
    (template) =>
      template.manufacturer.toLowerCase().includes(lowerQuery) ||
      template.model.toLowerCase().includes(lowerQuery) ||
      template.id.toLowerCase().includes(lowerQuery),
  );
}
