"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import { Upload, ChevronDown } from "lucide-react";

import { MacroDetail } from "@/components/macros/macro-detail";
import { MacroSidebar } from "@/components/macros/macro-sidebar";
import { Button } from "@/components/ui/button";
import { macrosSelector, useClockStore } from "@/lib/store";
import { importMacrosFromPedal } from "@/lib/pedal/importer";

export default function MidiMacrosPage() {
  const macros = useClockStore(macrosSelector);
  const createMacro = useClockStore((state) => state.createMacro);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  const [selectedMacroId, setSelectedMacroId] = useState<string | undefined>(
    macros[0]?.id,
  );

  const activeMacroId = useMemo(() => {
    if (selectedMacroId && macros.some((macro) => macro.id === selectedMacroId)) {
      return selectedMacroId;
    }
    return macros[0]?.id;
  }, [selectedMacroId, macros]);

  const selectedMacro = useMemo(
    () => macros.find((macro) => macro.id === activeMacroId) ?? macros[0],
    [macros, activeMacroId],
  );

  const handleCreateMacro = () => {
    const newMacro = createMacro();
    setSelectedMacroId(newMacro.id);
  };

  const handleImportFromPedal = useCallback(async (importAll = false) => {
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const result = await importMacrosFromPedal(importAll);
      if (result.warnings.length > 0) {
        setImportSuccess(`Imported ${result.macros.length} macros with ${result.warnings.length} warnings`);
      } else {
        setImportSuccess(`Successfully imported ${result.macros.length} macros from device`);
      }
      // Auto-clear success message after 5 seconds
      setTimeout(() => setImportSuccess(null), 5000);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to import macros from device",
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
        <MacroSidebar
          macros={macros}
          selectedMacroId={activeMacroId}
          onSelect={setSelectedMacroId}
          onCreateMacro={handleCreateMacro}
        />

        <div className="flex flex-1 flex-col">
        <div className="border-b border-border/60 bg-surface-subtle px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 lg:hidden">
              <label className="block text-xs font-semibold text-on-muted">
                Macro
              </label>
              <select
                value={activeMacroId ?? ""}
                onChange={(event) => setSelectedMacroId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
              >
                {macros.map((macro) => (
                  <option key={macro.id} value={macro.id}>
                    {macro.name}
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
          {selectedMacro ? (
            <MacroDetail
              macro={selectedMacro}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface-subtle p-8 text-on-muted">
              Create a macro to start collecting MIDI events.
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

