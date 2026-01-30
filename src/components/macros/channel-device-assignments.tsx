"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import type { MidiChannel } from "@/lib/domain/midi";
import { loadDeviceList, type DeviceInfo } from "@/lib/midi/templates";
import { getAllTemplates } from "@/lib/midi/templates";
import { cn } from "@/lib/utils";

type ChannelDeviceAssignmentsProps = {
  channelDeviceMap: Partial<Record<MidiChannel, string>>;
  onChange: (map: Partial<Record<MidiChannel, string>>) => void;
  className?: string;
};

export function ChannelDeviceAssignments({
  channelDeviceMap,
  onChange,
  className,
}: ChannelDeviceAssignmentsProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load device list on mount
  useEffect(() => {
    let mounted = true;

    async function loadDevices() {
      setIsLoading(true);
      try {
        const builtInTemplates = getAllTemplates();
        const builtInDevices: DeviceInfo[] = builtInTemplates.map((t) => ({
          id: t.id,
          manufacturer: t.manufacturer,
          model: t.model,
          hasTemplate: true,
        }));

        const openMidiDevices = await loadDeviceList();

        if (mounted) {
          setDevices([...builtInDevices, ...openMidiDevices]);
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

  const handleChannelDeviceChange = (channel: MidiChannel, deviceId: string) => {
    const newMap = { ...channelDeviceMap };
    if (deviceId) {
      newMap[channel] = deviceId;
    } else {
      delete newMap[channel];
    }
    onChange(newMap);
  };

  const getDeviceName = (deviceId: string | undefined): string => {
    if (!deviceId) return "Unknown Device";
    const device = devices.find((d) => d.id === deviceId);
    return device ? `${device.manufacturer} ${device.model}` : deviceId;
  };

  // Get channels that have devices assigned
  const assignedChannels = Object.keys(channelDeviceMap)
    .map(Number)
    .filter((ch) => channelDeviceMap[ch as MidiChannel]);

  return (
    <div className={cn("rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle", className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-on-muted" />
          <h2 className="text-lg font-semibold text-on-surface">Channel → Device Assignments</h2>
        </div>
        <span className="text-xs text-on-muted">
          {assignedChannels.length} channel{assignedChannels.length === 1 ? "" : "s"} assigned
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-on-muted">
            Assign devices to MIDI channels. When you add events, you'll select the channel first.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as MidiChannel[]).map(
              (channel) => (
                <div key={channel} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-on-muted">
                    Channel {channel}
                  </label>
                  <select
                    value={channelDeviceMap[channel] || ""}
                    onChange={(e) => handleChannelDeviceChange(channel, e.target.value)}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-border/70 bg-surface-subtle px-2 py-1.5 text-xs text-on-surface focus:border-accent focus:outline-none"
                  >
                    <option value="">No device</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.manufacturer} {device.model}
                      </option>
                    ))}
                  </select>
                </div>
              ),
            )}
          </div>

          {assignedChannels.length > 0 && (
            <div className="mt-4 rounded-lg border border-border/60 bg-surface-subtle p-3">
              <h3 className="text-xs font-semibold text-on-muted mb-2">Active Assignments</h3>
              <div className="flex flex-wrap gap-2">
                {assignedChannels.map((channel) => (
                  <div
                    key={channel}
                    className="flex items-center gap-2 rounded-md bg-surface px-2 py-1 text-xs"
                  >
                    <span className="font-medium text-accent">Ch {channel}</span>
                    <span className="text-on-muted">→</span>
                    <span className="text-on-surface">
                      {getDeviceName(channelDeviceMap[channel as MidiChannel])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
