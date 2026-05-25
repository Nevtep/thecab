import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF,
  maxDuration: 300,
  dirs: ["./src/server/trigger/tasks"],
} as never);