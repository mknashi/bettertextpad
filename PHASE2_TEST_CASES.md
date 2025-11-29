# Phase 2: AI-Powered Intelligent Completions - Test Cases

## Overview
Phase 2 adds AI-powered context-aware code completions using Groq, OpenAI, or Claude APIs. AI suggestions appear alongside traditional keyword/snippet completions when enabled.

---

## Prerequisites

### Test Environment Setup
1. Ensure Phase 1 completions are working correctly
2. Have valid API keys for at least one provider:
   - Groq API key (recommended for testing - fastest and free tier available)
   - OpenAI API key (gpt-4o-mini or gpt-4o)
   - Claude API key (desktop app only - CORS restrictions in browser)

### Configuration
Access AI settings through the application settings panel and configure:
- AI Provider (Groq/OpenAI/Claude)
- API Key for selected provider
- Model selection
- Enable AI Completions toggle

---

## Test Case Categories

### 1. AI Completion Service Initialization

#### TC-AI-001: Service Initialization with Valid Settings
**Objective**: Verify AI completion service initializes correctly with valid settings

**Steps**:
1. Open settings
2. Select "Groq" as provider
3. Enter valid Groq API key
4. Select model "Llama 3.3 70B"
5. Enable "AI Completions" toggle
6. Save settings

**Expected Result**:
- Settings saved successfully
- AI completion service marked as enabled
- No errors in console

**Priority**: High

---

#### TC-AI-002: Service Initialization with Missing API Key
**Objective**: Verify service handles missing API key gracefully

**Steps**:
1. Open settings
2. Select "OpenAI" as provider
3. Leave API key field empty
4. Enable "AI Completions" toggle
5. Save settings
6. Open a JavaScript file
7. Press Ctrl+Space to trigger completion

**Expected Result**:
- Settings save successfully
- AI completions are disabled due to missing API key
- Only traditional completions appear
- No errors thrown to user

**Priority**: High

---

#### TC-AI-003: Service Initialization with Invalid API Key
**Objective**: Verify service handles invalid API key gracefully

**Steps**:
1. Configure AI settings with invalid API key (e.g., "invalid-key-123")
2. Open a JavaScript file
3. Type partial code: `function getUserD`
4. Press Ctrl+Space

**Expected Result**:
- Traditional completions appear immediately
- AI completion fails silently in background
- Error logged to console (not shown to user)
- No application crash or hanging

**Priority**: High

---

### 2. AI Completion Triggering

#### TC-AI-004: Manual Trigger with Ctrl+Space
**Objective**: Verify AI completions trigger on explicit completion request

**Steps**:
1. Configure valid AI settings (Groq recommended)
2. Open a new JavaScript file
3. Type the following code:
   ```javascript
   function calculateTotal(items) {
     const sum = items.reduce((acc, item) =>
   ```
4. Press Ctrl+Space (manual completion trigger)

**Expected Result**:
- Completion menu appears within 2-3 seconds
- AI suggestion appears at top of list (marked with ✨ icon)
- AI suggestion is contextually relevant (e.g., "acc + item.price" or "acc + item")
- Traditional completions appear below AI suggestion
- Detail shows "AI suggestion" and info shows provider name

**Priority**: Critical

---

#### TC-AI-005: AI Completions on Auto-Typing (Should NOT Trigger)
**Objective**: Verify AI completions do NOT trigger automatically while typing

**Steps**:
1. Configure valid AI settings
2. Open JavaScript file
3. Type slowly character by character: `const user`
4. Observe completion menu as it appears automatically

**Expected Result**:
- Traditional keyword completions appear immediately (const, constructor, etc.)
- NO AI suggestions appear (to avoid excessive API calls)
- Only Ctrl+Space triggers AI completions
- Typing remains responsive

**Priority**: High

---

### 3. Context Extraction and Relevance

#### TC-AI-006: Context-Aware JavaScript Completion
**Objective**: Verify AI extracts and uses code context correctly

**Steps**:
1. Configure valid AI settings
2. Create JavaScript file with this code:
   ```javascript
   class User {
     constructor(name, email, age) {
       this.name = name;
       this.email = email;
       this.age = age;
     }

     isAdult() {
       return
   ```
