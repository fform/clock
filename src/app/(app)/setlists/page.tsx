"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import { Upload, ChevronDown } from "lucide-react";

import { SetlistDetail } from "@/components/setlists/setlist-detail";
import { SetlistSidebar } from "@/components/setlists/setlist-sidebar";
import { Button } from "@/components/ui/button";
import type { Setlist } from "@/lib/domain/project";
import {
  setlistsSelector,
  songsSelector,
  useClockStore,
} from "@/lib/store";
import { importSetlistsFromPedal } from "@/lib/pedal/importer";

const generateId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `set-${Date.now().toString(36)}`;

export default function SetlistsPage() {
  const setlists = useClockStore(setlistsSelector);
  const songs = useClockStore(songsSelector);
  const upsertSetlist = useClockStore((state) => state.upsertSetlist);
  const createSetlist = useClockStore((state) => state.createSetlist);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

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

  const handleUpdateSetlist = (updated: Setlist) => {
    upsertSetlist({
      ...updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCreateNewSetlist = useCallback(() => {
    const newSetlist = createSetlist();
    setSelectedSetlistId(newSetlist.id);
  }, [createSetlist]);

  const handleImportFromPedal = useCallback(async (importAll = false) => {
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const result = await importSetlistsFromPedal(importAll);
      if (result.warnings.length > 0) {
        setImportSuccess(`Imported ${result.setlists.length} setlists with ${result.warnings.length} warnings`);
      } else {
        setImportSuccess(`Successfully imported ${result.setlists.length} setlists from device`);
      }
      setTimeout(() => setImportSuccess(null), 5000);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to import setlists from device",
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
        <SetlistSidebar
          setlists={setlists}
          selectedSetlistId={activeSetlistId}
          onSelect={setSelectedSetlistId}
          onCreateNew={handleCreateNewSetlist}
        />

        <div className="flex flex-1 flex-col">
          <div className="border-b border-border/60 bg-surface-subtle px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 lg:hidden">
                <label className="block text-xs font-semibold text-on-muted">
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
                      Import All (10 slots)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 pt-6">
          {selectedSetlist ? (
            <SetlistDetail
              setlist={selectedSetlist}
              songs={songs}
              onMoveEntry={handleMoveEntry}
              onRemoveEntry={handleRemoveEntry}
              onAddEntry={handleAddEntry}
              onUpdateSetlist={handleUpdateSetlist}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface-subtle p-8 text-on-muted">
              Create a setlist to start planning your show.
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

