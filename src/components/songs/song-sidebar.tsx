import type { Song } from "@/lib/domain/project";
import { cn } from "@/lib/utils";

type SongSidebarProps = {
  songs: Song[];
  selectedSongId?: string;
  onSelect: (songId: string) => void;
};

export function SongSidebar({
  songs,
  selectedSongId,
  onSelect,
}: SongSidebarProps) {
  return (
    <aside className="hidden flex-col border-r border-border/60 bg-surface-subtle lg:flex">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.32em] text-on-muted">
          Songs
        </h2>
        <span className="text-xs text-on-muted">{songs.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-1 px-2 pb-6">
          {songs.map((song) => {
            const isActive = song.id === selectedSongId;
            return (
              <li key={song.id}>
                <button
                  type="button"
                  onClick={() => onSelect(song.id)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150",
                    isActive
                      ? "bg-accent-subtle text-accent"
                      : "bg-transparent text-on-muted hover:bg-surface hover:text-on-surface",
                  )}
                >
                  <span className="block font-medium text-on-surface">
                    {song.title}
                  </span>
                  <span className="text-xs uppercase tracking-[0.26em] text-on-muted">
                    {song.key} · {song.tempo} BPM
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

