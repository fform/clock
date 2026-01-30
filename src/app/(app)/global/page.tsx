"use client";

import { ChangeEvent, useCallback, useState } from "react";
import { Download, Upload } from "lucide-react";

import {
  globalSettingsSelector,
  useClockStore,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ensurePedalBridge } from "@/lib/pedal/bridge";
import { exportGlobalSettingsToDevice } from "@/lib/pedal/exporter";
import { importSettingsFromPedal } from "@/lib/pedal/importer";
import { ChannelDeviceAssignments } from "@/components/macros/channel-device-assignments";
import type { MidiChannel } from "@/lib/domain/midi";

const EMPTY_DEVICE_MAP: Record<number, string> = {};

export default function GlobalSettingsPage() {
  const settings = useClockStore(globalSettingsSelector);
  const updateSettings = useClockStore((state) => state.updateGlobalSettings);
  const clearGlobalsUnsynced = useClockStore((state) => state.clearGlobalsUnsynced);
  const channelDeviceMap = useClockStore((state) => state.globalSettings.channelDeviceMap ?? EMPTY_DEVICE_MAP);
  const updateChannelDeviceMap = useClockStore((state) => state.updateChannelDeviceMap);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const handleMetronomeChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const target = event.target;
    const { name, value } = target;
    const isCheckbox =
      target instanceof HTMLInputElement && target.type === "checkbox";
    const isRange =
      target instanceof HTMLInputElement && target.type === "range";
    updateSettings({
      metronome: {
        ...settings.metronome,
        [name]:
          isCheckbox
            ? target.checked
            : isRange || name === "volume"
              ? Number.parseInt(value, 10) || 0
              : value,
      },
    });
  };

  const handleSyncChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    updateSettings({
      sync: {
        ...settings.sync,
        [name]: value,
      },
    });
  };

  const handleTapTempoChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateSettings({
      tapTempo: {
        ...settings.tapTempo,
        overrideEnabled: event.target.checked,
      },
    });
  };

  const handleMidiRoutingChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, type, checked, value } = event.target;
    updateSettings({
      midiRouting: {
        ...settings.midiRouting,
        [name]:
          type === "checkbox"
            ? checked
            : Number.parseInt(value, 10) || settings.midiRouting[name as keyof typeof settings.midiRouting],
      },
    });
  };

  const handleSaveToDevice = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const bridge = await ensurePedalBridge();
      await exportGlobalSettingsToDevice(bridge, settings);
      setLastSavedAt(Date.now());
      clearGlobalsUnsynced();
      bridge.disconnect();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save settings to device.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [settings, clearGlobalsUnsynced]);

  const handleImportFromPedal = useCallback(async () => {
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const result = await importSettingsFromPedal();
      if (result.warnings.length > 0) {
        setImportSuccess(`Imported settings with ${result.warnings.length} warnings`);
      } else {
        setImportSuccess(`Successfully imported all settings from device`);
      }
      setTimeout(() => setImportSuccess(null), 5000);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to import settings from device",
      );
    } finally {
      setIsImporting(false);
    }
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              Global settings
            </h1>
            <p className="mt-2 max-w-3xl text-on-muted">
              Metronome, sync, and MIDI routing preferences mirror the Canvas Clock
              hardware. Updates persist locally and will sync to the pedal once a device is connected.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Upload className="size-4" />}
              onClick={handleImportFromPedal}
              disabled={isImporting}
            >
              {isImporting ? "Importing..." : "Import from Device"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="size-4" />}
              onClick={handleSaveToDevice}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save to Device"}
            </Button>
          </div>
        </div>
        {(saveError || importError || importSuccess || lastSavedAt) && (
          <p className={`mt-3 text-sm ${saveError || importError ? "text-danger" : importSuccess ? "text-success" : "text-on-muted"}`}>
            {saveError || importError || importSuccess || `Last saved to device at ${new Date(lastSavedAt!).toLocaleTimeString()}`}
          </p>
        )}
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="Metronome" description="Configure the internal click track.">
          <div className="grid gap-4">
            <label className="flex items-center justify-between text-sm text-on-surface">
              Accent enabled
              <input
                type="checkbox"
                name="accentEnabled"
                checked={settings.metronome.accentEnabled}
                onChange={handleMetronomeChange}
                className="size-5 rounded border-border/70 text-accent focus:ring-accent"
              />
            </label>

            <Field label="Division">
              <select
                name="division"
                value={settings.metronome.division}
                onChange={handleMetronomeChange}
                className="w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              >
                <option value="1/1">Whole</option>
                <option value="1/2">Half</option>
                <option value="1/4">Quarter</option>
                <option value="1/8">Eighth</option>
                <option value="1/16">Sixteenth</option>
              </select>
            </Field>

            <Field label="Sound">
              <select
                name="sound"
                value={settings.metronome.sound}
                onChange={handleMetronomeChange}
                className="w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              >
                <option value="Click">Click</option>
                <option value="Clave">Clave</option>
                <option value="Wood">Wood block</option>
                <option value="Custom">Custom sample</option>
              </select>
            </Field>

            <Field label="Volume">
              <input
                type="range"
                name="volume"
                min={0}
                max={100}
                value={settings.metronome.volume}
                onChange={handleMetronomeChange}
                className="w-full accent-accent"
              />
              <span className="text-xs text-on-muted">
                {settings.metronome.volume}%
              </span>
            </Field>
          </div>
        </Card>

        <Card title="Sync" description="Clock in/out and transport forwarding.">
          <div className="grid gap-4">
            <Field label="I/O mode">
              <select
                name="io"
                value={settings.sync.io}
                onChange={handleSyncChange}
                className="w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              >
                <option value="in">MIDI In</option>
                <option value="out">MIDI Out</option>
              </select>
            </Field>

            <Field label="Division">
              <select
                name="division"
                value={settings.sync.division}
                onChange={handleSyncChange}
                className="w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              >
                <option value="1/1">Whole</option>
                <option value="1/2">Half</option>
                <option value="1/4">Quarter</option>
                <option value="1/8">Eighth</option>
              </select>
            </Field>

            <Field label="Clock frequency">
              <select
                name="clockFrequency"
                value={settings.sync.clockFrequency}
                onChange={handleSyncChange}
                className="w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              >
                <option value="1x">1×</option>
                <option value="2x">2×</option>
                <option value="4x">4×</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card title="Tap tempo" description="Manage override behaviour.">
          <label className="flex items-center justify-between text-sm text-on-surface">
            Override enabled
            <input
              type="checkbox"
              checked={settings.tapTempo.overrideEnabled}
              onChange={handleTapTempoChange}
              className="size-5 rounded border-border/70 text-accent focus:ring-accent"
            />
          </label>
        </Card>

        <Card title="MIDI routing" description="Clock distribution and filtering.">
          <div className="space-y-3 text-sm text-on-surface">
            <ToggleRow
              label="Send clock"
              name="sendClock"
              checked={settings.midiRouting.sendClock}
              onChange={handleMidiRoutingChange}
            />
            <ToggleRow
              label="Clock Thru"
              name="clockThru"
              checked={settings.midiRouting.clockThru}
              onChange={handleMidiRoutingChange}
            />
            <ToggleRow
              label="Receive clock"
              name="receiveClock"
              checked={settings.midiRouting.receiveClock}
              onChange={handleMidiRoutingChange}
            />
            <ToggleRow
              label="MIDI Thru"
              name="thru"
              checked={settings.midiRouting.thru}
              onChange={handleMidiRoutingChange}
            />

            <Field label="Channel In">
              <input
                type="number"
                name="channelIn"
                min={1}
                max={16}
                value={settings.midiRouting.channelIn}
                onChange={handleMidiRoutingChange}
                className="w-24 rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              />
            </Field>

            <Field label="Threshold">
              <input
                type="number"
                name="threshold"
                min={1}
                max={32}
                value={settings.midiRouting.threshold}
                onChange={handleMidiRoutingChange}
                className="w-24 rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              />
            </Field>

            <Field label="Clock pulses">
              <input
                type="number"
                name="clockPulses"
                min={0}
                max={24}
                value={settings.midiRouting.clockPulses}
                onChange={handleMidiRoutingChange}
                className="w-24 rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              />
              <p className="text-xs text-on-muted">
                21 represents continuous clock (Infinity).
              </p>
            </Field>
          </div>
        </Card>
      </section>

      <section className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <h2 className="mb-2 text-lg font-semibold text-on-surface">
          MIDI Channel Device Assignments
        </h2>
        <p className="mb-6 text-sm text-on-muted">
          Assign MIDI devices to channels globally. These assignments will be used across all MIDI macros,
          allowing the editor to show device-specific templates and command names.
        </p>
        <ChannelDeviceAssignments
          channelDeviceMap={channelDeviceMap}
          onChange={(map) => {
            Object.entries(map).forEach(([channel, deviceId]) => {
              updateChannelDeviceMap(Number(channel) as MidiChannel, deviceId);
            });
          }}
        />
      </section>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
      <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
      <p className="mt-1 text-sm text-on-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-on-surface">
      <span className="text-xs text-on-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span>{label}</span>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-5 rounded border-border/70 text-accent focus:ring-accent"
      />
    </label>
  );
}

