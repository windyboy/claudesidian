# OpenCode SDK Migration - Test Execution Guide

This guide provides step-by-step instructions for executing the manual test plan.

## Quick Start

1. **Verify Implementation**: Run verification script
   ```bash
   bash .scripts/verify-opencode-migration.sh
   ```

2. **Test Server Connection**: Verify OpenCode server is running
   ```bash
   bash .scripts/test-opencode-connection.sh
   ```

3. **Start Testing**: Follow the test categories below

## Prerequisites Checklist

Before starting tests, ensure:

- [ ] OpenCode CLI installed: `npm install -g @opencode-ai/cli` or `pnpm add -g @opencode-ai/cli`
- [ ] OpenCode server running: `opencode server` (in separate terminal)
- [ ] Obsidian vault open
- [ ] Claudesidian plugin enabled in Obsidian
- [ ] Plugin settings accessible (Settings → Claudesidian)
- [ ] At least one markdown file in vault for testing
- [ ] Optional: Sample image file for image tests

## Test Execution Workflow

### Phase 1: Pre-Testing Verification

**Run Code Verification:**
```bash
bash .scripts/verify-opencode-migration.sh
```

Expected: All checks pass ✅

**Test Server Connection:**
```bash
bash .scripts/test-opencode-connection.sh
```

Expected: Server health check passes ✅

### Phase 2: Category-by-Category Testing

Execute tests in order, checking off each test as you complete it.

#### Category 1: Server Connection & Health Checks

**Test 1.1: Default Server Connection**
1. Open Obsidian → Settings → Claudesidian
2. Verify "OpenCode Server URL" shows `http://localhost:4096`
3. Send a simple query: "What is 2+2?"
4. ✅ **Pass**: Query processes successfully
5. ❌ **Fail**: Connection error or query fails

**Test 1.2: Custom Server URL**
1. Change server URL in settings to `http://localhost:5000`
2. Start OpenCode server on port 5000: `opencode server --port 5000`
3. Send a query
4. ✅ **Pass**: Query works with custom URL
5. ❌ **Fail**: Connection fails or uses wrong URL

**Test 1.3: Server Not Running**
1. Stop OpenCode server (Ctrl+C in server terminal)
2. Send a query through plugin
3. ✅ **Pass**: User-friendly error message displayed
4. ❌ **Fail**: Generic error or no error shown

**Test 1.4: Invalid Server URL**
1. Set invalid URL: `http://invalid:9999`
2. Send a query
3. ✅ **Pass**: Error message indicates connection failure
4. ❌ **Fail**: No error or unclear error message

**Category 1 Results**: ___/4 tests passed

---

#### Category 2: Session Management

**Test 2.1: Session Creation**
1. Open browser console (F12) or Obsidian developer console
2. Send first query after plugin load
3. Look for session creation in logs
4. ✅ **Pass**: Session ID created and logged
5. ❌ **Fail**: No session created or error

**Test 2.2: Session Persistence**
1. Query A: "My name is Alice"
2. Query B: "What is my name?"
3. ✅ **Pass**: Query B responds "Alice"
4. ❌ **Fail**: Query B doesn't remember context

**Test 2.3: Session ID Retrieval**
1. Send a query
2. Check if session ID is accessible (may require console inspection)
3. ✅ **Pass**: Session ID is non-null string
4. ❌ **Fail**: Session ID is null or undefined

**Test 2.4: Session Reset**
1. Send multiple queries
2. Reload Obsidian plugin (disable and re-enable)
3. Send new query
4. ✅ **Pass**: New session created (no previous context)
5. ❌ **Fail**: Old context persists

**Category 2 Results**: ___/4 tests passed

---

#### Category 3: Basic Query Functionality

**Test 3.1: Simple Text Query**
1. Query: "What is 2+2?"
2. ✅ **Pass**: Response is "4" or similar
3. ❌ **Fail**: No response or wrong answer

