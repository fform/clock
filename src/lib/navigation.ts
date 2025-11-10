import type { LucideIcon } from "lucide-react";
import {
  GaugeCircle,
  LibraryBig,
  ListMusic,
  MonitorCog,
  Settings2,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/songs", label: "Songs", icon: ListMusic },
  { href: "/setlists", label: "Setlists", icon: LibraryBig },
  { href: "/midi-macros", label: "MIDI macros", icon: GaugeCircle },
  { href: "/global", label: "Global", icon: Settings2 },
  { href: "/display", label: "Display", icon: MonitorCog },
];

