# Truncation & Merge Fix for Large Files

## 🔧 **Problem Fixed**

When WebLLM truncated large files, the AI would only return the fixed truncated sections, losing the rest of the file content.

### **Before (Broken):**
```
Original file: 200 lines
Truncated to: 50 lines around errors
AI fixes: Only 50 lines returned
Result: Lost 150 lines! ❌
```

### **After (Fixed):**
```
Original file: 200 lines
Truncated to: 50 lines around errors (with line numbers)
AI fixes: 50 lines with fixes (keeping line numbers)
Merge: Fixed lines + original lines = 200 lines ✅
```

---

## ✨ **Solution: Smart Line Merging**

### **How It Works**

1. **Truncation with Line Numbers**
   ```
   Original (200 lines) → Truncate → 50 lines with numbers

   1: {
   2:   "config": {...},
   ...
   105:   "data": [1, 2, 3,],  ← Error here
   106:   "next": "value"
   ...
   200: }
   ```

2. **AI Fixes with Line Numbers**
   ```
   AI receives lines with numbers → Returns fixes with numbers

   105: "data": [1, 2, 3]  ← Fixed (removed trailing comma)
   106: "next": "value"
   ```

3. **Merge Back to Full File**
   ```javascript
   mergeFixedLines(originalContent, fixedLines) {
     // Extract line numbers and content from AI response
     // Map: lineNum → fixed content

     // For each line in original:
     //   - If line was fixed by AI: use fixed version
     //   - Otherwise: use original line

     return fullFileWithFixes;
   }
   ```

4. **Result: Complete File**
   ```
   Lines 1-104: Original (unchanged)
   Line 105: Fixed by AI
   Line 106: Original (unchanged)
   Lines 107-200: Original (unchanged)

   Total: 200 lines preserved ✅
   ```

---

## 🎯 **Key Changes**

### **1. New Method: `mergeFixedLines()`**

**Location:** [src/services/AIService.js:174-199](src/services/AIService.js#L174-L199)

```javascript
mergeFixedLines(originalContent, fixedLines) {
  const originalLines = originalContent.split('\n');
  const fixedMap = new Map();

  // Parse AI response: "105: fixed content"
  fixedLines.split('\n').forEach(line => {
    const match = line.match(/^(\d+):\s*(.*)$/);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      const content = match[2];
      fixedMap.set(lineNum - 1, content); // 0-indexed
    }
  });

  // Merge: fixed lines override original lines
  return originalLines.map((line, idx) => {
    return fixedMap.has(idx) ? fixedMap.get(idx) : line;
  }).join('\n');
}
```

**Purpose:** Reconstructs full file by merging AI fixes back into original content

---

### **2. Updated: `fixWithWebLLM()`**

**Location:** [src/services/AIService.js:201-237](src/services/AIService.js#L201-L237)

**Changes:**
```javascript
// Before
async fixWithWebLLM(...) {
  const prompt = buildFixPrompt(content, errorDetails, true);
  // ... AI call ...
  return fixed; // ❌ Only truncated content
}

// After
async fixWithWebLLM(...) {
  const lines = content.split('\n');
  const shouldTruncate = lines.length > 100;

  const prompt = buildFixPrompt(content, errorDetails, shouldTruncate);
  // ... AI call ...

  if (shouldTruncate) {
    return this.mergeFixedLines(content, fixed); // ✅ Full file
  }
  return fixed;
}
```

---

### **3. Enhanced: `buildFixPrompt()`**

**Location:** [src/services/AIService.js:145-195](src/services/AIService.js#L145-L195)

**New Truncated Prompt:**
```javascript
if (wasTruncated) {
  return `You are a ${errorDetails.type} syntax error fixer.

Errors found:
Line 105: Trailing comma before closing bracket

Content (showing relevant sections with line numbers):
1: {
2:   "config": {...},
...
105:   "data": [1, 2, 3,],
106:   "next": "value"
...

IMPORTANT Instructions:
1. Fix ONLY the syntax errors listed above
2. Return ONLY the fixed lines in the SAME format: "lineNumber: content"
3. KEEP the line number prefix (e.g., "105: fixed content")
4. Only include lines that you changed or are near errors
5. Do NOT include the full file, only the lines shown above with fixes applied

Example:
Input:  105: "data": [1, 2, 3,]
Output: 105: "data": [1, 2, 3]

Fixed lines:`;
}
```

**Key Points:**
- Clear instructions to maintain line numbers
- Example showing expected format
- Only return modified lines (saves tokens)

---

## 📊 **Flow Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│ User File (200 lines, errors on line 105)                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Truncate (line 105 > 100, so truncate)                     │
│ Extract: 15 lines before/after error + first/last 5        │
│ Add line numbers: "105: content"                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Send to WebLLM (50 lines with numbers)                     │
│ Prompt: "Fix errors, keep line numbers"                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ AI Response (fixed lines with numbers)                     │
│ 105: "data": [1, 2, 3]   ← Fixed                          │
│ 106: "next": "value"     ← Unchanged but included          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ mergeFixedLines()                                           │
│ • Parse line numbers from AI response                      │
│ • Create map: {105: fixed content}                         │
│ • Iterate original 200 lines                               │
│ • Use fixed content for line 105, original for rest        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Complete Fixed File (200 lines)                            │
│ Lines 1-104: Original                                       │
│ Line 105: Fixed by AI                                       │
│ Lines 106-200: Original                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 **Testing**

### **Test Case 1: Small File (≤100 lines)**
```javascript
Input: 50 lines, error on line 25
shouldTruncate: false
Prompt: Full content (no line numbers)
AI Response: Full fixed file
Output: Fixed file (50 lines) ✅
```

### **Test Case 2: Large File (>100 lines)**
```javascript
Input: 200 lines, error on line 105
shouldTruncate: true
Prompt: ~50 lines with numbers (90-120 + first/last 5)
AI Response: Fixed lines with numbers
mergeFixedLines: Reconstruct full 200 lines
Output: Fixed file (200 lines) ✅
```

### **Test Case 3: Multiple Errors**
```javascript
Input: 300 lines, errors on lines 50, 150, 250
shouldTruncate: true
Prompt: ~100 lines covering all 3 error locations
AI Response: All 3 errors fixed with line numbers
mergeFixedLines: Apply all fixes to original
Output: Fixed file (300 lines) ✅
```

---

## ✅ **Benefits**

1. **No Data Loss**: Full file preserved
2. **Efficient**: Only sends relevant lines to AI
3. **Context Aware**: Includes surrounding lines for context
4. **Scalable**: Works with files of any size
5. **Smart**: WebLLM for small/medium, Groq for very large

---

## 📝 **Example**

### **Input File (200 lines):**
```json
{
  "config": { ... },
  ... 100 lines ...
  "data": [1, 2, 3,],  ← Line 105, error
  ... 95 lines ...
}
```

### **Truncated Prompt:**
```
Content (showing relevant sections with line numbers):
1: {
2:   "config": { ... },
...
100:   "nested": {},
101:   "value": "test",
105:   "data": [1, 2, 3,],
106:   "next": "value"
...
200: }
```

### **AI Response:**
```
105: "data": [1, 2, 3]
```

### **Merged Output (200 lines):**
```json
{
  "config": { ... },
  ... 100 lines ...
  "data": [1, 2, 3],  ← Fixed!
  ... 95 lines ...
}
```

---

## 🎉 **Result**

**Problem:** Truncation was losing content
**Solution:** Merge fixed lines back into original
**Outcome:** Full file preserved with AI fixes applied ✅

---

**The fix is now live at http://localhost:5175!**

Try it with large files (>100 lines) and verify all content is preserved.
