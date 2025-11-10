"use client";

import { useMemo, useState } from "react";

import { SetlistDetail } from "@/components/setlists/setlist-detail";
import { SetlistSidebar } from "@/components/setlists/setlist-sidebar";
import {
  setlistsSelector,
  songsSelector,
  useClockStore,
} from "@/lib/store";

const generateId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `set-${Date.now().toString(36)}`;

export default function SetlistsPage() {
  const setlists = useClockStore(setlistsSelector);
  const songs = useClockStore(songsSelector);
  const upsertSetlist = useClockStore((state) => state.upsertSetlist);

  const [selectedSetlistId, setSelectedSetlistId] = useState<string | undefined>(
    setlists[0]?.id,
  );

  const activeSetlistId = useMemo(() => {
    if (
      selectedSetlistId &&
      setlists.some((setlist) => setlist.id === selectedSetlistId)
    ) {
      return selectedSetlistId;
    }
    return setlists[0]?.id;
  }, [selectedSetlistId, setlists]);

  const selectedSetlist = useMemo(
    () =>
      setlists.find((setlist) => setlist.id === activeSetlistId) ?? setlists[0],
    [setlists, activeSetlistId],
  );

  const handleMoveEntry = (from: number, to: number) => {
    if (!selectedSetlist) return;
    if (to < 0 || to >= selectedSetlist.entries.length) return;
    const nextEntries = [...selectedSetlist.entries];
    const [moved] = nextEntries.splice(from, 1);
    nextEntries.splice(to, 0, moved);
    upsertSetlist({
      ...selectedSetlist,
      entries: nextEntries,
    });
  };

  const handleRemoveEntry = (entryId: string) => {
    if (!selectedSetlist) return;
    upsertSetlist({
      ...selectedSetlist,
      entries: selectedSetlist.entries.filter((entry) => entry.id !== entryId),
    });
  };

  const handleAddEntry = (songId: string) => {
    if (!selectedSetlist) return;
    upsertSetlist({
      ...selectedSetlist,
      entries: [
        ...selectedSetlist.entries,
        {
          id: generateId(),
          songId,
        },
      ],
    });
  };

  return (
    <div className="flex min-h-[calc(100vh_-_var(--header-height))] flex-1 overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-subtle">
      <SetlistSidebar
        setlists={setlists}
        selectedSetlistId={activeSetlistId}
        onSelect={setSelectedSetlistId}
      />

      <div className="flex flex-1 flex-col">
        <div className="border-b border-border/60 bg-surface-subtle px-3 py-3 lg:hidden">
          <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-on-muted">
            Setlist
          </label>
          <select
            value={activeSetlistId ?? ""}
            onChange={(event) => setSelectedSetlistId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
          >
            {setlists.map((setlist) => (
              <option key={setlist.id} value={setlist.id}>
                {setlist.name} · {setlist.entries.length} song
                {setlist.entries.length === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 pt-6">
          {selectedSetlist ? (
            <SetlistDetail
              setlist={selectedSetlist}
              songs={songs}
              onMoveEntry={handleMoveEntry}
              onRemoveEntry={handleRemoveEntry}
              onAddEntry={handleAddEntry}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface-subtle p-8 text-on-muted">
              Create a setlist to start planning your show.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

