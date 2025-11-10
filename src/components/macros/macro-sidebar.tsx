import type { MidiMacro } from "@/lib/domain/midi";
import { cn } from "@/lib/utils";

type MacroSidebarProps = {
  macros: MidiMacro[];
  selectedMacroId?: string;
  onSelect: (macroId: string) => void;
};

export function MacroSidebar({
  macros,
  selectedMacroId,
  onSelect,
}: MacroSidebarProps) {
  return (
    <aside className="hidden flex-col border-r border-border/60 bg-surface-subtle lg:flex">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.32em] text-on-muted">
          MIDI macros
        </h2>
        <span className="text-xs text-on-muted">{macros.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-1 px-2 pb-6">
          {macros.map((macro) => {
            const isActive = macro.id === selectedMacroId;
            return (
              <li key={macro.id}>
                <button
                  type="button"
                  onClick={() => onSelect(macro.id)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150",
                    isActive
                      ? "bg-accent-subtle text-accent"
                      : "bg-transparent text-on-muted hover:bg-surface hover:text-on-surface",
                  )}
                >
                  <span className="block font-medium text-on-surface">
                    {macro.name}
                  </span>
                  <span className="text-xs uppercase tracking-[0.26em] text-on-muted">
                    {macro.steps.length} event
                    {macro.steps.length === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

