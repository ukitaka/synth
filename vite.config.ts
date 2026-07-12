/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Runtime deps are React + Tone.js only (NFR-07).
export default defineConfig({
  plugins: [react()],
  test: {
    // Pure-logic tests (validation, choke selection, round-trip) run under node.
    // Web-Audio offline-render tests are gated at runtime on OfflineAudioContext
    // availability (see test/helpers/audioEnv.ts).
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
