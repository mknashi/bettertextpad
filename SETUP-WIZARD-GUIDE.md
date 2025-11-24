# Ollama Setup Wizard

## Overview

The desktop version of BetterTextPad includes an **automatic setup wizard** that guides users through installing and configuring Ollama on first run.

## How It Works

### First Run Detection

When you launch the desktop app for the first time:

1. **Auto-Check**: App automatically checks if Ollama is installed
2. **Status Detection**:
   - ✅ Ollama installed + models available → Skip wizard
   - ⚠️ Ollama not installed → Show wizard
   - ⚠️ Ollama installed but no models → Show model download screen

3. **Smart Persistence**: Setup completion is saved to `localStorage`, so the wizard only appears once

### Wizard Steps

#### Step 1: Checking Installation
- Automatic detection of Ollama
- Shows loading spinner while checking
- ~1-2 seconds

#### Step 2: Ollama Not Found (if needed)
Displays:
- Clear explanation of why Ollama is needed
- Step-by-step installation instructions
- **Download Ollama** button (opens ollama.ai)
- **Check Again** button to retry detection after install

#### Step 3: Choose Model (if Ollama installed but no models)
Displays:
- List of recommended models with specs:
  - **Qwen2.5 Coder 1.5B** (1 GB) - Recommended
  - **Qwen2.5 Coder 3B** (2 GB) - Balanced
  - **Qwen2.5 Coder 7B** (4.7 GB) - High quality
- Size, speed, and description for each
- **Download** button to pull selected model

#### Step 4: Downloading Model
- Shows download progress
- Model size indicator
- "This may take a few minutes" message
- Cannot be canceled (Ollama requirement)

#### Step 5: Setup Complete
- Success confirmation
- Lists all available models
- **Start Using Desktop AI** button
- Marks setup as completed

---

## User Experience

### First-Time Desktop User

```
1. Download BetterTextPad.dmg
2. Install and launch app
3. App opens normally
4. Setup wizard appears automatically
5. Click "Download Ollama" → Opens browser
6. Install Ollama from ollama.ai
7. Return to app → Click "Check Again"
8. Choose model (default: Qwen2.5 Coder 1.5B)
9. Click "Download Model" → Wait ~2-5 min
10. Click "Start Using Desktop AI"
11. Done! AI features now work
```

**Total time**: 5-10 minutes (mostly download time)

### Re-Running Setup Wizard

Users can manually trigger the wizard anytime:

1. Open **Settings → AI Fix Settings**
2. Select **Desktop AI (Ollama)**
3. Scroll to **Ollama Model** section
4. Click **Run Setup Wizard**
5. App reloads and wizard appears

---

## Technical Implementation

### Files

- **OllamaSetupWizard.jsx** - Main wizard component
- **BetterTextPad.jsx** - Integration and first-run logic
- **AIService.desktop.js** - Ollama status checking
- **lib.rs** - Rust backend commands

### State Management

```javascript
// In BetterTextPad.jsx
const [showOllamaSetup, setShowOllamaSetup] = useState(false);
const [ollamaSetupChecked, setOllamaSetupChecked] = useState(false);

// Check on first run
useEffect(() => {
  const setupCompleted = localStorage.getItem('betternotepad-ollama-setup-completed');

  if (!setupCompleted) {
    const status = await aiService.checkOllamaStatus();
    if (!status.available || !status.models?.length) {
      setShowOllamaSetup(true);
    } else {
      localStorage.setItem('betternotepad-ollama-setup-completed', 'true');
    }
  }
}, []);
```

### Rust Backend

```rust
// Check Ollama installation
#[tauri::command]
async fn check_ollama_status() -> Result<serde_json::Value, String> {
    let output = Command::new("ollama")
        .arg("list")
        .output();

    match output {
        Ok(out) => {
            let models = parse_models(String::from_utf8_lossy(&out.stdout));
            Ok(json!({
                "available": true,
                "models": models
            }))
        }
        Err(_) => Ok(json!({
            "available": false,
            "models": []
        }))
    }
}

// Download model
#[tauri::command]
async fn pull_ollama_model(model: String) -> Result<String, String> {
    let output = Command::new("ollama")
        .arg("pull")
        .arg(&model)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(format!("Successfully pulled {}", model))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

---

## Features

### ✅ Automatic Detection
- No user action required on first run
- Intelligent status checking
- Graceful error handling

### ✅ Clear Instructions
- Step-by-step guidance
- Visual progress indicators
- Helpful tips and links

### ✅ Model Selection
- Curated list of recommended models
- Size/speed information
- Default recommendation (1.5B)

### ✅ Progress Feedback
- Loading states for each step
- Download progress (where possible)
- Success confirmation

### ✅ Flexible Setup
- Can skip/close wizard anytime
- Can re-run wizard later
- Doesn't block app usage

### ✅ Smart Persistence
- Setup state saved to localStorage
- Only shows once per fresh install
- Can be reset manually

---

## Error Handling

### Ollama Command Not Found
**Wizard shows**: "Ollama Not Found" with installation instructions

**User action**: Download and install from ollama.ai

### Model Download Fails
**Wizard shows**: Error alert with message

**User action**:
- Check internet connection
- Try different model
- Run `ollama pull` manually in terminal

### Ollama Service Not Running
**Wizard shows**: Same as "Not Found" (can't distinguish)

**User action**:
- Start Ollama: `ollama serve`
- Or reinstall Ollama

---

## Customization

### Adding More Models

Edit `AIService.desktop.js`:

```javascript
export const OLLAMA_MODELS = {
  'qwen2.5-coder:1.5b': {
    id: 'qwen2.5-coder:1.5b',
    name: 'Qwen2.5 Coder 1.5B (Recommended)',
    size: '1 GB',
    speed: 'Very Fast'
  },
  // Add new model
  'codellama:13b': {
    id: 'codellama:13b',
    name: 'CodeLlama 13B',
    size: '7.3 GB',
    speed: 'Medium'
  }
};
```

### Changing Default Model

Edit `BetterTextPad.jsx`:

```javascript
const [aiSettings, setAISettings] = useState(() => {
  return {
    // ...
    ollamaModel: 'qwen2.5-coder:3b' // Change default here
  };
});
```

### Skipping Setup Wizard

For development/testing:

```javascript
localStorage.setItem('betternotepad-ollama-setup-completed', 'true');
```

Or remove the check in `BetterTextPad.jsx`.

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **Zero Friction** | First-time users guided through entire setup |
| **No Manual Steps** | App handles detection and downloads |
| **Clear Feedback** | Users always know what's happening |
| **Recoverable** | Can re-run wizard if issues occur |
| **Professional** | VSCode/Discord-quality onboarding |

---

## Comparison with Alternatives

### Without Setup Wizard
❌ User confused: "Why doesn't AI work?"
❌ Needs to find documentation
❌ Manual terminal commands required
❌ Easy to make mistakes

### With Setup Wizard
✅ Automatic detection on first run
✅ Clear visual guidance
✅ One-click download
✅ Success confirmation

---

## Future Enhancements

- [ ] Download progress percentage
- [ ] Estimated time remaining
- [ ] Background downloads
- [ ] Automatic Ollama installation (macOS/Linux)
- [ ] Model management (delete, update)
- [ ] Multiple model selection
- [ ] Model benchmarks/comparisons

---

**The setup wizard ensures desktop users have a smooth, professional onboarding experience!** 🎉
