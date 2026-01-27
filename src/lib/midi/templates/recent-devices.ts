const RECENT_DEVICES_KEY = "clock-recent-midi-devices";
const MAX_RECENT_DEVICES = 5;

export function getRecentDevices(): string[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(RECENT_DEVICES_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as string[];
  } catch {
    return [];
  }
}

export function addRecentDevice(deviceId: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const recent = getRecentDevices();
    // Remove if already exists
    const filtered = recent.filter((id) => id !== deviceId);
    // Add to front
    const updated = [deviceId, ...filtered].slice(0, MAX_RECENT_DEVICES);
    localStorage.setItem(RECENT_DEVICES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore errors
  }
}

export function clearRecentDevices(): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(RECENT_DEVICES_KEY);
  } catch {
    // Ignore errors
  }
}
