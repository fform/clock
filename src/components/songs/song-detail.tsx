import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Edit,
  MinusCircle,
  Plus,
} from "lucide-react";

import type { MidiMacro } from "@/lib/domain/midi";
import type { Setlist, Song } from "@/lib/domain/project";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SongDetailProps = {
  song: Song;
  macros: MidiMacro[];
  setlists: Setlist[];
  onMoveMacro: (from: number, to: number) => void;
  onToggleMacro: (macroInstanceId: string) => void;
  onRemoveMacro: (macroInstanceId: string) => void;
  onAddMacro: (macroId: string) => void;
};

export function SongDetail({
  song,
  macros,
  setlists,
  onMoveMacro,
  onToggleMacro,
  onRemoveMacro,
  onAddMacro,
}: SongDetailProps) {
  const [selectedMacroId, setSelectedMacroId] = useState<string>("");

  const macroLookup = useMemo(
    () => new Map(macros.map((macro) => [macro.id, macro])),
    [macros],
  );

  const setlistMembership = useMemo(
    () =>
      setlists.filter((setlist) =>
        setlist.entries.some((entry) => entry.songId === song.id),
      ),
    [setlists, song.id],
  );

  const handleAddMacro = () => {
    if (!selectedMacroId) return;
    onAddMacro(selectedMacroId);
    setSelectedMacroId("");
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              {song.title}
            </h1>
            <p className="text-sm uppercase tracking-[0.3em] text-on-muted">
              {song.key} · {song.tempo} BPM · {song.timeSignature.beatsPerBar}/
              {song.timeSignature.beatUnit}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" icon={<Edit className="size-4" />}>
              Rename
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<BadgeCheck className="size-4" />}
            >
              Send song to pedal
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">
                Macro sequence
              </h2>
              <p className="text-sm text-on-muted">
                These macros execute in order when the song loads.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedMacroId}
                onChange={(event) => setSelectedMacroId(event.target.value)}
                className="rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
              >
                <option value="">Add macro…</option>
                {macros.map((macro) => (
                  <option key={macro.id} value={macro.id}>
                    {macro.name}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="size-4" />}
                onClick={handleAddMacro}
                disabled={!selectedMacroId}
              >
                Add
              </Button>
            </div>
          </div>

          <ol className="mt-6 space-y-3">
            {song.macros.length === 0 && (
              <li className="rounded-xl border border-dashed border-border/60 bg-surface-subtle p-4 text-sm text-on-muted">
                No macros yet — add one from the library to begin building your
                sequence.
              </li>
            )}
            {song.macros.map((instance, index) => {
              const macro = macroLookup.get(instance.macroId);
              if (!macro) return null;
              const isDisabled = !instance.enabled;
              return (
                <li
                  key={instance.id}
                  className={cn(
                    "rounded-xl border border-border/60 bg-surface-subtle p-4 transition",
                    isDisabled && "opacity-65",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-md bg-surface px-2 py-1 text-xs font-semibold text-on-muted">
                          Step {index + 1}
                        </span>
                        <h3 className="text-base font-medium text-on-surface">
                          {instance.label ?? macro.name}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.26em] text-on-muted">
                        {macro.steps.length} MIDI event
                        {macro.steps.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Move macro up"
                        disabled={index === 0}
                        onClick={() => onMoveMacro(index, index - 1)}
                        className="rounded-lg border border-border/60 p-2 text-on-muted transition hover:text-on-surface disabled:opacity-50"
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Move macro down"
                        disabled={index === song.macros.length - 1}
                        onClick={() => onMoveMacro(index, index + 1)}
                        className="rounded-lg border border-border/60 p-2 text-on-muted transition hover:text-on-surface disabled:opacity-50"
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={isDisabled ? "Enable macro" : "Disable macro"}
                        onClick={() => onToggleMacro(instance.id)}
                        className={cn(
                          "rounded-lg border border-border/60 p-2 transition",
                          isDisabled
                            ? "text-on-muted hover:text-on-surface"
                            : "text-success hover:text-success/80",
                        )}
                      >
                        <BadgeCheck className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove macro"
                        onClick={() => onRemoveMacro(instance.id)}
                        className="rounded-lg border border-border/60 p-2 text-danger transition hover:text-danger/80"
                      >
                        <MinusCircle className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <MacroStepList steps={macro.steps} />
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-surface p-4 shadow-subtle">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-on-muted">
              Setlist membership
            </h2>
            {setlistMembership.length === 0 ? (
              <p className="mt-3 text-sm text-on-muted">
                This song hasn&apos;t been added to any setlists yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-on-muted">
                {setlistMembership.map((setlist) => (
                  <li key={setlist.id} className="rounded-lg bg-surface-subtle px-3 py-2">
                    {setlist.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-surface p-4 shadow-subtle">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-on-muted">
              Notes
            </h2>
            <p className="mt-2 text-sm text-on-muted">
              {song.notes ?? "Add performance notes or pedal reminders here."}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

type MacroStepListProps = {
  steps: MidiMacro["steps"];
};

function MacroStepList({ steps }: MacroStepListProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-subtle text-on-muted">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 font-medium">Channel</th>
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
              <td className="px-3 py-2 text-on-surface">
                {renderStepData(step)}
              </td>
              <td className="px-3 py-2 text-on-muted">
                {"channel" in step ? step.channel : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderStepData(step: MidiMacro["steps"][number]) {
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

