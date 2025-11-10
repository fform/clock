import { AppShell } from "@/components/layout/app-shell";
import { MidiProvider } from "@/lib/midi/context";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MidiProvider>
      <AppShell>{children}</AppShell>
    </MidiProvider>
  );
}

