 "use client";
 
import { createContext, useContext, useEffect, useMemo, useState } from "react";
 
import { MidiService, type MidiPortsSnapshot } from "./service";
 
 const MidiContext = createContext<MidiService | null>(null);
 
 export function MidiProvider({ children }: { children: React.ReactNode }) {
  const service = useMemo(() => new MidiService({ sysex: true }), []);

   useEffect(() => {
     // Ensure we're in the browser
     if (typeof window === "undefined") {
       return;
     }

     service
       .initialize()
       .catch((error) => {
         // Only log as warning, don't throw - allows app to continue without MIDI
         console.warn("[MidiService] initialization failed", error);
       });
   }, [service]);

   return (
     <MidiContext.Provider value={service}>{children}</MidiContext.Provider>
   );
 }
 
 export function useMidi() {
   const context = useContext(MidiContext);
   if (!context) {
     throw new Error("useMidi must be used within a MidiProvider");
   }
   return context;
 }

export function useMidiPorts() {
  const service = useMidi();
  const [snapshot, setSnapshot] = useState<MidiPortsSnapshot | null>(null);

  useEffect(() => {
    const unsubscribe = service.subscribePorts((next) => {
      setSnapshot(next);
    });
    return () => {
      unsubscribe();
    };
  }, [service]);

  return snapshot;
}

