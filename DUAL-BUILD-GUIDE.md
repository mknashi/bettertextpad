# BetterTextPad Dual Build Guide

## Overview

BetterTextPad now supports **two build targets** from a single codebase:

1. **Web Version** - Browser-based app with WebLLM (WebGPU) and Groq API
2. **Desktop Version** - Native Tauri app with Ollama integration

## Architecture

### Platform Detection

The app uses runtime platform detection to load the appropriate AI service:

```javascript
// src/utils/platform.js
export const isDesktop = () => window.__TAURI__ !== undefined;
export const getAIService = async () => {
  if (isDesktop()) {
    return (await import('./services/AIService.desktop')).DesktopAIService;
  } else {
    return (await import('./services/AIService')).aiService;
  }
};
```

### AI Service Architecture

**Web Version** ([AIService.js](src/services/AIService.js)):
- WebLLM (Browser-based, requires WebGPU)
- Groq API (Cloud-based)
- Context window: 4k tokens (WebLLM), 32k (Groq)

**Desktop Version** ([AIService.desktop.js](src/services/AIService.desktop.js)):
- Ollama (Native, 100% local)
- Context window: 8k-128k (model dependent)
- No internet required
- Fastest performance

### Code Sharing

- **95% shared**: UI components, utils, styling
- **5% platform-specific**: AI service implementation only

## Development

### Web Development

```bash
npm run dev
```

- Runs on http://localhost:5175
- Uses WebLLM + Groq
- Hot module replacement enabled

### Desktop Development

```bash
npm run dev:desktop
```

- Opens native window
- Uses Ollama backend
- Rust compilation + Vite HMR
- **Requires**: Rust toolchain installed

## Building

### Web Build

```bash
npm run build
```

Output: `dist/` folder
- Optimized for browser deployment
- Can be served with `npm start`
- Deploy to Vercel, Netlify, etc.

### Desktop Build

```bash
npm run build:desktop
```

Output (macOS): `src-tauri/target/release/bundle/`
- `.dmg` for distribution
- `.app` bundle
- Auto-update ready

**Requirements:**
- Rust 1.77.2+
- Tauri CLI
- Platform-specific build tools

## Ollama Setup (Desktop Only)

### 1. Install Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or download from https://ollama.ai
```

### 2. Pull Models

Recommended models:

```bash
# Fast, small (1GB)
ollama pull qwen2.5-coder:1.5b

# Balanced (2GB)
ollama pull qwen2.5-coder:3b

# High quality (4.7GB)
ollama pull qwen2.5-coder:7b
```

### 3. Start Ollama Service

```bash
ollama serve
```

The desktop app will automatically connect to Ollama.

## Configuration

### Web Version

Settings → AI Fix Settings:
- **Provider**: Auto / Browser AI / Cloud AI
- **Browser AI Model**: Qwen2.5 0.5B-1.5B
- **Groq API Key**: (optional, from console.groq.com)

### Desktop Version

Settings → AI Fix Settings:
- **Provider**: Desktop AI (Ollama)
- **Ollama Model**: qwen2.5-coder:1.5b (recommended)

## Features Comparison

| Feature | Web | Desktop |
|---------|-----|---------|
| AI Provider | WebLLM / Groq | Ollama |
| Internet Required | Yes (Groq) / No (WebLLM) | No |
| Model Download Size | 450MB-2.4GB | 1GB-4.7GB |
| Performance | Medium | Very Fast |
| Privacy | 100% (WebLLM) | 100% |
| Context Window | 4k-32k | 8k-128k |
| Auto-update | No | Yes |
| Native File Dialogs | No | Yes |

## Troubleshooting

### Web Version

**WebLLM not working:**
- Check browser: Chrome/Edge 113+ required
- Enable WebGPU in chrome://flags
- Clear cache and reload

**Groq API errors:**
- Verify API key at console.groq.com
- Check rate limits (free tier)

### Desktop Version

**Ollama not found:**
```bash
# Check if Ollama is running
ollama list

# If not installed, install from ollama.ai
```

**Model not available:**
- The app will prompt to download
- Or manually: `ollama pull qwen2.5-coder:1.5b`

**Build errors:**
```bash
# Update Rust
rustup update

# Clean build
cd src-tauri
cargo clean
cd ..
npm run build:desktop
```

## File Structure

```
bettertextpad/
├── src/
│   ├── services/
│   │   ├── AIService.js          # Web AI (WebLLM + Groq)
│   │   └── AIService.desktop.js  # Desktop AI (Ollama)
│   ├── utils/
│   │   └── platform.js            # Platform detection
│   └── components/
│       ├── BetterTextPad.jsx      # Main app (95% shared)
│       └── AISettingsModal.jsx    # Platform-aware settings
├── src-tauri/
│   ├── src/
│   │   └── lib.rs                 # Rust backend for Ollama
│   ├── Cargo.toml                 # Rust dependencies
│   └── tauri.conf.json            # Tauri configuration
├── package.json                   # Build scripts
└── vite.config.js                 # Vite config
```

## Development Workflow

### Making Changes

1. **UI/Logic changes**: Edit shared components in `src/`
   - Changes apply to both web and desktop automatically

2. **Web-specific AI**: Edit `src/services/AIService.js`

3. **Desktop-specific AI**: Edit `src/services/AIService.desktop.js` and `src-tauri/src/lib.rs`

### Testing Both Versions

```bash
# Terminal 1: Test web
npm run dev

# Terminal 2: Test desktop (in new terminal)
npm run dev:desktop
```

## Deployment

### Web Deployment

1. Build:
   ```bash
   npm run build
   ```

2. Deploy `dist/` folder to:
   - Vercel: `vercel --prod`
   - Netlify: `netlify deploy --prod --dir=dist`
   - GitHub Pages: Copy `dist/` to `gh-pages` branch

### Desktop Distribution

1. Build:
   ```bash
   npm run build:desktop
   ```

2. Distribute:
   - macOS: `src-tauri/target/release/bundle/dmg/*.dmg`
   - Windows: `src-tauri/target/release/bundle/msi/*.msi`
   - Linux: `src-tauri/target/release/bundle/appimage/*.AppImage`

3. Auto-update setup (optional):
   - Configure in `src-tauri/tauri.conf.json`
   - Set up update server
   - Enable auto-updater plugin

## Benefits of Dual Build

✅ **Single Codebase**: Maintain one app, deploy two versions
✅ **User Choice**: Web for quick access, Desktop for power users
✅ **Best Performance**: Native speed with Ollama on desktop
✅ **Privacy**: 100% local processing in both versions (optional)
✅ **Flexibility**: Web accessible anywhere, Desktop for offline work
✅ **Progressive Enhancement**: Start with web, upgrade to desktop

## Next Steps

- [ ] Set up CI/CD for both builds
- [ ] Add Windows/Linux desktop support testing
- [ ] Implement desktop auto-updater
- [ ] Add desktop-specific features (system tray, etc.)
- [ ] Optimize WebLLM model loading
- [ ] Add model management UI for desktop

---

**Questions?** Check the troubleshooting section or open an issue on GitHub.
