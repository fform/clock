import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, MinusCircle, Save, Undo2 } from "lucide-react";

import type { Setlist, Song } from "@/lib/domain/project";
import { Button } from "@/components/ui/button";
import { ensurePedalBridge } from "@/lib/pedal/bridge";
import { exportSetlistToDevice } from "@/lib/pedal/exporter";
import { useClockStore } from "@/lib/store";

type SetlistDetailProps = {
  setlist: Setlist;
  songs: Song[];
  onMoveEntry: (from: number, to: number) => void;
  onRemoveEntry: (entryId: string) => void;
  onAddEntry: (songId: string) => void;
  onUpdateSetlist: (setlist: Setlist) => void;
};

export function SetlistDetail({
  setlist,
  songs,
  onMoveEntry,
  onRemoveEntry,
  onAddEntry,
  onUpdateSetlist,
}: SetlistDetailProps) {
  const setlists = useClockStore((state) => state.setlists);
  const clearSetlistUnsynced = useClockStore((state) => state.clearSetlistUnsynced);
  const [selectedSongId, setSelectedSongId] = useState<string>("");
  const [draft, setDraft] = useState<Setlist>(setlist);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(setlist);
    setIsEditing(false);
  }, [setlist]);

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

  const handleFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setDraft((current) => ({
      ...current,
      [name]: value,
    }));
    setIsEditing(true);
  };

  const handleEntryNoteChange = (entryId: string, value: string) => {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === entryId ? { ...entry, notes: value } : entry,
      ),
    }));
    setIsEditing(true);
  };

  const handleReset = () => {
    setDraft(setlist);
    setIsEditing(false);
  };

  const handleSave = () => {
    onUpdateSetlist(draft);
    setIsEditing(false);
  };

  const handleSaveToDevice = useCallback(async () => {
    const slotIndex = setlists.findIndex((s) => s.id === draft.id);
    if (slotIndex === -1) {
      setSaveError("Cannot find setlist slot. Save the setlist first.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const bridge = await ensurePedalBridge();
      await exportSetlistToDevice(bridge, draft, slotIndex);
      setLastSavedAt(Date.now());
      clearSetlistUnsynced(draft.id);
      bridge.disconnect();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save setlist to device.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [draft, setlists, clearSetlistUnsynced]);

  const isDirty = useMemo(() => {
    if (draft.name !== setlist.name) return true;
    if ((draft.description ?? "") !== (setlist.description ?? "")) return true;
    if (draft.entries.length !== setlist.entries.length) return true;
    return draft.entries.some((entry, index) => {
      const original = setlist.entries[index];
      if (!original) return true;
      return (entry.notes ?? "") !== (original.notes ?? "");
    });
  }, [draft, setlist]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="rounded-2xl border border-border/60 bg-surface p-6 shadow-subtle">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">
              <input
                type="text"
                name="name"
                value={draft.name}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-transparent bg-transparent px-0 text-3xl font-semibold tracking-tight text-on-surface focus:border-accent focus:outline-none"
              />
            </h1>
            <p className="text-sm text-on-muted">
              <textarea
                name="description"
                value={draft.description ?? ""}
                onChange={handleFieldChange}
                placeholder="Add a short description for this setlist."
                rows={2}
                className="mt-2 w-full rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-sm text-on-surface focus:border-accent focus:outline-none"
              />
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<Undo2 className="size-4" aria-hidden />}
              onClick={handleReset}
              disabled={!isDirty && !isEditing}
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
              Save changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="size-4" />}
              onClick={handleSaveToDevice}
              disabled={isSaving || isDirty}
            >
              {isSaving ? "Saving…" : "Save to Device"}
            </Button>
          </div>
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
            const draftEntry =
              draft.entries.find((item) => item.id === entry.id) ?? entry;
            return (
              <li
                key={entry.id}
                className="rounded-xl border border-border/60 bg-surface-subtle p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-on-muted">
                      Position {index + 1}
                    </p>
                    <p className="text-lg font-medium text-on-surface">
                      {song?.title ?? "Unknown song"}
                    </p>
                    {song && (
                      <p className="text-xs text-on-muted">
                        {song.key} · {song.tempo} BPM
                      </p>
                    )}
                  <textarea
                    value={draftEntry.notes ?? ""}
                    onChange={(event) =>
                      handleEntryNoteChange(entry.id, event.target.value)
                    }
                    placeholder="Add transition notes or cues."
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm text-on-surface focus:border-accent focus:outline-none"
                  />
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

