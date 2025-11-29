import React, { useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vim, Vim, getCM } from '@replit/codemirror-vim';

// Language imports
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';

// Theme imports
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, drawSelection } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Completion imports
import { autocompletion, acceptCompletion, completionStatus, startCompletion } from '@codemirror/autocomplete';
import { createSmartCompletionSource } from '../utils/completions/completionSource';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

// Custom syntax highlighting for dark mode
const darkHighlighting = HighlightStyle.define([
  { tag: t.keyword, color: '#c678dd' }, // purple - keywords like if, const, function
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#e06c75' }, // red
  { tag: [t.function(t.variableName), t.labelName], color: '#61afef' }, // blue - function names
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#d19a66' }, // orange
  { tag: [t.definition(t.name), t.separator], color: '#abb2bf' }, // light gray
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#e5c07b' }, // yellow
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#56b6c2' }, // cyan
  { tag: [t.meta, t.comment], color: '#5c6370', fontStyle: 'italic' }, // gray comments
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#61afef', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: '#e06c75' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#d19a66' }, // orange
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#98c379' }, // green - strings
  { tag: t.invalid, color: '#ffffff', backgroundColor: '#e06c75' },
]);

// Custom syntax highlighting for light mode
const lightHighlighting = HighlightStyle.define([
  { tag: t.keyword, color: '#a626a4' }, // purple
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#e45649' }, // red
  { tag: [t.function(t.variableName), t.labelName], color: '#4078f2' }, // blue
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#c18401' }, // orange
  { tag: [t.definition(t.name), t.separator], color: '#383a42' }, // dark gray
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#986801' }, // brown
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#0184bc' }, // cyan
  { tag: [t.meta, t.comment], color: '#a0a1a7', fontStyle: 'italic' }, // gray
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#4078f2', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: '#e45649' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#c18401' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#50a14f' }, // green
  { tag: t.invalid, color: '#ffffff', backgroundColor: '#e45649' },
]);

