"use client";

import { ChangeEvent } from "react";

import {
  globalSettingsSelector,
  useClockStore,
} from "@/lib/store";

export default function GlobalSettingsPage() {
  const settings = useClockStore(globalSettingsSelector);
  const updateSettings = useClockStore((state) => state.updateGlobalSettings);

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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
          Global settings
        </h1>
        <p className="mt-2 max-w-3xl text-on-muted">
          Metronome, sync, and MIDI routing preferences mirror the Canvas Clock
          hardware. Updates persist locally and will sync to the pedal once a device is connected.
        </p>
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
      <span className="text-xs uppercase tracking-[0.3em] text-on-muted">
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

