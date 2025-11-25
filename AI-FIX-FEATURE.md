# AI-Powered JSON/XML Error Fixing

## Overview
BetterTextPad now includes AI-powered automatic fixing for JSON and XML parsing errors. The feature uses local browser-based AI models (WebLLM) or cloud-based APIs (Groq) to intelligently fix syntax errors.

## Features

### ✨ Key Capabilities
- **🤖 AI-Powered Fixes**: Automatically detect and fix JSON/XML syntax errors
- **🔒 Privacy-First**: Default mode runs AI 100% locally in your browser (no data leaves your machine)
- **📊 Diff Viewer**: Side-by-side comparison of original vs. fixed content
- **💾 Safe Apply**: Original content is preserved in a new tab when accepting fixes
- **⚙️ Flexible Configuration**: Choose between local browser AI or cloud API

## How It Works

### 1. **Error Detection**
When you have invalid JSON/XML, BetterTextPad shows an error panel with:
- List of all errors found
- Line and column numbers
- Error descriptions

### 2. **AI Fix Button**
Click the **"AI Fix"** button in the error panel to:
1. Send your content to the AI provider
2. AI analyzes the errors and generates a corrected version
3. Diff viewer opens showing changes

### 3. **Review & Accept**
- **Side-by-side diff** shows:
  - 🟢 Green: Added lines
  - 🔴 Red: Removed lines
  - 🟡 Yellow: Modified lines
- **Accept**: Applies fixes and creates backup tab with original
- **Reject**: Discards AI suggestions

## AI Provider Options

### 🌐 **Browser AI (WebLLM)** - Recommended
- **Privacy**: 100% local, no data sent anywhere
- **Cost**: Completely free
- **Setup**: One-time model download (~450MB-2GB)
- **Speed**: 5-15 seconds per fix
- **Requirements**: Chrome/Edge 113+ with WebGPU support

**Models Available:**
- **Qwen2.5-0.5B** (450 MB) - Fastest
- **Qwen2.5-1.5B** (950 MB) - Recommended balance
- **Phi-3-mini** (2.4 GB) - Highest quality

