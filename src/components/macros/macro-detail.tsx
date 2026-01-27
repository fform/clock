import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MinusCircle,
  PlusCircle,
  Save,
  TestTube2,
  Undo2,
} from "lucide-react";

import type { MidiChannel, MidiMacro, MidiStep } from "@/lib/domain/midi";
import { Button } from "@/components/ui/button";
import { useMidi } from "@/lib/midi/context";
import { useClockStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DeviceSelector } from "./device-selector";
import { TemplateCommandSelector } from "./template-command-selector";
import { TemplateCheatsheet } from "./template-cheatsheet";

type MacroDetailProps = {
  macro: MidiMacro;
};

type EditableStep = MidiStep & { id: string };

const DEFAULT_CC = (): MidiStep => ({
  id: createId(),
  kind: "cc",
  controller: 0,
  value: 0,
  channel: 1,
});

const DEFAULT_PC = (): MidiStep => ({
  id: createId(),
  kind: "pc",
  program: 0,
  channel: 1,
});

const DEFAULT_CUSTOM = (): MidiStep => ({
  id: createId(),
  kind: "custom",
  bytes: [0xf0, 0xf7],
});

const createDefaultStep = (kind: MidiStep["kind"]) => {
  switch (kind) {
    case "cc":
      return DEFAULT_CC();
    case "pc":
      return DEFAULT_PC();
    case "custom":
    default:
      return DEFAULT_CUSTOM();
  }
};

const normalizeChannel = (value: number): MidiChannel => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const clamped = Math.max(1, Math.min(16, Math.round(value)));
  return clamped as MidiChannel;
};

