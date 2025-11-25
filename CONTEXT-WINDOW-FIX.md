# Context Window Fix for Large Files

## Problem
WebLLM models have a **4,096 token context window limit**. When files are large (e.g., 200+ lines), the content + prompt exceeds this limit, causing the error:
```
ContextWindowSizeExceededError: Prompt tokens exceed context window size
```

## Solution: Intelligent Content Truncation

### How It Works

The AI service now **intelligently truncates** large files to focus on error-relevant sections:

1. **Small files (≤100 lines)**: Sent in full, no truncation
2. **Large files (>100 lines)**: Smart extraction of relevant context

### Truncation Algorithm

```javascript
For large files:
1. Extract 15 lines before/after each error location
2. Always include first 5 lines (for structure context)
3. Always include last 5 lines (for closing structure)
4. Limit to 100 total lines maximum
5. Add line numbers to maintain position context
```

### Example

**Original File (200 lines):**
```json
{
  "config": { ... },
  // ... 100 lines ...
  "data": [1, 2, 3,],  ← Error on line 105
  // ... 95 lines ...
}
```

**Sent to AI (truncated to ~50 lines):**
```
1: {
2:   "config": { ... },
3:   ...
4:   ...
5:   ...
90: "nested": {
...
100:   "value": "test",
101:   "data": [1, 2, 3,],  ← Error context
102:   "next": "value"
...
196: },
197: "final": true
198: }
199: }
200:

... (content truncated for context window)
```

### AI Response Handling

The AI fixes the **truncated sections** with line numbers. The service then:
1. Removes line number prefixes
2. Returns cleaned fix
3. Diff viewer shows changes

### Provider Differences

| Provider | Context Window | Truncation |
|----------|----------------|------------|
| **WebLLM** | 4,096 tokens (~100 lines) | ✅ Yes, intelligent |
| **Groq** | 32,768 tokens (~800 lines) | ❌ No, full content |

### Limitations

**For very large files with WebLLM:**
- ⚠️ Only errors in truncated sections get fixed
- ⚠️ Errors outside context window may be missed
- ✅ Most common: errors are clustered, so truncation works well

**Workarounds:**
1. **Use Groq API** for large files (no truncation, larger context)
2. **Split large files** into smaller sections
3. **Fix in batches** - fix visible errors, then retry for remaining

### Configuration

Truncation parameters in `AIService.js`:
```javascript
maxLines = 100         // Maximum lines to include
contextRadius = 15     // Lines before/after each error
firstLines = 5         // Always include from start
lastLines = 5          // Always include from end
```

Adjust these if needed for your use case.

## Testing

**Test with large file:**
1. Create JSON file with 200+ lines
2. Add error on line 150
3. Click "AI Fix"
4. WebLLM: Truncates to ~100 lines around error
5. Groq: Processes full 200 lines

**Verify in console:**
- Watch for "showing relevant sections with line numbers" in prompt
- Check that errors are fixed despite truncation

## Future Enhancements

- [ ] Sliding window for multiple error clusters
- [ ] Adaptive truncation based on file type
- [ ] Multi-pass fixing for large files
- [ ] User-configurable context window size

---

**The context window fix is now live!** Try it with large files at http://localhost:5175
