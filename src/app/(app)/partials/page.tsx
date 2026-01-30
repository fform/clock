"use client";

import { useMemo, useState } from "react";

import { PartialDetail } from "@/components/partials/partial-detail";
import { PartialSidebar } from "@/components/partials/partial-sidebar";
import {
  partialsSelector,
  useClockStore,
} from "@/lib/store";

export default function PartialsPage() {
  const partials = useClockStore(partialsSelector);

  const [selectedPartialId, setSelectedPartialId] = useState<string | undefined>(
    partials[0]?.id,
  );

  const activePartialId = useMemo(() => {
    if (selectedPartialId && partials.some((p) => p.id === selectedPartialId)) {
      return selectedPartialId;
    }
    return partials[0]?.id;
  }, [selectedPartialId, partials]);

  const selectedPartial = useMemo(
    () => partials.find((p) => p.id === activePartialId) ?? partials[0],
    [partials, activePartialId],
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex min-h-[calc(100vh_-_var(--header-height)_-_4rem)] flex-1 overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-subtle">
        <PartialSidebar
          partials={partials}
          selectedPartialId={activePartialId}
          onSelect={setSelectedPartialId}
        />

        <div className="flex flex-1 flex-col">
          <div className="border-b border-border/60 bg-surface-subtle px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 lg:hidden">
                <label className="block text-xs font-semibold text-on-muted">
                  Partial
                </label>
                <select
                  value={activePartialId ?? ""}
                  onChange={(event) => setSelectedPartialId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-on-surface"
                >
                  {partials.map((partial) => (
                    <option key={partial.id} value={partial.id}>
                      {partial.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-6">
            {selectedPartial ? (
              <PartialDetail partial={selectedPartial} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface-subtle p-8 text-on-muted">
                Create a partial to save reusable MIDI command sequences.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
