"use client";

import { useMemo, useState } from "react";

import { MacroDetail } from "@/components/macros/macro-detail";
import { MacroSidebar } from "@/components/macros/macro-sidebar";
import { macrosSelector, useClockStore } from "@/lib/store";

const generateId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `step-${Date.now().toString(36)}`;

export default function MidiMacrosPage() {
  const macros = useClockStore(macrosSelector);
  const upsertMacro = useClockStore((state) => state.upsertMacro);

  const [selectedMacroId, setSelectedMacroId] = useState<string | undefined>(
    macros[0]?.id,
  );

  const activeMacroId = useMemo(() => {
    if (selectedMacroId && macros.some((macro) => macro.id === selectedMacroId)) {
      return selectedMacroId;
    }
    return macros[0]?.id;
  }, [selectedMacroId, macros]);

  const selectedMacro = useMemo(
    () => macros.find((macro) => macro.id === activeMacroId) ?? macros[0],
    [macros, activeMacroId],
  );

  const handleRemoveStep = (stepId: string) => {
    if (!selectedMacro) return;
    upsertMacro({
      ...selectedMacro,
      steps: selectedMacro.steps.filter((step) => step.id !== stepId),
    });
  };

  const handleDuplicateStep = (step: (typeof macros)[number]["steps"][number]) => {
    if (!selectedMacro) return;
    upsertMacro({
      ...selectedMacro,
      steps: [
        ...selectedMacro.steps,
        {
          ...step,
          id: generateId(),
        },
      ],
    });
  };

  return (
    <div className="flex min-h-[calc(100vh_-_var(--header-height))] flex-1 overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-subtle">
      <MacroSidebar
        macros={macros}
        selectedMacroId={activeMacroId}
        onSelect={setSelectedMacroId}
      />

      <div className="flex flex-1 flex-col">
        <div className="border-b border-border/60 bg-surface-subtle px-3 py-3 lg:hidden">
          <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-on-muted">
            Macro
          </label>
          <select
            value={activeMacroId ?? ""}
            onChange={(event) => setSelectedMacroId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
          >
            {macros.map((macro) => (
              <option key={macro.id} value={macro.id}>
                {macro.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 pt-6">
          {selectedMacro ? (
            <MacroDetail
              macro={selectedMacro}
              onRemoveStep={handleRemoveStep}
              onDuplicateStep={handleDuplicateStep}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface-subtle p-8 text-on-muted">
              Create a macro to start collecting MIDI events.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

