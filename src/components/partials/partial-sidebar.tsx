import { PlusCircle } from "lucide-react";
import type { MidiPartial } from "@/lib/domain/midi";
import { cn } from "@/lib/utils";
import { useClockStore } from "@/lib/store";

type PartialSidebarProps = {
  partials: MidiPartial[];
  selectedPartialId?: string;
  onSelect: (partialId: string) => void;
};

export function PartialSidebar({
  partials,
  selectedPartialId,
  onSelect,
}: PartialSidebarProps) {
  const createPartial = useClockStore((state) => state.createPartial);

  const handleCreateNew = () => {
    const newPartial = createPartial();
    onSelect(newPartial.id);
  };

  return (
    <aside className="hidden w-64 flex-col border-r border-border/60 bg-surface-subtle lg:flex">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold text-on-muted">
          Partials
        </h2>
        <button
          type="button"
          onClick={handleCreateNew}
          className="rounded-lg p-1 text-on-muted transition-colors hover:bg-surface hover:text-accent"
          title="New Partial"
        >
          <PlusCircle className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-1 px-2 pb-6">
          {partials.map((partial) => {
            const isActive = partial.id === selectedPartialId;
            return (
              <li key={partial.id}>
                <button
                  type="button"
                  onClick={() => onSelect(partial.id)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150",
                    isActive
                      ? "bg-accent-subtle text-accent"
                      : "bg-transparent text-on-muted hover:bg-surface hover:text-on-surface",
                  )}
                >
                  <span className="block font-medium text-on-surface">
                    {partial.name}
                  </span>
                  <span className="text-xs text-on-muted">
                    {partial.commands.length} command{partial.commands.length === 1 ? "" : "s"}
                    {partial.deviceId && ` · ${partial.deviceId.split('-').slice(0, 2).join(' ')}`}
                  </span>
                </button>
              </li>
            );
          })}
          {partials.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-on-muted">
              No partials yet
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}
