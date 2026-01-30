"use client";

import { useMemo, useState, useEffect } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { useClockStore } from "@/lib/store";
import { getTemplateById, loadTemplateById } from "@/lib/midi/templates";
import type { MidiDeviceTemplate, MidiChannel } from "@/lib/domain/midi";
import { cn } from "@/lib/utils";

type TemplateCheatsheetProps = {
  channelDeviceMap: Partial<Record<MidiChannel, string>>;
  className?: string;
};

export function TemplateCheatsheet({ channelDeviceMap, className }: TemplateCheatsheetProps) {
  const templates = useClockStore((state) => state.templates);
  const registerTemplates = useClockStore((state) => state.registerTemplates);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loadedTemplates, setLoadedTemplates] = useState<MidiDeviceTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get unique device IDs from channel map
  const deviceIds = useMemo(() => {
    return Array.from(new Set(Object.values(channelDeviceMap).filter(Boolean)));
  }, [channelDeviceMap]);

  // Lazy-load templates when devices change
  useEffect(() => {
    if (deviceIds.length === 0) {
      setLoadedTemplates([]);
      return;
    }

    let mounted = true;

    async function loadTemplates() {
      setIsLoading(true);
      const templatesPromises = deviceIds.map(async (deviceId) => {
        // Check if template is already available
        const existingTemplate = getTemplateById(deviceId) || templates.find((t) => t.id === deviceId);
        if (existingTemplate) {
          return existingTemplate;
        }

        // Load template from API
        try {
          const loadedTemplate = await loadTemplateById(deviceId);
          if (loadedTemplate) {
            registerTemplates([loadedTemplate]);
            return loadedTemplate;
          }
        } catch (error) {
          console.error("Failed to load template:", error);
        }
        return null;
      });

      const results = await Promise.all(templatesPromises);
      if (mounted) {
        setLoadedTemplates(results.filter((t): t is MidiDeviceTemplate => t !== null));
        setIsLoading(false);
      }
    }

    loadTemplates();

    return () => {
      mounted = false;
    };
  }, [deviceIds, templates, registerTemplates]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  if (deviceIds.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-surface shadow-subtle p-4", className)}>
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-on-muted animate-pulse" />
          <p className="text-sm text-on-muted">
            Loading templates...
          </p>
        </div>
      </div>
    );
  }

  if (loadedTemplates.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-surface shadow-subtle p-4", className)}>
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-on-muted" />
          <p className="text-sm text-on-muted">
            No templates available for assigned devices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border/60 bg-surface shadow-subtle", className)}>
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-subtle transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-on-muted" />
          <h3 className="text-sm font-semibold text-on-surface">
            Command References ({loadedTemplates.length} device{loadedTemplates.length === 1 ? "" : "s"})
          </h3>
        </div>
        {isCollapsed ? (
          <ChevronDown className="size-4 text-on-muted" />
        ) : (
          <ChevronUp className="size-4 text-on-muted" />
        )}
      </button>

      {!isCollapsed && (
        <div className="border-t border-border/60 p-4 max-h-96 overflow-y-auto space-y-6">
          {loadedTemplates.map((template) => (
            <div key={template.id}>
              <h4 className="text-sm font-semibold text-on-surface mb-3">
                {template.manufacturer} {template.model}
              </h4>
              {template.categories.length === 0 ? (
                <p className="text-xs text-on-muted">No commands available for this device.</p>
              ) : (
                <div className="space-y-3">
                  {template.categories.map((category) => {
                    const categoryKey = `${template.id}-${category.id}`;
                    const isExpanded = expandedCategories.has(categoryKey);
                    return (
                      <div key={categoryKey} className="border-b border-border/40 pb-3 last:border-0">
                        <button
                          type="button"
                          onClick={() => toggleCategory(categoryKey)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <h5 className="text-xs font-semibold text-on-muted">
                            {category.label}
                          </h5>
                          {isExpanded ? (
                            <ChevronUp className="size-3 text-on-muted" />
                          ) : (
                            <ChevronDown className="size-3 text-on-muted" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-1">
                            {category.commands.map((command) => {
                              const step = command.step;
                              let summary = "";
                              if (step.kind === "cc") {
                                summary = `CC ${step.controller} = ${step.value}`;
                              } else if (step.kind === "pc") {
                                summary = `PC ${step.program}`;
                                if (step.bank) {
                                  summary += ` (Bank MSB:${step.bank.msb ?? 0} LSB:${step.bank.lsb ?? 0})`;
                                }
                              }
                              return (
                                <div
                                  key={command.id}
                                  className="rounded-md bg-surface-subtle px-2 py-1.5 text-xs"
                                >
                                  <div className="font-medium text-on-surface">{command.label}</div>
                                  {command.summary && (
                                    <div className="mt-0.5 text-on-muted">{command.summary}</div>
                                  )}
                                  <div className="mt-1 font-mono text-on-muted">{summary}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