**Test 3.2: Multi-turn Conversation**
1. Query 1: "My name is Alice"
2. Query 2: "What is my name?"
3. ✅ **Pass**: Query 2 responds "Alice"
4. ❌ **Fail**: Query 2 doesn't remember

**Test 3.3: System Prompt**
1. Send query with system prompt (if feature available)
2. Verify response follows system instructions
3. ✅ **Pass**: Response follows system prompt
4. ❌ **Fail**: System prompt ignored

**Category 3 Results**: ___/3 tests passed

---

#### Category 4: Streaming Responses

**Test 4.1: Text Streaming**
1. Send query: "Write a 500-word essay about AI"
2. Observe response appearing
3. ✅ **Pass**: Text appears incrementally (streaming)
4. ❌ **Fail**: All text appears at once (no streaming)

**Test 4.2: Streaming Events**
1. Send query and monitor events
2. Check for: `text`, `thinking`, `usage`, `done` events
3. ✅ **Pass**: All event types received
4. ❌ **Fail**: Missing event types

**Test 4.3: Abort Streaming**
1. Send long-running query
2. Cancel/abort mid-stream (if cancel button available)
3. ✅ **Pass**: Streaming stops, `done` event received
4. ❌ **Fail**: Streaming continues or error occurs

**Category 4 Results**: ___/3 tests passed

---

#### Category 5: Image Handling

**Test 5.1: Image Prompt (queryViaSDK)**
1. Use feature that includes images (if available in plugin)
2. Send prompt with image
3. ✅ **Pass**: Image processed, response references image
4. ❌ **Fail**: Image ignored or error

**Test 5.2: Image Format Conversion**
1. Send image with base64 encoding
2. Check network tab or console for request format
3. ✅ **Pass**: Image in correct OpenCode SDK format
4. ❌ **Fail**: Wrong format or missing image data

**Test 5.3: Image in sendPrompt**
1. Test feature that uses `sendPrompt()` with images
2. ✅ **Pass**: Image included in prompt
4. ❌ **Fail**: Image missing or error

**Test 5.4: Mixed Text and Image**
1. Send prompt with both text and image
2. ✅ **Pass**: Both parts processed correctly
3. ❌ **Fail**: One part missing or error

**Category 5 Results**: ___/4 tests passed

---

#### Category 6: Service Integrations

**Test 6.1: InlineEditService**
1. Use inline edit feature in Obsidian
2. Verify editing works
3. ✅ **Pass**: Inline editing works correctly
4. ❌ **Fail**: Editing fails or error

**Test 6.2: InstructionRefineService**
1. Use instruction refine feature
2. Verify streaming works
3. ✅ **Pass**: Instruction refinement works
4. ❌ **Fail**: Feature fails or error

**Test 6.3: TitleGenerationService**
1. Use title generation feature
2. Verify title is generated
3. ✅ **Pass**: Title generated successfully
4. ❌ **Fail**: No title or error

**Test 6.4: AgentService.queryViaSDK**
1. Use main query functionality
2. Verify it works (no duplicate client errors)
3. ✅ **Pass**: Query works, uses centralized client
4. ❌ **Fail**: Connection errors or duplicate clients

**Category 6 Results**: ___/4 tests passed

---

#### Category 7: Error Handling

**Test 7.1: Connection Timeout**
1. Set short timeout (may require code modification)
2. Send query to slow server
3. ✅ **Pass**: Timeout error with clear message
4. ❌ **Fail**: No timeout or unclear error

**Test 7.2: Invalid Model**
1. Send query with invalid model (if configurable)
2. ✅ **Pass**: Error message about model issue
4. ❌ **Fail**: No error or generic error

**Test 7.3: Prompt Send Failure**
1. Cause failure (e.g., stop server mid-request)
2. ✅ **Pass**: Error message returned
3. ❌ **Fail**: No error or crash

