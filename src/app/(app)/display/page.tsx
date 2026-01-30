"use client";

import { ChangeEvent } from "react";

import {
  displaySettingsSelector,
  useClockStore,
} from "@/lib/store";

export default function DisplaySettingsPage() {
  const settings = useClockStore(displaySettingsSelector);
  const updateSettings = useClockStore((state) => state.updateDisplaySettings);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;
    updateSettings({
      [name]:
        type === "range" || type === "number"
          ? Number.parseInt(value, 10)
          : Number.parseInt(value, 10),
    });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
          Display
        </h1>
        <p className="mt-2 max-w-3xl text-on-muted">
          Tune the on-device display, LED pulse indicators, and screen orientation.
          Changes preview below and will sync to the pedal during the next transfer.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
          <h2 className="text-lg font-semibold text-on-surface">Display controls</h2>
          <div className="mt-4 grid gap-4 text-sm text-on-surface">
            <label className="flex flex-col gap-2">
              <span className="text-xs text-on-muted">
                Screen brightness
              </span>
              <input
                type="range"
                name="brightness"
                min={0}
                max={10}
                value={settings.brightness}
                onChange={handleChange}
                className="w-full accent-accent"
              />
              <span className="text-xs text-on-muted">
                Level {settings.brightness}/10
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-on-muted">
                Tempo LED pulses
              </span>
              <input
                type="range"
                name="tempoLedPulses"
                min={2}
                max={32}
                value={settings.tempoLedPulses}
                onChange={handleChange}
                className="w-full accent-accent"
              />
              <span className="text-xs text-on-muted">
                {settings.tempoLedPulses} flashes per beat
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-on-muted">
                Orientation
              </span>
              <select
                name="orientation"
                value={settings.orientation}
                onChange={handleChange}
                className="w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              >
                <option value={0}>0° (standard)</option>
                <option value={90}>90° (left rotated)</option>
                <option value={180}>180° (upside down)</option>
                <option value={270}>270° (right rotated)</option>
              </select>
            </label>
          </div>
        </div>

        <PreviewCard
          brightness={settings.brightness}
          orientation={settings.orientation}
          pulses={settings.tempoLedPulses}
        />
      </div>
    </div>
  );
}

function PreviewCard({
  brightness,
  orientation,
  pulses,
}: {
  brightness: number;
  orientation: number;
  pulses: number;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
      <h2 className="text-sm font-semibold text-on-muted">
        Live preview
      </h2>
      <div className="mt-4 flex aspect-[3/2] items-center justify-center rounded-2xl border border-border/60 bg-surface-subtle">
        <div
          className="relative flex h-28 w-44 items-center justify-center rounded-xl border border-border/60 bg-background text-on-surface shadow-raised transition"
          style={{
            opacity: 0.5 + brightness / 20,
            transform: `rotate(${orientation}deg)`,
          }}
        >
          <div className="absolute inset-3 rounded-lg border border-dashed border-border/60" />
          <span className="text-xs text-on-muted">
            Tempo pulses {pulses}
          </span>
        </div>
      </div>
    </div>
  );
}