export function MacroDetail({ macro }: MacroDetailProps) {
  const midi = useMidi();
  const connectedOutputId = useClockStore((state) => state.connectedOutputId);
  const upsertMacro = useClockStore((state) => state.upsertMacro);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [draft, setDraft] = useState<MidiMacro>(macro);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDraft(macro);
    setIsEditing(false);
  }, [macro]);

  const handleTestMacro = useCallback(async () => {
    if (!connectedOutputId) {
      setTestError("No Canvas Clock MIDI output detected.");
      return;
    }
    if (draft.steps.length === 0) {
      setTestError("Macro has no MIDI events to send.");
      return;
    }

    setIsTesting(true);
    setTestError(null);
    try {
      await midi.sendMacro(connectedOutputId, draft);
      setLastSentAt(Date.now());
    } catch (error) {
      setTestError(
        error instanceof Error ? error.message : "Failed to send macro via WebMIDI.",
      );
    } finally {
      setIsTesting(false);
    }
  }, [connectedOutputId, midi, draft]);

  const handleNameChange = (value: string) => {
    setDraft((current) => ({
      ...current,
      name: value,
    }));
    setIsEditing(true);
  };

  const handleDeviceChange = (deviceId: string | undefined) => {
    setDraft((current) => ({
      ...current,
      deviceId,
    }));
    setIsEditing(true);
  };

  const handleNotesChange = (value: string) => {
    setDraft((current) => ({
      ...current,
      notes: value,
    }));
    setIsEditing(true);
  };

  const handleStepUpdate = (index: number, updated: Partial<EditableStep>) => {
    setDraft((current) => {
      const nextSteps = [...current.steps];
      nextSteps[index] = {
        ...nextSteps[index],
        ...updated,
      } as MidiStep;
      return {
        ...current,
        steps: nextSteps,
      };
    });
    setIsEditing(true);
  };

  const handleStepKindChange = (index: number, kind: MidiStep["kind"]) => {
    setDraft((current) => {
      const nextSteps = [...current.steps];
      const existing = nextSteps[index];
      const converted = convertStep(existing, kind);
      nextSteps[index] = converted;
      return {
        ...current,
        steps: nextSteps,
      };
    });
    setIsEditing(true);
  };

  const handleAddStep = (kind: MidiStep["kind"]) => {
    setDraft((current) => ({
      ...current,
      steps: [...current.steps, createDefaultStep(kind)],
    }));
    setIsEditing(true);
  };

  const handleDuplicateStep = (index: number) => {
    setDraft((current) => {
      const source = current.steps[index];
      const clone = {
        ...source,
        id: createId(),
      } as MidiStep;
      return {
        ...current,
        steps: [...current.steps.slice(0, index + 1), clone, ...current.steps.slice(index + 1)],
      };
    });
    setIsEditing(true);
  };

  const handleRemoveStep = (index: number) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.filter((_, stepIndex) => stepIndex !== index),
    }));
    setIsEditing(true);
  };

  const handleReset = () => {
    setDraft(macro);
    setIsEditing(false);
  };

  const handleSave = () => {
    upsertMacro({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  const isDirty = useMemo(() => {
    if (draft.name !== macro.name) return true;
    if ((draft.notes ?? "") !== (macro.notes ?? "")) return true;
    if (draft.steps.length !== macro.steps.length) return true;

    return draft.steps.some((step, index) => {
      const original = macro.steps[index];
      if (!original) return true;
      return JSON.stringify(step) !== JSON.stringify(original);
    });
  }, [draft, macro]);

  const handleByteChange = (index: number, value: string) => {
    const bytes = value
      .split(/\s+/)
      .map((byte) => byte.trim())
      .filter(Boolean)
      .map((byte) => Number.parseInt(byte, 16))
      .filter((byte) => Number.isFinite(byte) && byte >= 0 && byte <= 0xff);
    handleStepUpdate(index, { bytes });
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <input
              type="text"
              value={draft.name}
              onChange={(event) => handleNameChange(event.target.value)}
              className="w-full rounded-lg border border-transparent bg-transparent px-0 text-3xl font-semibold tracking-tight text-on-surface focus:border-accent focus:outline-none"
            />
            <DeviceSelector
              value={draft.deviceId}
              onChange={handleDeviceChange}
              className="mt-2"
            />
            <p className="mt-2 text-sm uppercase tracking-[0.3em] text-on-muted">
              {draft.steps.length} MIDI event
              {draft.steps.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<Undo2 className="size-4" aria-hidden />}
              onClick={handleReset}
              disabled={!isDirty && !isEditing}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="size-4" aria-hidden />}
              onClick={handleSave}
              disabled={!isDirty}
            >
              Save changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<TestTube2 className="size-4" aria-hidden />}
              onClick={handleTestMacro}
              disabled={isTesting}
            >
              {isTesting ? "Sending…" : "Test via WebMIDI"}
            </Button>
          </div>
        </div>
        {(testError || lastSentAt) && (
          <p
            className={cn(
              "mt-3 text-xs",
              testError ? "text-danger" : "text-on-muted",
            )}
          >
            {testError
              ? testError
              : `Last test sent ${new Date(lastSentAt!).toLocaleTimeString()}`}
          </p>
        )}
      </header>

      <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-on-surface">MIDI events</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<PlusCircle className="size-4" />}
              onClick={() => handleAddStep("cc")}
            >
              Add CC
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<PlusCircle className="size-4" />}
              onClick={() => handleAddStep("pc")}
            >
              Add PC
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<PlusCircle className="size-4" />}
              onClick={() => handleAddStep("custom")}
            >
              Add Custom
            </Button>
          </div>
        </div>

        <table className="mt-6 w-full overflow-hidden rounded-xl border border-border/60 text-left text-xs">
          <thead className="bg-surface-subtle text-on-muted">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Details</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {draft.steps.map((step, index) => (
              <tr
                key={step.id}
                className={cn(index % 2 === 0 ? "bg-surface" : "bg-surface-subtle")}
              >
                <td className="px-3 py-2 text-on-muted">{index + 1}</td>
                <td className="px-3 py-2">
                  <select
                    value={step.kind}
                    onChange={(event) =>
                      handleStepKindChange(index, event.target.value as MidiStep["kind"])
                    }
                    className="w-28 rounded-lg border border-border/70 bg-surface-subtle px-2 py-1 text-xs uppercase tracking-[0.26em] text-on-muted focus:border-accent focus:outline-none"
                  >
                    <option value="cc">CC</option>
                    <option value="pc">PC</option>
                    <option value="custom">Custom</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <StepEditor
                    step={step}
                    deviceId={draft.deviceId}
                    onChange={(updated) => handleStepUpdate(index, updated)}
                    onChangeBytes={(value) => handleByteChange(index, value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-border/60 p-2 text-accent transition hover:text-accent-muted"
                      onClick={() => handleDuplicateStep(index)}
                      aria-label="Duplicate step"
                    >
                      <PlusCircle className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-border/60 p-2 text-danger transition hover:text-danger/80"
                      onClick={() => handleRemoveStep(index)}
                      aria-label="Remove step"
                    >
                      <MinusCircle className="size-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-on-muted">
            Notes
          </h3>
          <textarea
            value={draft.notes ?? ""}
            onChange={(event) => handleNotesChange(event.target.value)}
            placeholder="Add reminders or describe the macro's behavior."
            rows={4}
            className="mt-2 w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {draft.deviceId && (
        <TemplateCheatsheet deviceId={draft.deviceId} />
      )}
    </div>
  );
}

type StepEditorProps = {
  step: MidiStep;
  deviceId?: string;
  onChange: (updated: Partial<MidiStep>) => void;
  onChangeBytes: (value: string) => void;
};

function StepEditor({ step, deviceId, onChange, onChangeBytes }: StepEditorProps) {
  const templates = useClockStore((state) => state.templates);
  const template = deviceId ? templates.find((t) => t.id === deviceId) : undefined;

  const handleTemplateCommandSelect = (commandStep: MidiStep) => {
    onChange({
      ...commandStep,
      id: step.id, // Preserve the step ID
      delayMs: step.delayMs, // Preserve delay
    });
  };

  switch (step.kind) {
    case "cc":
      return (
        <div className="flex flex-col gap-2">
          {template && (
            <TemplateCommandSelector
              template={template}
              stepKind="cc"
              onSelect={handleTemplateCommandSelect}
              className="mb-2"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-xs text-on-muted">
              CC
              <input
                type="number"
                min={0}
                max={127}
                value={step.controller}
                onChange={(event) =>
                  onChange({ controller: Number.parseInt(event.target.value, 10) || 0 })
                }
                className="w-16 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Value
              <input
                type="number"
                min={0}
                max={127}
                value={step.value}
                onChange={(event) =>
                  onChange({ value: Number.parseInt(event.target.value, 10) || 0 })
                }
                className="w-16 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Channel
              <input
                type="number"
                min={1}
                max={16}
                value={step.channel}
                onChange={(event) =>
                  onChange({ channel: normalizeChannel(Number.parseInt(event.target.value, 10) || 1) })
                }
                className="w-16 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Delay (ms)
              <input
                type="number"
                min={0}
                value={step.delayMs ?? 0}
                onChange={(event) =>
                  onChange({ delayMs: Number.parseInt(event.target.value, 10) || 0 })
                }
                className="w-20 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
              />
            </label>
          </div>
        </div>
      );
    case "pc":
      return (
        <div className="flex flex-col gap-2">
          {template && (
            <TemplateCommandSelector
              template={template}
              stepKind="pc"
              onSelect={handleTemplateCommandSelect}
              className="mb-2"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Program
              <input
                type="number"
                min={0}
                max={127}
                value={step.program}
                onChange={(event) =>
                  onChange({ program: Number.parseInt(event.target.value, 10) || 0 })
                }
                className="w-20 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Channel
              <input
                type="number"
                min={1}
                max={16}
                value={step.channel}
                onChange={(event) =>
                  onChange({ channel: normalizeChannel(Number.parseInt(event.target.value, 10) || 1) })
                }
                className="w-16 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Bank MSB
              <input
                type="number"
                min={0}
                max={127}
                value={step.bank?.msb ?? 0}
                onChange={(event) =>
                  onChange({
                    bank: {
                      msb: Number.parseInt(event.target.value, 10) || 0,
                      lsb: step.bank?.lsb ?? 0,
                    },
                  })
                }
                className="w-20 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Bank LSB
              <input
                type="number"
                min={0}
                max={127}
                value={step.bank?.lsb ?? 0}
                onChange={(event) =>
                  onChange({
                    bank: {
                      msb: step.bank?.msb ?? 0,
                      lsb: Number.parseInt(event.target.value, 10) || 0,
                    },
                  })
                }
                className="w-20 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Delay (ms)
              <input
                type="number"
                min={0}
                value={step.delayMs ?? 0}
                onChange={(event) =>
                  onChange({ delayMs: Number.parseInt(event.target.value, 10) || 0 })
                }
                className="w-20 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
              />
            </label>
          </div>
        </div>
      );
    case "custom":
    default:
      return (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-on-muted">
            Sysex Bytes
            <textarea
              value={step.bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ")}
              onChange={(event) => onChangeBytes(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-xs font-mono text-on-surface focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-on-muted">
            Delay (ms)
            <input
              type="number"
              min={0}
              value={step.delayMs ?? 0}
              onChange={(event) =>
                onChange({ delayMs: Number.parseInt(event.target.value, 10) || 0 })
              }
              className="w-24 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      );
  }
}

function convertStep(step: MidiStep, kind: MidiStep["kind"]): MidiStep {
  if (step.kind === kind) {
    return step;
  }

  const base = createDefaultStep(kind);
  return {
    ...base,
    id: step.id,
  };
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

