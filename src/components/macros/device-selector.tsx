"use client";

import { useMemo, useState, useEffect } from "react";
import { getRecentDevices, addRecentDevice } from "@/lib/midi/templates/recent-devices";
import { getAllTemplates, loadDeviceList, type DeviceInfo } from "@/lib/midi/templates";

type DeviceSelectorProps = {
  value?: string;
  onChange: (deviceId: string | undefined) => void;
  className?: string;
};

export function DeviceSelector({ value, onChange, className }: DeviceSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const recentDeviceIds = useMemo(() => getRecentDevices(), []);

  // Load device list on mount (lightweight, single request)
  useEffect(() => {
    let mounted = true;
    
    async function loadDevices() {
      setIsLoading(true);
      try {
        // Load built-in templates
        const builtInTemplates = getAllTemplates();
        const builtInDevices: DeviceInfo[] = builtInTemplates.map((t) => ({
          id: t.id,
          manufacturer: t.manufacturer,
          model: t.model,
          hasTemplate: true,
        }));

        // Load OpenMIDI device list (just metadata, no template data)
        const openMidiDevices = await loadDeviceList();
        
        if (mounted) {
          // Combine built-in and OpenMIDI devices
          const allDevices = [...builtInDevices, ...openMidiDevices];
          setDevices(allDevices);
        }
      } catch (error) {
        console.error("Failed to load device list:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadDevices();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) {
      return devices;
    }

    const query = searchQuery.toLowerCase();
    return devices.filter(
      (device) =>
        device.manufacturer.toLowerCase().includes(query) ||
        device.model.toLowerCase().includes(query) ||
        device.id.toLowerCase().includes(query),
    );
  }, [devices, searchQuery]);

  // Separate recent and other devices
  const recentDevices = useMemo(() => {
    const recentIds = new Set(recentDeviceIds);
    return devices.filter((d) => recentIds.has(d.id));
  }, [devices, recentDeviceIds]);

  const otherDevices = useMemo(() => {
    const recentIds = new Set(recentDeviceIds);
    return filteredDevices.filter((d) => !recentIds.has(d.id));
  }, [filteredDevices, recentDeviceIds]);

  const handleDeviceChange = (deviceId: string) => {
    if (deviceId) {
      addRecentDevice(deviceId);
      onChange(deviceId);
    } else {
      onChange(undefined);
    }
  };

  const selectedDevice = value ? devices.find((d) => d.id === value) : undefined;

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-on-muted mb-2">
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
          {recentDevices.length > 0 && (
            <optgroup label="Recent">
              {recentDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.manufacturer} {device.model}
                </option>
              ))}
            </optgroup>
          )}
          {otherDevices.length > 0 && (
            <optgroup label={recentDevices.length > 0 ? "All Devices" : "Devices"}>
              {otherDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.manufacturer} {device.model}
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
      {selectedDevice && (
        <p className="mt-1 text-xs text-on-muted">
          {selectedDevice.manufacturer} {selectedDevice.model}
          {selectedDevice.hasTemplate ? " (template available)" : ""}
        </p>
      )}
    </div>
  );
}
