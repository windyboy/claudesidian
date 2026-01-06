# OpenCode Plugins

This directory contains OpenCode plugins for Claudesidian.

## Plugins

### session-hooks

**Purpose:** Replaces Claude Code hooks system

**Features:**

- First-run detection (checks for FIRST_RUN file)
- Welcome message display on initial setup
- Automatic npm update checking on session start

**Implementation:**

- Uses `session.created` event
- Executes shell commands via `$` API
- Graceful error handling (non-blocking)

**File:** `session-hooks.ts`

---

## How Plugins Work

OpenCode plugins are TypeScript modules that export a Plugin function:

```typescript
import type { Plugin } from "@opencode-ai/plugin";

export const myPlugin: Plugin = async ({ client, $, directory }) => {
  return {
    event: async ({ event }) => {
      // Handle events (session.created, etc.)
    },
  };
};
```

Plugins are automatically loaded from this directory based on the `plugin` configuration in `opencode.jsonc`.

---

## Adding New Plugins

1. Create a `.ts` file in this directory
2. Export a Plugin function
3. Add to `opencode.jsonc` plugin list if needed
4. Restart OpenCode to load

---

## Plugin Lifecycle

1. OpenCode starts
2. Loads plugins from `.opencode/plugin/`
3. Initializes each plugin with context (client, $, directory)
4. Listens for events (session.created, tool.execute.before, etc.)
5. Plugin code executes in response to events

---

## References

- OpenCode Plugin Documentation: https://opencode.ai/docs/plugins/
- Plugin TypeScript Types: `@opencode-ai/plugin`
