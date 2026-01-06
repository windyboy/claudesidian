// Session Hooks Plugin for OpenCode
// Replaces Claude Code hooks system with OpenCode plugin system

import type { Plugin } from "@opencode-ai/plugin";

export const sessionHooksPlugin: Plugin = async ({ client, $, directory }) => {
  return {
    event: async ({ event }) => {
      // Handle session created event
      if (event.type === "session.created") {
        console.error("[SessionHooks] Session started");

        try {
          // First-run detection and welcome message
          await checkFirstRun($, directory);

          // Update checking
          await checkUpdates($);
        } catch (error) {
          console.error("[SessionHooks] Error:", error);
        }
      }
    },
  };
};

/**
 * Check if this is the first run and display welcome message
 */
async function checkFirstRun($: any, directory: string) {
  const firstRunPath = `${directory}/FIRST_RUN`;

  try {
    // Check if FIRST_RUN file exists
    const result = await $`test -f ${firstRunPath}`.quiet();

    if (result.exitCode === 0) {
      // First run detected - display welcome message
      console.error(
        "[SessionHooks] First run detected - displaying welcome message",
      );

      const welcomeMessage =
        "# 🚀 Welcome to Claudesidian!\n\n**This appears to be your first time using this vault.**\n\n## Quick Start\n\nRun the setup wizard:\n\n⬇\n/init-bootstrap\n⬆\n\n## What this will do:\n\n✅ Set up your personalized configuration\n✅ Disconnect from the original repository\n✅ Help you import any existing Obsidian vault\n✅ Configure your preferred workflow\n✅ Create your PARA folder structure\n\nThe setup wizard will guide you through everything!\n";

      // Display welcome message
      console.error(`\n${welcomeMessage}\n`);
    } else {
      console.error("[SessionHooks] Not first run - skipping welcome message");
    }
  } catch (error) {
    console.error("[SessionHooks] Error checking first run:", error);
  }
}

/**
 * Check for npm updates silently
 */
async function checkUpdates($: any) {
  try {
    console.error("[SessionHooks] Checking for updates...");

    // Run update check silently (suppress errors with || true)
    await $`npm run check-updates --silent`.quiet();

    console.error("[SessionHooks] Update check completed");
  } catch (error) {
    // Silent failure - don't interrupt session
    console.error("[SessionHooks] Update check failed (continuing anyway)");
  }
}

export default sessionHooksPlugin;
