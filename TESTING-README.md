# OpenCode SDK Migration - Testing Guide

This directory contains all testing resources for the OpenCode SDK migration from stdio-based to HTTP-based architecture.

## Quick Start

1. **Run All Automated Tests** (Recommended first step):
   ```bash
   pnpm test:all
   ```
   This runs verification + comprehensive automated test suite.

2. **Individual Test Commands**:
   ```bash
   pnpm test:verify      # Verify migration implementation
   pnpm test:connection  # Test server connection (requires server running)
   pnpm test:automated   # Run comprehensive automated test suite
   ```

3. **Follow Test Execution Guide**:
   See [TEST-EXECUTION-GUIDE.md](./TEST-EXECUTION-GUIDE.md) for detailed manual testing steps.

## Files Overview

### Test Scripts

- **`.scripts/verify-opencode-migration.sh`** - Verifies migration implementation
  - Checks for `getClient()` method
  - Verifies `queryViaSDK` uses OpenCodeClient
  - Checks image handling in both methods
  - Validates dependencies and settings UI
  - Run: `pnpm test:verify`

- **`.scripts/test-opencode-connection.sh`** - Tests server connection
  - Checks health endpoint
  - Verifies server reachability
  - Run: `pnpm test:connection` or `bash .scripts/test-opencode-connection.sh [url]`

### Documentation

- **`TEST-EXECUTION-GUIDE.md`** - Step-by-step manual testing instructions
  - 35 test cases across 10 categories
  - Detailed pass/fail criteria
  - Troubleshooting tips

- **`TEST-RESULTS-TEMPLATE.md`** - Template for recording test results
  - Checkboxes for all 35 tests
  - Space for notes and issues
  - Summary section

- **Test Plan** (in `.cursor/plans/`) - Original comprehensive test plan
  - Full test specifications
  - Expected behaviors
  - Code file references

## Test Categories

1. **Server Connection & Health Checks** (4 tests)
2. **Session Management** (4 tests)
3. **Basic Query Functionality** (3 tests)
4. **Streaming Responses** (3 tests)
5. **Image Handling** (4 tests)
6. **Service Integrations** (4 tests)
7. **Error Handling** (4 tests)
8. **Settings Configuration** (3 tests)
9. **MCP Integration** (2 tests)
10. **Performance & Edge Cases** (4 tests)

**Total: 35 manual tests**

## Prerequisites

Before testing, ensure:

- [ ] OpenCode CLI installed: `npm install -g @opencode-ai/cli`
- [ ] OpenCode server running: `opencode server`
- [ ] Obsidian vault open with plugin enabled
- [ ] Plugin settings accessible
- [ ] Test files available (markdown, optional image)

## Testing Workflow

### Phase 1: Pre-Testing

```bash
# 1. Verify code implementation
pnpm test:verify

# 2. Start OpenCode server (in separate terminal)
opencode server

# 3. Test server connection
pnpm test:connection
```

### Phase 2: Manual Testing

1. Open [TEST-EXECUTION-GUIDE.md](./TEST-EXECUTION-GUIDE.md)
2. Copy [TEST-RESULTS-TEMPLATE.md](./TEST-RESULTS-TEMPLATE.md) to `TEST-RESULTS.md`
3. Execute tests category by category
4. Record results in `TEST-RESULTS.md`

### Phase 3: Post-Testing

- [ ] Review all test results
- [ ] Document any failures
- [ ] Fix critical issues
- [ ] Update migration tracking document
- [ ] Run code quality check: `pnpm lint:check`

## Success Criteria

All tests should pass with:
- ✅ No connection errors (when server is running)
- ✅ Proper error messages (when server is not running)
- ✅ Streaming responses work correctly
- ✅ Image handling works for both `queryViaSDK` and `sendPrompt`
- ✅ All services use centralized OpenCodeClient
- ✅ Settings persist and apply correctly
- ✅ Session management works as expected

## Troubleshooting

**Verification script fails:**
- Check that all migration fixes are applied
- Review error messages in script output
- Verify `main.js` has all required changes

**Connection test fails:**
- Ensure OpenCode server is running: `opencode server`
- Check server URL in settings matches running server
- Verify firewall/network settings
- Try different port if 4096 is in use

**Tests fail during execution:**
- Check browser/console for errors
- Verify OpenCode server logs
- Review test execution guide troubleshooting section
- Check plugin settings configuration

## Related Documentation

- [AGENTS.md](./AGENTS.md) - Development guidelines
- [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) - Migration overview
- [MIGRATION_TRACKING.md](./MIGRATION_TRACKING.md) - Migration progress
- [.scripts/README.md](./.scripts/README.md) - Scripts documentation

## Support

For issues or questions:
1. Check troubleshooting sections in test guides
2. Review console/error logs
3. Verify all prerequisites are met
4. Check OpenCode server status

