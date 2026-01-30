import { useCallback, useEffect, useMemo, useState } from "react";
import type { MidiDeviceTemplate } from "@/lib/domain/midi";
import {
  MinusCircle,
  PlusCircle,
  Save,
  Download,
  Undo2,
} from "lucide-react";

import type { MidiChannel, MidiMacro, MidiStep, MidiPartial, MidiPartialStep } from "@/lib/domain/midi";
import { Button } from "@/components/ui/button";
import { useMidi } from "@/lib/midi/context";
import { useClockStore, partialsSelector } from "@/lib/store";
import { getTemplateById, loadTemplateById } from "@/lib/midi/templates";
import { cn } from "@/lib/utils";
import { ChannelDeviceAssignments } from "./channel-device-assignments";
import { TemplateCommandSelector } from "./template-command-selector";
import { TemplateCheatsheet } from "./template-cheatsheet";
import { ensurePedalBridge } from "@/lib/pedal/bridge";
import { exportMacroToDevice } from "@/lib/pedal/exporter";

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

const DEFAULT_PARTIAL = (): MidiStep => ({
  id: createId(),
  kind: "partial",
  partialId: "",
  name: "Select a partial...",
});

const createDefaultStep = (kind: MidiStep["kind"]) => {
  switch (kind) {
    case "cc":
      return DEFAULT_CC();
    case "pc":
      return DEFAULT_PC();
    case "partial":
      return DEFAULT_PARTIAL();
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

const EMPTY_DEVICE_MAP: Partial<Record<MidiChannel, string>> = {};

export function MacroDetail({ macro }: MacroDetailProps) {
  const midi = useMidi();
  const macros = useClockStore((state) => state.macros);
  const partials = useClockStore(partialsSelector);
  const connectedOutputId = useClockStore((state) => state.connectedOutputId);
  const upsertMacro = useClockStore((state) => state.upsertMacro);
  const clearMacroUnsynced = useClockStore((state) => state.clearMacroUnsynced);
  const channelDeviceMap = useClockStore((state) => state.globalSettings.channelDeviceMap ?? EMPTY_DEVICE_MAP);
  const updateChannelDeviceMap = useClockStore((state) => state.updateChannelDeviceMap);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [draft, setDraft] = useState<MidiMacro>(macro);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDraft(macro);
    setIsEditing(false);
  }, [macro]);

  const handleSaveToDevice = useCallback(async () => {
    // Find the macro's slot index
    const slotIndex = macros.findIndex((m) => m.id === draft.id);
    if (slotIndex === -1) {
      setSaveError("Cannot find macro slot. Save the macro first.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const bridge = await ensurePedalBridge();
      await exportMacroToDevice(bridge, draft, slotIndex, partials);
      setLastSavedAt(Date.now());
      clearMacroUnsynced(draft.id);
      bridge.disconnect();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save macro to device.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [draft, macros, partials, clearMacroUnsynced]);

  const handleNameChange = (value: string) => {
    setDraft((current) => ({
      ...current,
      name: value,
    }));
    setIsEditing(true);
  };

  const handleChannelDeviceMapChange = (map: Partial<Record<MidiChannel, string>>) => {
    // Update global channel device map
    Object.entries(map).forEach(([channel, deviceId]) => {
      if (deviceId) {
        updateChannelDeviceMap(Number(channel) as MidiChannel, deviceId);
      }
    });
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

  // Calculate how many commands will be sent to pedal (with partials expanded)
  const expandedCommandCount = useMemo(() => {
    let count = 0;
    const partialMap = new Map(partials.map((p) => [p.id, p]));
    
    for (const step of draft.steps) {
      if (step.kind === "partial") {
        const partial = partialMap.get(step.partialId);
        count += partial?.commands.length || 0;
      } else {
        count += 1;
      }
    }
    return count;
  }, [draft.steps, partials]);

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
            <div className="mt-2 space-y-1">
              <p className="text-sm text-on-muted">
                {draft.steps.length} step{draft.steps.length === 1 ? "" : "s"}
                {expandedCommandCount !== draft.steps.length && (
                  <span className="text-accent"> → {expandedCommandCount} commands when expanded</span>
                )}
              </p>
              {expandedCommandCount > 15 && (
                <p className="text-xs text-danger">
                  ⚠ Warning: Expanded macro has {expandedCommandCount} commands (max 15). Excess commands will be ignored.
                </p>
              )}
            </div>
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
              icon={<Download className="size-4" aria-hidden />}
              onClick={handleSaveToDevice}
              disabled={isSaving || isDirty}
            >
              {isSaving ? "Saving…" : "Save to Device"}
            </Button>
          </div>
        </div>
        {(saveError || lastSavedAt) && (
          <p
            className={cn(
              "mt-3 text-xs",
              saveError ? "text-danger" : "text-on-muted",
            )}
          >
            {saveError
              ? saveError
              : `Last saved to device at ${new Date(lastSavedAt!).toLocaleTimeString()}`}
          </p>
        )}
      </header>

      <ChannelDeviceAssignments
        channelDeviceMap={channelDeviceMap}
        onChange={handleChannelDeviceMapChange}
      />

      <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-on-surface">MIDI events</h2>
          <div className="flex flex-wrap items-center gap-2">
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
              variant="outline"
              size="sm"
              icon={<PlusCircle className="size-4" />}
              onClick={() => handleAddStep("custom")}
            >
              Add Custom
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<PlusCircle className="size-4" />}
              onClick={() => handleAddStep("partial")}
            >
              Add Partial
            </Button>
          </div>
        </div>
        {partials.length === 0 && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-on-muted">
            💡 Tip: Create reusable command sequences in the <a href="/partials" className="text-accent underline">Partials</a> page, then add them here with "Add Partial"
          </div>
        )}

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
            {draft.steps.map((step, index) => {
              const isPartial = step.kind === "partial";
              return (
                <tr
                  key={step.id}
                  className={cn(
                    index % 2 === 0 ? "bg-surface" : "bg-surface-subtle",
                    isPartial && "border-l-4 border-accent/50"
                  )}
                >
                  <td className="px-3 py-2 text-on-muted">{index + 1}</td>
                  <td className="px-3 py-2">
                    <select
                      value={step.kind}
                      onChange={(event) =>
                        handleStepKindChange(index, event.target.value as MidiStep["kind"])
                      }
                      className={cn(
                        "w-28 rounded-lg border border-border/70 bg-surface-subtle px-2 py-1 text-xs focus:border-accent focus:outline-none",
                        isPartial ? "text-accent font-medium" : "text-on-muted"
                      )}
                    >
                      <option value="cc">CC</option>
                      <option value="pc">PC</option>
                      <option value="custom">Custom</option>
                      <option value="partial">Partial</option>
                    </select>
                  </td>
                <td className="px-3 py-2">
                  <StepEditor
                    step={step}
                    channelDeviceMap={channelDeviceMap}
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
            );
            })}
          </tbody>
        </table>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-on-muted">
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

      <TemplateCheatsheet channelDeviceMap={channelDeviceMap} />
    </div>
  );
}

type StepEditorProps = {
  step: MidiStep;
  channelDeviceMap: Partial<Record<MidiChannel, string>>;
  onChange: (updated: Partial<MidiStep>) => void;
  onChangeBytes: (value: string) => void;
};

function StepEditor({ step, channelDeviceMap, onChange, onChangeBytes }: StepEditorProps) {
  const partials = useClockStore(partialsSelector);
  const templates = useClockStore((state) => state.templates);
  const registerTemplates = useClockStore((state) => state.registerTemplates);
  const [template, setTemplate] = useState<MidiDeviceTemplate | undefined>(undefined);

  // Get device ID for the step's channel
  const deviceId = (step.kind === "cc" || step.kind === "pc") 
    ? channelDeviceMap[step.channel] 
    : undefined;

  // Lazy-load template when deviceId changes
  useEffect(() => {
    if (!deviceId) {
      setTemplate(undefined);
      return;
    }

    let mounted = true;

    // Check if template is already available
    const existingTemplate = getTemplateById(deviceId) || templates.find((t) => t.id === deviceId);
    if (existingTemplate) {
      setTemplate(existingTemplate);
      return;
    }

    // Load template from API
    loadTemplateById(deviceId)
      .then((loadedTemplate) => {
        if (mounted && loadedTemplate) {
          setTemplate(loadedTemplate);
          // Register in store for future use
          registerTemplates([loadedTemplate]);
        }
      })
      .catch((error) => {
        console.error("Failed to load template:", error);
      });

    return () => {
      mounted = false;
    };
  }, [deviceId, templates, registerTemplates]);

  const handleTemplateCommandSelect = (commandStep: MidiStep) => {
    onChange({
      ...commandStep,
      id: step.id, // Preserve the step ID
      delayMs: step.delayMs, // Preserve delay
    });
  };

  // Get assigned channels with devices
  const assignedChannels = Object.entries(channelDeviceMap)
    .filter(([_, deviceId]) => deviceId)
    .map(([channel]) => Number(channel) as MidiChannel)
    .sort((a, b) => a - b);

  switch (step.kind) {
    case "cc":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Channel
              <select
                value={step.channel}
                onChange={(event) =>
                  onChange({ channel: normalizeChannel(Number.parseInt(event.target.value, 10) || 1) })
                }
                className={cn(
                  "w-32 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs focus:border-accent focus:outline-none",
                  deviceId ? "text-on-surface" : "text-on-muted"
                )}
              >
                {assignedChannels.length > 0 ? (
                  assignedChannels.map((ch) => (
                    <option key={ch} value={ch}>
                      Ch {ch} ({channelDeviceMap[ch]?.split('-').slice(0, 2).join(' ') || 'Unknown'})
                    </option>
                  ))
                ) : (
                  <option value={step.channel}>Ch {step.channel} (no device)</option>
                )}
              </select>
            </label>
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
          {template && (
            <TemplateCommandSelector
              template={template}
              currentStep={step}
              onSelect={handleTemplateCommandSelect}
            />
          )}
        </div>
      );
    case "pc":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-xs text-on-muted">
              Channel
              <select
                value={step.channel}
                onChange={(event) =>
                  onChange({ channel: normalizeChannel(Number.parseInt(event.target.value, 10) || 1) })
                }
                className={cn(
                  "w-32 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs focus:border-accent focus:outline-none",
                  deviceId ? "text-on-surface" : "text-on-muted"
                )}
              >
                {assignedChannels.length > 0 ? (
                  assignedChannels.map((ch) => (
                    <option key={ch} value={ch}>
                      Ch {ch} ({channelDeviceMap[ch]?.split('-').slice(0, 2).join(' ') || 'Unknown'})
                    </option>
                  ))
                ) : (
                  <option value={step.channel}>Ch {step.channel} (no device)</option>
                )}
              </select>
            </label>
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
          {template && (
            <TemplateCommandSelector
              template={template}
              currentStep={step}
              onSelect={handleTemplateCommandSelect}
            />
          )}
        </div>
      );
    case "custom":
      return (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-on-muted">
            Sysex Bytes
            <textarea
              value={step.bytes.map((byte: number) => byte.toString(16).padStart(2, "0")).join(" ")}
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
    case "partial":
      return (
        <PartialSelector
          step={step}
          partials={partials}
          onChange={onChange}
        />
      );
  }
}