### ☁️ **Cloud AI (Groq)**
- **Privacy**: Content sent to Groq servers
- **Cost**: Free tier available (30 requests/minute)
- **Setup**: Requires API key from [console.groq.com](https://console.groq.com)
- **Speed**: 1-3 seconds per fix
- **Requirements**: Internet connection

**Models Available:**
- **llama-3.3-70b-versatile** - Best quality
- **mixtral-8x7b-32768** - Faster, good quality

### 🔄 **Auto Mode** (Default)
- Tries Browser AI first (if supported)
- Falls back to Cloud AI if configured
- Best of both worlds

## Getting Started

### Initial Setup

1. **Open BetterTextPad**: Navigate to http://localhost:5175
2. **Create/Open a file with errors**:
   - Open [test-invalid-json-for-ai.json](test-invalid-json-for-ai.json) or
   - Open [test-invalid-xml-for-ai.xml](test-invalid-xml-for-ai.xml)
3. **Wait for error detection**: Error panel will appear automatically
4. **Configure AI** (first time):
   - Click the ⚙️ Settings button in error panel
   - Choose your AI provider:
     - **Browser AI**: No setup needed (will download model on first use)
     - **Cloud AI**: Enter Groq API key
   - Click **Save Settings**

### Using AI Fix

1. **Click "AI Fix"** button in the error panel
2. **First-time Browser AI users**:
   - Model downloads automatically (~450MB-2GB)
   - Progress shown in button text
   - Model cached for future use
3. **Wait for AI processing**:
   - Browser AI: 10-20 seconds
   - Cloud AI: 2-5 seconds
4. **Review the diff**:
   - Check all changes carefully
   - Original (left) vs Fixed (right)
5. **Accept or Reject**:
   - **Accept**: Fixed content replaces current, original saved to new tab
   - **Reject**: Discard AI suggestions

## Configuration

### AI Settings Panel
Access via ⚙️ button in error panel or settings menu.

**Options:**
- **AI Provider**: Auto / Browser AI / Cloud AI
- **Browser AI Model**: Select model size/speed tradeoff
- **Groq API Key**: Enter your API key (optional)
- **Groq Model**: Choose cloud model

**Settings are saved** to localStorage and persist across sessions.

## Examples

### Example 1: Fixing JSON with Trailing Commas
**Original:**
```json
{
  "name": "John",
  "hobbies": ["reading", "coding",],
}
```

**AI Fixed:**
```json
{
  "name": "John",
  "hobbies": ["reading", "coding"]
}
```

### Example 2: Fixing XML with Unclosed Tags
**Original:**
```xml
<bookstore>
  <book>
    <title>Example
    <author>John Doe</author>
  <book>
</bookstore>
```

**AI Fixed:**
```xml
<bookstore>
  <book>
    <title>Example</title>
    <author>John Doe</author>
  </book>
</bookstore>
```

## Architecture

### File Structure
```
src/
├── services/
│   └── AIService.js          # AI provider abstraction
├── components/
│   ├── DiffViewerModal.jsx   # Side-by-side diff UI
│   └── AISettingsModal.jsx   # AI configuration UI
├── utils/
│   └── DiffUtils.js          # Diff calculation logic
└── BetterTextPad.jsx         # Main integration
```

### AI Service Flow
```
User clicks "AI Fix"
    ↓
BetterTextPad.handleAIFix()
    ↓
AIService.fix() → Auto-selects provider
    ↓
WebLLM (local) OR Groq API (cloud)
    ↓
Returns fixed content
    ↓
DiffViewerModal shows comparison
    ↓
User accepts → Original saved to new tab
```

## Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| Browser AI (WebLLM) | ✅ 113+ | ❌ | ❌ |
| Cloud AI (Groq) | ✅ All | ✅ All | ✅ All |
| Diff Viewer | ✅ All | ✅ All | ✅ All |

**Note**: Browser AI requires WebGPU support (currently Chrome/Edge only)

## Performance

### Browser AI (WebLLM)
- **First Use**: 30-60s (model download + inference)
- **Subsequent**: 5-15s (cached model)
- **Memory**: 2-4 GB RAM
- **Disk**: 450MB-2GB (model cache)

### Cloud AI (Groq)
- **Every Use**: 1-3s
- **Rate Limit**: 30 requests/minute (free tier)
- **No local storage** required

## Troubleshooting

### Browser AI Not Working
**Issue**: "WebLLM not supported" message
**Solutions**:
- Use Chrome or Edge 113+
- Enable WebGPU: `chrome://flags/#enable-webgpu`
- Fallback to Cloud AI mode

### Model Download Stuck
**Issue**: Download progress frozen
**Solutions**:
- Check internet connection
- Clear browser cache
- Refresh page and retry

### Cloud AI Errors
**Issue**: "Groq API error" message
**Solutions**:
- Verify API key is correct
- Check rate limits (30/min free tier)
- Ensure internet connection

### AI Produces Incorrect Fix
**Issue**: Fixed content still has errors
**Solutions**:
- Reject the fix and try again
- Switch to different model (larger = better)
- Manually fix with AI suggestions as guide
- Some complex errors may need manual fixes

## Privacy & Security

### Browser AI (WebLLM)
- ✅ 100% local processing
- ✅ No data sent anywhere
- ✅ Works offline (after model download)
- ✅ No API keys required

### Cloud AI (Groq)
- ⚠️ Content sent to Groq servers
- ⚠️ Subject to Groq's privacy policy
- ⚠️ Requires internet connection
- ⚠️ API key stored in localStorage

**Recommendation**: Use Browser AI for sensitive data.

## Future Enhancements

- [ ] Support for more languages (Python, JavaScript, etc.)
- [ ] Batch fixing of multiple files
- [ ] AI explanations of what was fixed
- [ ] Learning from user acceptances/rejections
- [ ] Offline-first browser models
- [ ] Custom AI endpoints

## Credits

**Technologies Used:**
- [WebLLM](https://github.com/mlc-ai/web-llm) - Browser-based LLM inference
- [Groq](https://groq.com) - Fast cloud LLM inference
- [Qwen2.5](https://github.com/QwenLM/Qwen2.5) - Efficient code models
- [Phi-3](https://azure.microsoft.com/en-us/products/phi-3) - Microsoft's small language model

## License

This feature is part of BetterTextPad and follows the same license.

---

**Questions or Issues?** Open an issue on GitHub or check the main README.
