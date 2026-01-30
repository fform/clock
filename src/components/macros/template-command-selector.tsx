"use client";

import { useMemo, useState, useEffect } from "react";
import type { MidiDeviceTemplate, MidiStep, MidiCCStep, MidiPCStep } from "@/lib/domain/midi";

type TemplateCommandSelectorProps = {
  template: MidiDeviceTemplate;
  currentStep: MidiStep;
  onSelect: (step: MidiStep) => void;
  className?: string;
};

export function TemplateCommandSelector({
  template,
  currentStep,
  onSelect,
  className,
}: TemplateCommandSelectorProps) {
  const stepKind = currentStep.kind;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "">("");

  // Filter categories to only those with commands matching the step kind
  const relevantCategories = useMemo(() => {
    return template.categories.filter((category) =>
      category.commands.some((cmd) => cmd.step.kind === stepKind),
    );
  }, [template.categories, stepKind]);

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) {
      return relevantCategories[0];
    }
    return relevantCategories.find((cat) => cat.id === selectedCategoryId);
  }, [selectedCategoryId, relevantCategories]);

  const commands = useMemo(() => {
    if (!selectedCategory) return [];
    return selectedCategory.commands.filter((cmd) => cmd.step.kind === stepKind);
  }, [selectedCategory, stepKind]);

  // Find matching command for current step values
  const matchingCommand = useMemo(() => {
    for (const category of relevantCategories) {
      for (const command of category.commands) {
        const cmdStep = command.step;
        if (cmdStep.kind !== stepKind) continue;

        if (stepKind === "cc" && cmdStep.kind === "cc") {
          const currentCC = currentStep as MidiCCStep;
          if (
            cmdStep.controller === currentCC.controller &&
            cmdStep.value === currentCC.value
          ) {
            return { command, categoryId: category.id };
          }
        } else if (stepKind === "pc" && cmdStep.kind === "pc") {
          const currentPC = currentStep as MidiPCStep;
          if (
            cmdStep.program === currentPC.program &&
            cmdStep.bank?.msb === currentPC.bank?.msb &&
            cmdStep.bank?.lsb === currentPC.bank?.lsb
          ) {
            return { command, categoryId: category.id };
          }
        }
      }
    }
    return null;
  }, [relevantCategories, currentStep, stepKind]);

  // Auto-select category if there's a matching command
  useEffect(() => {
    if (matchingCommand && !selectedCategoryId) {
      setSelectedCategoryId(matchingCommand.categoryId);
    }
  }, [matchingCommand, selectedCategoryId]);

  if (relevantCategories.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        {relevantCategories.length > 1 && (
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="flex-1 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
          >
            {relevantCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        )}
        <select
          value={matchingCommand?.command.id || ""}
          onChange={(e) => {
            const commandId = e.target.value;
            if (commandId) {
              const command = commands.find((cmd) => cmd.id === commandId);
              if (command) {
                onSelect(command.step);
              }
            }
          }}
          className="flex-1 rounded-md border border-border/70 bg-surface-subtle px-2 py-1 text-xs text-on-surface focus:border-accent focus:outline-none"
        >
          <option value="">Select from template...</option>
          {commands.map((command) => (
            <option key={command.id} value={command.id}>
              {command.label} {command.summary && `(${command.summary})`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
