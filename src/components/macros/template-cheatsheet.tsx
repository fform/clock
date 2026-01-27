"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { useClockStore } from "@/lib/store";
import { getTemplateById } from "@/lib/midi/templates";
import type { MidiDeviceTemplate } from "@/lib/domain/midi";
import { cn } from "@/lib/utils";

type TemplateCheatsheetProps = {
  deviceId?: string;
  className?: string;
};

export function TemplateCheatsheet({ deviceId, className }: TemplateCheatsheetProps) {
  const templates = useClockStore((state) => state.templates);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const template = useMemo(() => {
    if (!deviceId) return undefined;
    return getTemplateById(deviceId) || templates.find((t) => t.id === deviceId);
  }, [deviceId, templates]);

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

  if (!template) {
    return null;
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
            {template.manufacturer} {template.model} - Command Reference
          </h3>
        </div>
        {isCollapsed ? (
          <ChevronDown className="size-4 text-on-muted" />
        ) : (
          <ChevronUp className="size-4 text-on-muted" />
        )}
      </button>

      {!isCollapsed && (
        <div className="border-t border-border/60 p-4 max-h-96 overflow-y-auto">
          {template.categories.length === 0 ? (
            <p className="text-xs text-on-muted">No commands available for this device.</p>
          ) : (
            <div className="space-y-3">
              {template.categories.map((category) => {
                const isExpanded = expandedCategories.has(category.id);
                return (
                  <div key={category.id} className="border-b border-border/40 pb-3 last:border-0">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-on-muted">
                        {category.label}
                      </h4>
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
      )}
    </div>
  );
}
