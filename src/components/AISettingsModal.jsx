import React, { useState, useEffect } from 'react';
import { X, Sparkles, Cloud, Check, AlertCircle, Monitor, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { AI_PROVIDERS, GROQ_MODELS, OPENAI_MODELS, CLAUDE_MODELS } from '../services/AIService';

// Default Ollama models (will be replaced if desktop version is available)
const DEFAULT_OLLAMA_MODELS = {
  'qwen2.5-coder:1.5b': {
    id: 'qwen2.5-coder:1.5b',
    name: 'Qwen2.5 Coder 1.5B (Recommended)',
    size: '1 GB',
    speed: 'Very Fast'
  },
  'qwen2.5-coder:3b': {
    id: 'qwen2.5-coder:3b',
    name: 'Qwen2.5 Coder 3B',
    size: '2 GB',
    speed: 'Fast'
  }
};

const AISettingsModal = ({ settings, onSave, onClose, theme, isDesktop, desktopAIService, onTriggerSetupWizard }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [showGroqApiKey, setShowGroqApiKey] = useState(false);
  const [showOpenAIApiKey, setShowOpenAIApiKey] = useState(false);
  const [showClaudeApiKey, setShowClaudeApiKey] = useState(false);
  const [ollamaModels, setOllamaModels] = useState(DEFAULT_OLLAMA_MODELS);
  const [checkingModel, setCheckingModel] = useState(false);

  // API key validation states
  const [groqApiKeyStatus, setGroqApiKeyStatus] = useState(null); // null, 'valid', 'invalid'
  const [openaiApiKeyStatus, setOpenaiApiKeyStatus] = useState(null);
  const [claudeApiKeyStatus, setClaudeApiKeyStatus] = useState(null);
  const [validatingApiKey, setValidatingApiKey] = useState(false);

  // Load Ollama models only if desktop
  useEffect(() => {
    if (isDesktop) {
      // Use dynamic import with full path to avoid build-time resolution
      import(/* @vite-ignore */ '../services/AIService.desktop.js').then(module => {
        setOllamaModels(module.OLLAMA_MODELS);
      }).catch(err => {
        console.warn('Failed to load Ollama models:', err);
      });
    }
  }, [isDesktop]);

  // Check if selected Ollama model is available
  const handleOllamaModelChange = async (newModelId) => {
    console.log('[AISettingsModal] Model changed to:', newModelId);
    setLocalSettings({ ...localSettings, ollamaModel: newModelId });

    // Check if model is available
    if (isDesktop && desktopAIService) {
      console.log('[AISettingsModal] Checking model availability...');
      setCheckingModel(true);
      try {
        const isAvailable = await desktopAIService.isModelAvailable(newModelId);
        console.log('[AISettingsModal] Model available:', isAvailable);

        if (!isAvailable && onTriggerSetupWizard) {
          // Model not available - trigger setup wizard
          console.log('[AISettingsModal] Triggering setup wizard for:', newModelId);
          onClose();
          onTriggerSetupWizard(newModelId);
        } else if (!isAvailable) {
          console.warn('[AISettingsModal] Model not available but no setup wizard callback');
        }
      } catch (error) {
        console.error('Failed to check model availability:', error);
      } finally {
        setCheckingModel(false);
      }
    } else {
      console.log('[AISettingsModal] Not desktop or no AI service');
    }
  };

  // API key validation - basic format checks
  const validateApiKeyFormat = (key, provider) => {
    if (!key || key.trim() === '') return null;

    switch (provider) {
      case 'groq':
        // Groq keys start with 'gsk_'
        return key.startsWith('gsk_') && key.length > 20 ? 'valid' : 'invalid';
      case 'openai':
        // OpenAI keys start with 'sk-'
        return key.startsWith('sk-') && key.length > 20 ? 'valid' : 'invalid';
      case 'claude':
        // Claude keys start with 'sk-ant-'
        return key.startsWith('sk-ant-') && key.length > 20 ? 'valid' : 'invalid';
      default:
        return null;
    }
  };

  // Handle API key changes with validation
  const handleGroqApiKeyChange = (value) => {
    setLocalSettings({ ...localSettings, groqApiKey: value });
    setGroqApiKeyStatus(validateApiKeyFormat(value, 'groq'));
  };

  const handleOpenAIApiKeyChange = (value) => {
    setLocalSettings({ ...localSettings, openaiApiKey: value });
    setOpenaiApiKeyStatus(validateApiKeyFormat(value, 'openai'));
  };

  const handleClaudeApiKeyChange = (value) => {
    setLocalSettings({ ...localSettings, claudeApiKey: value });
    setClaudeApiKeyStatus(validateApiKeyFormat(value, 'claude'));
  };

  // Open API key page in browser
  const openApiKeyPage = async (provider) => {
    const urls = {
      groq: 'https://console.groq.com/keys',
      openai: 'https://platform.openai.com/api-keys',
      claude: 'https://console.anthropic.com/settings/keys'
    };

    const url = urls[provider];
    if (!url) return;

    if (isDesktop || window?.__TAURI__) {
      const shellOpen = window?.__TAURI__?.shell?.open;
      if (typeof shellOpen === 'function') {
        try {
          console.info('[AISettingsModal] Opening via tauri.shell.open');
          await shellOpen(url);
          return;
        } catch (error) {
          console.warn('[AISettingsModal] Failed via tauri.shell.open', error);
        }
      }

      const tauriCoreInvoke = window?.__TAURI__?.core?.invoke;
      if (typeof tauriCoreInvoke === 'function') {
        try {
          console.info('[AISettingsModal] Opening via tauri.core.invoke plugin:shell|open');
          await tauriCoreInvoke('plugin:shell|open', { path: url });
          return;
        } catch (error) {
          console.warn('[AISettingsModal] Failed via tauri.core.invoke', error);
        }
      }

      const tauriInvokeV1 = window?.__TAURI__?.invoke;
      if (typeof tauriInvokeV1 === 'function') {
        try {
          console.info('[AISettingsModal] Opening via tauri.invoke plugin:shell|open');
          await tauriInvokeV1('plugin:shell|open', { path: url });
          return;
        } catch (error) {
          console.warn('[AISettingsModal] Failed via tauri.invoke v1', error);
        }
      }

      const tauriInvokeLegacy = window?.__TAURI_INVOKE__;
      if (typeof tauriInvokeLegacy === 'function') {
        try {
          console.info('[AISettingsModal] Opening via __TAURI_INVOKE__ plugin:shell|open');
          await tauriInvokeLegacy('plugin:shell|open', { path: url });
          return;
        } catch (error) {
          console.warn('[AISettingsModal] Failed via __TAURI_INVOKE__', error);
        }
      }

      // Additional fallback for older shell command name
      const tauriShellInvoke = window?.__TAURI__?.core?.invoke;
      if (typeof tauriShellInvoke === 'function') {
        try {
          console.info('[AISettingsModal] Opening via tauri.core.invoke shell:open');
          await tauriShellInvoke('shell:open', { path: url });
          return;
        } catch (error) {
          console.warn('[AISettingsModal] Failed via tauri.core.invoke shell:open', error);
        }
      }
    }

    console.info('[AISettingsModal] Falling back to window.open for API key link');
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) return;

    // Try anchor click fallback (helps bypass some blockers)
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // If still blocked, ask user before replacing the app view
    const confirmed = window.confirm('Unable to open your browser automatically. Open the API key page in this window instead?');
    if (confirmed) {
      window.location.href = url;
    } else {
      console.warn('[AISettingsModal] window.open and anchor click were blocked; please copy this link:', url);
    }
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className={`w-full max-w-2xl rounded-lg shadow-2xl ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className={`w-6 h-6 ${
              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
            }`} />
            <h2 className={`text-xl font-bold ${
              theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
            }`}>
              AI Fix Settings
            </h2>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded transition-colors ${
              theme === 'dark'
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Provider Selection */}
          <div>
            <label className={`block text-sm font-semibold mb-3 ${
              theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
            }`}>
              AI Provider
            </label>

            <div className="space-y-3">
              {/* Groq Mode */}
              <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                localSettings.provider === AI_PROVIDERS.GROQ
                  ? theme === 'dark'
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-purple-500 bg-purple-50'
                  : theme === 'dark'
                    ? 'border-gray-700 hover:border-gray-600'
                    : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="provider"
                  value={AI_PROVIDERS.GROQ}
                  checked={localSettings.provider === AI_PROVIDERS.GROQ}
                  onChange={(e) => setLocalSettings({ ...localSettings, provider: e.target.value })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5" />
                    <span className={`font-semibold ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      Groq
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                      Recommended
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Fast cloud inference • Requires API key • Free tier available
                  </p>
                </div>
              </label>

              {/* OpenAI Mode */}
              <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                localSettings.provider === AI_PROVIDERS.OPENAI
                  ? theme === 'dark'
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-purple-500 bg-purple-50'
                  : theme === 'dark'
                    ? 'border-gray-700 hover:border-gray-600'
                    : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="provider"
                  value={AI_PROVIDERS.OPENAI}
                  checked={localSettings.provider === AI_PROVIDERS.OPENAI}
                  onChange={(e) => setLocalSettings({ ...localSettings, provider: e.target.value })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <span className={`font-semibold ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      OpenAI
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Most capable models • Requires API key • Pay per use
                  </p>
                </div>
              </label>

              {/* Claude Mode */}
              <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                localSettings.provider === AI_PROVIDERS.CLAUDE
                  ? theme === 'dark'
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-purple-500 bg-purple-50'
                  : theme === 'dark'
                    ? 'border-gray-700 hover:border-gray-600'
                    : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="provider"
                  value={AI_PROVIDERS.CLAUDE}
                  checked={localSettings.provider === AI_PROVIDERS.CLAUDE}
                  onChange={(e) => setLocalSettings({ ...localSettings, provider: e.target.value })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5" />
                    <span className={`font-semibold ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      Claude
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Advanced reasoning • Requires API key • Pay per use
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Groq Settings */}
          {localSettings.provider === AI_PROVIDERS.GROQ && (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-3 ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  Groq API Key
                </label>

                {/* Get API Key Button */}
                <button
                  type="button"
                  onClick={() => openApiKeyPage('groq')}
                  className={`w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded border-2 border-dashed transition-colors ${
                    theme === 'dark'
                      ? 'border-purple-500/50 bg-purple-900/20 hover:bg-purple-900/30 text-purple-300'
                      : 'border-purple-400/50 bg-purple-50 hover:bg-purple-100 text-purple-700'
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="font-medium">Get API Key from Groq</span>
                </button>

                <div className="relative">
                  <input
                    type={showGroqApiKey ? 'text' : 'password'}
                    value={localSettings.groqApiKey || ''}
                    onChange={(e) => handleGroqApiKeyChange(e.target.value)}
                    placeholder="Paste your Groq API key (gsk_...)"
                    className={`w-full px-4 py-2 pr-20 rounded border ${
                      groqApiKeyStatus === 'valid'
                        ? theme === 'dark'
                          ? 'border-green-500 bg-gray-700 text-gray-200'
                          : 'border-green-500 bg-white text-gray-900'
                        : groqApiKeyStatus === 'invalid'
                          ? theme === 'dark'
                            ? 'border-red-500 bg-gray-700 text-gray-200'
                            : 'border-red-500 bg-white text-gray-900'
                          : theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200'
                            : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />

                  {/* Validation Icon */}
                  {groqApiKeyStatus && (
                    <div className="absolute right-16 top-1/2 -translate-y-1/2">
                      {groqApiKeyStatus === 'valid' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowGroqApiKey(!showGroqApiKey)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded ${
                      theme === 'dark' ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {showGroqApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>

                {groqApiKeyStatus === 'valid' && (
                  <p className="text-xs mt-2 text-green-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    API key format looks correct
                  </p>
                )}
                {groqApiKeyStatus === 'invalid' && (
                  <p className="text-xs mt-2 text-red-500 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Invalid key format. Groq keys start with 'gsk_'
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-3 ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  Groq Model
                </label>
                <select
                  value={localSettings.groqModel || GROQ_MODELS['llama-3.3-70b'].id}
                  onChange={(e) => setLocalSettings({ ...localSettings, groqModel: e.target.value })}
                  className={`w-full px-4 py-2 rounded border ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-gray-200'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  {Object.entries(GROQ_MODELS).map(([key, model]) => (
                    <option key={key} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* OpenAI Settings */}
          {localSettings.provider === AI_PROVIDERS.OPENAI && (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-3 ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  OpenAI API Key
                </label>

                {/* Get API Key Button */}
                <button
                  type="button"
                  onClick={() => openApiKeyPage('openai')}
                  className={`w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded border-2 border-dashed transition-colors ${
                    theme === 'dark'
                      ? 'border-purple-500/50 bg-purple-900/20 hover:bg-purple-900/30 text-purple-300'
                      : 'border-purple-400/50 bg-purple-50 hover:bg-purple-100 text-purple-700'
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="font-medium">Get API Key from OpenAI</span>
                </button>

                <div className="relative">
                  <input
                    type={showOpenAIApiKey ? 'text' : 'password'}
                    value={localSettings.openaiApiKey || ''}
                    onChange={(e) => handleOpenAIApiKeyChange(e.target.value)}
                    placeholder="Paste your OpenAI API key (sk-...)"
                    className={`w-full px-4 py-2 pr-20 rounded border ${
                      openaiApiKeyStatus === 'valid'
                        ? theme === 'dark'
                          ? 'border-green-500 bg-gray-700 text-gray-200'
                          : 'border-green-500 bg-white text-gray-900'
                        : openaiApiKeyStatus === 'invalid'
                          ? theme === 'dark'
                            ? 'border-red-500 bg-gray-700 text-gray-200'
                            : 'border-red-500 bg-white text-gray-900'
                          : theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200'
                            : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />

                  {/* Validation Icon */}
                  {openaiApiKeyStatus && (
                    <div className="absolute right-16 top-1/2 -translate-y-1/2">
                      {openaiApiKeyStatus === 'valid' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowOpenAIApiKey(!showOpenAIApiKey)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded ${
                      theme === 'dark' ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {showOpenAIApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>

                {openaiApiKeyStatus === 'valid' && (
                  <p className="text-xs mt-2 text-green-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    API key format looks correct
                  </p>
                )}
                {openaiApiKeyStatus === 'invalid' && (
                  <p className="text-xs mt-2 text-red-500 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Invalid key format. OpenAI keys start with 'sk-'
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-3 ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  OpenAI Model
                </label>
                <select
                  value={localSettings.openaiModel || OPENAI_MODELS['gpt-4o-mini'].id}
                  onChange={(e) => setLocalSettings({ ...localSettings, openaiModel: e.target.value })}
                  className={`w-full px-4 py-2 rounded border ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-gray-200'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  {Object.entries(OPENAI_MODELS).map(([key, model]) => (
                    <option key={key} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Claude Settings */}
          {localSettings.provider === AI_PROVIDERS.CLAUDE && (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-3 ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  Claude API Key
                </label>

                {/* Get API Key Button */}
                <button
                  type="button"
                  onClick={() => openApiKeyPage('claude')}
                  className={`w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded border-2 border-dashed transition-colors ${
                    theme === 'dark'
                      ? 'border-purple-500/50 bg-purple-900/20 hover:bg-purple-900/30 text-purple-300'
                      : 'border-purple-400/50 bg-purple-50 hover:bg-purple-100 text-purple-700'
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="font-medium">Get API Key from Anthropic</span>
                </button>

                <div className="relative">
                  <input
                    type={showClaudeApiKey ? 'text' : 'password'}
                    value={localSettings.claudeApiKey || ''}
                    onChange={(e) => handleClaudeApiKeyChange(e.target.value)}
                    placeholder="Paste your Claude API key (sk-ant-...)"
                    className={`w-full px-4 py-2 pr-20 rounded border ${
                      claudeApiKeyStatus === 'valid'
                        ? theme === 'dark'
                          ? 'border-green-500 bg-gray-700 text-gray-200'
                          : 'border-green-500 bg-white text-gray-900'
                        : claudeApiKeyStatus === 'invalid'
                          ? theme === 'dark'
                            ? 'border-red-500 bg-gray-700 text-gray-200'
                            : 'border-red-500 bg-white text-gray-900'
                          : theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200'
                            : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />

                  {/* Validation Icon */}
                  {claudeApiKeyStatus && (
                    <div className="absolute right-16 top-1/2 -translate-y-1/2">
                      {claudeApiKeyStatus === 'valid' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowClaudeApiKey(!showClaudeApiKey)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded ${
                      theme === 'dark' ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {showClaudeApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>

                {claudeApiKeyStatus === 'valid' && (
                  <p className="text-xs mt-2 text-green-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    API key format looks correct
                  </p>
                )}
                {claudeApiKeyStatus === 'invalid' && (
                  <p className="text-xs mt-2 text-red-500 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Invalid key format. Claude keys start with 'sk-ant-'
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-3 ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  Claude Model
                </label>
                <select
                  value={localSettings.claudeModel || CLAUDE_MODELS['claude-3-5-haiku'].id}
                  onChange={(e) => setLocalSettings({ ...localSettings, claudeModel: e.target.value })}
                  className={`w-full px-4 py-2 rounded border ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-gray-200'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  {Object.entries(CLAUDE_MODELS).map(([key, model]) => (
                    <option key={key} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Privacy Notice */}
          <div className={`p-4 rounded-lg ${
            theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start gap-2">
              <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`} />
              <div>
                <p className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-blue-300' : 'text-blue-900'
                }`}>
                  Privacy & Security
                </p>
                <p className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
                }`}>
                  <strong>Cloud AI:</strong> Your content will be sent to the provider's servers for processing.
                  <br />
                  <strong>API Keys:</strong> Encrypted before storage using AES-256-GCM. Keys never leave your device.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 p-6 border-t ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
            }`}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              theme === 'dark'
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISettingsModal;