**Test 7.4: Network Error**
1. Disconnect network
2. Send query
3. ✅ **Pass**: Network error caught and reported
4. ❌ **Fail**: No error or crash

**Category 7 Results**: ___/4 tests passed

---

#### Category 8: Settings Configuration

**Test 8.1: Server URL Setting**
1. Open plugin settings
2. Change server URL to `http://localhost:5000`
3. Save settings
4. Start server on port 5000
5. Send query
6. ✅ **Pass**: New URL used, query works
7. ❌ **Fail**: Old URL used or setting not saved

**Test 8.2: URL Validation**
1. Enter invalid URL: `not-a-url`
2. Try to save
3. ✅ **Pass**: Validation error or URL corrected
4. ❌ **Fail**: Invalid URL saved

**Test 8.3: Default URL**
1. Clear server URL setting (set to empty)
2. Send query
3. ✅ **Pass**: Default `http://localhost:4096` used
4. ❌ **Fail**: Error or wrong default

**Category 8 Results**: ___/3 tests passed

---

#### Category 9: MCP Integration

**Test 9.1: MCP Server Communication**
1. Configure MCP server in OpenCode (if applicable)
2. Send query that uses MCP tool
3. ✅ **Pass**: MCP tool called successfully
4. ❌ **Fail**: Tool not called or error

**Test 9.2: MCP Error Handling**
1. Configure invalid MCP server
2. Send query using that tool
3. ✅ **Pass**: Error handled gracefully
4. ❌ **Fail**: Crash or unclear error

**Category 9 Results**: ___/2 tests passed

---

#### Category 10: Performance & Edge Cases

**Test 10.1: Concurrent Queries**
1. Send 3-5 queries rapidly
2. ✅ **Pass**: All queries complete correctly
3. ❌ **Fail**: Connection conflicts or errors

**Test 10.2: Large Responses**
1. Send query: "Write a 2000-word article"
2. ✅ **Pass**: Large response streams correctly
4. ❌ **Fail**: Memory issues or crash

**Test 10.3: Special Characters**
1. Send query: "Test émojis 🎉 and spéciál chárs"
2. ✅ **Pass**: All characters handled correctly
3. ❌ **Fail**: Encoding issues or errors

**Test 10.4: Empty Prompts**
1. Send empty string as prompt
2. ✅ **Pass**: Error or graceful handling
3. ❌ **Fail**: Crash or unclear behavior

**Category 10 Results**: ___/4 tests passed

---

## Test Summary

**Total Tests**: 35
**Tests Passed**: ___
**Tests Failed**: ___
**Pass Rate**: ___%

### Category Breakdown

- Category 1 (Connection): ___/4
- Category 2 (Sessions): ___/4
- Category 3 (Queries): ___/3
- Category 4 (Streaming): ___/3
- Category 5 (Images): ___/4
- Category 6 (Services): ___/4
- Category 7 (Errors): ___/4
- Category 8 (Settings): ___/3
- Category 9 (MCP): ___/2
- Category 10 (Performance): ___/4

## Post-Testing Checklist

- [ ] All test results documented
- [ ] Failures analyzed and logged
- [ ] Console errors reviewed
- [ ] Code quality check: `pnpm lint:check`
- [ ] Migration tracking document updated
- [ ] Issues filed for any failures (if applicable)

## Troubleshooting

**Server won't start:**
- Check if port 4096 is already in use
- Try different port: `opencode server --port 5000`
- Check OpenCode CLI installation

**Connection errors:**
- Verify server is running: `curl http://localhost:4096/health`
- Check firewall settings
- Verify server URL in settings

**Query failures:**
- Check browser/console for error messages
- Verify OpenCode server logs
- Check plugin settings

**Image tests fail:**
- Verify image format is supported
- Check base64 encoding
- Verify image size limits

## Next Steps

After completing tests:

1. Document all results
2. Fix any critical failures
3. Update migration tracking document
4. Create issues for non-critical problems
5. Proceed with production deployment (if all critical tests pass)

