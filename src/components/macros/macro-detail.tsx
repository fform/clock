import { useMemo } from "react";
import { MinusCircle, PlusCircle } from "lucide-react";

import type { MidiMacro, MidiStep } from "@/lib/domain/midi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MacroDetailProps = {
  macro: MidiMacro;
  onRemoveStep: (stepId: string) => void;
  onDuplicateStep: (step: MidiStep) => void;
};

export function MacroDetail({
  macro,
  onRemoveStep,
  onDuplicateStep,
}: MacroDetailProps) {
  const steps = useMemo(() => macro.steps, [macro.steps]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              {macro.name}
            </h1>
            <p className="text-sm uppercase tracking-[0.3em] text-on-muted">
              {macro.deviceId ?? "Unassigned device"} ·{" "}
              {macro.steps.length} MIDI event
              {macro.steps.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              Rename
            </Button>
            <Button variant="primary" size="sm">
              Send macro to pedal
            </Button>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-on-surface">MIDI events</h2>
          <Button variant="primary" size="sm" icon={<PlusCircle className="size-4" />}>
            Add event
          </Button>
        </div>

        <table className="mt-6 w-full overflow-hidden rounded-xl border border-border/60 text-left text-xs">
          <thead className="bg-surface-subtle text-on-muted">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Channel</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, index) => (
              <tr
                key={step.id}
                className={cn(index % 2 === 0 ? "bg-surface" : "bg-surface-subtle")}
              >
                <td className="px-3 py-2 text-on-muted">{index + 1}</td>
                <td className="px-3 py-2 uppercase tracking-[0.26em] text-on-muted">
                  {step.kind.toUpperCase()}
                </td>
                <td className="px-3 py-2 text-on-surface">{renderStep(step)}</td>
                <td className="px-3 py-2 text-on-muted">
                  {"channel" in step ? step.channel : "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-border/60 p-2 text-accent transition hover:text-accent-muted"
                      onClick={() => onDuplicateStep(step)}
                      aria-label="Duplicate step"
                    >
                      <PlusCircle className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-border/60 p-2 text-danger transition hover:text-danger/80"
                      onClick={() => onRemoveStep(step.id)}
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

        {macro.notes && (
          <div className="mt-4 rounded-xl border border-border/60 bg-surface-subtle p-4 text-sm text-on-muted">
            {macro.notes}
          </div>
        )}
      </div>
    </div>
  );
}

function renderStep(step: MidiStep) {
  switch (step.kind) {
    case "cc":
      return `CC ${step.controller} → ${step.value}`;
    case "pc":
      if (step.bank) {
        return `Bank ${step.bank.msb ?? 0}/${step.bank.lsb ?? 0} · Program ${step.program}`;
      }
      return `Program ${step.program}`;
    case "custom":
      return step.bytes.join(" ");
    default:
      return "";
  }
}

