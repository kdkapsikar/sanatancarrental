import { defineProject } from "vitest/config";

export default defineProject({ test: { name: "fare-engine", include: ["src/**/*.test.ts"] } });