3. Place cursor after `return` and press Ctrl+Space

**Expected Result**:
- AI suggestion is contextually relevant: `this.age >= 18` or similar
- Suggestion makes logical sense given the context
- Suggestion is short (1-3 words as configured)

**Priority**: Critical

---

#### TC-AI-007: Context-Aware Python Completion
**Objective**: Verify AI completions work with Python language

**Steps**:
1. Configure valid AI settings
2. Create new file, set language to Python
3. Type this code:
   ```python
   def calculate_average(numbers):
       total = sum(numbers)
       count =
   ```
4. Place cursor after `count = ` and press Ctrl+Space

**Expected Result**:
- AI suggests relevant Python code: `len(numbers)` or similar
- Syntax matches Python (not JavaScript)
- Traditional Python keywords also appear

**Priority**: High

---

#### TC-AI-008: Multi-Line Context Extraction
**Objective**: Verify AI uses multiple lines of context (up to 20 lines before)

**Steps**:
1. Create JavaScript file with 30+ lines of code
2. Add imports at top, functions in middle
3. At line 25, start typing new function
4. Press Ctrl+Space

**Expected Result**:
- AI suggestion considers imported modules and existing function names
- Suggestions don't reference code more than 20 lines away
- Context window is appropriately sized (not too much/too little)

**Priority**: Medium

---

### 4. Caching Mechanism

#### TC-AI-009: Cache Hit for Identical Context
**Objective**: Verify caching reduces API calls for same context

**Steps**:
1. Configure valid AI settings
2. Open JavaScript file
3. Type: `function getName(user) { return user.`
4. Press Ctrl+Space and wait for AI suggestion
5. Press Escape to close menu
6. Delete last character and retype it: `user.`
7. Press Ctrl+Space again

**Expected Result**:
- First Ctrl+Space: Takes 1-3 seconds (API call)
- Second Ctrl+Space: Appears instantly (cached)
- Same AI suggestion appears both times
- Console shows only one API call made

**Priority**: High

---

#### TC-AI-010: Cache Expiration After 5 Minutes
**Objective**: Verify cache expires after timeout

**Steps**:
1. Perform TC-AI-009 to populate cache
2. Wait 6 minutes (cache timeout is 5 minutes)
3. Press Ctrl+Space again in same location

**Expected Result**:
- New API call is made (cache expired)
- Takes 1-3 seconds again
- Fresh suggestion appears

**Priority**: Low

---

#### TC-AI-011: Cache Key Differentiation
**Objective**: Verify different contexts create different cache entries

**Steps**:
1. Type: `function add(a, b) { return `
2. Press Ctrl+Space, note AI suggestion
3. Delete that line
4. Type: `function multiply(a, b) { return `
5. Press Ctrl+Space, note AI suggestion

**Expected Result**:
- Two different AI suggestions (one for add, one for multiply)
- Each context triggers separate API call
- Suggestions are contextually different

**Priority**: Medium

---

### 5. Multi-Provider Support

#### TC-AI-012: Groq Provider Integration
**Objective**: Verify Groq API integration works correctly

**Steps**:
1. Configure Groq settings:
   - Provider: Groq
   - API Key: Valid Groq key
   - Model: llama-3.3-70b-versatile
   - Enable AI Completions: ON
2. Test completion as in TC-AI-004

**Expected Result**:
- AI completions work correctly
- Response time: 1-3 seconds
- Info text shows "Powered by GROQ"
- Suggestions are relevant and concise

**Priority**: Critical

---

#### TC-AI-013: OpenAI Provider Integration
**Objective**: Verify OpenAI API integration works correctly

**Steps**:
1. Configure OpenAI settings:
   - Provider: OpenAI
   - API Key: Valid OpenAI key
   - Model: gpt-4o-mini
   - Enable AI Completions: ON
2. Test completion as in TC-AI-004

**Expected Result**:
- AI completions work correctly
- Response time: 2-4 seconds
- Info text shows "Powered by OPENAI"
- Suggestions are relevant and concise

**Priority**: High

---

