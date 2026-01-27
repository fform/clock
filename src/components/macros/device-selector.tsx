"use client";

import { useMemo, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useClockStore } from "@/lib/store";
import { getRecentDevices, addRecentDevice } from "@/lib/midi/templates/recent-devices";
import { getAllTemplates, getTemplateById } from "@/lib/midi/templates";
import { loadOpenMidiTemplates } from "@/lib/midi/templates";
import type { MidiDeviceTemplate } from "@/lib/domain/midi";

type DeviceSelectorProps = {
  value?: string;
  onChange: (deviceId: string | undefined) => void;
  className?: string;
};

export function DeviceSelector({ value, onChange, className }: DeviceSelectorProps) {
  const templates = useClockStore((state) => state.templates);
  const registerTemplates = useClockStore((state) => state.registerTemplates);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [allTemplates, setAllTemplates] = useState<MidiDeviceTemplate[]>(templates);
  const recentDeviceIds = useMemo(() => getRecentDevices(), []);

  // Load OpenMIDI templates on mount
  useEffect(() => {
    let mounted = true;
    
    async function loadTemplates() {
      setIsLoading(true);
      try {
        const openMidiTemplates = await loadOpenMidiTemplates();
        if (mounted) {
          registerTemplates(openMidiTemplates);
          setAllTemplates(getAllTemplates());
        }
      } catch (error) {
        console.error("Failed to load templates:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadTemplates();

    return () => {
      mounted = false;
    };
  }, [registerTemplates]);

  // Update allTemplates when store templates change
  useEffect(() => {
    setAllTemplates(getAllTemplates());
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return allTemplates;
    }

    const query = searchQuery.toLowerCase();
    return allTemplates.filter(
      (template) =>
        template.manufacturer.toLowerCase().includes(query) ||
        template.model.toLowerCase().includes(query) ||
        template.id.toLowerCase().includes(query),
    );
  }, [allTemplates, searchQuery]);

  // Separate recent and other templates
  const recentTemplates = useMemo(() => {
    return recentDeviceIds
      .map((id) => getTemplateById(id))
      .filter((t): t is MidiDeviceTemplate => t !== undefined);
  }, [recentDeviceIds]);

  const otherTemplates = useMemo(() => {
    const recentIds = new Set(recentDeviceIds);
    return filteredTemplates.filter((t) => !recentIds.has(t.id));
  }, [filteredTemplates, recentDeviceIds]);

  const handleDeviceChange = (deviceId: string) => {
    if (deviceId) {
      addRecentDevice(deviceId);
      onChange(deviceId);
    } else {
      onChange(undefined);
    }
  };

  const selectedTemplate = value ? getTemplateById(value) : undefined;

  return (
    <div className={className}>
      <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-on-muted mb-2">
        Device Template
      </label>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => handleDeviceChange(e.target.value)}
          className="w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 pr-8 text-sm text-on-surface focus:border-accent focus:outline-none appearance-none"
          disabled={isLoading}
        >
          <option value="">No device selected</option>
          {recentTemplates.length > 0 && (
            <optgroup label="Recent">
              {recentTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.manufacturer} {template.model}
                </option>
              ))}
            </optgroup>
          )}
          {otherTemplates.length > 0 && (
            <optgroup label={recentTemplates.length > 0 ? "All Devices" : "Devices"}>
              {otherTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.manufacturer} {template.model}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-muted">
            Loading...
          </div>
        )}
      </div>
      {selectedTemplate && (
        <p className="mt-1 text-xs text-on-muted">
          {selectedTemplate.description || `${selectedTemplate.manufacturer} ${selectedTemplate.model}`}
        </p>
      )}
    </div>
  );
}
