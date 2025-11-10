import { createJSONStorage, type StateStorage } from "zustand/middleware";

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => void 0,
  removeItem: () => void 0,
};

export function createPersistedStorage<T>() {
  return createJSONStorage<T>(() => {
    if (typeof window === "undefined") {
      return noopStorage;
    }

    return window.localStorage;
  });
}