#### TC-AI-014: Claude Provider Integration (Desktop Only)
**Objective**: Verify Claude API integration works in desktop app

**Prerequisites**: Running in Tauri desktop app (NOT browser)

**Steps**:
1. Configure Claude settings:
   - Provider: Claude
   - API Key: Valid Claude key
   - Model: claude-3-5-haiku-20241022
   - Enable AI Completions: ON
2. Test completion as in TC-AI-004

**Expected Result**:
- AI completions work correctly
- Response time: 2-4 seconds
- Info text shows "Powered by CLAUDE"
- Suggestions are relevant and concise

**Priority**: Medium (Desktop only)

---

#### TC-AI-015: Provider Switching
**Objective**: Verify switching between providers works correctly

**Steps**:
1. Start with Groq configured and working
2. Get one AI completion from Groq
3. Open settings
4. Switch provider to OpenAI with valid key
5. Save settings
6. Get AI completion again

**Expected Result**:
- Settings update successfully
- Cache is cleared when provider changes
- New completions use OpenAI
- Info text changes to "Powered by OPENAI"
- No errors during transition

**Priority**: Medium

---

### 6. UI Indicators and Visual Feedback

#### TC-AI-016: AI Completion Icon Display
**Objective**: Verify AI completions show distinctive ✨ icon

**Steps**:
1. Configure valid AI settings
2. Trigger AI completion with Ctrl+Space
3. Observe completion menu

**Expected Result**:
- AI suggestion has ✨ icon (sparkle emoji)
- Icon is visible and distinct from other completion types
- Regular completions don't have AI icon
- Icon scales correctly with UI theme

**Priority**: Medium

---

#### TC-AI-017: AI Completion Detail and Info Text
**Objective**: Verify AI completions show correct metadata

**Steps**:
1. Configure Groq provider
2. Get AI completion
3. Hover over or select AI suggestion in menu

**Expected Result**:
- Detail field shows: "AI suggestion"
- Info field shows: "Powered by GROQ" (or current provider)
- Text is readable in both light and dark themes

**Priority**: Medium

---

#### TC-AI-018: AI Completion Sorting Priority
**Objective**: Verify AI suggestions appear at top of list

**Steps**:
1. Configure valid AI settings
2. Type: `function test`
3. Press Ctrl+Space

**Expected Result**:
- AI suggestion appears as first item in list (boost: 100)
- Traditional keywords appear below
- Sorting is consistent across multiple triggers

**Priority**: High

---

#### TC-AI-019: Dark Theme AI Styling
**Objective**: Verify AI completion styling in dark theme

**Steps**:
1. Switch to dark theme
2. Trigger AI completion
3. Observe menu styling

**Expected Result**:
- AI completion icon visible against dark background
- Selected item has amber/yellow highlight (rgba(251, 191, 36, 0.2))
- Text is readable
- Contrast is sufficient

**Priority**: Low

---

#### TC-AI-020: Light Theme AI Styling
**Objective**: Verify AI completion styling in light theme

**Steps**:
1. Switch to light theme
2. Trigger AI completion
3. Observe menu styling

**Expected Result**:
- AI completion icon visible against light background
- Selected item has blue highlight (rgba(59, 130, 246, 0.2))
- Text is readable
- Contrast is sufficient

**Priority**: Low

---

### 7. Error Handling and Edge Cases

#### TC-AI-021: Network Timeout Handling
**Objective**: Verify graceful handling of slow/timeout API responses

**Steps**:
1. Configure valid AI settings
2. Simulate slow network (browser dev tools: throttle to slow 3G)
3. Trigger AI completion with Ctrl+Space

**Expected Result**:
- Traditional completions appear immediately
- AI completion either:
  - Appears after delay (if within timeout)
  - Fails silently (if timeout exceeded)
- No UI freezing or error messages to user
- Error logged to console

**Priority**: High

---

#### TC-AI-022: Empty Context Handling
**Objective**: Verify AI doesn't trigger with insufficient context

**Steps**:
1. Open new empty file
2. Type just: `a`
3. Press Ctrl+Space

**Expected Result**:
- AI completion doesn't trigger (context too short)
- Only traditional completions appear
- No API call made (check network tab)

