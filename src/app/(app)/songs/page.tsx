"use client";

import { useMemo, useState } from "react";

import { SongDetail } from "@/components/songs/song-detail";
import { SongSidebar } from "@/components/songs/song-sidebar";
import {
  macrosSelector,
  setlistsSelector,
  songsSelector,
  useClockStore,
} from "@/lib/store";

const generateId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `macro-${Date.now().toString(36)}`;

export default function SongsPage() {
  const songs = useClockStore(songsSelector);
  const macros = useClockStore(macrosSelector);
  const setlists = useClockStore(setlistsSelector);
  const upsertSong = useClockStore((state) => state.upsertSong);

  const [selectedSongId, setSelectedSongId] = useState<string | undefined>(
    songs[0]?.id,
  );

  const activeSongId = useMemo(() => {
    if (selectedSongId && songs.some((song) => song.id === selectedSongId)) {
      return selectedSongId;
    }
    return songs[0]?.id;
  }, [selectedSongId, songs]);

  const selectedSong = useMemo(
    () => songs.find((song) => song.id === activeSongId) ?? songs[0],
    [songs, activeSongId],
  );

  const handleMoveMacro = (from: number, to: number) => {
    if (!selectedSong) return;
    if (to < 0 || to >= selectedSong.macros.length) return;
    const nextMacros = [...selectedSong.macros];
    const [moved] = nextMacros.splice(from, 1);
    nextMacros.splice(to, 0, moved);
    upsertSong({
      ...selectedSong,
      macros: nextMacros,
    });
  };

  const handleToggleMacro = (macroInstanceId: string) => {
    if (!selectedSong) return;
    upsertSong({
      ...selectedSong,
      macros: selectedSong.macros.map((instance) =>
        instance.id === macroInstanceId
          ? { ...instance, enabled: !instance.enabled }
          : instance,
      ),
    });
  };

  const handleRemoveMacro = (macroInstanceId: string) => {
    if (!selectedSong) return;
    upsertSong({
      ...selectedSong,
      macros: selectedSong.macros.filter(
        (instance) => instance.id !== macroInstanceId,
      ),
    });
  };

  const handleAddMacro = (macroId: string) => {
    if (!selectedSong) return;
    upsertSong({
      ...selectedSong,
      macros: [
        ...selectedSong.macros,
        {
          id: generateId(),
          macroId,
          enabled: true,
        },
      ],
    });
  };

  return (
    <div className="flex min-h-[calc(100vh_-_var(--header-height))] flex-1 overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-subtle">
      <SongSidebar
        songs={songs}
        selectedSongId={activeSongId}
        onSelect={setSelectedSongId}
      />

      <div className="flex flex-1 flex-col">
        <div className="border-b border-border/60 bg-surface-subtle px-3 py-3 lg:hidden">
          <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-on-muted">
            Song
          </label>
          <select
            value={activeSongId ?? ""}
            onChange={(event) => setSelectedSongId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
          >
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title} · {song.tempo} BPM
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 pt-6">
          {selectedSong ? (
            <SongDetail
              song={selectedSong}
              macros={macros}
              setlists={setlists}
              onMoveMacro={handleMoveMacro}
              onToggleMacro={handleToggleMacro}
              onRemoveMacro={handleRemoveMacro}
              onAddMacro={handleAddMacro}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface-subtle p-8 text-on-muted">
              Add a song to begin programming macros.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

