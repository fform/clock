import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MinusCircle } from "lucide-react";

import type { Setlist, Song } from "@/lib/domain/project";
import { Button } from "@/components/ui/button";

type SetlistDetailProps = {
  setlist: Setlist;
  songs: Song[];
  onMoveEntry: (from: number, to: number) => void;
  onRemoveEntry: (entryId: string) => void;
  onAddEntry: (songId: string) => void;
};

export function SetlistDetail({
  setlist,
  songs,
  onMoveEntry,
  onRemoveEntry,
  onAddEntry,
}: SetlistDetailProps) {
  const [selectedSongId, setSelectedSongId] = useState<string>("");

  const songLookup = useMemo(
    () => new Map(songs.map((song) => [song.id, song])),
    [songs],
  );

  const totalTempo = setlist.entries.reduce((acc, entry) => {
    const song = songLookup.get(entry.songId);
    return song ? acc + song.tempo : acc;
  }, 0);

  const handleAddEntry = () => {
    if (!selectedSongId) return;
    onAddEntry(selectedSongId);
    setSelectedSongId("");
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              {setlist.name}
            </h1>
            <p className="text-sm text-on-muted">
              {setlist.description ?? "Draft setlist"}
            </p>
          </div>
          <div className="flex items-center gap-3" />
        </div>
      </header>

      <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              Running order
            </h2>
            <p className="text-sm text-on-muted">
              {setlist.entries.length} song
              {setlist.entries.length === 1 ? "" : "s"} · Avg tempo{" "}
              {setlist.entries.length
                ? Math.round(totalTempo / setlist.entries.length)
                : 0}{" "}
              BPM
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedSongId}
              onChange={(event) => setSelectedSongId(event.target.value)}
              className="rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface"
            >
              <option value="">Add song…</option>
              {songs.map((song) => (
                <option key={song.id} value={song.id}>
                  {song.title} · {song.tempo} BPM
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddEntry}
              disabled={!selectedSongId}
            >
              Add
            </Button>
          </div>
        </div>

        <ol className="mt-6 space-y-3">
          {setlist.entries.length === 0 && (
            <li className="rounded-xl border border-dashed border-border/60 bg-surface-subtle p-4 text-sm text-on-muted">
              Start adding songs to build your show.
            </li>
          )}

          {setlist.entries.map((entry, index) => {
            const song = songLookup.get(entry.songId);
            return (
              <li
                key={entry.id}
                className="rounded-xl border border-border/60 bg-surface-subtle p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-on-muted">
                      Position {index + 1}
                    </p>
                    <p className="text-lg font-medium text-on-surface">
                      {song?.title ?? "Unknown song"}
                    </p>
                    {song && (
                      <p className="text-xs uppercase tracking-[0.26em] text-on-muted">
                        {song.key} · {song.tempo} BPM
                      </p>
                    )}
                    {entry.notes && (
                      <p className="mt-2 text-sm text-on-muted">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Move song up"
                      disabled={index === 0}
                      onClick={() => onMoveEntry(index, index - 1)}
                      className="rounded-lg border border-border/60 p-2 text-on-muted transition hover:text-on-surface disabled:opacity-50"
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Move song down"
                      disabled={index === setlist.entries.length - 1}
                      onClick={() => onMoveEntry(index, index + 1)}
                      className="rounded-lg border border-border/60 p-2 text-on-muted transition hover:text-on-surface disabled:opacity-50"
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove song from setlist"
                      onClick={() => onRemoveEntry(entry.id)}
                      className="rounded-lg border border-border/60 p-2 text-danger transition hover:text-danger/80"
                    >
                      <MinusCircle className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

