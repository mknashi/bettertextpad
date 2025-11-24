# Quick Start: AI Fix Feature

## 🚀 Try It in 3 Steps

### Step 1: Open a File with Errors
1. Go to http://localhost:5175
2. Click **"Open File"** button
3. Select `test-invalid-json-for-ai.json` or `test-invalid-xml-for-ai.xml`

### Step 2: Click "AI Fix"
1. Error panel appears automatically at bottom
2. Click the **purple "AI Fix"** button
3. First time: Model downloads (~1 minute for 950MB)
4. Subsequent times: Instant loading, fix in 10-15 seconds

### Step 3: Review & Accept
1. Diff viewer opens showing changes
2. Check the fixes (green = added, red = removed, yellow = modified)
3. Click **"Accept Changes"** to apply (original saved in new tab)
4. Or click **"Reject"** to discard

---

## 🎯 What You'll See

### Error Panel (Before Fix)
```
⚠️ Invalid JSON - Formatting Failed
[AI Fix] [⚙️] [Retry Format] [Close]

Errors:
• Line 10: Trailing comma before closing bracket
• Line 11: Single quotes detected - JSON requires double quotes
• Line 12: Missing comma between properties
```

### Diff Viewer (After AI Fix)
```
┌─────────────────────────────┬─────────────────────────────┐
│ Original (With Errors)      │ AI-Fixed Version            │
├─────────────────────────────┼─────────────────────────────┤
│  9  "hobbies": ["coding",], │  9  "hobbies": ["coding"]   │ (yellow)
│ 10  'invalidKey': 'value',  │ 10  "invalidKey": "value",  │ (yellow)
│ 11  "key1": "value1"        │ 11  "key1": "value1",       │ (yellow)
│ 12  "key2": "value2"        │ 12  "key2": "value2"        │
└─────────────────────────────┴─────────────────────────────┘

Changes: 3 modified • 0 added • 0 removed • 9 unchanged

[Reject]  [Accept Changes]
```

---

## ⚙️ Configuration (Optional)

### Using Browser AI (Default - Private & Free)
**No setup needed!** Just click "AI Fix" and the model downloads automatically.

**First use:**
- Downloads: ~950 MB (Qwen2.5-1.5B model)
- Takes: ~1 minute
- Cached forever in your browser

**Every use after:**
- No download
- Processing: 10-15 seconds
- 100% private (runs locally)

### Using Cloud AI (Faster but Requires API Key)
1. Click ⚙️ Settings button in error panel
2. Select **"Cloud AI (Groq)"**
3. Get free API key: https://console.groq.com
4. Paste key and click **"Save Settings"**
5. Now "AI Fix" uses cloud (2-3 seconds per fix)

---

## 💡 Tips

### Choose Smaller Model for Speed
1. Click ⚙️ in error panel
2. Under "Browser AI Model" select **Qwen2.5 0.5B (Fastest)**
3. Only 450 MB download
4. Faster inference (~5-10 seconds)

### Keep Original Safe
- When you click "Accept", original is saved to a new tab
- Look for tab named "filename.json (Original)"
- You can always compare or undo

### Try Both Providers
- Browser AI: Best for privacy, works offline
- Cloud AI: Best for speed (if you have API key)
- Auto mode: Tries Browser first, falls back to Cloud

---

## ❓ Common Questions

**Q: Which model should I use?**
- Default (Qwen2.5-1.5B): Best balance of speed and quality
- Fastest (Qwen2.5-0.5B): Use if your machine is slow
- Best (Phi-3-mini): Use if you need highest quality

**Q: Does it work offline?**
- Browser AI: Yes (after first download)
- Cloud AI: No (needs internet)

**Q: Is my data safe?**
- Browser AI: Yes, 100% local
- Cloud AI: Sent to Groq servers

**Q: Can I use it for other file types?**
- Currently: JSON and XML only
- Future: More formats coming

**Q: What if the AI fix is wrong?**
- Click "Reject" and try again
- Or manually fix with AI suggestions as guide
- Larger models = better accuracy

---

## 🐛 Troubleshooting

**"WebLLM not supported"**
→ Use Chrome/Edge 113+ or switch to Cloud AI mode

**Model download stuck**
→ Check internet, refresh page, try again

**AI produces bad fix**
→ Reject and retry, or try larger model

**Groq API error**
→ Check API key, rate limits (30/min free)

---

**Ready to try?** Open http://localhost:5175 and load a test file! 🎉