const CodeMirrorEditor = forwardRef(({
  value,
  onChange,
  language = 'javascript',
  theme = 'light',
  vimEnabled = false,
  onVimModeChange,
  onCursorChange,
  readOnly = false,
  placeholder = '',
  className = '',
  style = {},
  aiSettings = null // AI completion settings
}, ref) => {
  const editorRef = useRef(null);
  const vimModeRef = useRef('normal');
  const viewRef = useRef(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (viewRef.current) {
        viewRef.current.focus();
      }
    },
    getView: () => viewRef.current,
    setSelection: (from, to) => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          selection: { anchor: from, head: to || from }
        });
      }
    },
    getValue: () => {
      if (viewRef.current) {
        return viewRef.current.state.doc.toString();
      }
      return value;
    }
  }));

  // Map language names to CodeMirror language extensions
  const getLanguageExtension = useCallback((lang) => {
    const langMap = {
      'javascript': javascript({ jsx: true }),
      'typescript': javascript({ jsx: true, typescript: true }),
      'jsx': javascript({ jsx: true }),
      'tsx': javascript({ jsx: true, typescript: true }),
      'python': python(),
      'java': java(),
      'cpp': cpp(),
      'c': cpp(),
      'rust': rust(),
      'php': php(),
      'sql': sql(),
      'xml': xml(),
      'html': html(),
      'css': css(),
      'json': json(),
      'markdown': markdown(),
      'markup': html(), // For XML/HTML
    };
    return langMap[lang] || javascript();
  }, []);

  // Build extensions array
  const extensions = useCallback(() => {
    const exts = [];

    // Add vim mode if enabled
    if (vimEnabled) {
      exts.push(vim());
    }

    // Add language support
    exts.push(getLanguageExtension(language));

    // Add syntax highlighting based on theme
    if (theme === 'dark') {
      exts.push(syntaxHighlighting(darkHighlighting));
    } else {
      exts.push(syntaxHighlighting(lightHighlighting));
    }

    // Add line wrapping
    exts.push(EditorView.lineWrapping);

    // Explicitly add drawSelection extension
    exts.push(drawSelection());

    // Add high-priority selection styling based on theme
    const selectionTheme = theme === 'dark'
      ? EditorView.theme({
          '.cm-selectionBackground': {
            backgroundColor: '#fbbf24 !important',
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: '#fbbf24 !important',
          },
          '.cm-selectionMatch': {
            backgroundColor: 'rgba(251, 191, 36, 0.4) !important',
          }
        }, { dark: true })
      : EditorView.theme({
          '.cm-selectionBackground': {
            backgroundColor: '#3b82f6 !important',
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: '#3b82f6 !important',
          },
          '.cm-selectionMatch': {
            backgroundColor: 'rgba(59, 130, 246, 0.3) !important',
          }
        });

    exts.push(Prec.highest(selectionTheme));

    // Add monospace font for all themes
    exts.push(EditorView.theme({
      '&': {
        height: '100%',
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      },
      '.cm-scroller': {
        overflow: 'auto'
      },
      '.cm-content': {
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      },
      '.cm-gutters': {
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      }
    }));

    // Add cursor position tracking
    if (onCursorChange) {
      exts.push(EditorView.updateListener.of((update) => {
        if (update.selectionSet) {
          const pos = update.state.selection.main.head;
          onCursorChange(pos);
        }
      }));
    }

    // Add DOM-level Tab key handler with highest precedence to prevent browser navigation
    exts.push(Prec.highest(EditorView.domEventHandlers({
      keydown: (event, view) => {
        if (event.key === 'Tab') {
          const status = completionStatus(view.state);
          if (status === 'active') {
            // Prevent default browser Tab navigation
            event.preventDefault();
            event.stopPropagation();
            // Accept the completion
            acceptCompletion(view);
            return true;
          }
        }
        return false;
      }
    })));

    // Add custom completion source with language-specific keywords and snippets
    // Pass AI settings to enable AI-powered completions
    exts.push(autocompletion({
      override: [createSmartCompletionSource(language, aiSettings)],
      activateOnTyping: true,
      maxRenderedOptions: 10,
      closeOnBlur: true,
      defaultKeymap: true, // Enable default keymap for arrow keys, Enter, Escape
      interactionDelay: 75,
      aboveCursor: false,
    }));

    // Add Ctrl-Space to trigger completion manually
    exts.push(keymap.of([
      {
        key: 'Ctrl-Space',
        run: startCompletion
      }
    ]));

    // Add Tab indentation (lower priority, runs when completion doesn't handle it)
    exts.push(keymap.of([indentWithTab]));

    return exts;
  }, [vimEnabled, language, getLanguageExtension, onCursorChange, theme, aiSettings]);

  // Handle VIM mode changes
  useEffect(() => {
    if (!vimEnabled || !viewRef.current) return;

    // Listen for mode changes
    const checkMode = () => {
      try {
        const cm = getCM(viewRef.current);
        if (!cm || !cm.state || !cm.state.vim) return;

        const mode = cm.state.vim.mode || 'normal';
        if (mode !== vimModeRef.current) {
          vimModeRef.current = mode;
          if (onVimModeChange) {
            onVimModeChange(mode);
          }
        }
      } catch (e) {
        // Silently handle errors during mode checking
        console.debug('VIM mode check error:', e);
      }
    };

    // Check mode periodically (VIM doesn't provide direct mode change events)
    const interval = setInterval(checkMode, 100);

    return () => clearInterval(interval);
  }, [vimEnabled, onVimModeChange]);

  // Custom theme based on dark/light mode
  const customTheme = theme === 'dark'
    ? EditorView.theme({
        '&': {
          backgroundColor: '#111827', // bg-gray-900
          color: '#e5e7eb', // text-gray-200
        },
        '.cm-content': {
          caretColor: '#e5e7eb',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: '#e5e7eb',
        },
        '.cm-activeLine': {
          backgroundColor: '#1f2937', // bg-gray-800
        },
        '.cm-gutters': {
          backgroundColor: '#1f2937', // bg-gray-800
          color: '#9ca3af', // text-gray-400
          border: 'none',
        },
      }, { dark: true })
    : EditorView.theme({
        '&': {
          backgroundColor: '#ffffff',
          color: '#24292e',
        },
        '.cm-content': {
          caretColor: '#24292e',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: '#24292e',
        },
        '.cm-activeLine': {
          backgroundColor: '#f6f8fa',
        },
        '.cm-gutters': {
          backgroundColor: '#f6f8fa',
          color: '#6e7781',
          border: 'none',
        },
      });

  return (
    <div className={`codemirror-wrapper ${className}`} style={{ height: '100%', width: '100%', overflow: 'hidden', ...style }}>
      <style>{`
        .codemirror-wrapper .cm-selectionLayer .cm-selectionBackground,
        .codemirror-wrapper .cm-selectionBackground,
        .codemirror-wrapper .cm-focused .cm-selectionBackground,
        .codemirror-wrapper .cm-editor .cm-selectionBackground,
        .codemirror-wrapper .cm-content .cm-selectionBackground {
          background-color: ${theme === 'dark' ? '#fbbf24' : '#3b82f6'} !important;
          color: ${theme === 'dark' ? '#000000' : '#ffffff'} !important;
        }
        .codemirror-wrapper .cm-selectionMatch {
          background-color: ${theme === 'dark' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(59, 130, 246, 0.3)'} !important;
        }
        .codemirror-wrapper .cm-vim-primary ::selection,
        .codemirror-wrapper .cm-line ::selection,
        .codemirror-wrapper .cm-content ::selection {
          background-color: ${theme === 'dark' ? '#fbbf24' : '#3b82f6'} !important;
          color: ${theme === 'dark' ? '#000000' : '#ffffff'} !important;
        }

        /* AI completion styling */
        .codemirror-wrapper .cm-completionIcon-ai::after {
          content: "✨";
          font-size: 14px;
        }
        .codemirror-wrapper .cm-completionLabel[aria-selected] .cm-completionIcon-ai::after {
          filter: brightness(1.2);
        }
        .codemirror-wrapper .cm-tooltip-autocomplete ul li[aria-selected] {
          background-color: ${theme === 'dark' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(59, 130, 246, 0.2)'} !important;
        }
      `}</style>
      <CodeMirror
        ref={(r) => {
          editorRef.current = r;
          if (r && r.view) {
            viewRef.current = r.view;
          }
        }}
        value={value}
        height="100%"
        width="100%"
        extensions={extensions()}
        onChange={onChange}
        theme={customTheme}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          height: '100%',
          overflow: 'auto'
        }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: false, // We add it manually in extensions with custom styling
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false, // Disabled - using custom completion in extensions
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  );
});

CodeMirrorEditor.displayName = 'CodeMirrorEditor';

export default CodeMirrorEditor;
