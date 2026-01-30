"use client";

import { useCallback, useMemo, useState, useRef } from "react";

import { SongDetail } from "@/components/songs/song-detail";
import { SongSidebar } from "@/components/songs/song-sidebar";
import type { Song } from "@/lib/domain/project";
import { Button } from "@/components/ui/button";
import { Upload, ChevronDown } from "lucide-react";
import {
  macrosSelector,
  setlistsSelector,
  songsSelector,
  useClockStore,
} from "@/lib/store";
import { importSongsFromPedal } from "@/lib/pedal/importer";

const generateId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `macro-${Date.now().toString(36)}`;

export default function SongsPage() {
  const songs = useClockStore(songsSelector);
  const macros = useClockStore(macrosSelector);
  const setlists = useClockStore(setlistsSelector);
  const upsertSong = useClockStore((state) => state.upsertSong);
  const createSong = useClockStore((state) => state.createSong);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

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

  const handleUpdateSong = (updated: Song) => {
    upsertSong({
      ...updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCreateNewSong = useCallback(() => {
    const newSong = createSong();
    setSelectedSongId(newSong.id);
  }, [createSong]);

  const handleImportFromPedal = useCallback(async (importAll = false) => {
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const result = await importSongsFromPedal(importAll);
      if (result.warnings.length > 0) {
        setImportSuccess(`Imported ${result.songs.length} songs with ${result.warnings.length} warnings`);
      } else {
        setImportSuccess(`Successfully imported ${result.songs.length} songs from device`);
      }
      setTimeout(() => setImportSuccess(null), 5000);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to import songs from device",
      );
    } finally {
      setIsImporting(false);
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {(importError || importSuccess) && (
        <div className={`rounded-lg border p-3 ${importError ? 'border-danger/60 bg-danger/10 text-danger' : 'border-success/60 bg-success/10 text-success'}`}>
          <p className="text-sm">{importError || importSuccess}</p>
        </div>
      )}

      <div className="flex min-h-[calc(100vh_-_var(--header-height)_-_4rem)] flex-1 overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-subtle">
        <SongSidebar
          songs={songs}
          selectedSongId={activeSongId}
          onSelect={setSelectedSongId}
          onCreateNew={handleCreateNewSong}
        />

        <div className="flex flex-1 flex-col">
        <div className="border-b border-border/60 bg-surface-subtle px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 lg:hidden">
              <label className="block text-xs font-semibold text-on-muted">
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
            <div className="relative" ref={importMenuRef}>
              <div className="flex gap-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Upload className="size-4" />}
                  onClick={() => handleImportFromPedal(false)}
                  disabled={isImporting}
                  className="rounded-r-none"
                >
                  {isImporting ? "Importing..." : "Import from Device"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ChevronDown className="size-3" />}
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  disabled={isImporting}
                  className="rounded-l-none border-l-0 px-2"
                />
              </div>
              {showImportMenu && (
                <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-border/60 bg-surface shadow-lg">
                  <button
                    onClick={() => {
                      handleImportFromPedal(false);
                      setShowImportMenu(false);
                    }}
                    disabled={isImporting}
                    className="w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-subtle disabled:opacity-50"
                  >
                    Import Configured
                  </button>
                  <button
                    onClick={() => {
                      handleImportFromPedal(true);
                      setShowImportMenu(false);
                    }}
                    disabled={isImporting}
                    className="w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-subtle disabled:opacity-50"
                  >
                    Import All (128 slots)
                  </button>
                </div>
              )}
            </div>
          </div>
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
            onUpdateSong={handleUpdateSong}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface-subtle p-8 text-on-muted">
              Add a song to begin programming macros.
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

