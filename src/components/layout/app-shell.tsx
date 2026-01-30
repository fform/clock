"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Download,
  Loader2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  SendHorizonal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/navigation";
import { useMidiPorts } from "@/lib/midi/context";
import type { MidiPortSummary } from "@/lib/midi/service";
import {
  hasUnsyncedChangesSelector,
  hasUnsyncedDisplaySelector,
  hasUnsyncedGlobalsSelector,
  projectNameSelector,
  projectVersionSelector,
  sidebarCollapsedSelector,
  unsyncedMacroIdsSelector,
  unsyncedSetlistIdsSelector,
  unsyncedSongIdsSelector,
  useClockStore,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { importProjectFromPedal, type ImportProgress } from "@/lib/pedal/importer";

type AppShellProps = {
  children: React.ReactNode;
};

type MidiStatusTone = "success" | "warning" | "danger" | "muted";

type MidiStatus = {
  tone: MidiStatusTone;
  label: string;
  detail: string;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const projectName = useClockStore(projectNameSelector);
  const projectVersion = useClockStore(projectVersionSelector);
  const sidebarCollapsed = useClockStore(sidebarCollapsedSelector);
  const toggleSidebar = useClockStore((state) => state.toggleSidebar);
  const connectedOutputId = useClockStore((state) => state.connectedOutputId);
  const setConnectedOutput = useClockStore((state) => state.setConnectedOutput);
  const unsyncedSongIds = useClockStore(unsyncedSongIdsSelector);
  const unsyncedSetlistIds = useClockStore(unsyncedSetlistIdsSelector);
  const unsyncedMacroIds = useClockStore(unsyncedMacroIdsSelector);
  const hasUnsyncedGlobals = useClockStore(hasUnsyncedGlobalsSelector);
  const hasUnsyncedDisplay = useClockStore(hasUnsyncedDisplaySelector);
  const hasUnsyncedChanges = useClockStore(hasUnsyncedChangesSelector);
  const midiPorts = useMidiPorts();
  const [isImporting, setIsImporting] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  const unsyncedSummary = useMemo(() => {
    const parts: string[] = [];
    if (unsyncedSongIds.length) {
      parts.push(
        `${unsyncedSongIds.length} song${unsyncedSongIds.length === 1 ? "" : "s"}`,
      );
    }
    if (unsyncedSetlistIds.length) {
      parts.push(
        `${unsyncedSetlistIds.length} setlist${unsyncedSetlistIds.length === 1 ? "" : "s"}`,
      );
    }
    if (unsyncedMacroIds.length) {
      parts.push(
        `${unsyncedMacroIds.length} macro${unsyncedMacroIds.length === 1 ? "" : "s"}`,
      );
    }
    if (hasUnsyncedGlobals) {
      parts.push("global settings");
    }
    if (hasUnsyncedDisplay) {
      parts.push("display settings");
    }
    return parts.join(", ");
  }, [
    unsyncedSongIds.length,
    unsyncedSetlistIds.length,
    unsyncedMacroIds.length,
    hasUnsyncedGlobals,
    hasUnsyncedDisplay,
  ]);

  const canvasOutput = useMemo<MidiPortSummary | undefined>(() => {
    if (!midiPorts?.outputs.length) {
      return undefined;
    }

    return midiPorts.outputs.find((output: MidiPortSummary) => {
      const signature = `${output.manufacturer ?? ""} ${output.name ?? ""}`.toLowerCase();
      return signature.includes("walrus") || signature.includes("canvas");
    });
  }, [midiPorts]);

  useEffect(() => {
    const nextId = canvasOutput?.id;
    if (nextId !== connectedOutputId) {
      setConnectedOutput(nextId);
    }
  }, [canvasOutput, connectedOutputId, setConnectedOutput]);

  const midiStatus = useMemo<MidiStatus>(() => {
    if (!midiPorts) {
      return {
        tone: "muted",
        label: "Detecting pedal…",
        detail: "",
      };
    }

    if (canvasOutput) {
      return {
        tone: "success",
        label: "Pedal connected",
        detail: canvasOutput.name ?? "Canvas Clock",
      };
    }

    if (midiPorts.outputs.length > 0) {
      return {
        tone: "warning",
        label: "Canvas Clock not found",
        detail: "Choose the pedal in MIDI settings",
      };
    }

    return {
      tone: "danger",
      label: "Pedal disconnected",
      detail: "Connect via USB to sync or import",
    };
  }, [midiPorts, canvasOutput]);

  const statusToneClasses: Record<MidiStatusTone, string> = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    muted: "text-on-muted",
  };

  const statusDotClasses: Record<MidiStatusTone, string> = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    muted: "bg-border",
  };

  const describeProgress = useCallback((progress: ImportProgress) => {
    switch (progress.stage) {
      case "connect":
        return "Connecting to pedal...";
      case "firmware":
        return "Reading firmware version...";
      case "global":
        return `Loading global settings (${progress.index + 1}/${progress.total})`;
      case "display":
        return `Loading display settings (${progress.index + 1}/${progress.total})`;
      case "jacks":
        return `Reading jack configuration (${progress.index + 1}/${progress.total})`;
      case "songs":
        return `Importing songs (${progress.index + 1}/${progress.total})`;
      case "setlists":
        return `Importing setlists (${progress.index + 1}/${progress.total})`;
      case "macros":
        return `Importing MIDI macros (${progress.index + 1}/${progress.total})`;
      case "finalize":
        return "Applying project data...";
      default:
        return "Working...";
    }
  }, []);

  const handleImport = useCallback(async (importAll = false) => {
    if (isImporting) return;
    setIsImporting(true);
    setProgressLabel("Connecting to pedal...");
    setImportStatus(null);
    setImportWarning(null);
    setImportError(null);

    try {
      const result = await importProjectFromPedal({
        importAll,
        onProgress: (progress) => {
          setProgressLabel(describeProgress(progress));
        },
      });

      setImportStatus(
        `Imported ${result.songs} song${result.songs === 1 ? "" : "s"}, ${result.macros} macro${result.macros === 1 ? "" : "s"}, and ${result.setlists} setlist${result.setlists === 1 ? "" : "s"}.`,
      );

      if (result.warnings.length) {
        setImportWarning(result.warnings.join(" "));
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Import failed. Make sure the pedal is connected via USB.";
      setImportError(message);
    } finally {
      setIsImporting(false);
      setProgressLabel(null);
    }
  }, [describeProgress, isImporting]);

  return (
    <div className="flex min-h-screen bg-background text-on-surface">
      <aside
        className={cn(
          "hidden border-r border-border/60 bg-surface transition-[width] duration-200 ease-brand lg:flex lg:flex-shrink-0",
          sidebarCollapsed ? "w-20" : "w-[var(--sidebar-width)]",
        )}
      >
        <div className="flex w-full flex-col gap-6 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-muted">
              Navigate
            </span>
            <button
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={toggleSidebar}
              className="text-on-muted transition hover:text-on-surface"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="size-5" aria-hidden />
              ) : (
                <PanelLeftClose className="size-5" aria-hidden />
              )}
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-2 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150",
                    isActive
                      ? "bg-accent-subtle text-accent"
                      : "text-on-muted hover:bg-surface-subtle hover:text-on-surface",
                    sidebarCollapsed && "justify-center px-0",
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div
            className={cn(
              "rounded-xl border border-dashed border-border/70 bg-surface-subtle p-3 text-xs leading-relaxed text-on-muted transition-colors duration-150",
              sidebarCollapsed && "hidden",
            )}
          >
            <p className="font-semibold text-on-surface">
              Need that cheatsheet?
            </p>
            <p>
              MIDI templates are coming soon — we&apos;ll surface your favorite
              gear profiles right here.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-[var(--header-height)] items-center justify-between border-b border-border/60 bg-surface px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-lg border border-border/60 p-2 text-on-muted transition hover:text-on-surface lg:hidden"
              aria-label="Toggle navigation"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <div>
              <p className="font-display text-lg font-semibold text-on-surface">
                {projectName}
              </p>
              <p className="text-xs text-on-muted">
                Project version {projectVersion}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span
                  aria-hidden
                  className={cn("h-2 w-2 rounded-full", statusDotClasses[midiStatus.tone])}
                />
                <span className={cn("font-medium", statusToneClasses[midiStatus.tone])}>
                  {midiStatus.label}
                </span>
                {midiStatus.detail ? (
                  <span className="text-on-muted/80">· {midiStatus.detail}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex flex-col items-end gap-1 text-right">
              {progressLabel ? (
                <p className="text-xs text-on-muted">{progressLabel}</p>
              ) : null}
              {importStatus ? (
                <p className="text-xs text-success">{importStatus}</p>
              ) : null}
              {importWarning ? (
                <p className="text-xs text-warning">{importWarning}</p>
              ) : null}
              {importError ? (
                <p className="text-xs text-danger">{importError}</p>
              ) : null}
              <p
                className={cn(
                  "text-xs",
                  hasUnsyncedChanges ? "text-warning" : "text-on-muted",
                )}
              >
                {hasUnsyncedChanges
                  ? `Unsynced changes: ${unsyncedSummary}`
                  : "All changes are synced with your pedal."}
              </p>
            </div>
            <div className="relative" ref={importMenuRef}>
              <div className="flex gap-0.5">
                <Button
                  variant="primary"
                  size="sm"
                  icon={
                    isImporting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="size-4" aria-hidden />
                    )
                  }
                  onClick={() => handleImport(false)}
                  disabled={isImporting}
                  className="rounded-r-none"
                >
                  {isImporting ? "Importing..." : "Import from pedal"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<ChevronDown className="size-3" />}
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  disabled={isImporting}
                  className="rounded-l-none border-l-0 px-2"
                />
              </div>
              {showImportMenu && (
                <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-border/60 bg-surface shadow-lg">
                  <button
                    onClick={() => {
                      handleImport(false);
                      setShowImportMenu(false);
                    }}
                    disabled={isImporting}
                    className="w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-subtle disabled:opacity-50"
                  >
                    Import Configured
                  </button>
                  <button
                    onClick={() => {
                      handleImport(true);
                      setShowImportMenu(false);
                    }}
                    disabled={isImporting}
                    className="w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-subtle disabled:opacity-50"
                  >
                    Import Everything
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<SendHorizonal className="size-4" aria-hidden />}
              disabled={!hasUnsyncedChanges}
            >
              Send everything to pedal
            </Button>
          </div>
        </header>

        <nav className="flex gap-2 border-b border-border/60 bg-surface-subtle px-3 py-2 text-sm font-medium lg:hidden">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5",
                  isActive
                    ? "bg-accent text-on-primary"
                    : "bg-surface text-on-muted",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <main className="flex flex-1 flex-col bg-surface-subtle">
          <div className="container mx-auto flex-1 px-4 pb-12 pt-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

