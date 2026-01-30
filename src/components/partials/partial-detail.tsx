"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Trash2, Undo2, PlusCircle } from "lucide-react";

import type { MidiPartial, MidiCCStep, MidiPCStep, MidiCustomStep, MidiChannel } from "@/lib/domain/midi";
import { Button } from "@/components/ui/button";
import { useClockStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type PartialDetailProps = {
  partial: MidiPartial;
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_CC = (): MidiCCStep => ({
  id: createId(),
  kind: "cc",
  controller: 0,
  value: 0,
  channel: 1,
});

const DEFAULT_PC = (): MidiPCStep => ({
  id: createId(),
  kind: "pc",
  program: 0,
  channel: 1,
});

const DEFAULT_CUSTOM = (): MidiCustomStep => ({
  id: createId(),
  kind: "custom",
  bytes: [],
});

export function PartialDetail({ partial }: PartialDetailProps) {
  const upsertPartial = useClockStore((state) => state.upsertPartial);
  const removePartial = useClockStore((state) => state.removePartial);
  const [draft, setDraft] = useState<MidiPartial>(partial);
  const [isEditing, setIsEditing] = useState(false);

  const isDirty = isEditing;

  useEffect(() => {
    setDraft(partial);
    setIsEditing(false);
  }, [partial]);

  const handleSave = () => {
    upsertPartial(draft);
    setIsEditing(false);
  };

  const handleReset = () => {
    setDraft(partial);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm(`Delete "${partial.name}"? This will remove it from all macros.`)) {
      removePartial(partial.id);
    }
  };

  const handleNameChange = (value: string) => {
    setDraft((current) => ({ ...current, name: value }));
    setIsEditing(true);
  };

  const handleDescriptionChange = (value: string) => {
    setDraft((current) => ({ ...current, description: value }));
    setIsEditing(true);
  };

  const handleDeviceChange = (value: string) => {
    setDraft((current) => ({ ...current, deviceId: value || undefined }));
    setIsEditing(true);
  };

  const handleAddCommand = (kind: "cc" | "pc" | "custom") => {
    const newCommand = kind === "cc" ? DEFAULT_CC() : kind === "pc" ? DEFAULT_PC() : DEFAULT_CUSTOM();
    setDraft((current) => ({
      ...current,
      commands: [...current.commands, newCommand],
    }));
    setIsEditing(true);
  };

  const handleRemoveCommand = (index: number) => {
    setDraft((current) => ({
      ...current,
      commands: current.commands.filter((_, i) => i !== index),
    }));
    setIsEditing(true);
  };

  const handleUpdateCommand = (index: number, updated: Partial<MidiCCStep | MidiPCStep | MidiCustomStep>) => {
    setDraft((current) => ({
      ...current,
      commands: current.commands.map((cmd, i) =>
        i === index ? { ...cmd, ...updated } : cmd
      ),
    }));
    setIsEditing(true);
  };

  const handleCommandTypeChange = (index: number, kind: "cc" | "pc" | "custom") => {
    const current = draft.commands[index];
    let newCommand: MidiCCStep | MidiPCStep | MidiCustomStep;
    
    if (kind === "cc") {
      newCommand = { ...DEFAULT_CC(), id: current.id };
    } else if (kind === "pc") {
      newCommand = { ...DEFAULT_PC(), id: current.id };
    } else {
      newCommand = { ...DEFAULT_CUSTOM(), id: current.id };
    }

    setDraft((d) => ({
      ...d,
      commands: d.commands.map((cmd, i) => (i === index ? newCommand : cmd)),
    }));
    setIsEditing(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={draft.name}
              onChange={(event) => handleNameChange(event.target.value)}
              className="w-full rounded-lg border border-transparent bg-transparent px-0 text-3xl font-semibold tracking-tight text-on-surface focus:border-accent focus:outline-none"
              placeholder="Partial Name"
            />
            <textarea
              value={draft.description || ""}
              onChange={(event) => handleDescriptionChange(event.target.value)}
              placeholder="Description (optional)"
              className="mt-2 w-full rounded-lg border border-transparent bg-transparent px-0 text-sm text-on-muted focus:border-accent focus:outline-none"
              rows={2}
            />
            <p className="mt-2 text-sm text-on-muted">
              {draft.commands.length} command{draft.commands.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<Trash2 className="size-4" aria-hidden />}
              onClick={handleDelete}
            >
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Undo2 className="size-4" aria-hidden />}
              onClick={handleReset}
              disabled={!isDirty}
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
              Save
            </Button>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-on-surface">Commands</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<PlusCircle className="size-4" />}
              onClick={() => handleAddCommand("cc")}
            >
              Add CC
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<PlusCircle className="size-4" />}
              onClick={() => handleAddCommand("pc")}
            >
              Add PC
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<PlusCircle className="size-4" />}
              onClick={() => handleAddCommand("custom")}
            >
              Add Custom
            </Button>
          </div>
        </div>

        {draft.commands.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface-subtle p-8 text-center text-sm text-on-muted">
            Add MIDI commands to this partial
          </div>
        ) : (
          <div className="space-y-3">
            {draft.commands.map((command, index) => (
              <div
                key={command.id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface-subtle p-4"
              >
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <select
                      value={command.kind}
                      onChange={(e) => handleCommandTypeChange(index, e.target.value as "cc" | "pc" | "custom")}
                      className="rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
                    >
                      <option value="cc">Control Change (CC)</option>
                      <option value="pc">Program Change (PC)</option>
                      <option value="custom">Custom/SysEx</option>
                    </select>
                    <span className="text-xs text-on-muted">#{index + 1}</span>
                  </div>

                  {command.kind === "cc" ? (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-on-muted mb-1">
                          Channel
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={16}
                          value={command.channel}
                          onChange={(e) => handleUpdateCommand(index, { channel: parseInt(e.target.value) as MidiChannel })}
                          className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-on-muted mb-1">
                          Controller
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={127}
                          value={command.controller}
                          onChange={(e) => handleUpdateCommand(index, { controller: parseInt(e.target.value) })}
                          className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-on-muted mb-1">
                          Value
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={127}
                          value={command.value}
                          onChange={(e) => handleUpdateCommand(index, { value: parseInt(e.target.value) })}
                          className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
                        />
                      </div>
                    </div>
                  ) : command.kind === "pc" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-on-muted mb-1">
                          Channel
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={16}
                          value={command.channel}
                          onChange={(e) => handleUpdateCommand(index, { channel: parseInt(e.target.value) as MidiChannel })}
                          className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-on-muted mb-1">
                          Program
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={127}
                          value={command.program}
                          onChange={(e) => handleUpdateCommand(index, { program: parseInt(e.target.value) })}
                          className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-on-muted mb-1">
                        Bytes (hex, space-separated)
                      </label>
                      <input
                        type="text"
                        value={command.bytes.map((b: number) => b.toString(16).padStart(2, "0")).join(" ")}
                        onChange={(e) => {
                          const bytes = e.target.value
                            .split(/\s+/)
                            .map((b) => b.trim())
                            .filter(Boolean)
                            .map((b) => parseInt(b, 16))
                            .filter((b) => !isNaN(b) && b >= 0 && b <= 255);
                          handleUpdateCommand(index, { bytes });
                        }}
                        placeholder="e.g., F0 7E 7F 09 01 F7"
                        className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 font-mono text-sm text-on-surface"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveCommand(index)}
                  className="rounded-lg p-2 text-on-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  title="Remove command"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
