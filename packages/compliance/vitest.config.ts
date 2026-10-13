import { defineProject } from "vitest/config";

export default defineProject({ test: { name: "compliance", include: ["src/**/*.test.ts"] } });
