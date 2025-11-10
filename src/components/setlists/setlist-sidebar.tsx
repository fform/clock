import type { Setlist } from "@/lib/domain/project";
import { cn } from "@/lib/utils";

type SetlistSidebarProps = {
  setlists: Setlist[];
  selectedSetlistId?: string;
  onSelect: (setlistId: string) => void;
};

export function SetlistSidebar({
  setlists,
  selectedSetlistId,
  onSelect,
}: SetlistSidebarProps) {
  return (
    <aside className="hidden flex-col border-r border-border/60 bg-surface-subtle lg:flex">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.32em] text-on-muted">
          Setlists
        </h2>
        <span className="text-xs text-on-muted">{setlists.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-1 px-2 pb-6">
          {setlists.map((setlist) => {
            const isActive = setlist.id === selectedSetlistId;
            return (
              <li key={setlist.id}>
                <button
                  type="button"
                  onClick={() => onSelect(setlist.id)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150",
                    isActive
                      ? "bg-accent-subtle text-accent"
                      : "bg-transparent text-on-muted hover:bg-surface hover:text-on-surface",
                  )}
                >
                  <span className="block font-medium text-on-surface">
                    {setlist.name}
                  </span>
                  <span className="text-xs uppercase tracking-[0.26em] text-on-muted">
                    {setlist.entries.length} song
                    {setlist.entries.length === 1 ? "" : "s"}
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