type PartialSelectorProps = {
  step: MidiPartialStep;
  partials: MidiPartial[];
  onChange: (updated: Partial<MidiStep>) => void;
};

function PartialSelector({ step, partials, onChange }: PartialSelectorProps) {
  const selectedPartial = partials.find((p) => p.id === step.partialId);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-on-muted mb-1">
          Select Partial
        </label>
        <select
          value={step.partialId}
          onChange={(e) => {
            const partial = partials.find((p) => p.id === e.target.value);
            onChange({
              partialId: e.target.value,
              name: partial?.name || "Unknown",
            });
          }}
          className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
        >
          <option value="">Select a partial...</option>
          {partials.map((partial) => (
            <option key={partial.id} value={partial.id}>
              {partial.name} ({partial.commands.length} commands)
            </option>
          ))}
        </select>
      </div>
      {selectedPartial && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-accent">{selectedPartial.name}</p>
              {selectedPartial.description && (
                <p className="mt-1 text-xs text-on-muted">{selectedPartial.description}</p>
              )}
              <p className="mt-2 text-xs text-on-muted">
                {selectedPartial.commands.length} command{selectedPartial.commands.length === 1 ? "" : "s"}:
              </p>
              <ul className="mt-1 space-y-1">
                {selectedPartial.commands.map((cmd: MidiStep, idx: number) => (
                  <li key={idx} className="text-xs text-on-muted">
                    {cmd.kind === "cc" && `CC #${cmd.controller} = ${cmd.value} (Ch ${cmd.channel})`}
                    {cmd.kind === "pc" && `PC #${cmd.program} (Ch ${cmd.channel})`}
                    {cmd.kind === "custom" && `Custom: ${cmd.bytes.length} bytes`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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

// Helper to expand a macro's steps, including partials
export function expandMacroStepsForDisplay(steps: MidiStep[], partials: MidiPartial[]): { step: MidiStep; isFromPartial?: boolean; partialName?: string }[] {
  const expanded: { step: MidiStep; isFromPartial?: boolean; partialName?: string }[] = [];
  const partialMap = new Map(partials.map((p) => [p.id, p]));

  for (const step of steps) {
    if (step.kind === "partial") {
      const partial = partialMap.get(step.partialId);
      if (partial) {
        // Mark these as being from a partial
        for (const cmd of partial.commands) {
          expanded.push({ step: cmd, isFromPartial: true, partialName: partial.name });
        }
      }
    } else {
      expanded.push({ step });
    }
  }

  return expanded;
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