**Priority**: Medium

---

#### TC-AI-023: Very Long Context Handling
**Objective**: Verify AI handles large files efficiently

**Steps**:
1. Open file with 500+ lines of code
2. Navigate to middle of file
3. Start typing new code
4. Press Ctrl+Space

**Expected Result**:
- AI extracts reasonable context window (max 20 lines before, ~5 lines after)
- API call succeeds (doesn't exceed token limits)
- Completion works normally
- No performance degradation

**Priority**: Medium

---

#### TC-AI-024: Rapid Completion Requests
**Objective**: Verify handling of multiple rapid Ctrl+Space presses

**Steps**:
1. Type code: `function test() {`
2. Press Ctrl+Space rapidly 5 times in succession
3. Observe behavior

**Expected Result**:
- Only one API request is made (pending request tracking)
- No duplicate completions
- No race conditions or errors
- Menu appears once with results

**Priority**: High

---

#### TC-AI-025: API Rate Limiting
**Objective**: Verify graceful handling of API rate limit errors

**Steps**:
1. Use free tier API key with low rate limits
2. Trigger AI completions 20+ times rapidly
3. Continue until rate limit hit

**Expected Result**:
- After rate limit: AI completions fail silently
- Traditional completions continue working
- Error logged to console (not shown to user)
- Service recovers when rate limit resets

**Priority**: Medium

---

### 8. Integration with Phase 1 Features

#### TC-AI-026: AI + Keyword Completions Together
**Objective**: Verify AI and traditional completions coexist

**Steps**:
1. Enable AI completions with valid settings
2. Type: `cons`
3. Press Ctrl+Space

**Expected Result**:
- AI suggestion at top (if relevant)
- Keywords below: const, constructor, console
- Both types selectable with arrow keys
- Tab accepts selected item

**Priority**: Critical

---

#### TC-AI-027: AI + Snippet Completions Together
**Objective**: Verify AI works alongside snippets

**Steps**:
1. Enable AI completions
2. Type: `for`
3. Press Ctrl+Space

**Expected Result**:
- AI suggestion may appear (context-dependent)
- For-loop snippets appear in list
- Snippets process correctly when selected
- AI doesn't interfere with snippet expansion

**Priority**: High

---

#### TC-AI-028: AI + Symbol Completions Together
**Objective**: Verify AI works with document symbol extraction

**Steps**:
1. Create file with variables: `const userName = 'John'; const userAge = 25;`
2. Below, type: `console.log(user`
3. Press Ctrl+Space

**Expected Result**:
- AI suggestion may complete based on context
- Document symbols appear: userName, userAge
- All completion types are present and selectable

**Priority**: High

---

### 9. Language-Specific AI Completions

#### TC-AI-029: JavaScript Specific Completions
**Objective**: Verify AI provides JavaScript-specific suggestions

**Steps**:
1. Open JavaScript file
2. Type:
   ```javascript
   const users = [{name: 'Alice'}, {name: 'Bob'}];
   const names = users.map(user =>
   ```
3. Press Ctrl+Space

**Expected Result**:
- AI suggests JavaScript-specific completion: `user.name` or similar
- Syntax uses JavaScript arrow function style
- Suggestion makes sense for array mapping

**Priority**: High

---

#### TC-AI-030: Python Specific Completions
**Objective**: Verify AI provides Python-specific suggestions

**Steps**:
1. Set language to Python
2. Type:
   ```python
   def read_file(filepath):
       with open(filepath, 'r') as f:
           content =
   ```
3. Press Ctrl+Space

**Expected Result**:
- AI suggests Python-specific: `f.read()` or similar
- Syntax uses Python style (not JavaScript)
- Suggestion makes sense for file reading

**Priority**: High

---

#### TC-AI-031: TypeScript Specific Completions
**Objective**: Verify AI provides TypeScript-specific suggestions

**Steps**:
1. Set language to TypeScript
2. Type:
   ```typescript
   interface User {
     name: string;
     age: number;
   }
   function greetUser(user: User): string {
     return
   ```
3. Press Ctrl+Space

**Expected Result**:
- AI suggests TypeScript-aware completion
- Respects type system context
- May suggest string template or concatenation

**Priority**: Medium

---

### 10. Performance and Optimization

#### TC-AI-032: Response Time Measurement (Groq)
**Objective**: Measure AI completion response time for Groq

**Steps**:
1. Configure Groq provider
2. Clear cache
3. Trigger AI completion
4. Measure time from Ctrl+Space to suggestion appearance

**Expected Result**:
- Response time: 1-3 seconds typical
- Maximum acceptable: 5 seconds
- Consistent across multiple requests

**Priority**: Medium

---

#### TC-AI-033: Cache Performance Impact
**Objective**: Verify cache significantly improves response time

**Steps**:
1. Measure response time for first completion (TC-AI-032)
2. Trigger same completion again (cached)
3. Compare times

**Expected Result**:
- Cached response: < 100ms
- Improvement: >95% faster than API call
- User perceives instant response

**Priority**: Medium

---

#### TC-AI-034: Memory Usage with Large Cache
**Objective**: Verify cache doesn't cause memory issues

**Steps**:
1. Trigger AI completions in 50+ different contexts
2. Monitor browser/app memory usage
3. Continue normal editing

**Expected Result**:
- Memory usage remains reasonable (<100MB increase)
- Old cache entries are cleaned up automatically
- No memory leaks observed

**Priority**: Low

---

### 11. Settings and Configuration

#### TC-AI-035: Enable/Disable AI Completions Toggle
**Objective**: Verify toggle immediately enables/disables AI

**Steps**:
1. Configure valid AI settings with toggle ON
2. Get AI completion successfully
3. Open settings, toggle OFF
4. Save settings
5. Trigger completion again
6. Toggle back ON
7. Trigger completion

**Expected Result**:
- With toggle ON: AI completions appear
- With toggle OFF: Only traditional completions
- Toggle works immediately without restart
- Cache cleared when toggled

**Priority**: High

---

#### TC-AI-036: Model Selection Changes
**Objective**: Verify changing model updates completions

**Steps**:
1. Configure OpenAI with gpt-4o-mini
2. Get completion
3. Change to gpt-4o
4. Get completion in similar context

**Expected Result**:
- Both models work correctly
- gpt-4o may provide slightly different suggestions
- No errors during model switch
- Settings persist correctly

**Priority**: Low

---

#### TC-AI-037: Settings Persistence
**Objective**: Verify AI settings persist across sessions

**Steps**:
1. Configure AI settings with specific provider and model
2. Enable AI completions
3. Close and reopen application
4. Check settings

**Expected Result**:
- All AI settings retained: provider, API key, model, enabled state
- AI completions work immediately after reopening
- No need to reconfigure

**Priority**: Medium

---

## Test Execution Guidelines

### Test Priority Levels
- **Critical**: Must pass before release
- **High**: Should pass, blockers for full functionality
- **Medium**: Important but not blocking
- **Low**: Nice to have, can be addressed in updates

### Test Environment Recommendations
1. **Browser Testing**: Chrome/Edge (latest), Firefox, Safari
2. **Desktop Testing**: Tauri app on macOS, Windows, Linux
3. **API Providers**: Test with at least Groq (free tier available)

### Success Criteria
- All Critical and High priority tests pass
- No application crashes or data loss
- AI completions work for at least one provider
- Performance is acceptable (< 5 second response)
- Error handling is graceful (no user-facing errors)

### Known Limitations
1. Claude API requires desktop app (CORS in browser)
2. AI completions only trigger on Ctrl+Space (not auto-typing)
3. Maximum 50 tokens per AI suggestion (keeps responses concise)
4. Cache timeout is fixed at 5 minutes
5. Context window limited to ~20 lines before cursor

---

## Reporting Issues

When reporting bugs, include:
1. Test case ID
2. Steps to reproduce
3. Expected vs actual result
4. Provider and model used
5. Browser/desktop app version
6. Console errors (if any)
7. Network request details (if relevant)

---

## Summary

**Total Test Cases**: 37
- Critical: 6
- High: 15
- Medium: 13
- Low: 3

**Estimated Testing Time**: 4-6 hours for complete suite
