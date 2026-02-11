import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("firebase/app", () => ({
  getApps: () => [],
  initializeApp: () => ({ name: "test-app" }),
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: null }),
  setPersistence: () => Promise.resolve(),
  browserLocalPersistence: {},
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
}));

const storage = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  },
});

Object.defineProperty(window, "scrollTo", {
  value: () => {},
});
