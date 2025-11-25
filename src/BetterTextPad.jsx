import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Plus, Minus, Save, Upload, ChevronLeft, ChevronRight, Search, Replace, Code2, StickyNote, CheckSquare, ChevronsLeft, ChevronsRight, GripVertical, Bold, Italic, Underline, Sun, Moon, Settings, ChevronDown, ChevronUp, Info, FileText, Braces, FileCode, Folder, FolderOpen, FolderPlus, Edit2, Trash2, Image as ImageIcon, Sparkles, Loader2, Maximize2, Minimize2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { marked } from 'marked';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
// Import Prism language components
// Note: Order matters! Some languages have dependencies
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating'; // Required for PHP, JSP, etc.
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-objectivec';
import 'prismjs/components/prism-perl';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-markdown';
import DiffViewerModal from './components/DiffViewerModal';
import AISettingsModal from './components/AISettingsModal';
import OllamaSetupWizard from './components/OllamaSetupWizard';
import { AI_PROVIDERS, GROQ_MODELS, OPENAI_MODELS, CLAUDE_MODELS } from './services/AIService';
import { isDesktop, getAIService } from './utils/platform';
import { loadSecureSettings, saveSecureSettings } from './utils/secureStorage';

const BRACE_PAIRS = {
  '{': '}',
  '[': ']',
  '(': ')'
};

const BRACE_LOOKUP = Object.entries(BRACE_PAIRS).reduce((acc, [open, close]) => {
  acc[close] = open;
  return acc;
}, {});

const INDENT_UNIT = '  ';
const DEFAULT_CSV_COLUMN_WIDTH = 140;
const MIN_CSV_COLUMN_WIDTH = 60;
const MAX_CSV_COLUMN_WIDTH = 420;
const DEFAULT_CSV_PREVIEW_HEIGHT = 220;
const MIN_CSV_PREVIEW_HEIGHT = 120;
const MAX_CSV_PREVIEW_HEIGHT = 420;
const APP_NAME = 'Better Text Pad';

// File type detection utility
const getFileType = (filename = '') => {
  const name = (filename || '').toLowerCase();

  // Code/Script files that should not be auto-formatted as JSON/XML
  const codeExtensions = [
    '.js', '.jsx', '.ts', '.tsx',  // JavaScript/TypeScript
    '.php', '.php3', '.php4', '.php5', '.phtml',  // PHP
    '.py', '.pyw', '.pyx',  // Python
    '.rb', '.rbw',  // Ruby
    '.java', '.class',  // Java
    '.jsp', '.jspx',  // JSP
    '.go',  // Go
    '.rs',  // Rust
    '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',  // C/C++
    '.cs',  // C#
    '.swift',  // Swift
    '.kt', '.kts',  // Kotlin
    '.scala',  // Scala
    '.m', '.mm',  // Objective-C
    '.pl', '.pm',  // Perl
    '.sh', '.bash', '.zsh', '.fish',  // Shell
    '.lua',  // Lua
    '.r', '.R',  // R
    '.dart',  // Dart
    '.sql',  // SQL
    '.vb', '.vbs',  // Visual Basic
    '.asm', '.s',  // Assembly
    '.f', '.f90', '.f95',  // Fortran
    '.pas',  // Pascal
    '.groovy', '.gradle'  // Groovy
  ];

  // Config files
  const configExtensions = [
    '.ini', '.conf', '.config', '.toml', '.yaml', '.yml',
    '.properties', '.env', '.cfg'
  ];

  // Markup files
  const markupExtensions = [
    '.html', '.htm', '.xhtml', '.xml', '.svg'
  ];

  // Markdown
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    return { type: 'markdown', shouldAutoFormat: false };
  }

  // Code files
  if (codeExtensions.some(ext => name.endsWith(ext))) {
    return { type: 'code', shouldAutoFormat: false };
  }

  // Config files
  if (configExtensions.some(ext => name.endsWith(ext))) {
    return { type: 'config', shouldAutoFormat: false };
  }

  // Markup files (can be auto-formatted as XML)
  if (markupExtensions.some(ext => name.endsWith(ext))) {
    return { type: 'markup', shouldAutoFormat: true };
  }

  // JSON files
  if (name.endsWith('.json')) {
    return { type: 'json', shouldAutoFormat: true };
  }

  // Plain text or unknown
  return { type: 'text', shouldAutoFormat: true };
};

// Detect language from content patterns
const detectLanguageFromContent = (content = '') => {
  if (!content || content.trim().length === 0) return null;

  const trimmed = content.trim();
  const firstLine = trimmed.split('\n')[0].trim();

  // JSON - starts with { or [
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) &&
      (trimmed.includes('"') || trimmed.includes(':'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch (e) {
      // Might still be JSON being typed
      if (trimmed.match(/^\s*[\{\[]/)) return 'json';
    }
  }

  // XML/HTML - starts with < and has tags
  if (trimmed.startsWith('<') && (trimmed.includes('</') || trimmed.includes('/>'))) {
    if (trimmed.match(/<(!DOCTYPE html|html|head|body|div|span|p|a|img)/i)) {
      return 'markup'; // HTML
    }
    return 'markup'; // XML
  }

  // PHP - starts with <?php
  if (trimmed.startsWith('<?php') || firstLine.includes('<?php')) {
    return 'php';
  }

  // Python - common patterns
  if (firstLine.startsWith('#!') && firstLine.includes('python')) return 'python';
  if (trimmed.match(/^(import |from .+ import |def |class |if __name__)/m)) return 'python';

  // JavaScript/TypeScript - common patterns
  if (trimmed.match(/^(import .+ from|export (default |const |function |class )|const .+ = |function |class |\/\/ |\/\*)/m)) {
    if (trimmed.includes(': ') && trimmed.match(/:\s*(string|number|boolean|any|void)/)) {
      return 'typescript'; // Has type annotations
    }
    if (trimmed.match(/<[A-Z][a-zA-Z]*.*>/)) {
      return 'jsx'; // Has JSX
    }
    return 'javascript';
  }

  // CSS - has selectors and properties
  if (trimmed.match(/[.#\w-]+\s*\{[\s\S]*:\s*[\s\S]*;?[\s\S]*\}/)) {
    return 'css';
  }

  // SQL - common keywords
  if (trimmed.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN)\s+/im)) {
    return 'sql';
  }

  // Shell/Bash - shebang or common commands
  if (firstLine.startsWith('#!') && firstLine.match(/\/(bash|sh|zsh|fish)/)) return 'bash';
  if (trimmed.match(/^(echo|cd|ls|mkdir|rm|cp|mv|grep|awk|sed)\s+/m)) return 'bash';

  // Ruby - common patterns
  if (firstLine.startsWith('#!') && firstLine.includes('ruby')) return 'ruby';
  if (trimmed.match(/^(require |class .+ < |def |module |puts |end$)/m)) return 'ruby';

  // Go - package declaration
  if (trimmed.match(/^package\s+\w+/m) && trimmed.includes('func ')) return 'go';

  // Rust - common patterns
  if (trimmed.match(/^(fn |use |pub |struct |impl |mod |let mut )/m)) return 'rust';

  // Java/C#/C++ - common patterns
  if (trimmed.match(/^(public |private |protected |class |interface |namespace )/m)) {
    if (trimmed.includes('namespace')) return 'csharp';
    if (trimmed.includes('#include')) return 'cpp';
    return 'java';
  }

  // C - #include and common patterns
  if (trimmed.match(/^#include\s*[<"]/m) && !trimmed.match(/^(class |namespace )/m)) {
    return trimmed.includes('iostream') ? 'cpp' : 'c';
  }

  // YAML - starts with --- or has key: value
  if (trimmed.startsWith('---') || trimmed.match(/^[\w-]+:\s*[\w\s]/m)) {
    if (!trimmed.includes('{') && !trimmed.includes(';')) return 'yaml';
  }

  // Markdown - has markdown syntax
  if (trimmed.match(/^(#{1,6}\s|```|\*\*|__|\[.+\]\(.+\))/m)) return 'markdown';

  return null;
};

// Get Prism language identifier from filename
const getPrismLanguage = (filename = '') => {
  const name = (filename || '').toLowerCase();

  // JavaScript/TypeScript
  if (name.endsWith('.js')) return 'javascript';
  if (name.endsWith('.jsx')) return 'jsx';
  if (name.endsWith('.ts')) return 'typescript';
  if (name.endsWith('.tsx')) return 'tsx';

  // PHP
  if (name.endsWith('.php') || name.endsWith('.php3') || name.endsWith('.php4') ||
      name.endsWith('.php5') || name.endsWith('.phtml')) return 'php';

  // Python
  if (name.endsWith('.py') || name.endsWith('.pyw') || name.endsWith('.pyx')) return 'python';

  // Ruby
  if (name.endsWith('.rb') || name.endsWith('.rbw')) return 'ruby';

  // Java
  if (name.endsWith('.java') || name.endsWith('.class')) return 'java';

  // JSP
  if (name.endsWith('.jsp') || name.endsWith('.jspx')) return 'markup';

  // Go
  if (name.endsWith('.go')) return 'go';

  // Rust
  if (name.endsWith('.rs')) return 'rust';

  // C/C++
  if (name.endsWith('.c') || name.endsWith('.h')) return 'c';
  if (name.endsWith('.cpp') || name.endsWith('.hpp') || name.endsWith('.cc') ||
      name.endsWith('.cxx')) return 'cpp';

  // C#
  if (name.endsWith('.cs')) return 'csharp';

  // Swift
  if (name.endsWith('.swift')) return 'swift';

  // Kotlin
  if (name.endsWith('.kt') || name.endsWith('.kts')) return 'kotlin';

  // Scala
  if (name.endsWith('.scala')) return 'scala';

  // Objective-C
  if (name.endsWith('.m') || name.endsWith('.mm')) return 'objectivec';

  // Perl
  if (name.endsWith('.pl') || name.endsWith('.pm')) return 'perl';

  // Shell
  if (name.endsWith('.sh') || name.endsWith('.bash') || name.endsWith('.zsh') ||
      name.endsWith('.fish')) return 'bash';

  // Lua
  if (name.endsWith('.lua')) return 'lua';

  // R
  if (name.endsWith('.r') || name.endsWith('.R')) return 'r';

  // Dart
  if (name.endsWith('.dart')) return 'dart';

  // SQL
  if (name.endsWith('.sql')) return 'sql';

  // Visual Basic
  if (name.endsWith('.vb') || name.endsWith('.vbs')) return 'vbnet';

  // Assembly
  if (name.endsWith('.asm') || name.endsWith('.s')) return 'asm6502';

  // Markup
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'markup';
  if (name.endsWith('.xml')) return 'markup';
  if (name.endsWith('.svg')) return 'markup';

  // Styles
  if (name.endsWith('.css')) return 'css';

  // Data formats
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'yaml';
  if (name.endsWith('.toml')) return 'toml';
  if (name.endsWith('.ini') || name.endsWith('.conf') || name.endsWith('.config')) return 'ini';

  // Markdown
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';

  // Groovy
  if (name.endsWith('.groovy') || name.endsWith('.gradle')) return 'groovy';

  // Default
  return null;
};

const LogoMark = ({ size = 24, className = '' }) => (
  <img
    src="/betternotepad-logo.svg"
    width={size}
    height={size}
    alt="Better Text Pad logo"
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
    draggable="false"
  />
);

const htmlEntityDecode = (input = '') => {
  const doc = new DOMParser().parseFromString(input, 'text/html');
  return doc.documentElement.textContent || '';
};
const stripHtml = (input = '') => htmlEntityDecode(input.replace(/<[^>]*>/g, ' ')).trim();
const stripAnchors = (input = '') => input.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');
const escapeHtml = (input = '') => input
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const linkifyHtml = (input = '') => {
  const regex = /((https?:\/\/)[^\s<]+)/gi;
  return input.replace(regex, (match) => `<a href="${match}" target="_blank" rel="noreferrer">${match}</a>`);
};

const parseCSV = (text = '', delimiter = ',') => {
  if (!text) return [];
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      row.push(current);
      current = '';
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        rows.push(row);
      }
      row = [];
    } else {
      current += char;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
  }
  if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
    rows.push(row);
  }
  return rows;
};

const computeCsvRowRanges = (text = '') => {
  if (!text) return [];
  const ranges = [];
  let inQuotes = false;
  let rowStart = 0;
  let lineNumber = 1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      let rowEnd = i;
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      ranges.push({ start: rowStart, end: rowEnd, lineNumber });
      rowStart = i + 1;
      lineNumber++;
    }
  }

  if (rowStart < text.length) {
    ranges.push({ start: rowStart, end: text.length, lineNumber });
  } else if (text.length === 0) {
    ranges.push({ start: 0, end: 0, lineNumber: 1 });
  }

  return ranges;
};

const serializeCSV = (rows = [], delimiter = ',') => {
  if (!rows || rows.length === 0) return '';
  const escapeCell = (cell = '') => {
    const needsQuotes = /[",\n\r]/.test(cell);
    const escaped = cell.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };
  return rows.map(row => row.map(cell => escapeCell(cell ?? '')).join(delimiter)).join('\n');
};

const looksLikeJSON = (text = '') => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const startsWith = trimmed[0];
  if (startsWith !== '{' && startsWith !== '[') return false;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'object' && parsed !== null;
  } catch (error) {
    return false;
  }
};

const looksLikeXML = (text = '') => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Check for XML declaration or opening tag
  if (trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && trimmed.includes('>'))) {
    // Basic check: should have opening and closing tags
    const hasOpeningTag = /<[\w]/.test(trimmed);
    const hasClosingTag = /<\/[\w]/.test(trimmed) || /\/>/.test(trimmed);
    return hasOpeningTag && hasClosingTag;
  }
  return false;
};

const detectCSVContent = (text = '') => {
  if (!text) return false;
  const trimmed = String(text).trim();
  if (!trimmed) return false;

  // Don't detect as CSV if it looks like JSON (valid or invalid)
  if (looksLikeJSON(trimmed)) return false;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false;

  // Don't detect as CSV if it looks like XML (valid or invalid)
  if (looksLikeXML(trimmed)) return false;
  if (trimmed.startsWith('<')) return false;

  if (!trimmed.includes(',')) return false;
  const rows = parseCSV(text);
  if (!rows || rows.length < 2) return false;
  const columnCounts = rows.map(row => row.length);
  const maxColumns = Math.max(...columnCounts);
  const minColumns = Math.min(...columnCounts);
  if (!Number.isFinite(maxColumns) || maxColumns < 2) return false;
  const allowedVariance = Math.max(1, Math.floor(maxColumns * 0.2));
  if (maxColumns - minColumns > allowedVariance) return false;
  return true;
};

const detectMarkdownContent = (text = '', filename = '') => {
  if (!text && !filename) return false;

  // Check file extension first
  if (filename && filename.toLowerCase().endsWith('.md')) return true;

  if (!text) return false;
  const trimmed = String(text).trim();
  if (!trimmed) return false;

  // Don't detect as markdown if it looks like JSON or XML
  if (looksLikeJSON(trimmed) || looksLikeXML(trimmed)) return false;
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<')) return false;

  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers
    /^\*{1,3}[^*]+\*{1,3}/m, // Bold/italic
    /^_{1,3}[^_]+_{1,3}/m,   // Bold/italic with underscores
    /^\[.+\]\(.+\)/m,        // Links
    /^!\[.+\]\(.+\)/m,       // Images
    /^>\s+/m,                // Blockquotes
    /^-{3,}$/m,              // Horizontal rules
    /^\*{3,}$/m,             // Horizontal rules
    /^```/m,                 // Code blocks
    /^`[^`]+`/m,             // Inline code
    /^\s*[-*+]\s+/m,         // Unordered lists
    /^\s*\d+\.\s+/m,         // Ordered lists
    /^\|.+\|/m,              // Tables
  ];

  let matchCount = 0;
  for (const pattern of markdownPatterns) {
    if (pattern.test(trimmed)) {
      matchCount++;
      if (matchCount >= 2) return true; // Need at least 2 markdown patterns
    }
  }

  return false;
};

const getLineColumnFromIndex = (text, index) => {
  const safeIndex = Math.max(0, Math.min(index, text.length));
  const textBeforeCursor = text.substring(0, safeIndex);
  const lines = textBeforeCursor.split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column, index: safeIndex };
};

const getIndexFromLineColumn = (text, targetLine, targetColumn) => {
  const lines = text.split('\n');
  let index = 0;
  const line = Math.max(1, targetLine || 1);
  const column = Math.max(1, targetColumn || 1);

  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    index += lines[i].length + 1;
  }

  return Math.min(index + column - 1, text.length);
};

const findMatchingBraces = (text, cursorPos) => {
  if (!text || cursorPos === null || cursorPos === undefined) return null;

  let index = Math.max(0, cursorPos - 1);
  let char = text[index];

  if (!BRACE_PAIRS[char] && !BRACE_LOOKUP[char]) {
    index = cursorPos;
    char = text[index];
  }

  if (!BRACE_PAIRS[char] && !BRACE_LOOKUP[char]) return null;

  if (BRACE_PAIRS[char]) {
    const matchChar = BRACE_PAIRS[char];
    let depth = 0;
    for (let i = index; i < text.length; i++) {
      if (text[i] === char) depth++;
      else if (text[i] === matchChar) {
        depth--;
        if (depth === 0) {
          return {
            open: { ...getLineColumnFromIndex(text, index), char, role: 'open' },
            close: { ...getLineColumnFromIndex(text, i), char: matchChar, role: 'close' }
          };
        }
      }
    }
  } else {
    const matchChar = BRACE_LOOKUP[char];
    let depth = 0;
    for (let i = index; i >= 0; i--) {
      if (text[i] === char) depth++;
      else if (text[i] === matchChar) {
        depth--;
        if (depth === 0) {
          return {
            open: { ...getLineColumnFromIndex(text, i), char: matchChar, role: 'open' },
            close: { ...getLineColumnFromIndex(text, index), char, role: 'close' }
          };
        }
      }
    }
  }

  return null;
};

const buildJSONStructure = (text) => {
  let counter = 0;
  const rootNodes = [];
  const stack = [];
  const createNode = (label, line) => ({
    id: `json-${counter++}-${line}`,
    label,
    line,
    children: []
  });

  const attachNode = (node) => {
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.node.children.push(node);
    } else {
      rootNodes.push(node);
    }
  };

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const lineNum = index + 1;
    if (!trimmed) return;

    if (/^[}\]]/.test(trimmed)) {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if ((trimmed.startsWith('}') && top.type === 'object') ||
            (trimmed.startsWith(']') && top.type === 'array')) {
          stack.pop();
          break;
        }
        stack.pop();
      }
      return;
    }

    if (stack.length === 0 && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      const node = createNode(trimmed.startsWith('{') ? '{ }' : '[ ]', lineNum);
      rootNodes.push(node);
      stack.push({ node, type: trimmed.startsWith('{') ? 'object' : 'array', index: 0, prefix: '' });
      return;
    }

    const keyMatch = trimmed.match(/^"([^"]+)"\s*:\s*(.*)$/);
    if (keyMatch) {
      const key = keyMatch[1];
      const rest = keyMatch[2];
      if (rest.startsWith('{')) {
        const node = createNode(`${key} { }`, lineNum);
        attachNode(node);
        if (!rest.includes('}')) {
          stack.push({ node, type: 'object' });
        }
      } else if (rest.startsWith('[')) {
        const node = createNode(`${key} [ ]`, lineNum);
        attachNode(node);
        if (!rest.includes(']')) {
          stack.push({ node, type: 'array', index: 0, prefix: key });
        }
      } else {
        const valueSnippet = rest.replace(/,$/, '').trim();
        attachNode(createNode(`${key}: ${valueSnippet}`, lineNum));
      }
      return;
    }

    const parent = stack[stack.length - 1];
    if (!parent) return;

    if (parent.type === 'array') {
      const currentIndex = parent.index || 0;
      parent.index = currentIndex + 1;
      const prefixLabel = parent.prefix ? `${parent.prefix}[${currentIndex}]` : `[${currentIndex}]`;
      if (trimmed.startsWith('{')) {
        const node = createNode(`${prefixLabel} { }`, lineNum);
        parent.node.children.push(node);
        if (!trimmed.includes('}')) {
          stack.push({ node, type: 'object' });
        }
      } else if (trimmed.startsWith('[')) {
        const node = createNode(`${prefixLabel} [ ]`, lineNum);
        parent.node.children.push(node);
        if (!trimmed.includes(']')) {
          stack.push({ node, type: 'array', index: 0, prefix: prefixLabel });
        }
      } else {
        parent.node.children.push(createNode(`${prefixLabel} ${trimmed.replace(/,$/, '')}`, lineNum));
      }
    }
  });

  return rootNodes;
};

const buildXMLStructure = (text) => {
  let counter = 0;
  const rootNodes = [];
  const stack = [];
  const lines = text.split('\n');

  const createNode = (label, line) => ({
    id: `xml-${counter++}-${line}`,
    label,
    line,
    children: []
  });

  const attachNode = (node) => {
    if (stack.length > 0) {
      stack[stack.length - 1].node.children.push(node);
    } else {
      rootNodes.push(node);
    }
  };
  const incrementSiblingIndex = (tag) => {
    const parent = stack[stack.length - 1];
    if (!parent) return { label: '', index: null, parentRef: null, tag };
    const childCounts = parent.childCounts || (parent.childCounts = {});
    const showMap = parent.showIndices || (parent.showIndices = {});
    childCounts[tag] = (childCounts[tag] || 0) + 1;
    const currentIndex = childCounts[tag] - 1;
    let label = '';
    if (showMap[tag]) {
      label = `[${currentIndex}]`;
    }
    return { label, index: currentIndex, parentRef: parent, tag };
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const lineNum = index + 1;
    if (!trimmed) return;
    if (trimmed.startsWith('<!--') || trimmed.startsWith('<?')) return;

    const closingMatch = trimmed.match(/^<\/([\w:\-\.]+)>/);
    if (closingMatch) {
      while (stack.length) {
        const top = stack.pop();
        if (top.tag === closingMatch[1]) break;
      }
      return;
    }

    const openMatch = trimmed.match(/^<([\w:\-\.]+)([^>]*)>/);
    if (openMatch && !trimmed.startsWith('</')) {
      const tag = openMatch[1];
      const inlineClose = trimmed.includes(`</${tag}>`);
      const selfClosing = /\/>\s*$/.test(trimmed);
      const { label: indexLabel, parentRef } = incrementSiblingIndex(tag);
      const label = indexLabel ? `<${tag}> ${indexLabel}` : `<${tag}>`;
      const node = createNode(label, lineNum);
      attachNode(node);
      if (parentRef) {
        parentRef.showIndices = parentRef.showIndices || {};
        parentRef.showIndices[tag] = true;
      }
      if (!selfClosing && !inlineClose) {
        stack.push({ node, tag, childCounts: {}, showIndices: {} });
      }
    }
  });

  return rootNodes;
};

const createDefaultNotesState = () => {
  const firstNoteId = 1;
  const firstFolderId = 1;
  return {
    notes: [{ id: firstNoteId, folderId: null, title: '', content: '', images: [], createdAt: Date.now(), updatedAt: Date.now(), archived: false }],
    folders: [],
    nextNoteId: firstNoteId + 1,
    nextFolderId: firstFolderId + 1,
    activeFolderId: null,
    activeNoteId: null,
    viewMode: 'tiles'
  };
};

const createDefaultTodosState = () => {
  const firstId = 1;
  return {
    tabs: [{ id: firstId, title: 'List 1', items: [] }],
    activeId: firstId,
    nextId: firstId + 1
  };
};

const loadNotesState = () => {
  const fallback = createDefaultNotesState();
  if (typeof window === 'undefined' || !window?.localStorage) return fallback;
  const storage = window.localStorage;

  const sanitizeNote = (note) => ({
    id: typeof note.id === 'number' ? note.id : Number(note.id) || Date.now(),
    folderId: note.folderId !== undefined ? (note.folderId === null ? null : Number(note.folderId)) : null,
    title: typeof note.title === 'string' ? note.title : '',
    content: typeof note.content === 'string' ? note.content : '',
    images: Array.isArray(note.images) ? note.images : [],
    createdAt: typeof note.createdAt === 'number' ? note.createdAt : Date.now(),
    updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now(),
    archived: Boolean(note.archived)
  });

  const sanitizeFolder = (folder) => ({
    id: typeof folder.id === 'number' ? folder.id : Number(folder.id) || Date.now(),
    parentId: folder.parentId !== undefined ? (folder.parentId === null ? null : Number(folder.parentId)) : null,
    name: typeof folder.name === 'string' ? folder.name : 'Untitled Folder',
    expanded: typeof folder.expanded === 'boolean' ? folder.expanded : true
  });

  try {
    const saved = storage.getItem('betternotepad-notes-state-v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.notes)) {
        const notes = parsed.notes.map(sanitizeNote);
        const folders = Array.isArray(parsed.folders) ? parsed.folders.map(sanitizeFolder) : [];
        const noteIds = notes.map(n => Number(n.id) || 0);
        const folderIds = folders.map(f => Number(f.id) || 0);

        return {
          notes,
          folders,
          nextNoteId: Number.isFinite(parsed.nextNoteId) && parsed.nextNoteId > 0 ? parsed.nextNoteId : Math.max(0, ...noteIds) + 1,
          nextFolderId: Number.isFinite(parsed.nextFolderId) && parsed.nextFolderId > 0 ? parsed.nextFolderId : Math.max(0, ...folderIds) + 1,
          activeFolderId: parsed.activeFolderId !== undefined ? (parsed.activeFolderId === null ? null : Number(parsed.activeFolderId)) : null,
          activeNoteId: parsed.activeNoteId !== undefined ? (parsed.activeNoteId === null ? null : Number(parsed.activeNoteId)) : null,
          viewMode: parsed.viewMode === 'tiles' || parsed.viewMode === 'list' ? parsed.viewMode : 'tiles'
        };
      }
    }

    // Legacy migration from old tab-based structure
    const legacySaved = storage.getItem('betternotepad-notes-state');
    if (legacySaved) {
      const parsed = JSON.parse(legacySaved);
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const notes = parsed.tabs.map((tab, idx) => ({
          id: typeof tab.id === 'number' ? tab.id : idx + 1,
          folderId: null,
          title: typeof tab.title === 'string' ? tab.title : '',
          content: typeof tab.content === 'string' ? tab.content : '',
          images: Array.isArray(tab.images) ? tab.images : [],
          createdAt: Date.now() - (parsed.tabs.length - idx) * 1000,
          updatedAt: Date.now() - (parsed.tabs.length - idx) * 1000
        }));
        const noteIds = notes.map(n => n.id);
        return {
          notes,
          folders: [],
          nextNoteId: Math.max(...noteIds) + 1,
          nextFolderId: 1,
          activeFolderId: null,
          activeNoteId: null,
          viewMode: 'tiles'
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load saved notes, resetting storage.', error);
  }
  return fallback;
};

const loadTodosState = () => {
  const fallback = createDefaultTodosState();
  if (typeof window === 'undefined' || !window?.localStorage) return fallback;
  const storage = window.localStorage;
  const sanitizeTabs = (tabs) => tabs.map(tab => ({
    id: typeof tab.id === 'number' ? tab.id : Number(tab.id) || Date.now(),
    title: typeof tab.title === 'string' ? tab.title : `List ${tab.id}`,
    items: Array.isArray(tab.items) ? tab.items.map(item => ({
      id: typeof item.id === 'number' ? item.id : Number(item.id) || Date.now(),
      text: typeof item.text === 'string' ? item.text : '',
      dueDate: item.dueDate || null,
      completedDate: item.completedDate || null,
      done: Boolean(item.done)
    })) : []
  }));

  try {
    const saved = storage.getItem('betternotepad-todos-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const tabs = sanitizeTabs(parsed.tabs);
        const ids = tabs.map(tab => Number(tab.id) || 0);
        const candidateActive = Number(parsed.activeId);
        const nextCandidate = Number(parsed.nextId);
        return {
          tabs,
          activeId: tabs.find(tab => tab.id === candidateActive)?.id ?? tabs[0].id,
          nextId: Number.isFinite(nextCandidate) && nextCandidate > 0 ? nextCandidate : Math.max(...ids) + 1
        };
      }
    }

    const legacyTabs = storage.getItem('betternotepad-todos');
    if (legacyTabs) {
      const parsed = JSON.parse(legacyTabs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const tabs = sanitizeTabs(parsed);
        const ids = tabs.map(tab => Number(tab.id) || 0);
        const legacyActive = Number(storage.getItem('betternotepad-active-todo'));
        storage.removeItem('betternotepad-todos');
        storage.removeItem('betternotepad-active-todo');
        return {
          tabs,
          activeId: tabs.find(tab => tab.id === legacyActive)?.id ?? tabs[0].id,
          nextId: Math.max(...ids) + 1
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load saved todos, resetting storage.', error);
  }
  return fallback;
};

const loadThemePreference = () => {
  if (typeof window === 'undefined' || !window?.localStorage) return 'dark';
  try {
    return window.localStorage.getItem('betternotepad-theme') || 'dark';
  } catch {
    return 'dark';
  }
};

const RichTextEditor = ({ value, onChange }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;
    const normalized = linkifyHtml(stripAnchors(value || ''));
    if (editorRef.current.innerHTML !== normalized) {
      editorRef.current.innerHTML = normalized;
    }
    if ((value || '') !== normalized) {
      onChange(normalized);
    }
  }, [value, onChange]);

  const exec = (command) => {
    document.execCommand(command, false, null);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const stripped = stripAnchors(html);
    const linkified = linkifyHtml(stripped);
    if (linkified !== html) {
      editorRef.current.innerHTML = linkified;
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    onChange(linkified);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded">
      <div className="flex items-center gap-2 border-b border-gray-800 px-2 py-1 text-gray-400">
        <button type="button" onClick={() => exec('bold')} className="p-1 hover:text-white" title="Bold"><Bold className="w-4 h-4" /></button>
        <button type="button" onClick={() => exec('italic')} className="p-1 hover:text-white" title="Italic"><Italic className="w-4 h-4" /></button>
        <button type="button" onClick={() => exec('underline')} className="p-1 hover:text-white" title="Underline"><Underline className="w-4 h-4" /></button>
      </div>
      <div
        ref={editorRef}
        className="min-h-[160px] px-3 py-2 focus:outline-none"
        contentEditable
        onInput={handleInput}
      />
    </div>
  );
};

const BetterTextPad = () => {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [nextId, setNextId] = useState(1);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pendingAutoFormat, setPendingAutoFormat] = useState(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [tipsCollapsed, setTipsCollapsed] = useState(true);
  const [braceMatch, setBraceMatch] = useState(null);
  const [findValue, setFindValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [structureCollapsed, setStructureCollapsed] = useState({});
  const [structurePanelVisible, setStructurePanelVisible] = useState(true);
  const [currentPanel, setCurrentPanel] = useState('dev');
  const initialNotesStateRef = useRef(loadNotesState());
  const initialTodosStateRef = useRef(loadTodosState());
  const [notes, setNotes] = useState(initialNotesStateRef.current.notes);
  const [folders, setFolders] = useState(initialNotesStateRef.current.folders);
  const [activeFolderId, setActiveFolderId] = useState(initialNotesStateRef.current.activeFolderId);
  const [activeNoteId, setActiveNoteId] = useState(initialNotesStateRef.current.activeNoteId);
  const [nextNoteId, setNextNoteId] = useState(initialNotesStateRef.current.nextNoteId);
  const [nextFolderId, setNextFolderId] = useState(initialNotesStateRef.current.nextFolderId);
  const [notesViewMode, setNotesViewMode] = useState(initialNotesStateRef.current.viewMode || 'tiles');
  const [openNoteModalId, setOpenNoteModalId] = useState(null);
  const [isQuickNoteExpanded, setIsQuickNoteExpanded] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [quickNoteTitle, setQuickNoteTitle] = useState('');
  const [quickNoteImages, setQuickNoteImages] = useState([]);
  const [todoTabs, setTodoTabs] = useState(initialTodosStateRef.current.tabs);
  const [activeTodoTabId, setActiveTodoTabId] = useState(initialTodosStateRef.current.activeId);
  const [nextTodoId, setNextTodoId] = useState(initialTodosStateRef.current.nextId);
  const [notesSidebarWidth, setNotesSidebarWidth] = useState(288);
  const [todoSidebarWidth, setTodoSidebarWidth] = useState(256);
  const [csvPreviewHeight, setCsvPreviewHeight] = useState(DEFAULT_CSV_PREVIEW_HEIGHT);
  const [csvColumnWidths, setCsvColumnWidths] = useState({});
  const [isCsvEditorCollapsed, setIsCsvEditorCollapsed] = useState(false);
  const [csvEditMap, setCsvEditMap] = useState({});
  const [activeCsvRowIndex, setActiveCsvRowIndex] = useState(null);
  const [csvDetectionMessage, setCsvDetectionMessage] = useState(null);
  const [csvDetectionLocks, setCsvDetectionLocks] = useState({});
  const [markdownDetectionMessage, setMarkdownDetectionMessage] = useState(null);
  const [markdownPreviewHeight, setMarkdownPreviewHeight] = useState(DEFAULT_CSV_PREVIEW_HEIGHT);
  const [isMarkdownPreviewCollapsed, setIsMarkdownPreviewCollapsed] = useState(false);
  const [theme, setTheme] = useState(loadThemePreference);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoPairingEnabled, setAutoPairingEnabled] = useState(true);
  const [moveMenuFolderId, setMoveMenuFolderId] = useState(null);

  // AI Fix state
  const [aiFixState, setAIFixState] = useState({
    isLoading: false,
    fixedContent: null,
    originalContent: null,
    showDiff: false,
    error: null,
    progress: null
  });
  const [showAISettings, setShowAISettings] = useState(false);
  const [showOllamaSetup, setShowOllamaSetup] = useState(false);
  const [aiSettings, setAISettings] = useState(() => {
    // Default settings - use Groq for all platforms
    return {
      provider: AI_PROVIDERS.GROQ,
      groqApiKey: '',
      groqModel: GROQ_MODELS['llama-3.3-70b'].id,
      openaiApiKey: '',
      openaiModel: 'gpt-4o-mini',
      claudeApiKey: '',
      claudeModel: 'claude-3-5-haiku-20241022',
      ollamaModel: 'llama3.1:8b' // Desktop only - best for large files
    };
  });
  // AI Service instance (platform-aware)
  const [aiService, setAIService] = useState(null);
  const [dragFolderId, setDragFolderId] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [dragNoteId, setDragNoteId] = useState(null);
  const [dragOverNoteFolderId, setDragOverNoteFolderId] = useState(null);
  const noteDragPreviewRef = useRef(null);
  const isNoteDragging = dragNoteId !== null;
  const isFolderDragging = dragFolderId !== null;
  const [structureWidth, setStructureWidth] = useState(288);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const [draggedTabId, setDraggedTabId] = useState(null);
  const [dragOverTabId, setDragOverTabId] = useState(null);
  const [tabContextMenu, setTabContextMenu] = useState(null);
  const textareaRef = useRef(null);
  const autoFormatTimeoutRef = useRef(null);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const braceOverlayRef = useRef(null);
  const errorOverlayRef = useRef(null);
  const syntaxOverlayRef = useRef(null);
  const lineNumberRef = useRef(null);
  const pendingCursorRef = useRef(null);
  const lastCursorRef = useRef({ line: 1, column: 1 });
  const structureRef = useRef(null);
  const activeStructureNodeRef = useRef(null);
  const structureDragState = useRef({ active: false, startX: 0, startWidth: 288 });
  const notesSidebarDragState = useRef({ active: false, startX: 0, startWidth: 288 });
  const todoSidebarDragState = useRef({ active: false, startX: 0, startWidth: 256 });
  const csvPreviewDragState = useRef({ active: false, startY: 0, startHeight: DEFAULT_CSV_PREVIEW_HEIGHT });
  const csvColumnDragState = useRef({ active: false, startX: 0, startWidth: DEFAULT_CSV_COLUMN_WIDTH, columnIndex: null, tabId: null });
  const markdownPreviewDragState = useRef({ active: false, startY: 0, startHeight: DEFAULT_CSV_PREVIEW_HEIGHT });
  const csvPreviewRowRefs = useRef(new Map());
  const csvEditorRowRefs = useRef(new Map());
  const csvDetectionMessageTimeoutRef = useRef(null);
  const markdownDetectionMessageTimeoutRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const newTodoInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const markdownPreviewRef = useRef(null);
  const quickNoteInputRef = useRef(null);
  const quickNoteContainerRef = useRef(null);
  const noteModalRef = useRef(null);
  const syncScrollVisuals = useCallback(() => {
    if (!textareaRef.current) return;
    const scrollTop = textareaRef.current.scrollTop;
    const scrollLeft = textareaRef.current.scrollLeft;

    if (syntaxOverlayRef.current) {
      syntaxOverlayRef.current.style.transform = `translate(${-scrollLeft}px, -${scrollTop}px)`;
    }
    if (braceOverlayRef.current) {
      braceOverlayRef.current.style.transform = `translate(${-scrollLeft}px, -${scrollTop}px)`;
    }
    if (errorOverlayRef.current) {
      errorOverlayRef.current.style.transform = `translate(${-scrollLeft}px, -${scrollTop}px)`;
    }
    if (lineNumberRef.current) {
      lineNumberRef.current.style.transform = `translateY(-${scrollTop}px)`;
    }
  }, []);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    return () => {
      if (csvDetectionMessageTimeoutRef.current) {
        clearTimeout(csvDetectionMessageTimeoutRef.current);
      }
      if (markdownDetectionMessageTimeoutRef.current) {
        clearTimeout(markdownDetectionMessageTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    body.classList.remove('theme-dark', 'theme-light');
    const applied = theme === 'dark' ? 'theme-dark' : 'theme-light';
    body.classList.add(applied);
    if (typeof window !== 'undefined' && window?.localStorage) {
      try {
        window.localStorage.setItem('betternotepad-theme', theme);
      } catch {
        // ignore storage errors
      }
    }
  }, [theme]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleClick = (event) => {
      if (!settingsMenuRef.current) return;
      if (!settingsMenuRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isSettingsOpen]);

  // Auto-focus on todo input when panel is opened
  useEffect(() => {
    if (currentPanel === 'todo' && newTodoInputRef.current) {
      newTodoInputRef.current.focus();
    }
  }, [currentPanel]);

  useEffect(() => {
    if (isQuickNoteExpanded && quickNoteInputRef.current) {
      quickNoteInputRef.current.focus();
    }
  }, [isQuickNoteExpanded]);

  useEffect(() => {
    if (!openNoteModalId) return;
    const handleModalClickOutside = (event) => {
      if (noteModalRef.current && noteModalRef.current.contains(event.target)) return;
      setOpenNoteModalId(null);
    };
    document.addEventListener('mousedown', handleModalClickOutside);
    return () => document.removeEventListener('mousedown', handleModalClickOutside);
  }, [openNoteModalId]);

  useEffect(() => {
    const handleMoveMenuOutside = (event) => {
      const target = event.target;
      if (target?.closest?.('[data-move-menu="true"]')) return;
      if (target?.closest?.('[data-move-toggle="true"]')) return;
      if (moveMenuFolderId !== null) setMoveMenuFolderId(null);
    };
    document.addEventListener('mousedown', handleMoveMenuOutside);
    return () => document.removeEventListener('mousedown', handleMoveMenuOutside);
  }, [moveMenuFolderId]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => {
      if (tabContextMenu) {
        setTabContextMenu(null);
      }
    };

    if (tabContextMenu) {
      document.addEventListener('mousedown', handleClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [tabContextMenu]);

  // Keyboard shortcuts for Save and Save As
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + S for Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        saveFile();
      }
      // Ctrl/Cmd + Shift + S for Save As
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        saveFileAs();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs]); // Dependencies to ensure we have latest data

  // Load tabs from localStorage on mount
  useEffect(() => {
    const loadTabs = () => {
      const savedTabs = localStorage.getItem('notepad-tabs');
      const savedActiveId = localStorage.getItem('notepad-active-tab');

      if (savedTabs) {
        try {
          const parsed = JSON.parse(savedTabs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Ensure content is always a string
            const sanitizedTabs = parsed.map(tab => ({
              ...tab,
              content: String(tab.content || ''),
              title: String(tab.title || 'Untitled')
            }));
            setTabs(sanitizedTabs);
            setActiveTabId(savedActiveId ? parseInt(savedActiveId, 10) : sanitizedTabs[0]?.id);
            setNextId(Math.max(...sanitizedTabs.map(t => t.id), 0) + 1);
            return;
          }
        } catch (error) {
          console.warn('Failed to load saved tabs, resetting storage.', error);
          localStorage.removeItem('notepad-tabs');
          localStorage.removeItem('notepad-active-tab');
        }
      }
      // Create Welcome tab on first access
      const welcomeTab = {
        id: 1,
        title: 'Welcome',
        content: '',
        isModified: false,
        filePath: null
      };
      setTabs([welcomeTab]);
      setActiveTabId(welcomeTab.id);
      setNextId(2);
    };

    loadTabs();
  }, []);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    if (tabs.length > 0) {
      try {
        // Sanitize tabs to only include serializable properties
        const sanitizedTabs = tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          content: tab.content,
          isModified: tab.isModified,
          filePath: tab.filePath
        }));
        localStorage.setItem('notepad-tabs', JSON.stringify(sanitizedTabs));
        if (activeTabId !== null) {
          localStorage.setItem('notepad-active-tab', activeTabId.toString());
        }
      } catch (error) {
        console.warn('Failed to save tabs to localStorage:', error);
      }
    }
  }, [tabs, activeTabId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window?.localStorage) return;
    try {
      window.localStorage.setItem('betternotepad-notes-state-v2', JSON.stringify({
        notes,
        folders,
        nextNoteId,
        nextFolderId,
        activeFolderId,
        activeNoteId,
        viewMode: notesViewMode
      }));
    } catch (error) {
      console.warn('Failed to save notes', error);
    }
  }, [notes, folders, nextNoteId, nextFolderId, activeFolderId, activeNoteId, notesViewMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window?.localStorage) return;
    try {
      window.localStorage.setItem('betternotepad-todos-state', JSON.stringify({
        tabs: todoTabs,
        activeId: activeTodoTabId,
        nextId: nextTodoId
      }));
    } catch (error) {
      console.warn('Failed to save todos', error);
    }
  }, [todoTabs, activeTodoTabId, nextTodoId]);

  // Load AI settings on mount (async decryption)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await loadSecureSettings();
        if (settings) {
          setAISettings(prev => ({ ...prev, ...settings }));
        }
      } catch (error) {
        console.warn('Failed to load AI settings', error);
      }
    };
    loadSettings();
  }, []);

  // Save AI settings to localStorage (async encryption)
  useEffect(() => {
    if (typeof window === 'undefined' || !window?.localStorage) return;

    const saveSettings = async () => {
      try {
        await saveSecureSettings(aiSettings);
      } catch (error) {
        console.warn('Failed to save AI settings', error);
      }
    };

    // Only save if settings have values (not initial empty state)
    if (aiSettings.provider) {
      saveSettings();
    }
  }, [aiSettings]);

  // Initialize AI service based on platform
  useEffect(() => {
    const initAIService = async () => {
      try {
        const service = await getAIService();
        setAIService(service);

        // For desktop, check if Ollama setup is needed
        if (isDesktop()) {
          // Check if setup wizard has been completed before
          const setupCompleted = localStorage.getItem('betternotepad-ollama-setup-completed');

          if (!setupCompleted) {
            try {
              const status = await service.checkOllamaStatus();
              if (!status.available || !status.models || status.models.length === 0) {
                // Show setup wizard
                setShowOllamaSetup(true);
              } else {
                // Mark as completed if Ollama is already set up
                localStorage.setItem('betternotepad-ollama-setup-completed', 'true');
              }
            } catch (error) {
              console.error('Failed to check Ollama status:', error);
              // Show setup wizard on error
              setShowOllamaSetup(true);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize AI service:', error);
      }
    };
    initAIService();
  }, []); // Run once on mount

  // Update cursor position when tab changes
  useEffect(() => {
    if (textareaRef.current) {
      updateCursorPosition();
    }
  }, [activeTabId]);

  useEffect(() => {
    return () => {
      if (autoFormatTimeoutRef.current) {
        clearTimeout(autoFormatTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (errorMessage) {
      setTipsCollapsed(true);
    }
  }, [errorMessage?.message, errorMessage?.type]);

  useEffect(() => {
    if (!errorMessage) return;
    const priorityError = errorMessage.allErrors?.find(e => e.isPrimary && e.line) ||
      errorMessage.allErrors?.find(e => e.line) ||
      (errorMessage.line ? { line: errorMessage.line } : null);
    if (priorityError?.line) {
      scrollLineIntoView(priorityError.line);
    }
  }, [errorMessage]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const handleScroll = () => {
      requestAnimationFrame(syncScrollVisuals);
    };
    textarea.addEventListener('scroll', handleScroll);
    syncScrollVisuals();
    return () => {
      textarea.removeEventListener('scroll', handleScroll);
    };
  }, [activeTabId, syncScrollVisuals]);

  useEffect(() => {
    if (!pendingCursorRef.current) return;
    const cursor = pendingCursorRef.current;
    pendingCursorRef.current = null;
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      const text = textarea.value;
      const index = getIndexFromLineColumn(text, cursor.line, cursor.column);
      textarea.focus();
      textarea.setSelectionRange(index, index);
      updateCursorPosition(text);
      syncScrollVisuals();
    });
  }, [tabs, activeTabId]);

  // Auto-format JSON/XML when a file is opened
  useEffect(() => {
    if (!pendingAutoFormat) return;

    const { tabId, content, fileName } = pendingAutoFormat;
    setPendingAutoFormat(null);

    const trimmed = String(content).trim();
    const fileType = getFileType(fileName);

    // Only auto-format if file type allows it
    if (fileType.shouldAutoFormat) {
      if (fileType.type === 'json' || looksLikeJSON(trimmed) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
        formatJSON({ tabId, content, autoTriggered: false });
      } else if (fileType.type === 'markup' || looksLikeXML(trimmed) || trimmed.startsWith('<')) {
        formatXML({ tabId, content, autoTriggered: false });
      }
    }
  }, [pendingAutoFormat]);

  const createNewTab = () => {
    const newTab = {
      id: nextId,
      title: `Untitled-${nextId}`,
      content: '',
      isModified: false,
      filePath: null
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setNextId(nextId + 1);
  };

  const closeTab = (tabId) => {
    const newTabs = tabs.filter(t => t.id !== tabId);

    // If closing all tabs, create a Welcome tab
    if (newTabs.length === 0) {
      const welcomeTab = {
        id: nextId,
        title: 'Welcome',
        content: '',
        isModified: false,
        filePath: null
      };
      setTabs([welcomeTab]);
      setActiveTabId(welcomeTab.id);
      setNextId(nextId + 1);
      return;
    }

    setTabs(newTabs);

    if (activeTabId === tabId) {
      const index = tabs.findIndex(t => t.id === tabId);
      const newActiveTab = newTabs[Math.max(0, index - 1)];
      setActiveTabId(newActiveTab.id);
    }
  };

  const closeTabsToRight = (tabId) => {
    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const newTabs = tabs.slice(0, index + 1);
    setTabs(newTabs);

    // If active tab was closed, activate the clicked tab
    if (!newTabs.find(t => t.id === activeTabId)) {
      setActiveTabId(tabId);
    }
  };

  const closeAllTabs = () => {
    const welcomeTab = {
      id: nextId,
      title: 'Welcome',
      content: '',
      isModified: false,
      filePath: null
    };
    setTabs([welcomeTab]);
    setActiveTabId(welcomeTab.id);
    setNextId(nextId + 1);
  };

  const closeOtherTabs = (tabId) => {
    const tabToKeep = tabs.find(t => t.id === tabId);
    if (!tabToKeep) return;

    setTabs([tabToKeep]);
    setActiveTabId(tabId);
  };

  const handleTabDragStart = (e, tabId) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTabDragOver = (e, tabId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTabId(tabId);
  };

  const handleTabDragLeave = () => {
    setDragOverTabId(null);
  };

  const handleTabDrop = (e, targetTabId) => {
    e.preventDefault();

    if (!draggedTabId || draggedTabId === targetTabId) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }

    const draggedIndex = tabs.findIndex(t => t.id === draggedTabId);
    const targetIndex = tabs.findIndex(t => t.id === targetTabId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }

    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);

    setTabs(newTabs);
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleTabDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const updateCursorPosition = (textOverride = null) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const text = textOverride ?? textarea.value;
    const cursorPos = textarea.selectionStart;
    
    const { line, column } = getLineColumnFromIndex(text, cursorPos);
    const latest = { line, column };
    setCursorPosition(latest);
    lastCursorRef.current = latest;
    setBraceMatch(findMatchingBraces(text, cursorPos));
    if (isCSVTab && csvRowCount > 0 && csvEditorRowRefs.current.size > 0) {
      let matchedRow = null;
      for (const [rowIndex, meta] of csvEditorRowRefs.current.entries()) {
        if (cursorPos >= meta.start && cursorPos <= meta.end) {
          matchedRow = rowIndex;
          break;
        }
      }
      if (matchedRow === null && cursorPos > (csvEditorRowRefs.current.get(csvRowCount - 1)?.end ?? 0)) {
        matchedRow = csvRowCount - 1;
      }
      if (activeCsvRowIndex !== matchedRow) {
        setActiveCsvRowIndex(matchedRow);
      }
    } else if (isCSVTab && csvRowCount === 0 && activeCsvRowIndex !== null) {
      setActiveCsvRowIndex(null);
    } else if (activeCsvRowIndex !== null && !isCSVTab) {
      setActiveCsvRowIndex(null);
    }
  };

  const focusEditorRange = (start, end = start) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.focus();
    textarea.setSelectionRange(start, end);

    const { line } = getLineColumnFromIndex(textarea.value, start);
    const lineHeight = 24;
    const targetScroll = Math.max(0, (line - 1) * lineHeight - textarea.clientHeight / 2 + lineHeight);
    textarea.scrollTop = targetScroll;
    syncScrollVisuals();
    updateCursorPosition(textarea.value);
  };

  const focusCsvRow = (rowIndex) => {
    if (!isCSVTab || !textareaRef.current) return;
    const entry = csvEditorRowRefs.current.get(rowIndex);
    if (!entry) return;
    const textarea = textareaRef.current;
    const start = entry.start;
    const end = entry.end;
    textarea.focus();
    textarea.setSelectionRange(start, end);
    updateCursorPosition(textarea.value);
    syncScrollVisuals();
  };

  const handleCsvPreviewRowClick = (rowIndex) => {
    if (!isCSVTab || rowIndex == null) return;
    focusCsvRow(rowIndex);
  };

  const goToPosition = (line, column) => {
    if (!textareaRef.current || !line) return;
    const textarea = textareaRef.current;
    const index = getIndexFromLineColumn(textarea.value, line, column || 1);
    focusEditorRange(index, index + 1);
  };

  const setSelectionRange = (start, end, textOverride = null) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const sourceText = textOverride ?? textarea.value;
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const { line, column } = getLineColumnFromIndex(sourceText, start);
    setCursorPosition({ line, column });
    lastCursorRef.current = { line, column };
  };

  const restoreCursorPosition = (cursor, textOverride = null) => {
    if (!cursor) return;
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      const sourceText = textOverride ?? textarea.value;
      if (textOverride !== null) {
        textarea.value = textOverride;
      }
      const index = getIndexFromLineColumn(sourceText, cursor.line, cursor.column);
      textarea.focus();
      textarea.setSelectionRange(index, index);
      updateCursorPosition(sourceText);
      syncScrollVisuals();
    });
  };

  const scrollLineIntoView = (line) => {
    if (!textareaRef.current || !line) return;
    const textarea = textareaRef.current;
    const lineHeight = 24;
    const targetTop = Math.max(0, (line - 1) * lineHeight);
    const viewTop = textarea.scrollTop;
    const viewBottom = textarea.scrollTop + textarea.clientHeight - lineHeight;

    if (targetTop < viewTop) {
      textarea.scrollTop = Math.max(0, targetTop - lineHeight);
    } else if (targetTop > viewBottom) {
      textarea.scrollTop = Math.max(0, targetTop - textarea.clientHeight / 2);
    }
    syncScrollVisuals();
  };

  const applyTextEdit = (text, selectionStartOffset, selectionEndOffset = selectionStartOffset) => {
    if (!textareaRef.current || !activeTab) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    const newValue = before + text + after;
    const newStart = start + selectionStartOffset;
    const newEnd = start + selectionEndOffset;

    // Clear pending cursor restoration to prevent interference
    pendingCursorRef.current = null;

    textarea.value = newValue;
    setSelectionRange(newStart, newEnd, newValue);
    updateTabContent(activeTab.id, newValue);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(newStart, newEnd);
      updateCursorPosition(newValue);
      syncScrollVisuals();
    });
  };

  const updateTabTitle = (tabId, title) => {
    setTabs(tabs.map(tab => 
      tab.id === tabId 
        ? { ...tab, title }
        : tab
    ));
  };

  const findMultipleXMLErrors = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    // Check for unclosed tags
    const tagStack = [];
    lines.forEach((line, index) => {
      // Find opening tags
      const openTags = [...line.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g)];
      openTags.forEach(match => {
        if (!match[0].endsWith('/>')) {
          tagStack.push({
            tag: match[1],
            line: index + 1,
            column: match.index + 1
          });
        }
      });
      
      // Find closing tags
      const closeTags = [...line.matchAll(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g)];
      closeTags.forEach(match => {
        const lastOpen = tagStack.pop();
        if (!lastOpen) {
          errors.push({
            line: index + 1,
            column: match.index + 1,
            message: `Closing tag </${match[1]}> without matching opening tag`,
            severity: 'error'
          });
        } else if (lastOpen.tag !== match[1]) {
          errors.push({
            line: index + 1,
            column: match.index + 1,
            message: `Mismatched closing tag: expected </${lastOpen.tag}> but found </${match[1]}>`,
            severity: 'error'
          });
        }
      });
    });
    
    // Check for tags left unclosed
    tagStack.forEach(unclosed => {
      errors.push({
        line: unclosed.line,
        column: unclosed.column,
        message: `Unclosed tag: <${unclosed.tag}>`,
        severity: 'warning'
      });
    });
    
    // Check for missing closing angle brackets
    lines.forEach((line, index) => {
      const openBrackets = (line.match(/</g) || []).length;
      const closeBrackets = (line.match(/>/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push({
          line: index + 1,
          column: line.length,
          message: 'Mismatched angle brackets on this line',
          severity: 'warning'
        });
      }
    });
    
    return errors;
  };

  const buildXMLErrorDetails = (content, errorText) => {
    const multipleErrors = findMultipleXMLErrors(content);
    const lineMatch = errorText.match(/line (\d+)/i);
    const columnMatch = errorText.match(/column (\d+)/i);
    const errorLine = lineMatch ? parseInt(lineMatch[1], 10) : null;
    const errorColumn = columnMatch ? parseInt(columnMatch[1], 10) : null;

    const errorDetails = {
      type: 'XML',
      message: errorText,
      line: errorLine,
      column: errorColumn || 1,
      allErrors: [],
      context: [],
      tips: [
        'Unclosed tags (every <tag> needs </tag>)',
        'Missing closing angle bracket >',
        'Special characters not escaped (&, <, >, ", \')',
        'Attribute values not in quotes',
        'Invalid characters in tag names',
        'Mismatched opening and closing tags'
      ]
    };

    if (errorLine) {
      errorDetails.allErrors.push({
        line: errorLine,
        column: errorColumn || 1,
        message: errorText,
        isPrimary: true
      });

      const allLines = content.split('\n');
      const contextStart = Math.max(0, errorLine - 2);
      const contextEnd = Math.min(allLines.length, errorLine + 1);

      for (let i = contextStart; i < contextEnd; i++) {
        const lineNum = i + 1;
        const isErrorLine = lineNum === errorLine;
        errorDetails.context.push({
          lineNum,
          text: allLines[i],
          isError: isErrorLine,
          column: isErrorLine ? (errorColumn || 1) : null
        });
      }
    }

    multipleErrors.forEach(err => {
      if (!errorLine || err.line !== errorLine || err.column !== (errorColumn || 1)) {
        errorDetails.allErrors.push({
          line: err.line,
          column: err.column,
          message: err.message,
          isPrimary: false,
          severity: err.severity
        });
      }
    });

    // Sort errors: secondary errors (warnings) first, then primary error
    errorDetails.allErrors.sort((a, b) => {
      if (a.isPrimary === b.isPrimary) return 0;
      return a.isPrimary ? 1 : -1; // non-primary (warnings) first
    });

    return errorDetails;
  };

  const findMultipleJSONErrors = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    // Check for trailing commas
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      // Look for ,} or ,]
      if (/,\s*[}\]]/.test(trimmed)) {
        const match = line.match(/,\s*[}\]]/);
        if (match) {
          errors.push({
            line: index + 1,
            column: line.indexOf(match[0]) + 1,
            message: 'Trailing comma before closing bracket',
            severity: 'error'
          });
        }
      }
    });
    
    // Check for single quotes instead of double quotes (basic check)
    lines.forEach((line, index) => {
      if (/'[^']*'\s*:/.test(line) || /:\s*'[^']*'/.test(line)) {
        const match = line.match(/'[^']*'/);
        if (match) {
          errors.push({
            line: index + 1,
            column: line.indexOf(match[0]) + 1,
            message: "Single quotes detected - JSON requires double quotes",
            severity: 'error'
          });
        }
      }
    });
    
    // Check for unescaped quotes
    lines.forEach((line, index) => {
      const matches = [...line.matchAll(/"[^"\\]*(?:\\.[^"\\]*)*"/g)];
      const afterMatches = line.split(/"[^"\\]*(?:\\.[^"\\]*)*"/);
      afterMatches.forEach((segment, i) => {
        if (i > 0 && i < afterMatches.length) {
          const quoteIndex = segment.indexOf('"');
          if (quoteIndex !== -1 && segment[quoteIndex - 1] !== '\\') {
            // Potential unescaped quote
          }
        }
      });
    });
    
    // Check for missing commas between properties
    lines.forEach((line, index) => {
      if (index < lines.length - 1) {
        const currentTrimmed = line.trim();
        const nextTrimmed = lines[index + 1].trim();
        
        // If current line ends with " or number and next starts with "
        if ((/["}\]]$/.test(currentTrimmed) || /\d$/.test(currentTrimmed)) && 
            /^"/.test(nextTrimmed) && 
            !/,$/.test(currentTrimmed.replace(/\s+/g, ''))) {
          errors.push({
            line: index + 1,
            column: line.length,
            message: 'Possible missing comma between properties',
            severity: 'warning'
          });
        }
      }
    });
    
    return errors;
  };

  const buildJSONErrorDetails = (content, error) => {
    const multipleErrors = findMultipleJSONErrors(content);
    const positionMatch = error.message.match(/position (\d+)/);
    const position = positionMatch ? parseInt(positionMatch[1], 10) : null;

    let primaryError = {
      message: error.message,
      line: null,
      column: null,
    };

    if (position !== null) {
      const lines = content.substring(0, position).split('\n');
      primaryError.line = lines.length;
      primaryError.column = lines[lines.length - 1].length + 1;
    }

    const errorDetails = {
      type: 'JSON',
      message: error.message,
      line: primaryError.line,
      column: primaryError.column,
      allErrors: [],
      context: [],
      tips: [
        'Trailing commas (remove comma after last item)',
        'Missing quotes around property names',
        'Single quotes instead of double quotes',
        'Missing commas between properties',
        'Unclosed braces { } or brackets [ ]'
      ]
    };

    if (primaryError.line) {
      errorDetails.allErrors.push({
        line: primaryError.line,
        column: primaryError.column,
        message: error.message,
        isPrimary: true
      });
    }

    multipleErrors.forEach(err => {
      if (!primaryError.line || err.line !== primaryError.line || err.column !== primaryError.column) {
        errorDetails.allErrors.push({
          line: err.line,
          column: err.column,
          message: err.message,
          isPrimary: false,
          severity: err.severity
        });
      }
    });

    // Sort errors: secondary errors (warnings) first, then primary error
    errorDetails.allErrors.sort((a, b) => {
      if (a.isPrimary === b.isPrimary) return 0;
      return a.isPrimary ? 1 : -1; // non-primary (warnings) first
    });

    if (position !== null) {
      const lines = content.substring(0, position).split('\n');
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;
      const allLines = content.split('\n');
      const contextStart = Math.max(0, line - 2);
      const contextEnd = Math.min(allLines.length, line + 1);

      for (let i = contextStart; i < contextEnd; i++) {
        const lineNum = i + 1;
        const isErrorLine = lineNum === line;
        errorDetails.context.push({
          lineNum,
          text: allLines[i],
          isError: isErrorLine,
          column: isErrorLine ? column : null
        });
      }
    }

    return errorDetails;
  };

  const formatJSON = ({ tabId = activeTabId, content, autoTriggered = false, cursor, allowRedirect = true } = {}) => {
    if (!tabId) return false;

    const targetTab = tabsRef.current.find(t => t.id === tabId);
    const workingContent = content ?? targetTab?.content ?? '';
    if (!String(workingContent).trim()) {
      if (!autoTriggered) {
        setErrorMessage(null);
      }
      return false;
    }

    const trimmed = String(workingContent).trim();
    if (allowRedirect && trimmed.startsWith('<')) {
      return formatXML({ tabId, content: workingContent, autoTriggered, cursor, allowRedirect: false });
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (autoTriggered) {
        const isEmptyObject = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0;
        const isEmptyArray = Array.isArray(parsed) && parsed.length === 0;
        if ((isEmptyObject || isEmptyArray) && /\n/.test(workingContent)) {
          setErrorMessage(null);
          // Don't set pendingCursorRef for auto-formatting
          return true;
        }
      }

      const formatted = JSON.stringify(parsed, null, 2);
      // Only restore cursor for manual formatting, not auto-formatting
      if (!autoTriggered) {
        const cursorToStore = cursor || lastCursorRef.current;
        if (cursorToStore) {
          pendingCursorRef.current = { ...cursorToStore };
        }
      }
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === tabId 
          ? { ...tab, content: formatted, isModified: true }
          : tab
      ));
      setErrorMessage(null);
      return true;
    } catch (e) {
      if (!autoTriggered) {
        const errorDetails = buildJSONErrorDetails(workingContent, e);
        setErrorMessage(errorDetails);
      }
      return false;
    }
  };

  const formatXML = ({ tabId = activeTabId, content, autoTriggered = false, cursor, allowRedirect = true } = {}) => {
    if (!tabId) return false;

    const targetTab = tabsRef.current.find(t => t.id === tabId);
    const workingContent = content ?? targetTab?.content ?? '';
    if (!String(workingContent).trim()) {
      if (!autoTriggered) {
        setErrorMessage(null);
      }
      return false;
    }

    const trimmed = String(workingContent).trim();
    if (allowRedirect && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      return formatJSON({ tabId, content: workingContent, autoTriggered, cursor, allowRedirect: false });
    }

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(trimmed, 'text/xml');
      const parserError = xmlDoc.getElementsByTagName('parsererror');

      if (parserError.length > 0) {
        const errorText = parserError[0].textContent;
        if (!autoTriggered) {
          const errorDetails = buildXMLErrorDetails(workingContent, errorText);
          setErrorMessage(errorDetails);
        }
        return false;
      }

      const formatted = formatXMLString(trimmed);
      // Only restore cursor for manual formatting, not auto-formatting
      if (!autoTriggered) {
        const cursorToStore = cursor || lastCursorRef.current;
        if (cursorToStore) {
          pendingCursorRef.current = { ...cursorToStore };
        }
      }
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === tabId 
          ? { ...tab, content: formatted, isModified: true }
          : tab
      ));
      setErrorMessage(null);
      return true;
    } catch (e) {
      if (!autoTriggered) {
        setErrorMessage({
          type: 'XML',
          message: e.message,
          line: null,
          column: null,
          allErrors: [],
          context: [],
          tips: [
            'Unclosed tags (every <tag> needs </tag>)',
            'Missing closing angle bracket >',
            'Special characters not escaped (&, <, >, ", \')',
            'Attribute values not in quotes',
            'Invalid characters in tag names',
            'Mismatched opening and closing tags'
          ]
        });
      }
      return false;
    }
  };

  const queueAutoFormat = (tabId, content) => {
    if (autoFormatTimeoutRef.current) {
      clearTimeout(autoFormatTimeoutRef.current);
    }

    autoFormatTimeoutRef.current = setTimeout(() => {
      const trimmed = String(content).trim();
      if (!trimmed || trimmed.length < 2) return;
      if (activeTabIdRef.current !== tabId) return;

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        formatJSON({ tabId, content, autoTriggered: true });
      } else if (trimmed.startsWith('<')) {
        formatXML({ tabId, content, autoTriggered: true });
      }
    }, 700);
  };

  const updateTabContent = (tabId, content) => {
    setTabs(prevTabs => prevTabs.map(tab =>
      tab.id === tabId
        ? { ...tab, content, isModified: true }
        : tab
    ));

    // Update error message with current errors
    if (errorMessage && errorMessage.type === 'JSON') {
      try {
        const trimmed = String(content).trim();
        if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
          JSON.parse(content);
          // Content is valid JSON, clear the error
          setErrorMessage(null);
        }
      } catch (e) {
        // Re-validate and update error list
        const updatedErrorDetails = buildJSONErrorDetails(content, e);
        setErrorMessage(updatedErrorDetails);
      }
    } else if (errorMessage && errorMessage.type === 'XML') {
      try {
        const trimmed = String(content).trim();
        if (trimmed && trimmed.startsWith('<')) {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content, 'text/xml');
          const parserError = xmlDoc.getElementsByTagName('parsererror');
          if (parserError.length === 0) {
            // Content is valid XML, clear the error
            setErrorMessage(null);
          } else {
            // Re-validate and update error message
            const errorText = parserError[0].textContent;
            const updatedErrorDetails = buildXMLErrorDetails(content, errorText);
            setErrorMessage(updatedErrorDetails);
          }
        }
      } catch (e) {
        // Keep existing error
      }
    }

    // Disable auto-formatting - it interferes with editing by reformatting while typing
    // Users can still manually format using the Format JSON/XML buttons
    // queueAutoFormat(tabId, content);
  };

  const formatXMLString = (xml) => {
    const PADDING = '  ';
    const reg = /(>)(<)(\/*)/g;
    let pad = 0;

    xml = xml.replace(reg, '$1\n$2$3');

    return xml.split('\n').map((node) => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/) && pad > 0) {
        pad -= 1;
      } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }

      const padding = PADDING.repeat(pad);
      pad += indent;

      return padding + node;
    }).join('\n');
  };

  // AI Fix handlers
  const handleAIFix = async () => {
    if (!errorMessage || !activeTab) return;

    if (!aiService) {
      setAIFixState({
        isLoading: false,
        fixedContent: null,
        originalContent: null,
        showDiff: false,
        error: 'AI service is still initializing. Please try again.',
        progress: null
      });
      return;
    }

    setAIFixState({
      isLoading: true,
      fixedContent: null,
      originalContent: activeTab.content,
      showDiff: false,
      error: null,
      progress: null
    });

    try {
      const fixedContent = await aiService.fix(
        activeTab.content,
        errorMessage,
        aiSettings,
        (progress) => {
          setAIFixState(prev => ({
            ...prev,
            progress: progress
          }));
        }
      );

      setAIFixState({
        isLoading: false,
        fixedContent,
        originalContent: activeTab.content,
        showDiff: true,
        error: null,
        progress: null
      });
    } catch (error) {
      setAIFixState({
        isLoading: false,
        fixedContent: null,
        originalContent: null,
        showDiff: false,
        error: error.message || 'Failed to fix content',
        progress: null
      });
    }
  };

  const handleAcceptFix = (customContent = null) => {
    const contentToUse = customContent || aiFixState.fixedContent;
    if (!contentToUse || !activeTab) return;

    // Create a new tab with the AI-fixed content
    const aiFixedTab = {
      id: nextId,
      title: `${activeTab.title} (AI Fixed)`,
      content: String(contentToUse),
      isModified: true,
      filePath: null
    };

    // Update current tab with original content (rename to show it's the original with errors)
    setTabs(prevTabs => [
      ...prevTabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, title: `${tab.title} (Original)`, isModified: false }
          : tab
      ),
      aiFixedTab
    ]);

    // Switch to the new AI-fixed tab
    setActiveTabId(nextId);
    setNextId(nextId + 1);

    // Clear error and close diff
    setErrorMessage(null);
    setAIFixState({
      isLoading: false,
      fixedContent: null,
      originalContent: null,
      showDiff: false,
      error: null,
      progress: null
    });

    // Revalidate the fixed content in the new tab
    setTimeout(() => {
      if (errorMessage?.type === 'JSON') {
        formatJSON({ autoTriggered: true });
      } else if (errorMessage?.type === 'XML') {
        formatXML({ autoTriggered: true });
      }
    }, 100);
  };

  const handleRejectFix = () => {
    setAIFixState({
      isLoading: false,
      fixedContent: null,
      originalContent: null,
      showDiff: false,
      error: null,
      progress: null
    });
  };

  const handleSaveAISettings = async (newSettings) => {
    setAISettings(newSettings);
  };

  // Handler for triggering setup wizard when unavailable model is selected
  const handleTriggerSetupWizard = (modelId) => {
    console.log('[BetterTextPad] Setup wizard triggered for model:', modelId);
    // Update the selected model in settings
    setAISettings(prev => ({ ...prev, ollamaModel: modelId }));
    // Open the setup wizard
    setShowOllamaSetup(true);
    console.log('[BetterTextPad] showOllamaSetup set to true');
  };

  const saveFileAs = async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    // Check if running in Tauri desktop mode
    const isTauri = window.__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { save } = await import('@tauri-apps/plugin-dialog');

        // Always show save dialog for Save As
        const filePath = await save({
          defaultPath: activeTab.title || 'untitled.txt'
        });

        if (filePath) {
          await invoke('save_file_to_path', {
            filePath: filePath,
            content: String(activeTab.content || '')
          });

          // Update tab with the new absolute path and mark as saved
          setTabs(tabs.map(tab =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  absolutePath: filePath,
                  title: filePath.split(/[/\\]/).pop() || activeTab.title,
                  isModified: false
                }
              : tab
          ));

          console.log('File saved as:', filePath);
        }
      } catch (error) {
        console.error('Failed to save file as:', error);
        alert('Failed to save file: ' + error);
      }
    } else {
      // Browser mode - use File System Access API if available
      try {
        if ('showSaveFilePicker' in window) {
          // Always show save picker for Save As
          const handle = await window.showSaveFilePicker({
            suggestedName: activeTab.title || 'untitled.txt'
            // Don't specify types to allow all file extensions
          });

          const writable = await handle.createWritable();
          await writable.write(String(activeTab.content || ''));
          await writable.close();

          // Update tab with new file handle and mark as saved
          setTabs(tabs.map(tab =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  fileHandle: handle,
                  title: handle.name,
                  isModified: false
                }
              : tab
          ));
          console.log('File saved as using File System Access API:', handle.name);
          return;
        }
      } catch (err) {
        // User cancelled or API not supported, fall through to download
        if (err.name !== 'AbortError') {
          console.log('File System Access API error:', err);
        }
      }

      // Fallback to browser download with original extension
      const blob = new Blob([String(activeTab.content || '')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = String(activeTab.title || 'untitled');
      // Preserve original extension instead of forcing .txt
      a.download = title;
      a.click();
      URL.revokeObjectURL(url);

      // Mark as saved
      setTabs(tabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, isModified: false }
          : tab
      ));
    }
  };

  const saveFile = async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    // Check if running in Tauri desktop mode
    const isTauri = window.__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { save } = await import('@tauri-apps/plugin-dialog');

        // If the tab has an existing absolute file path, save directly to it
        if (activeTab.absolutePath) {
          await invoke('save_file_to_path', {
            filePath: activeTab.absolutePath,
            content: String(activeTab.content || '')
          });

          // Mark as saved
          setTabs(tabs.map(tab =>
            tab.id === activeTabId
              ? { ...tab, isModified: false }
              : tab
          ));

          console.log('File saved successfully to:', activeTab.absolutePath);
        } else {
          // No existing path, use Save As behavior
          await saveFileAs();
        }
      } catch (error) {
        console.error('Failed to save file:', error);
        alert('Failed to save file: ' + error);
      }
    } else {
      // Browser mode - use File System Access API if available
      try {
        // Check if browser supports File System Access API
        if ('showSaveFilePicker' in window) {
          // If we have a file handle from previous save/open, try to use it
          if (activeTab.fileHandle) {
            try {
              const writable = await activeTab.fileHandle.createWritable();
              await writable.write(String(activeTab.content || ''));
              await writable.close();

              // Mark as saved
              setTabs(tabs.map(tab =>
                tab.id === activeTabId
                  ? { ...tab, isModified: false }
                  : tab
              ));
              console.log('File saved using existing handle');
              return;
            } catch (err) {
              // If we can't write (permissions denied), fall through to show save picker
              console.log('Cannot write to existing handle, showing save picker');
            }
          }

          // Show save picker
          const handle = await window.showSaveFilePicker({
            suggestedName: activeTab.title || 'untitled.txt'
            // Don't specify types to allow all file extensions
          });

          const writable = await handle.createWritable();
          await writable.write(String(activeTab.content || ''));
          await writable.close();

          // Update tab with file handle and mark as saved
          setTabs(tabs.map(tab =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  fileHandle: handle,
                  title: handle.name,
                  isModified: false
                }
              : tab
          ));
          console.log('File saved using File System Access API');
          return;
        }
      } catch (err) {
        // User cancelled or API not supported, fall through to download
        if (err.name !== 'AbortError') {
          console.log('File System Access API error:', err);
        }
      }

      // Fallback to browser download with original extension
      const blob = new Blob([String(activeTab.content || '')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = String(activeTab.title || 'untitled');
      // Preserve original extension instead of forcing .txt
      a.download = title;
      a.click();
      URL.revokeObjectURL(url);

      // Mark as saved
      setTabs(tabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, isModified: false }
          : tab
      ));
    }
  };

  const openFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target.result || '');
      const newTabId = nextId;
      const newTab = {
        id: newTabId,
        title: file.name,
        content: content,
        isModified: false,
        filePath: file.name
        // Note: Browser file input doesn't provide absolute path for security reasons
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTabId);
      setNextId(nextId + 1);

      // Trigger auto-format via useEffect
      setPendingAutoFormat({ tabId: newTabId, content, fileName: file.name });
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const openFileWithDialog = async () => {
    // Check if running in Tauri desktop mode
    const isTauri = window.__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { open } = await import('@tauri-apps/plugin-dialog');

        // Show open dialog - no filters to allow all file types
        const filePath = await open({
          multiple: false
        });

        if (filePath) {
          // Read file content using Tauri
          const content = await invoke('read_file_from_path', {
            filePath: filePath
          });

          const fileName = filePath.split(/[/\\]/).pop() || 'untitled';
          const newTabId = nextId;
          const newTab = {
            id: newTabId,
            title: fileName,
            content: String(content),
            isModified: false,
            filePath: fileName,
            absolutePath: filePath
          };

          setTabs([...tabs, newTab]);
          setActiveTabId(newTabId);
          setNextId(nextId + 1);

          // Trigger auto-format via useEffect
          setPendingAutoFormat({ tabId: newTabId, content: String(content), fileName });

          console.log('File opened successfully:', filePath);
        }
      } catch (error) {
        console.error('Failed to open file:', error);
        alert('Failed to open file: ' + error);
      }
    } else {
      // Browser mode - use File System Access API if available
      try {
        if ('showOpenFilePicker' in window) {
          const [fileHandle] = await window.showOpenFilePicker({
            multiple: false
          });

          const file = await fileHandle.getFile();
          const content = await file.text();

          const newTabId = nextId;
          const newTab = {
            id: newTabId,
            title: file.name,
            content: content,
            isModified: false,
            filePath: file.name,
            fileHandle: fileHandle // Store handle for later saving
          };

          setTabs([...tabs, newTab]);
          setActiveTabId(newTabId);
          setNextId(nextId + 1);

          // Trigger auto-format via useEffect
          setPendingAutoFormat({ tabId: newTabId, content, fileName: file.name });

          console.log('File opened using File System Access API:', file.name);
          return;
        }
      } catch (err) {
        // User cancelled or API not supported
        if (err.name !== 'AbortError') {
          console.log('File System Access API error:', err);
        }
        // Fall through to trigger the hidden input
      }

      // Fallback to browser file input - trigger the hidden input
      document.getElementById('file-input')?.click();
    }
  };

  const handleFindNext = () => {
    if (!textareaRef.current || !findValue) return;
    const textarea = textareaRef.current;
    const text = textarea.value;
    const startPos = textarea.selectionEnd || 0;
    let matchIndex = text.indexOf(findValue, startPos);

    if (matchIndex === -1 && startPos !== 0) {
      matchIndex = text.indexOf(findValue, 0);
    }

    if (matchIndex !== -1) {
      focusEditorRange(matchIndex, matchIndex + findValue.length);
    }
  };

  const handleReplace = () => {
    if (!textareaRef.current || !findValue || !activeTab) return;
    const textarea = textareaRef.current;
    const text = textarea.value;
    const { selectionStart, selectionEnd } = textarea;
    const selected = text.substring(selectionStart, selectionEnd);

    if (selected === findValue) {
      const replaceLength = replaceValue.length;
      // Use execCommand to preserve undo stack
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
      document.execCommand('insertText', false, replaceValue);

      // Update React state to match
      const newContent = text.substring(0, selectionStart) + replaceValue + text.substring(selectionEnd);
      updateTabContent(activeTab.id, newContent);

      setTimeout(() => {
        focusEditorRange(selectionStart, selectionStart + replaceLength);
      }, 0);
    } else {
      handleFindNext();
    }
  };

  const handleReplaceAll = () => {
    if (!textareaRef.current || !findValue || !activeTab) return;
    const textarea = textareaRef.current;
    const text = textarea.value;
    if (!text.includes(findValue)) return;

    // Use execCommand to preserve undo stack - select all and replace
    textarea.focus();
    const newContent = text.split(findValue).join(replaceValue);
    textarea.setSelectionRange(0, text.length);
    document.execCommand('insertText', false, newContent);

    // Update React state to match
    updateTabContent(activeTab.id, newContent);
  };

  const toggleStructureNode = (id) => {
    setStructureCollapsed(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const renderStructureNodes = (nodes, depth = 0) => {
    return nodes.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const collapsed = structureCollapsed[node.id];
      const isActive = node.id === activeStructureId;
      const nodeTextClass = isActive
        ? 'text-white'
        : theme === 'dark'
          ? 'text-gray-300 hover:text-white'
          : 'text-gray-600 hover:text-gray-900';
      const buttonHoverClass = theme === 'dark'
        ? 'text-gray-400 hover:text-white'
        : 'text-gray-500 hover:text-gray-900';
      const bulletClass = theme === 'dark' ? 'text-gray-700' : 'text-gray-400';
      return (
        <div
          key={node.id}
          data-node-id={node.id}
          className={`text-xs mb-1 ${nodeTextClass} transition-colors duration-150`}
          style={{ marginLeft: depth * 12 }}
          ref={isActive ? activeStructureNodeRef : null}
        >
          <div className={`flex items-center gap-1 ${isActive ? 'bg-indigo-600 bg-opacity-40 rounded px-1 py-0.5 border border-indigo-400/70 shadow-sm' : ''}`}>
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStructureNode(node.id);
                }}
                className={`w-4 h-4 ${buttonHoverClass} flex items-center justify-center`}
              >
                {collapsed ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              </button>
            ) : (
              <span className={`w-4 h-4 ${bulletClass} flex items-center justify-center`}>•</span>
            )}
            <button
              onClick={() => goToPosition(node.line, 1)}
              className={`flex-1 text-left truncate ${isActive ? 'font-semibold' : ''}`}
              title={`Line ${node.line}`}
            >
              {node.label}
            </button>
          </div>
          {!collapsed && hasChildren && (
            <div>
              {renderStructureNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const handleEditorKeyDown = (event) => {
    if (!textareaRef.current || !activeTab) return;
    const textarea = textareaRef.current;
    const { selectionStart, selectionEnd, value } = textarea;
    const selectedText = value.substring(selectionStart, selectionEnd);


    // For CSV files, only handle Tab and Enter - let everything else behave normally
    if (isCSVTab && event.key !== 'Tab' && event.key !== 'Enter') {
      return; // Skip all custom key handling for CSV files except Tab and Enter
    }

    // Auto-pairing is disabled by default for more predictable editing
    // Users can enable it in settings if they want
    const autoPairs = (autoPairingEnabled && !isCSVTab) ? {
      '{': '}',
      '[': ']',
      '(': ')',
      '"': '"',
      "'": "'",
      '`': '`'
      // Note: '<' is not auto-paired here - XML auto-closing tags are handled separately
    } : {};

    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        const before = value.substring(0, selectionStart);
        const lineStart = before.lastIndexOf('\n') + 1;
        const currentIndent = value.substring(lineStart, Math.min(lineStart + INDENT_UNIT.length, value.length));
        if (currentIndent === INDENT_UNIT) {
          const newBefore = value.substring(0, lineStart);
          const newValue = newBefore + value.substring(lineStart + INDENT_UNIT.length);
          textarea.value = newValue;
          updateTabContent(activeTab.id, newValue);
          requestAnimationFrame(() => {
            if (!textareaRef.current) return;
            const newPos = Math.max(lineStart, selectionStart - INDENT_UNIT.length);
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
            updateCursorPosition(newValue);
            syncScrollVisuals();
          });
        }
      } else {
        applyTextEdit(INDENT_UNIT, INDENT_UNIT.length);
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);
      const prevLineStart = before.lastIndexOf('\n') + 1;
      const currentLine = before.substring(prevLineStart);
      const baseIndent = currentLine.match(/^\s*/)?.[0] ?? '';
      const trimmedLine = currentLine.trimRight();
      const lastChar = trimmedLine.slice(-1);
      const nextChar = after[0];
      let extraIndent = '';
      let closingLine = '';
      let handledStructure = false;

      const xmlMatch = (!trimmedLine.startsWith('</') && !trimmedLine.startsWith('<?') && !trimmedLine.startsWith('<!--'))
        ? trimmedLine.match(/^<([\w:\-\.]+)([^>]*)>/)
        : null;
      if (xmlMatch && !/\/>\s*$/.test(trimmedLine)) {
        extraIndent = INDENT_UNIT;
        handledStructure = true;
        const tagName = xmlMatch[1];
        const closingTag = `</${tagName}>`;
        if (after.trimStart().startsWith(closingTag)) {
          closingLine = `\n${baseIndent}`;
        }
      }

      if (!handledStructure && /[{\[\(]$/.test(trimmedLine)) {
        extraIndent = INDENT_UNIT;
        const expectedClose = BRACE_PAIRS[lastChar];
        if (expectedClose && nextChar === expectedClose) {
          closingLine = '\n' + baseIndent;
        }
      }

      const insertText = '\n' + baseIndent + extraIndent + closingLine;
      const cursorOffset = ('\n' + baseIndent + extraIndent).length;
      const cursorEndOffset = closingLine ? insertText.length - closingLine.length : insertText.length;
      applyTextEdit(insertText, cursorOffset, cursorEndOffset);
      return;
    }

    // XML auto-closing tags - only for XML/HTML files
    if (event.key === '>') {
      if (!autoPairingEnabled) {
        return;
      }

      const nextChar = value[selectionStart];

      // Skip over existing >
      if (nextChar === '>') {
        event.preventDefault();
        pendingCursorRef.current = null;
        setSelectionRange(selectionStart + 1, selectionStart + 1, value);
        return;
      }

      // Only auto-close tags for XML/HTML files
      const fileName = activeTab?.filePath || activeTab?.title || '';
      const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
      const isXMLOrHTML = ['xml', 'html', 'htm', 'svg', 'xhtml', 'jsp', 'jspx'].includes(fileExt) ||
                          (syntaxLanguage === 'markup');

      if (isXMLOrHTML) {
        // Auto-close XML tags
        const before = value.substring(0, selectionStart);
        // Match opening tag pattern: <tagname or <tagname attr="value"
        const tagMatch = before.match(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*$/);

        if (tagMatch) {
          const tagName = tagMatch[1];
          // Don't auto-close self-closing tags or if already has a closing tag nearby
          const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];

          if (!selfClosingTags.includes(tagName.toLowerCase())) {
            // Check if we're not in a self-closing tag (ending with /)
            if (!before.endsWith('/')) {
              event.preventDefault();
              const closingTag = `</${tagName}>`;
              applyTextEdit('>' + closingTag, 1);
              return;
            }
          }
        }
      }
    }

    if (autoPairs[event.key]) {
      event.preventDefault();
      const closeChar = autoPairs[event.key];
      if (selectedText) {
        applyTextEdit(event.key + selectedText + closeChar, 1, 1 + selectedText.length);
      } else {
        const nextChar = value[selectionStart];

        // Skip over closing character if it matches what we're typing
        if (nextChar === closeChar) {
          // Clear pending cursor to prevent interference
          pendingCursorRef.current = null;
          setSelectionRange(selectionStart + 1, selectionStart + 1, value);
          return;
        }

        // Otherwise, insert the auto-pair
        applyTextEdit(event.key + closeChar, 1);
      }
      return;
    }

    const closeChars = Object.values(BRACE_PAIRS);
    if (closeChars.includes(event.key)) {
      const nextChar = value[selectionStart];

      // Skip over matching closing character
      if (nextChar === event.key) {
        event.preventDefault();
        pendingCursorRef.current = null;
        setSelectionRange(selectionStart + 1, selectionStart + 1, value);
        return;
      }

      // Auto-dedent when typing closing brace
      const before = value.substring(0, selectionStart);
      const lineStart = before.lastIndexOf('\n') + 1;
      const leadingWhitespace = before.substring(lineStart, selectionStart);
      if (/^\s+$/.test(leadingWhitespace) && leadingWhitespace.length >= INDENT_UNIT.length) {
        event.preventDefault();
        const removeLength = INDENT_UNIT.length;
        const newBefore = before.substring(0, selectionStart - removeLength);
        const newValue = newBefore + event.key + value.substring(selectionEnd);
        textarea.value = newValue;
        updateTabContent(activeTab.id, newValue);
        requestAnimationFrame(() => {
          if (!textareaRef.current) return;
          const newPos = selectionStart - removeLength + 1;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
          updateCursorPosition(newValue);
          syncScrollVisuals();
        });
        return;
      }
    }
  };

  const goToPreviousTab = () => {
    if (tabs.length === 0 || activeTabId === null) return;
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    setActiveTabId(tabs[prevIndex].id);
  };

  const goToNextTab = () => {
    if (tabs.length === 0 || activeTabId === null) return;
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActiveTabId(tabs[nextIndex].id);
  };

  const handleTabBarDoubleClick = (event) => {
    if (typeof event.target.closest !== 'function') {
      createNewTab();
      return;
    }
    const tabElement = event.target.closest('[data-tab-item="true"]');
    if (!tabElement) {
      createNewTab();
    }
  };

  const activeTodoTab = todoTabs.find(tab => tab.id === activeTodoTabId) || todoTabs[0];

  const folderTree = useMemo(() => {
    const map = new Map();
    folders.forEach(folder => {
      map.set(folder.id, { ...folder, children: [] });
    });
    const roots = [];
    map.forEach(folder => {
      if (folder.parentId != null && map.has(folder.parentId)) {
        map.get(folder.parentId).children.push(folder);
      } else {
        roots.push(folder);
      }
    });
    const sortTree = (nodes) => nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(node => ({ ...node, children: sortTree(node.children) }));
    return sortTree(roots);
  }, [folders]);

  const getDescendantFolderIds = useCallback((folderId) => {
    const results = [];
    const stack = [folderId];
    while (stack.length) {
      const current = stack.pop();
      results.push(current);
      folders.forEach(folder => {
        if (folder.parentId === current) {
          stack.push(folder.id);
        }
      });
    }
    return results;
  }, [folders]);

  const isFolderTargetAllowed = useCallback((targetId) => {
    if (!isFolderDragging) return true;
    if (dragFolderId === targetId) return false;
    const blocked = getDescendantFolderIds(dragFolderId);
    return !blocked.includes(targetId);
  }, [isFolderDragging, dragFolderId, getDescendantFolderIds]);

  const visibleNotes = useMemo(() => {
    const filtered = notes.filter(note => !note.archived);
    if (activeFolderId === null) return filtered;
    return filtered.filter(note => note.folderId === activeFolderId);
  }, [notes, activeFolderId]);

  const createFolder = (parentId = null) => {
    const name = typeof window !== 'undefined' ? window.prompt('Folder name', 'New Folder') : 'New Folder';
    const safeName = (name || 'New Folder').trim() || 'New Folder';
    setNextFolderId(prevId => {
      const newFolder = { id: prevId, parentId: parentId ?? null, name: safeName, expanded: true };
      setFolders(prev => [...prev, newFolder]);
      setActiveFolderId(newFolder.id);
      return prevId + 1;
    });
  };

  const toggleFolderExpanded = (id) => {
    setFolders(prev => prev.map(folder => folder.id === id ? { ...folder, expanded: !folder.expanded } : folder));
  };

  const renameFolder = (id, name) => {
    const safeName = (name || '').trim();
    if (!safeName) return;
    setFolders(prev => prev.map(folder => folder.id === id ? { ...folder, name: safeName } : folder));
  };

  const createNote = (folderId = activeFolderId ?? null, overrides = {}) => {
    let createdId = null;
    setNextNoteId(prevId => {
      const now = Date.now();
      const newNote = {
        id: prevId,
        folderId: folderId ?? null,
        title: overrides.title ?? '',
        content: overrides.content ?? '',
        images: overrides.images ?? [],
        archived: overrides.archived ?? false,
        createdAt: now,
        updatedAt: now
      };
      createdId = newNote.id;
      setNotes(prev => [...prev, newNote]);
      setActiveNoteId(newNote.id);
      setActiveFolderId(folderId ?? null);
      return prevId + 1;
    });
    return createdId;
  };

  const updateNote = (id, updates) => {
    setNotes(prev => prev.map(note => note.id === id ? { ...note, ...updates, updatedAt: Date.now() } : note));
  };

  const removeNote = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id));
    setActiveNoteId(current => current === id ? null : current);
  };

  const archiveNote = (id) => {
    setNotes(prev => prev.map(note => note.id === id ? { ...note, archived: true, updatedAt: Date.now() } : note));
    if (activeNoteId === id) {
      setActiveNoteId(null);
    }
  };

  const deleteFolder = (id) => {
    const targets = getDescendantFolderIds(id);
    const notesInFolder = notes.filter(note => targets.includes(note.folderId));
    if (notesInFolder.length > 0) {
      const ok = typeof window === 'undefined' ? true : window.confirm('This folder contains notes. Delete it and move notes to root?');
      if (!ok) return;
    }
    setFolders(prev => prev.filter(folder => !targets.includes(folder.id)));
    setNotes(prev => prev.map(note => targets.includes(note.folderId) ? { ...note, folderId: null } : note));
    if (targets.includes(activeFolderId)) {
      setActiveFolderId(null);
    }
  };

  const moveFolderToTarget = (id, targetId) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    if (targetId === id) return;
    if (targetId !== null && !folders.find(f => f.id === targetId)) return;
    const blocked = getDescendantFolderIds(id);
    if (targetId !== null && blocked.includes(targetId)) return;
    setFolders(prev => prev.map(f => f.id === id ? { ...f, parentId: targetId } : f));
    setMoveMenuFolderId(null);
  };

  const moveNoteToFolder = (noteId, targetId) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    updateNote(noteId, { folderId: targetId ?? null });
    setDragNoteId(null);
    setDragOverNoteFolderId(null);
  };

  const handleFolderDragStart = (id) => {
    setDragFolderId(id);
  };

  const handleFolderDragEnd = () => {
    setDragFolderId(null);
    setDragOverFolderId(null);
  };

  const handleFolderDragOver = (event, targetId) => {
    // Note dragging
    if (dragNoteId !== null) {
      event.preventDefault();
      setDragOverNoteFolderId(targetId);
      return;
    }
    // Folder dragging
    if (dragFolderId === null) return;
    if (!isFolderTargetAllowed(targetId)) return;
    event.preventDefault();
    setDragOverFolderId(targetId);
  };

  const handleFolderDrop = (targetId) => {
    if (dragNoteId !== null) {
      moveNoteToFolder(dragNoteId, targetId);
      return;
    }
    if (dragFolderId === null) return;
    if (!isFolderTargetAllowed(targetId)) return;
    moveFolderToTarget(dragFolderId, targetId);
    handleFolderDragEnd();
  };

  const handleNoteDragStart = (noteId, event) => {
    setDragNoteId(noteId);
    if (noteDragPreviewRef.current) {
      noteDragPreviewRef.current.remove();
      noteDragPreviewRef.current = null;
    }
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      const preview = document.createElement('div');
      preview.textContent = '≡';
      preview.style.position = 'absolute';
      preview.style.top = '-1000px';
      preview.style.left = '-1000px';
      preview.style.fontSize = '18px';
      preview.style.padding = '4px 6px';
      preview.style.background = '#111827';
      preview.style.color = '#86efac';
      preview.style.border = '1px solid #22c55e';
      preview.style.borderRadius = '6px';
      preview.style.boxShadow = '0 8px 18px rgba(0,0,0,0.4)';
      document.body.appendChild(preview);
      noteDragPreviewRef.current = preview;
      event.dataTransfer.setDragImage(preview, 8, 8);
    }
  };

  const handleNoteDragEnd = () => {
    setDragNoteId(null);
    setDragOverNoteFolderId(null);
    if (noteDragPreviewRef.current) {
      noteDragPreviewRef.current.remove();
      noteDragPreviewRef.current = null;
    }
  };

  useEffect(() => {
    // Only set a default active note when no folder is selected
    if (activeFolderId !== null) return;
    if (!activeNoteId && notes.length > 0) {
      setActiveNoteId(notes[0].id);
    }
  }, [activeNoteId, notes, activeFolderId]);

  useEffect(() => {
    if (activeFolderId === null) return;
    const inFolder = notes.filter(note => note.folderId === activeFolderId);
    if (inFolder.length === 0) {
      return;
    }
    if (!inFolder.find(note => note.id === activeNoteId)) {
      setActiveNoteId(inFolder[0].id);
    }
  }, [activeFolderId, notes, activeNoteId]);

  const createTodoTab = () => {
    const newTab = { id: nextTodoId, title: `List ${nextTodoId}`, items: [] };
    setTodoTabs([...todoTabs, newTab]);
    setActiveTodoTabId(newTab.id);
    setNextTodoId(nextTodoId + 1);
  };

  const closeTodoTab = (id) => {
    if (todoTabs.length === 1) return;
    const filtered = todoTabs.filter(tab => tab.id !== id);
    setTodoTabs(filtered);
    if (activeTodoTabId === id) {
      setActiveTodoTabId(filtered[0].id);
    }
  };

  const updateTodoTab = (id, updater) => {
    setTodoTabs(tabs => tabs.map(tab => tab.id === id ? updater(tab) : tab));
  };

  const finishQuickNote = useCallback((event = null) => {
    if (event) event.preventDefault();
    const title = quickNoteTitle.trim();
    const body = quickNoteText.trim();
    const hasImages = quickNoteImages.length > 0;
    if (!title && !body && !hasImages) {
      setQuickNoteTitle('');
      setQuickNoteText('');
      setQuickNoteImages([]);
      setIsQuickNoteExpanded(false);
      return;
    }
    const derivedTitle = title || body.split(/\s+/).slice(0, 8).join(' ').trim() || 'Untitled note';
    const escapedBody = escapeHtml(body).replace(/\n/g, '<br/>');
    const htmlBody = linkifyHtml(escapedBody);
    createNote(activeFolderId ?? null, {
      title: derivedTitle,
      content: htmlBody,
      images: quickNoteImages
    });
    setQuickNoteTitle('');
    setQuickNoteText('');
    setQuickNoteImages([]);
    setIsQuickNoteExpanded(false);
  }, [quickNoteTitle, quickNoteText, quickNoteImages, activeFolderId, createNote]);

  const handleQuickNotePaste = (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    let handledImage = false;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (e) => {
          setQuickNoteImages(prev => [...prev, { id: Date.now() + Math.random(), url: e.target?.result }]);
        };
        reader.readAsDataURL(file);
        handledImage = true;
      }
    }
    if (handledImage) {
      event.preventDefault();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isQuickNoteExpanded) return;
      if (quickNoteContainerRef.current && quickNoteContainerRef.current.contains(event.target)) return;
      finishQuickNote();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isQuickNoteExpanded, finishQuickNote]);

  const addTodoItem = () => {
    if (!activeTodoTab) return;
    const text = newTodoText.trim();
    if (!text) return;
    const item = {
      id: Date.now(),
      text,
      dueDate: newTodoDueDate || null,
      completedDate: null,
      done: false
    };
    updateTodoTab(activeTodoTab.id, tab => ({ ...tab, items: [...tab.items, item] }));
    setNewTodoText('');
    setNewTodoDueDate('');
  };

  const toggleTodoItem = (id) => {
    updateTodoTab(activeTodoTabId, tab => ({
      ...tab,
      items: tab.items.map(item => item.id === id ? { ...item, done: !item.done, completedDate: !item.done ? new Date().toISOString().slice(0, 10) : null } : item)
    }));
  };

  const removeTodoItem = (id) => {
    updateTodoTab(activeTodoTabId, tab => ({ ...tab, items: tab.items.filter(item => item.id !== id) }));
  };

  const moveTodoItem = (draggedIdRaw, direction = 0, targetIdRaw = null) => {
    const draggedId = Number(draggedIdRaw);
    const targetId = targetIdRaw !== null ? Number(targetIdRaw) : null;
    updateTodoTab(activeTodoTabId, tab => {
      const idx = tab.items.findIndex(item => item.id === draggedId);
      if (idx === -1) return tab;
      const newItems = [...tab.items];
      const [moved] = newItems.splice(idx, 1);
      if (direction !== 0) {
        const newIdx = Math.min(Math.max(idx + direction, 0), newItems.length);
        newItems.splice(newIdx, 0, moved);
      } else if (targetId !== null) {
        let targetIdx = newItems.findIndex(item => item.id === targetId);
        if (targetIdx === -1) {
          newItems.push(moved);
        } else {
          newItems.splice(targetIdx, 0, moved);
        }
      } else {
        newItems.push(moved);
      }
      return { ...tab, items: newItems };
    });
  };

  const activeTab = tabs.find(t => t.id === activeTabId);
  const editorLines = activeTab && activeTab.content ? String(activeTab.content).split('\n') : [];

  // Detect if current file should have syntax highlighting - needs to be before CSV/Markdown detection
  const syntaxLanguage = useMemo(() => {
    const fileName = activeTab?.filePath || activeTab?.title || '';
    const content = activeTab?.content || '';

    // First try filename-based detection
    const filenameLang = getPrismLanguage(fileName);
    if (filenameLang) return filenameLang;

    // If no filename match, try content-based detection
    const contentLang = detectLanguageFromContent(content);
    return contentLang;
  }, [activeTab?.filePath, activeTab?.title, activeTab?.content]);

  const isCsvFileName = useMemo(() => {
    const name = (activeTab?.filePath || activeTab?.title || '').toLowerCase();
    return name.endsWith('.csv');
  }, [activeTab?.filePath, activeTab?.title]);
  const isCsvByContent = useMemo(() => {
    if (isCsvFileName) return false;
    if (!activeTab?.content) return false;
    // Don't detect CSV if we already have a recognized programming language from filename or content
    if (syntaxLanguage && syntaxLanguage !== 'markdown') return false;
    return detectCSVContent(activeTab.content);
  }, [activeTab?.content, isCsvFileName, syntaxLanguage]);
  const shouldAutoCsv = useMemo(() => {
    if (isCsvFileName) return true;
    const tabId = activeTab?.id;
    if (tabId && csvDetectionLocks[tabId]) return true;
    return isCsvByContent;
  }, [isCsvFileName, isCsvByContent, csvDetectionLocks, activeTab?.id]);
  const isCSVTab = shouldAutoCsv;

  // Markdown detection
  const isMarkdownFileName = useMemo(() => {
    const name = (activeTab?.filePath || activeTab?.title || '').toLowerCase();
    return name.endsWith('.md') || name.endsWith('.markdown');
  }, [activeTab?.filePath, activeTab?.title]);
  const isMarkdownByContent = useMemo(() => {
    if (isMarkdownFileName) return false;
    if (!activeTab?.content) return false;
    // Don't detect Markdown if we already have a recognized programming language from filename or content
    if (syntaxLanguage && syntaxLanguage !== 'markdown') return false;
    return detectMarkdownContent(activeTab.content, activeTab?.title || '');
  }, [activeTab?.content, activeTab?.title, isMarkdownFileName, syntaxLanguage]);
  const shouldAutoMarkdown = useMemo(() => {
    if (isMarkdownFileName) return true;
    return isMarkdownByContent;
  }, [isMarkdownFileName, isMarkdownByContent]);
  const isMarkdownTab = shouldAutoMarkdown && !isCSVTab; // CSV takes precedence
  const getMarkdownLineCount = useCallback(() => {
    const text = activeTab?.content || '';
    if (!text) return 1;
    const lines = text.split('\n');
    return Math.max(1, lines.length);
  }, [activeTab?.content]);
  const markdownSyncScroll = useCallback((targetLine) => {
    if (!isMarkdownTab || !markdownPreviewRef.current) return;
    const preview = markdownPreviewRef.current;
    const totalLines = getMarkdownLineCount();
    const safeLine = Math.max(1, Math.min(targetLine || 1, totalLines));
    const ratio = (safeLine - 1) / Math.max(1, totalLines - 1);
    const target = ratio * Math.max(0, preview.scrollHeight - preview.clientHeight);
    preview.scrollTo({ top: target, behavior: 'smooth' });
  }, [isMarkdownTab, getMarkdownLineCount]);

  const markdownSyncEditor = useCallback((targetLine) => {
    if (!isMarkdownTab || !textareaRef.current) return;
    const line = Math.max(1, targetLine || 1);
    const index = getIndexFromLineColumn(textareaRef.current.value, line, 1);
    setSelectionRange(index, index);
    scrollLineIntoView(line);
  }, [isMarkdownTab, setSelectionRange]);

  const handleMarkdownEditorClick = useCallback(() => {
    if (!isMarkdownTab || !textareaRef.current) return;
    const { line } = getLineColumnFromIndex(textareaRef.current.value, textareaRef.current.selectionStart);
    markdownSyncScroll(line);
  }, [isMarkdownTab, markdownSyncScroll]);

  const handleMarkdownPreviewClick = useCallback((event) => {
    if (!isMarkdownTab || !markdownPreviewRef.current || !textareaRef.current) return;
    const preview = markdownPreviewRef.current;
    const rect = preview.getBoundingClientRect();
    const offsetY = event.clientY - rect.top + preview.scrollTop;
    const ratio = preview.scrollHeight > 0 ? offsetY / preview.scrollHeight : 0;
    const totalLines = getMarkdownLineCount();
    const targetLine = Math.min(totalLines, Math.max(1, Math.round(ratio * Math.max(totalLines - 1, 0)) + 1));
    markdownSyncEditor(targetLine);
  }, [isMarkdownTab, markdownPreviewRef, getMarkdownLineCount, markdownSyncEditor]);

  const shouldShowSyntaxHighlighting = useMemo(() => {
    return syntaxLanguage !== null;
  }, [syntaxLanguage]);

  const editorTopPaddingPx = '16px';
  const parsedCsvContent = useMemo(() => {
    if (!isCSVTab || !activeTab?.content) return [];
    return parseCSV(activeTab.content);
  }, [isCSVTab, activeTab?.content]);
  const csvData = useMemo(() => {
    if (!isCSVTab || !activeTab) return null;
    const existing = csvEditMap[activeTab.id];
    const source = existing && existing.length ? existing : parsedCsvContent;
    return source.length ? source : [['']];
  }, [isCSVTab, activeTab?.id, csvEditMap, parsedCsvContent]);
  const csvPreviewStats = useMemo(() => {
    if (!csvData) return null;
    const columnCount = csvData.reduce((max, row) => Math.max(max, row.length), 0);
    const header = columnCount > 0 ? (csvData[0] || Array.from({ length: columnCount }).map(() => '')) : [];
    const rows = csvData.slice(1);
    return { header, rows, columnCount, rowCount: csvData.length };
  }, [csvData]);

  // Markdown preview HTML
  const markdownHtml = useMemo(() => {
    if (!isMarkdownTab || !activeTab?.content) return '';
    try {
      return marked.parse(activeTab.content);
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return '<p style="color: red;">Error parsing markdown</p>';
    }
  }, [isMarkdownTab, activeTab?.content]);
  const csvRowCount = useMemo(() => {
    if (!csvData || csvData.length <= 1) return 0;
    return csvData.length - 1;
  }, [csvData]);
  const csvColumnWidthsForTab = useMemo(() => {
    if (!csvPreviewStats || !activeTab) return [];
    const stored = csvColumnWidths[activeTab.id] || [];
    return Array.from({ length: csvPreviewStats.columnCount }, (_, idx) => stored[idx] ?? DEFAULT_CSV_COLUMN_WIDTH);
  }, [csvPreviewStats?.columnCount, csvColumnWidths, activeTab?.id]);
  const csvTotalWidth = useMemo(() => {
    if (!csvPreviewStats) return 0;
    return csvColumnWidthsForTab.reduce((sum, width) => sum + (width || DEFAULT_CSV_COLUMN_WIDTH), 0);
  }, [csvPreviewStats, csvColumnWidthsForTab]);
  const csvRowRanges = useMemo(() => {
    if (!isCSVTab || !activeTab?.content) return [];
    return computeCsvRowRanges(activeTab.content);
  }, [isCSVTab, activeTab?.content]);
  const csvEditorRowEntries = useMemo(() => {
    if (!isCSVTab || !csvRowRanges.length || csvRowCount === 0) return [];
    const usableRows = Math.min(csvRowCount, Math.max(0, csvRowRanges.length - 1));
    const entries = [];
    for (let i = 0; i < usableRows; i++) {
      const target = csvRowRanges[i + 1];
      if (!target) break;
      entries.push({ rowIndex: i, ...target });
    }
    return entries;
  }, [isCSVTab, csvRowRanges, csvRowCount]);
  const csvPreviewRows = useMemo(() => {
    if (!csvPreviewStats) return [];
    if (csvPreviewStats.rows.length > 0) return csvPreviewStats.rows;
    return csvData || [];
  }, [csvPreviewStats, csvData]);
  const csvPreviewHasDataRows = !!(csvPreviewStats?.rows?.length);
  const csvRowHighlightBg = theme === 'dark' ? '#854d0e' : '#fef3c7';
  const csvRowHighlightLineBg = theme === 'dark' ? '#854d0e' : '#fef3c7';
  const csvRowHighlightTextClass = theme === 'dark' ? 'text-yellow-100' : 'text-yellow-900';

  useEffect(() => {
    if (!isCSVTab) {
      setIsCsvEditorCollapsed(false);
      return;
    }
    setCsvPreviewHeight(prev => Math.min(MAX_CSV_PREVIEW_HEIGHT, Math.max(MIN_CSV_PREVIEW_HEIGHT, prev)));
  }, [isCSVTab]);

  useEffect(() => {
    if (!activeTab || !isCSVTab || !csvPreviewStats?.columnCount) return;
    setCsvColumnWidths(prev => {
      const existing = prev[activeTab.id];
      const nextColumns = csvPreviewStats.columnCount;
      if (existing && existing.length >= nextColumns) return prev;
      const newWidths = Array.from({ length: nextColumns }, (_, idx) => existing?.[idx] ?? DEFAULT_CSV_COLUMN_WIDTH);
      return { ...prev, [activeTab.id]: newWidths };
    });
  }, [activeTab?.id, isCSVTab, csvPreviewStats?.columnCount]);

  useEffect(() => {
    if (!activeTab || isCsvFileName) return;
    if (!isCsvByContent) return;
    const tabId = activeTab.id;
    if (csvDetectionLocks[tabId]) return;
    setCsvDetectionLocks(prev => ({ ...prev, [tabId]: true }));
    setCsvDetectionMessage('Detected CSV text, switching to CSV editor…');
    if (csvDetectionMessageTimeoutRef.current) {
      clearTimeout(csvDetectionMessageTimeoutRef.current);
    }
    csvDetectionMessageTimeoutRef.current = setTimeout(() => {
      setCsvDetectionMessage(null);
    }, 5000);
  }, [activeTab?.id, isCsvFileName, isCsvByContent, csvDetectionLocks]);

  // Markdown detection message
  useEffect(() => {
    if (!activeTab || isMarkdownFileName || isCSVTab) return;
    if (!isMarkdownByContent) return;
    setMarkdownDetectionMessage('Detected markdown file, switching to Markdown editor…');
    if (markdownDetectionMessageTimeoutRef.current) {
      clearTimeout(markdownDetectionMessageTimeoutRef.current);
    }
    markdownDetectionMessageTimeoutRef.current = setTimeout(() => {
      setMarkdownDetectionMessage(null);
    }, 5000);
  }, [activeTab?.id, isMarkdownFileName, isMarkdownByContent, isCSVTab]);

  const structureTree = useMemo(() => {
    if (!activeTab?.content) return { type: null, nodes: [] };
    const trimmed = String(activeTab.content).trim();
    if (!trimmed) return { type: null, nodes: [] };

    // Check file type - only show structure for JSON, XML, and YAML files
    const fileName = activeTab?.filePath || activeTab?.title || '';
    const fileType = getFileType(fileName);

    // Only show structure tree for JSON, XML, and YAML files
    if (fileType.type === 'json' && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      // Use looksLikeJSON to validate it's actually parseable JSON
      if (looksLikeJSON(trimmed)) {
        return { type: 'JSON', nodes: buildJSONStructure(activeTab.content) };
      }
    }

    if (fileType.type === 'markup' && trimmed.startsWith('<')) {
      return { type: 'XML', nodes: buildXMLStructure(activeTab.content) };
    }

    // Add YAML support (basic structure detection)
    if (fileType.type === 'config' && (fileName.endsWith('.yaml') || fileName.endsWith('.yml'))) {
      // For now, return a simple YAML indicator - can be expanded later
      return { type: 'YAML', nodes: [] };
    }

    return { type: null, nodes: [] };
  }, [activeTab?.content, activeTab?.filePath, activeTab?.title]);

  const structureNodeList = useMemo(() => {
    const list = [];
    const walk = (nodes) => {
      nodes.forEach(node => {
        list.push(node);
        if (node.children?.length) {
          walk(node.children);
        }
      });
    };
    walk(structureTree.nodes || []);
    return list;
  }, [structureTree]);

  const activeStructureId = useMemo(() => {
    if (!cursorPosition || structureNodeList.length === 0) return null;
    let candidate = null;
    let bestDiff = Infinity;
    structureNodeList.forEach(node => {
      const diff = cursorPosition.line - node.line;
      if (diff >= 0 && diff < bestDiff) {
        candidate = node;
        bestDiff = diff;
      }
    });
    return candidate?.id ?? structureNodeList[0]?.id ?? null;
  }, [cursorPosition, structureNodeList]);

  useEffect(() => {
    setStructureCollapsed({});
  }, [structureTree.type, activeTabId]);

  useEffect(() => {
    if (!isCSVTab || !activeTab) return;
    setCsvEditMap(prev => {
      const parsed = parsedCsvContent.length ? parsedCsvContent : [['']];
      const existing = prev[activeTab.id];
      if (!existing) {
        return { ...prev, [activeTab.id]: parsed };
      }
      const serializedExisting = serializeCSV(existing);
      if (String(serializedExisting).trim() === String(activeTab.content || '').trim()) {
        return prev;
      }
      return { ...prev, [activeTab.id]: parsed };
    });
  }, [isCSVTab, activeTab?.id, activeTab?.content, parsedCsvContent]);

  useEffect(() => {
    if (activeCsvRowIndex != null && activeCsvRowIndex >= csvRowCount) {
      setActiveCsvRowIndex(csvRowCount > 0 ? Math.min(activeCsvRowIndex, csvRowCount - 1) : null);
    }
  }, [csvRowCount, activeCsvRowIndex]);

  useEffect(() => {
    if (!isCSVTab && activeCsvRowIndex !== null) {
      setActiveCsvRowIndex(null);
    }
  }, [isCSVTab, activeCsvRowIndex]);

  useEffect(() => {
    csvPreviewRowRefs.current = new Map();
  }, [csvData, activeTab?.id]);

  useEffect(() => {
    const map = new Map();
    csvEditorRowEntries.forEach(entry => {
      map.set(entry.rowIndex, entry);
    });
    csvEditorRowRefs.current = map;
  }, [csvEditorRowEntries]);

  useEffect(() => {
    if (!isCSVTab || activeCsvRowIndex == null) return;
    requestAnimationFrame(() => {
      const previewRow = csvPreviewRowRefs.current.get(activeCsvRowIndex);
      if (previewRow) {
        previewRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const editorEntry = csvEditorRowRefs.current.get(activeCsvRowIndex);
      if (editorEntry && textareaRef.current) {
        const textarea = textareaRef.current;
        const lineHeight = 24;
        const targetLineIndex = Math.max(0, (editorEntry.lineNumber || 1) - 1);
        const targetTop = Math.max(0, targetLineIndex * lineHeight - textarea.clientHeight / 2 + lineHeight);
        if (typeof textarea.scrollTo === 'function') {
          textarea.scrollTo({ top: targetTop, behavior: 'smooth' });
        } else {
          textarea.scrollTop = targetTop;
        }
        syncScrollVisuals();
      }
    });
  }, [isCSVTab, activeCsvRowIndex, activeTab?.id, syncScrollVisuals]);

  useEffect(() => {
    if (!structureRef.current || !activeStructureNodeRef.current) return;
    const container = structureRef.current;
    const target = activeStructureNodeRef.current;
    const getOffset = (el, parent) => {
      let offset = 0;
      let node = el;
      while (node && node !== parent) {
        offset += node.offsetTop;
        node = node.offsetParent;
      }
      return offset;
    };
    const offsetTop = getOffset(target, container);
    const desiredTop = Math.max(0, offsetTop - container.clientHeight / 2 + target.offsetHeight / 2);
    container.scrollTo({ top: desiredTop, behavior: 'auto' });
  }, [activeStructureId, structureTree, editorLines.length]);

  const errorsByLine = useMemo(() => {
    const map = new Map();
    if (errorMessage?.allErrors) {
      errorMessage.allErrors.forEach(error => {
        if (!error.line) return;
        const column = error.column || 1;
        if (!map.has(error.line)) {
          map.set(error.line, []);
        }
        map.get(error.line).push({ ...error, column });
      });
      map.forEach(list => list.sort((a, b) => (a.column || 1) - (b.column || 1)));
    }
    return map;
  }, [errorMessage]);

  const braceMarkersByLine = useMemo(() => {
    const map = new Map();
    if (braceMatch) {
      [braceMatch.open, braceMatch.close].forEach(marker => {
        if (!marker || !marker.line) return;
        if (!map.has(marker.line)) {
          map.set(marker.line, []);
        }
        map.get(marker.line).push(marker);
      });
      map.forEach(list => list.sort((a, b) => (a.column || 1) - (b.column || 1)));
    }
    return map;
  }, [braceMatch]);

  const renderNotesPanel = () => {
    const sidebarStyle = { width: `${Math.round(notesSidebarWidth)}px` };
    const modalNote = openNoteModalId ? notes.find(note => note.id === openNoteModalId) : null;

    const renderFolderNode = (folder, depth = 0) => {
      const isExpanded = folder.expanded !== false;
      const hasChildren = Array.isArray(folder.children) && folder.children.length > 0;
      const isInvalidTarget = isFolderDragging && !isFolderTargetAllowed(folder.id);
      return (
        <div key={folder.id} className="space-y-1">
          <div
            className={`relative flex items-center justify-between gap-2 px-3 py-2 rounded cursor-pointer ${folder.id === activeFolderId ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-900/60'} ${dragOverFolderId === folder.id || dragOverNoteFolderId === folder.id ? 'border border-indigo-500' : 'border border-transparent'} ${isInvalidTarget ? 'cursor-not-allowed opacity-50' : ''}`}
            onClick={() => setActiveFolderId(folder.id)}
            onDragOver={(event) => handleFolderDragOver(event, folder.id)}
            onDrop={() => handleFolderDrop(folder.id)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0" style={{ paddingLeft: depth * 12 }}>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-800"
                onClick={(event) => { event.stopPropagation(); toggleFolderExpanded(folder.id); }}
                aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {isExpanded ? <FolderOpen className="w-4 h-4 text-indigo-400" /> : <Folder className="w-4 h-4 text-indigo-400" />}
              <span className="text-sm font-medium truncate">{folder.name}</span>
            </div>
            <div className="flex items-center gap-1 opacity-80">
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-800"
                title="New subfolder"
                onClick={(event) => { event.stopPropagation(); createFolder(folder.id); }}
              >
                <FolderPlus className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-800"
                title="Rename folder"
                onClick={(event) => {
                  event.stopPropagation();
                  const name = typeof window !== 'undefined' ? window.prompt('Rename folder', folder.name) : folder.name;
                  renameFolder(folder.id, name);
                }}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-800"
                title="Move folder"
                data-move-toggle="true"
                draggable
                onDragStart={() => handleFolderDragStart(folder.id)}
                onDragEnd={handleFolderDragEnd}
                onClick={(event) => { event.stopPropagation(); setMoveMenuFolderId(prev => prev === folder.id ? null : folder.id); }}
              >
                <GripVertical className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-800 text-red-400"
                title="Delete folder"
                onClick={(event) => { event.stopPropagation(); deleteFolder(folder.id); }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {isNoteDragging && dragOverNoteFolderId === folder.id && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-green-600/80 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg">
                <Plus className="w-3 h-3" />
                <span>Move here</span>
              </div>
            )}
          </div>
          {moveMenuFolderId === folder.id && (
            <div className="pl-8 pr-3 pb-2" data-move-menu="true">
              <div className="text-[11px] text-gray-500 mb-1">Move “{folder.name}” to:</div>
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
                value={folder.parentId ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const targetId = value === '' ? null : Number(value);
                  moveFolderToTarget(folder.id, targetId);
                }}
              >
                <option value="">Root</option>
                {folders
                  .filter(f => f.id !== folder.id && !getDescendantFolderIds(folder.id).includes(f.id))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
              </select>
            </div>
          )}
          {isExpanded && hasChildren && (
            <div className="space-y-1">
              {folder.children.map(child => renderFolderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    const activeFolderName = activeFolderId === null
      ? 'All Notes'
      : (folders.find(folder => folder.id === activeFolderId)?.name || 'Notes');

    return (
      <>
      <div className="flex h-full group/notes">
        <div className="border-r border-gray-800 flex flex-col" style={sidebarStyle}>
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-400">BETTER TEXT PAD</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">BETA</span>
                </div>
                <div className="text-sm font-medium text-gray-300">Notes</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => createFolder(activeFolderId ?? null)}
                  className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-200"
                  title="Create Folder"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => createNote(activeFolderId ?? null)}
                  className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-200"
                  title="Create Note"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
          <div
            className={`relative px-3 py-2 rounded cursor-pointer ${activeFolderId === null ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-900/60'} ${dragOverNoteFolderId === null && dragNoteId !== null ? 'border border-indigo-500' : 'border border-transparent'} ${isFolderDragging && !isFolderTargetAllowed(null) ? 'cursor-not-allowed opacity-50' : ''}`}
            onClick={() => setActiveFolderId(null)}
            onDragOver={(event) => handleFolderDragOver(event, null)}
            onDrop={() => handleFolderDrop(null)}
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium">All Notes</span>
            </div>
            {isNoteDragging && dragOverNoteFolderId === null && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-green-600/80 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg">
                <Plus className="w-3 h-3" />
                <span>Move here</span>
              </div>
            )}
          </div>
            <div className="mt-2 space-y-1">
              {folderTree.length === 0 && (
                <div className="text-xs text-gray-500 px-3 py-2">No folders yet. Create one to get started.</div>
              )}
              {folderTree.map(folder => renderFolderNode(folder))}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="w-2 bg-gray-900/80 hover:bg-indigo-500 cursor-col-resize transition-colors flex items-center justify-center rounded-md border border-gray-800"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize notes panel"
          onMouseDown={handleNotesResizeStart}
        >
          <span className="h-8 w-0.5 bg-gray-500 rounded-full" />
        </button>
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">{activeFolderName}</div>
              <div className="text-xs text-gray-500">{visibleNotes.length} note{visibleNotes.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div
              ref={quickNoteContainerRef}
              className="bg-gray-900 border border-dashed border-gray-700 rounded-lg p-3 space-y-2"
              onPaste={handleQuickNotePaste}
              onDragOver={(event) => handleFolderDragOver(event, null)}
              onDrop={() => handleFolderDrop(null)}
            >
              {isQuickNoteExpanded ? (
                <form className="space-y-2" onSubmit={finishQuickNote}>
                  <input
                    ref={quickNoteInputRef}
                    value={quickNoteTitle}
                    onChange={(e) => setQuickNoteTitle(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-200 focus:outline-none border-b border-gray-700 pb-1"
                    placeholder="Title"
                  />
                  <textarea
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-200 focus:outline-none resize-none min-h-[100px]"
                    placeholder="Take a note..."
                  />
                  {quickNoteImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {quickNoteImages.map(img => (
                        <div key={img.id} className="bg-gray-800 border border-gray-700 rounded p-1">
                          <img src={img.url} alt="attachment" className="w-full h-24 object-cover rounded" />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500 pt-1">Click away to save automatically. Paste images or URLs here.</p>
                </form>
              ) : (
                <button
                  className="w-full text-left text-sm text-gray-400 hover:text-white flex items-center gap-2"
                  onClick={() => setIsQuickNoteExpanded(true)}
                >
                  <Plus className="w-4 h-4" />
                  Take a note
                </button>
              )}
            </div>
            {visibleNotes.length === 0 ? (
              <div className="h-full border border-dashed border-gray-700 rounded-lg flex items-center justify-center text-sm text-gray-500">
                No notes in this folder yet. Create one to start writing.
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleNotes.map(note => {
                  const previewText = stripHtml(note.content || note.title || '').slice(0, 180) || 'Untitled';
                  const firstImage = note.images?.[0];
                  return (
                    <div
                      key={note.id}
                      className="bg-gray-900 border border-gray-800 hover:border-indigo-500 rounded-lg overflow-hidden h-56 flex flex-col cursor-pointer transition-colors"
                      onClick={() => { setActiveNoteId(note.id); setOpenNoteModalId(note.id); }}
                    >
                      <div className="relative h-24 bg-gray-800">
                        {firstImage ? (
                          <img src={firstImage.url} alt="note" className="w-full h-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">No image</div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 flex items-center justify-between">
                          <span className="text-white text-sm font-semibold truncate">{String(note.title || '').trim() || 'Untitled note'}</span>
                          <span className="text-[10px] text-gray-200">{note.images?.length || 0} img</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col p-3 gap-2">
                        <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">{previewText}</p>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 mt-auto pt-1">
                          <span>{new Date(note.updatedAt || note.createdAt).toLocaleDateString()}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-gray-800"
                              draggable
                              onDragStart={(event) => handleNoteDragStart(note.id, event)}
                              onDragEnd={handleNoteDragEnd}
                              title="Drag to folder"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <GripVertical className="w-4 h-4 text-indigo-300" />
                            </button>
                            <button
                              className="text-indigo-400 hover:text-indigo-200"
                              onClick={(event) => { event.stopPropagation(); setActiveNoteId(note.id); setOpenNoteModalId(note.id); }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {modalNote && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div
            ref={noteModalRef}
            className="bg-gray-900 border border-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
            onPaste={(event) => {
              const items = event.clipboardData?.items;
              if (!items) return;
              for (const item of items) {
                if (item.type.startsWith('image/')) {
                  const file = item.getAsFile();
                  if (!file) continue;
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    updateNote(modalNote.id, {
                      images: [...(modalNote.images || []), { id: Date.now(), url: e.target?.result }]
                    });
                  };
                  reader.readAsDataURL(file);
                  event.preventDefault();
                }
              }
            }}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800 gap-3">
              <div className="flex-1 space-y-2">
                <input
                  className="w-full bg-transparent text-lg font-semibold text-white focus:outline-none border-b border-gray-800 pb-1"
                  value={modalNote.title}
                  onChange={(e) => updateNote(modalNote.id, { title: e.target.value })}
                  placeholder="Untitled note"
                />
                <div className="text-xs text-gray-500">{modalNote.images?.length || 0} attachment(s)</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs text-yellow-300 hover:text-yellow-200 border border-yellow-500/60 px-2 py-1 rounded"
                  onClick={() => { archiveNote(modalNote.id); setOpenNoteModalId(null); }}
                >
                  Archive
                </button>
                <button
                  className="text-xs text-red-300 hover:text-red-200 border border-red-500/60 px-2 py-1 rounded"
                  onClick={() => { removeNote(modalNote.id); setOpenNoteModalId(null); }}
                >
                  Delete
                </button>
                <button onClick={() => setOpenNoteModalId(null)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-4">
              <RichTextEditor
                value={modalNote.content}
                onChange={(value) => updateNote(modalNote.id, { content: value })}
              />
              {modalNote.images?.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {modalNote.images.map(img => (
                    <div key={img.id} className="bg-gray-800 rounded border border-gray-700 p-2">
                      <img src={img.url} alt="attachment" className="w-full h-40 object-cover rounded" />
                      <a href={img.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 block mt-1 truncate">
                        {img.url}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No images attached. Paste an image into this window to attach.</div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
    );
  };

  const renderTodoPanel = () => {
    if (!activeTodoTab) return null;
    const sidebarStyle = { width: `${Math.round(todoSidebarWidth)}px` };
    return (
    <div className="flex h-full group/todo">
      <div className="border-r border-gray-800 flex flex-col" style={sidebarStyle}>
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-400">BETTER TEXT PAD</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">BETA</span>
              </div>
              <div className="text-sm font-medium text-gray-300">Todo Lists</div>
            </div>
            <button onClick={createTodoTab} className="flex items-center gap-1 text-sm text-green-400 hover:text-green-200" title="Create New Todo List">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" onDoubleClick={(e) => { if (!e.target.closest('[data-todo-card]')) createTodoTab(); }}>
          {todoTabs.map(tab => (
            <div
              key={tab.id}
              data-todo-card
              className={`px-4 py-3 border-b border-gray-800 cursor-pointer ${tab.id === activeTodoTabId ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
              onClick={() => setActiveTodoTabId(tab.id)}
            >
              <div className="flex items-center justify-between gap-2">
                {tab.id === activeTodoTabId ? (
                  <input
                    className="bg-transparent border-b border-gray-600 focus:outline-none w-full"
                    value={tab.title}
                    onChange={(e) => updateTodoTab(tab.id, t => ({ ...t, title: e.target.value }))}
                    placeholder="List title"
                  />
                ) : (
                  <div>
                    <p className="font-semibold text-sm">{String(tab.title || '').trim() || `List ${tab.id}`}</p>
                    <p className="text-xs text-gray-500">{tab.items.length} tasks</p>
                  </div>
                )}
                {todoTabs.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); closeTodoTab(tab.id); }} className="text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="w-2 bg-gray-900/80 hover:bg-green-500 cursor-col-resize transition-colors flex items-center justify-center rounded-md border border-gray-800"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize todo lists panel"
        onMouseDown={handleTodoResizeStart}
      >
        <span className="h-8 w-0.5 bg-gray-500 rounded-full" />
      </button>
      <div className="flex-1 flex flex-col px-6 py-4">
      <div className="flex-1 overflow-y-auto space-y-3">
        {activeTodoTab?.items?.map((item) => (
          <div
            key={item.id}
            className="bg-gray-900 border border-gray-700 rounded p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const draggedId = event.dataTransfer.getData('text/plain');
              if (!draggedId || Number(draggedId) === item.id) return;
              moveTodoItem(draggedId, 0, item.id);
            }}
          >
            <div className="flex gap-3">
              <div
                className="flex items-center justify-center px-2 py-2 bg-gray-800 rounded cursor-move"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', item.id);
                }}
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 flex-1">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleTodoItem(item.id)}
                    />
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => updateTodoTab(activeTodoTabId, tab => ({
                        ...tab,
                        items: tab.items.map(it => it.id === item.id ? { ...it, text: e.target.value } : it)
                      }))}
                      className={`flex-1 bg-transparent focus:outline-none ${item.done ? 'line-through text-gray-500' : ''}`}
                    />
                  </label>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {item.dueDate && <span>Due: {item.dueDate}</span>}
                    {item.completedDate && <span>Done: {item.completedDate}</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-gray-400">
                    <span>Due:</span>
                    <input
                      type="date"
                      value={item.dueDate || ''}
                      onChange={(e) => updateTodoTab(activeTodoTabId, tab => ({
                        ...tab,
                        items: tab.items.map(it => it.id === item.id ? { ...it, dueDate: e.target.value } : it)
                      }))}
                      className="bg-gray-900 border border-gray-700 rounded px-2 py-1"
                    />
                  </label>
                  <button onClick={() => removeTodoItem(item.id)} className="text-red-400 text-sm">Remove</button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {(activeTodoTab?.items?.length || 0) === 0 && <p className="text-gray-500">No tasks yet.</p>}
      </div>
      <div className="flex items-center gap-2 mt-4">
        <input
          ref={newTodoInputRef}
          type="text"
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTodoItem();
            }
          }}
          placeholder="New task"
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <span>Due:</span>
          <input
            type="date"
            value={newTodoDueDate}
            onChange={(e) => setNewTodoDueDate(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
          />
        </label>
        <button
          onClick={addTodoItem}
          className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded"
        >
          Add
        </button>
      </div>
      </div>
    </div>
  );
  };

  const renderEditorWorkspace = () => {
    if (isCsvEditorCollapsed) return null;

    return (
              <div className="flex flex-1 overflow-hidden min-w-0 relative" style={{ maxWidth: '100%' }}>
        {/* Line Numbers with Error Indicators */}
        <div
          ref={lineNumberRef}
          className="editor-line-numbers text-gray-500 text-right font-mono text-sm select-none border-r border-gray-700"
          style={{ minWidth: '50px', transform: 'translateZ(0)', paddingTop: editorTopPaddingPx, paddingBottom: '16px' }}
        >
          {editorLines.map((_, index) => {
            // For CSV files, skip numbering the first line (header row)
            const lineNum = isCSVTab ? (index === 0 ? null : index) : (index + 1);
            const markers = errorsByLine.get(index + 1) || [];
            const primaryMarker = markers.find(marker => marker.isPrimary);
            const hasError = markers.length > 0;
            const accentClass = primaryMarker ? 'text-orange-400' : 'text-red-400';
            const rowTone = primaryMarker ? 'text-orange-200' : 'text-red-200';
            const errorBgColor = primaryMarker ? '#7c2d12' : '#7f1d1d';
            const normalBgColor = theme === 'dark' ? '#1f2937' : '#f3f4f6';
            const isCsvDataLine = isCSVTab && index > 0;
            const csvRowIndex = isCsvDataLine ? index - 1 : null;
            const isActiveCsvLine = isCsvDataLine && csvRowIndex === activeCsvRowIndex;
            const backgroundColor = hasError ? errorBgColor : (isActiveCsvLine ? csvRowHighlightLineBg : normalBgColor);
            const activeCsvClass = isActiveCsvLine ? `${csvRowHighlightTextClass} font-semibold` : '';

            return (
              <div
                key={index}
                className={`leading-6 px-3 flex items-start justify-end ${hasError ? `${rowTone} font-bold` : ''} ${activeCsvClass}`}
                style={{ minHeight: '24px', height: '24px', backgroundColor, marginLeft: '-12px', marginRight: '-12px', paddingLeft: '12px', paddingRight: '12px' }}
              >
                {hasError && <span className={`${accentClass} mr-1`}>●</span>}
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Editor with inline error markers */}
        <div className="flex-1 relative bg-gray-900 overflow-auto font-mono text-sm">
          {/* Syntax Highlighting Overlay using Prism.js */}
          {shouldShowSyntaxHighlighting && syntaxLanguage && (
            <div
              ref={syntaxOverlayRef}
              className="absolute top-0 left-0 right-0 z-10 pointer-events-none select-none font-mono text-sm"
              style={{ lineHeight: '24px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', willChange: 'transform', paddingTop: editorTopPaddingPx, paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px' }}
            >
              {editorLines.map((line, lineIndex) => (
                <div
                  key={`syntax-${lineIndex}`}
                  style={{ minHeight: '24px' }}
                  dangerouslySetInnerHTML={{
                    __html: Prism.highlight(
                      line || ' ',
                      Prism.languages[syntaxLanguage] || Prism.languages.markup,
                      syntaxLanguage
                    )
                  }}
                />
              ))}
            </div>
          )}

          {braceMarkersByLine.size > 0 && (
            <div
              ref={braceOverlayRef}
              className="absolute inset-0 z-30 pointer-events-none select-none overflow-hidden"
              style={{ lineHeight: '24px', whiteSpace: isCSVTab ? 'pre' : 'pre-wrap', wordBreak: isCSVTab ? 'normal' : 'break-all', willChange: 'transform', paddingTop: editorTopPaddingPx, paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px' }}
            >
              {editorLines.map((line, lineIndex) => {
                const lineNum = lineIndex + 1;
                const markers = braceMarkersByLine.get(lineNum);
                if (!markers || markers.length === 0) {
                  return (
                    <div key={`brace-${lineIndex}`} style={{ minHeight: '24px' }}>
                      <span className="opacity-0">{line || ' '}</span>
                    </div>
                  );
                }
                let lastIndex = 0;
                return (
                  <div key={`brace-${lineIndex}`} style={{ minHeight: '24px' }}>
                    {markers.map((marker, markerIdx) => {
                      const columnIndex = Math.max(0, (marker.column || 1) - 1);
                      const beforeText = line.substring(lastIndex, columnIndex);
                      lastIndex = columnIndex + 1;
                      const braceColor = marker.role === 'open' ? '#c084fc' : '#60a5fa';
                      return (
                        <React.Fragment key={`brace-marker-${lineIndex}-${markerIdx}`}>
                          <span className="opacity-0">{beforeText}</span>
                          <span
                            className="inline-block rounded"
                            style={{
                              backgroundColor: braceColor,
                              opacity: 0.35
                            }}
                          >
                            <span className="opacity-0">{line.charAt(columnIndex) || marker.char || ' '}</span>
                          </span>
                        </React.Fragment>
                      );
                    })}
                    <span className="opacity-0">{line.substring(lastIndex)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div
            ref={errorOverlayRef}
            className="absolute inset-0 z-40 pointer-events-none select-none overflow-hidden"
            style={{ lineHeight: '24px', whiteSpace: isCSVTab ? 'pre' : 'pre-wrap', wordBreak: isCSVTab ? 'normal' : 'break-all', willChange: 'transform', paddingTop: editorTopPaddingPx, paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px' }}
          >
            {editorLines.map((line, lineIndex) => {
              const lineNum = lineIndex + 1;
              const markers = errorsByLine.get(lineNum);

              if (!markers || markers.length === 0) {
                return (
                  <div key={`error-${lineIndex}`} style={{ minHeight: '24px' }}>
                    <span className="opacity-0">{line || ' '}</span>
                  </div>
                );
              }

              let lastIndex = 0;

              return (
                <div key={`error-${lineIndex}`} style={{ minHeight: '24px' }}>
                  {markers.map((marker, markerIdx) => {
                    const columnIndex = Math.max(0, (marker.column || 1) - 1);
                    const beforeText = line.substring(lastIndex, columnIndex);
                    lastIndex = columnIndex + 1;
                    const arrowColor = marker.isPrimary ? '#fb923c' : '#facc15';

                    return (
                      <React.Fragment key={`error-marker-${lineIndex}-${markerIdx}`}>
                        <span className="opacity-0">{beforeText}</span>
                        <span
                          className="relative"
                          style={{
                            borderBottom: `3px solid ${arrowColor}`,
                            textShadow: `0 0 4px ${arrowColor}`
                          }}
                        >
                          {line.charAt(columnIndex) || '█'}
                          <span
                            className="absolute left-0"
                            style={{
                              bottom: '-14px',
                              fontSize: '12px',
                              color: arrowColor,
                              fontWeight: 'bold',
                              textShadow: `0 0 4px ${arrowColor}`
                            }}
                          >
                            ▲
                          </span>
                        </span>
                      </React.Fragment>
                    );
                  })}
                  <span className="opacity-0">{line.substring(lastIndex)}</span>
                </div>
              );
            })}
          </div>
          
          {/* Actual textarea */}
          <textarea
            ref={textareaRef}
            value={activeTab.content}
            onChange={(e) => {
              const newValue = e.target.value;
              const cursorPos = e.target.selectionStart;
              const cursorEnd = e.target.selectionEnd;

              // Clear pending cursor restoration to prevent old cursor positions from being restored
              pendingCursorRef.current = null;

              updateTabContent(activeTab.id, newValue);

              // Preserve cursor position after React re-render
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.setSelectionRange(cursorPos, cursorEnd);
                  updateCursorPosition(newValue);
                }
              });
            }}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={() => updateCursorPosition()}
            onClick={() => { updateCursorPosition(); handleMarkdownEditorClick(); }}
            className={`absolute inset-0 z-20 w-full h-full bg-transparent font-mono text-sm resize-none focus:outline-none caret-white ${shouldShowSyntaxHighlighting ? 'text-transparent' : 'text-gray-100'}`}
            placeholder="Start typing..."
            spellCheck={false}
            style={{ lineHeight: '24px', whiteSpace: isCSVTab ? 'pre' : 'pre-wrap', wordBreak: isCSVTab ? 'normal' : (shouldShowSyntaxHighlighting ? 'break-word' : 'break-all'), overflowX: isCSVTab ? 'auto' : 'hidden', paddingTop: editorTopPaddingPx, paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px' }}
          />
        </div>
      </div>
    );
  };

  const renderDevPanel = () => {
    const structurePaneStyle = { width: `${Math.round(structureWidth)}px` };
    // Only show structure panel for JSON and XML files when user has it enabled
    const showStructurePane = !isCSVTab && !isMarkdownTab && structureTree.type !== null && structurePanelVisible;
    return (
    <div className="flex flex-col h-full">
      {/* Menu Bar */}
      <div className={`border-b px-4 py-2 flex items-center gap-4 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-200 border-gray-300'}`}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-400">BETTER TEXT PAD</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>BETA</span>
          </div>
          <div className={`text-[11px] font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Code & Text Editor • JSON • XML • CSV • Markdown • TXT</div>
        </div>

        <div className="flex gap-1.5 ml-4">
          <button
            onClick={createNewTab}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
            title="New File"
          >
            <Plus className="w-4 h-4" />
            New
          </button>

          <button
            onClick={openFileWithDialog}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
            title="Open files: JSON, XML, CSV, HTML, JS, TXT, and more"
          >
            <Upload className="w-4 h-4" />
            Open File
          </button>
          {/* Hidden file input for browser fallback */}
          <input
            id="file-input"
            ref={fileInputRef}
            type="file"
            onChange={openFile}
            className="hidden"
            accept=".txt,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.md,.log,.csv,.php,.php3,.php4,.php5,.phtml,.py,.pyw,.pyx,.rb,.rbw,.java,.class,.jsp,.jspx,.go,.rs,.c,.h,.cpp,.hpp,.cc,.cxx,.cs,.swift,.kt,.kts,.scala,.m,.mm,.pl,.pm,.sh,.bash,.zsh,.fish,.lua,.r,.R,.dart,.sql,.vb,.vbs,.asm,.s,.f,.f90,.f95,.pas,.groovy,.gradle,.ini,.conf,.config,.toml,.yaml,.yml,.properties,.env,.cfg,.svg"
          />

          <button
            onClick={saveFile}
            disabled={!activeTab}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${!activeTab ? 'bg-gray-600 cursor-not-allowed opacity-50' : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
            title="Save File (Ctrl/Cmd+S)"
          >
            <Save className="w-4 h-4" />
            Save
          </button>

          <button
            onClick={saveFileAs}
            disabled={!activeTab}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${!activeTab ? 'bg-gray-600 cursor-not-allowed opacity-50' : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
            title="Save As... (Ctrl/Cmd+Shift+S)"
          >
            <Save className="w-4 h-4" />
            Save As...
          </button>

          <div className={`w-px mx-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

          <button
            onClick={formatJSON}
            disabled={!activeTab}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${!activeTab ? 'bg-gray-600 cursor-not-allowed opacity-50' : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
            title="Format JSON"
          >
            <Braces className="w-4 h-4" />
            Format JSON
          </button>

          <button
            onClick={formatXML}
            disabled={!activeTab}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${!activeTab ? 'bg-gray-600 cursor-not-allowed opacity-50' : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
            title="Format XML"
          >
            <FileCode className="w-4 h-4" />
            Format XML
          </button>

          {/* Toggle Structure Panel - only show for JSON/XML */}
          {!isCSVTab && !isMarkdownTab && structureTree.type !== null && (
            <>
              <div className={`w-px mx-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
              <button
                onClick={() => setStructurePanelVisible(!structurePanelVisible)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                title={structurePanelVisible ? 'Hide Structure Panel' : 'Show Structure Panel'}
              >
                {structurePanelVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
                {structurePanelVisible ? 'Hide' : 'Show'} Structure
              </button>
            </>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex gap-1.5 ml-auto">
          <button
            onClick={() => setShowAISettings(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
            title="AI Settings - Configure AI provider for error fixing"
          >
            <Settings className="w-4 h-4" />
            AI Settings
          </button>
        </div>
      </div>

      {/* Find & Replace */}
      <div className={`border-b px-4 py-2 flex flex-wrap items-center gap-2 text-sm ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-100 border-gray-300'}`}>
        <div className={`flex items-center gap-2 rounded px-2 py-1 flex-1 min-w-[200px] ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-300'}`}>
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={findValue}
            onChange={(e) => setFindValue(e.target.value)}
            placeholder="Find..."
            className={`bg-transparent flex-1 outline-none placeholder-gray-500 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}
          />
        </div>
        <div className={`flex items-center gap-2 rounded px-2 py-1 flex-1 min-w-[200px] ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-300'}`}>
          <Replace className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={replaceValue}
            onChange={(e) => setReplaceValue(e.target.value)}
            placeholder="Replace with..."
            className={`bg-transparent flex-1 outline-none placeholder-gray-500 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}
          />
        </div>
        <button
          onClick={handleFindNext}
          disabled={!findValue}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${!findValue ? 'bg-gray-600 cursor-not-allowed opacity-50' : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
        >
          Find Next
        </button>
        <button
          onClick={handleReplace}
          disabled={!findValue || !activeTab}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${(!findValue || !activeTab) ? 'bg-gray-600 cursor-not-allowed opacity-50' : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
        >
          Replace
        </button>
        <button
          onClick={handleReplaceAll}
          disabled={!findValue || !activeTab}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${(!findValue || !activeTab) ? 'bg-gray-600 cursor-not-allowed opacity-50' : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
        >
          Replace All
        </button>
      </div>

      {/* Tab Bar */}
      <div className="bg-gray-800 border-b border-gray-700 flex items-center">
        <div className="flex border-r border-gray-700">
          <button
            onClick={goToPreviousTab}
            disabled={tabs.length === 0}
            className={`px-3 py-2 ${theme === 'dark' ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-300'} disabled:text-gray-600 disabled:hover:bg-transparent`}
            title="Previous Tab"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToNextTab}
            disabled={tabs.length === 0}
            className={`px-3 py-2 ${theme === 'dark' ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-300'} disabled:text-gray-600 disabled:hover:bg-transparent`}
            title="Next Tab"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div
          className="flex overflow-x-auto flex-1 scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
          onDoubleClick={handleTabBarDoubleClick}
        >
          {tabs.map(tab => (
            <div
              key={tab.id}
              data-tab-item="true"
              draggable="true"
              onDragStart={(e) => handleTabDragStart(e, tab.id)}
              onDragOver={(e) => handleTabDragOver(e, tab.id)}
              onDragLeave={handleTabDragLeave}
              onDrop={(e) => handleTabDrop(e, tab.id)}
              onDragEnd={handleTabDragEnd}
              onContextMenu={(e) => {
                e.preventDefault();
                setTabContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  tabId: tab.id
                });
              }}
              className={`flex items-center gap-2 px-4 py-2 border-r border-gray-700 cursor-move min-w-[150px] max-w-[200px] group
                ${tab.id === activeTabId ? 'bg-gray-900 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-750'}
                ${draggedTabId === tab.id ? 'opacity-50' : ''}
                ${dragOverTabId === tab.id && draggedTabId !== tab.id ? 'border-l-2 border-l-indigo-400' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="truncate flex-1 text-sm">
                {tab.isModified ? '● ' : ''}{tab.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex-1 min-w-[200px]" />
        </div>
      </div>

      {csvDetectionMessage && (
        <div className="bg-yellow-400 border-b-2 border-yellow-500 text-red-800 px-5 py-3 text-sm flex items-center gap-3 shadow-lg font-semibold">
          <Info className="w-4 h-4" />
          <span className="tracking-wide">{csvDetectionMessage}</span>
        </div>
      )}

      {markdownDetectionMessage && (
        <div className="bg-yellow-400 border-b-2 border-yellow-500 text-red-800 px-5 py-3 text-sm flex items-center gap-3 shadow-lg font-semibold">
          <Info className="w-4 h-4" />
          <span className="tracking-wide">{markdownDetectionMessage}</span>
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ maxWidth: '100%' }}>
        {activeTab && activeTab.title !== 'Welcome' ? (
          <>
            {/* Editor Section */}
            <div className="flex-1 flex overflow-hidden border-b-2 border-gray-700 group" style={{ maxWidth: '100%' }}>
              {/* Structure Pane */}
              {showStructurePane && (
                <>
                  <div
                    className="bg-gray-900 border-r border-gray-800 overflow-hidden transition-[width]"
                    style={structurePaneStyle}
                  >
                    <div className="px-3 py-2 border-b border-gray-800 text-xs uppercase tracking-wide text-gray-300 flex items-center justify-between gap-2 bg-gray-900">
                      <span>Structure</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            // Expand all nodes
                            setStructureCollapsed({});
                          }}
                          className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
                          title="Expand All"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            // Collapse all nodes
                            const allNodeIds = {};
                            const collectNodeIds = (nodes) => {
                              nodes.forEach(node => {
                                if (node.children && node.children.length > 0) {
                                  allNodeIds[node.id] = true;
                                  collectNodeIds(node.children);
                                }
                              });
                            };
                            collectNodeIds(structureTree.nodes);
                            setStructureCollapsed(allNodeIds);
                          }}
                          className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
                          title="Collapse All"
                        >
                          <Minimize2 className="w-4 h-4" />
                        </button>
                        <span className="text-gray-400">{structureTree.type || 'Plain'}</span>
                      </div>
                    </div>
                    <div className="p-3 max-h-full overflow-y-auto text-gray-200" ref={structureRef}>
                      {structureTree.nodes.length > 0 ? (
                        renderStructureNodes(structureTree.nodes)
                      ) : (
                        <p className="text-gray-500 text-xs">No structure detected</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-1 bg-gray-800/50 hover:bg-indigo-500/60 cursor-col-resize transition-colors flex items-center justify-center"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize structure panel"
                    onMouseDown={handleStructureResizeStart}
                  >
                  </button>
                </>
              )}

              <div className="flex flex-1 overflow-hidden min-w-0" style={{ maxWidth: '100%' }}>
                <div className="flex flex-1 flex-col overflow-hidden min-w-0" style={{ maxWidth: '100%' }}>
                  {isMarkdownTab && (
                    <>
                      <div
                        className="bg-gray-900 border-b border-gray-800 flex flex-col min-w-0"
                        style={
                          isMarkdownPreviewCollapsed
                            ? { flex: 1, minHeight: 0 }
                            : { height: `${Math.round(markdownPreviewHeight)}px`, minHeight: MIN_CSV_PREVIEW_HEIGHT, maxHeight: MAX_CSV_PREVIEW_HEIGHT }
                        }
                      >
                        <div className="flex items-center justify-between px-4 py-2 text-xs uppercase tracking-wide text-gray-400 flex-shrink-0">
                          <span>Markdown Preview</span>
                        </div>
                        <div
                          ref={markdownPreviewRef}
                          className="flex-1 min-w-0 overflow-auto px-6 py-4"
                          style={{ backgroundColor: theme === 'dark' ? '#111827' : '#ffffff' }}
                          onClick={handleMarkdownPreviewClick}
                        >
                          <div
                            className="markdown-preview prose prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: markdownHtml }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-0.5 border-b border-gray-700/30">
                        <button
                          type="button"
                          className="flex-1 h-1 bg-transparent hover:bg-indigo-500/40 cursor-row-resize transition-colors flex items-center justify-center group"
                          aria-label="Resize markdown preview area"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            markdownPreviewDragState.current.active = true;
                            markdownPreviewDragState.current.startY = e.clientY;
                            markdownPreviewDragState.current.startHeight = markdownPreviewHeight;
                          }}
                        >
                          <span className="w-8 h-0.5 bg-gray-600 rounded-full group-hover:bg-indigo-400" />
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:text-white hover:border-indigo-400 transition-colors"
                          onClick={() => setIsMarkdownPreviewCollapsed(prev => !prev)}
                          aria-pressed={isMarkdownPreviewCollapsed}
                        >
                          {isMarkdownPreviewCollapsed ? (
                            <span className="flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Expand Editor</span>
                          ) : (
                            <span className="flex items-center gap-1"><ChevronUp className="w-3 h-3" /> Collapse Editor</span>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                  {isCSVTab && csvPreviewStats && (
                    <>
                      <div
                        className="bg-gray-900 border-b border-gray-800 flex flex-col min-w-0"
                        style={
                          isCsvEditorCollapsed
                            ? { flex: 1, minHeight: 0 }
                            : { height: `${Math.round(csvPreviewHeight)}px`, minHeight: MIN_CSV_PREVIEW_HEIGHT, maxHeight: MAX_CSV_PREVIEW_HEIGHT }
                        }
                      >
                        <div className="flex items-center justify-between px-4 py-2 text-xs uppercase tracking-wide text-gray-400 flex-shrink-0">
                          <span>CSV Grid Preview</span>
                          <span className="text-gray-500">
                            {csvPreviewStats.rowCount} rows · {csvPreviewStats.columnCount} columns
                          </span>
                        </div>
                        <div className="csv-table-container flex-1 min-w-0">
                          <table
                            className="csv-table border-collapse text-sm font-mono text-gray-100"
                            style={{
                              width: csvTotalWidth > 0 ? `${csvTotalWidth}px` : '100%',
                              tableLayout: 'fixed'
                            }}
                          >
                              <thead style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#f3f4f6' }}>
                                <tr className="text-sm font-semibold text-gray-200">
                                  <th
                                    className="line-num-header border-r border-t border-b border-l border-gray-700 px-2 py-1 text-center font-semibold"
                                    style={{
                                      width: '60px',
                                      minWidth: '60px',
                                      backgroundColor: theme === 'dark' ? '#1f2937' : '#f3f4f6',
                                      position: 'sticky',
                                      left: 0,
                                      top: 0,
                                      zIndex: 80,
                                      boxShadow: theme === 'dark' ? '0 2px 0 #0f172a' : '0 2px 0 #e5e7eb'
                                    }}
                                  >
                                    #
                                  </th>
                                  {(csvPreviewStats.header.length ? csvPreviewStats.header : Array.from({ length: csvPreviewStats.columnCount }, (_, idx) => `Column ${idx + 1}`)).map((cell, idx) => (
                                    <th
                                      key={`csv-head-${idx}`}
                                      className="border-r border-t border-b border-gray-700 px-2 py-1 text-left relative select-none overflow-hidden font-semibold"
                                      style={{
                                        backgroundColor: theme === 'dark' ? '#1f2937' : '#f3f4f6',
                                        width: `${csvColumnWidthsForTab[idx] || DEFAULT_CSV_COLUMN_WIDTH}px`,
                                        minWidth: `${MIN_CSV_COLUMN_WIDTH}px`,
                                        borderLeftWidth: idx === 0 ? '1px' : '0',
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 40
                                      }}
                                    >
                                      <span className="pr-2 block truncate">{cell || `Column ${idx + 1}`}</span>
                                      <div
                                        className="absolute top-0 right-[-1px] h-full w-[3px] cursor-col-resize hover:bg-indigo-500 flex items-center justify-center z-10"
                                        aria-label={`Resize column ${idx + 1}`}
                                        onMouseDown={(e) => handleCsvColumnResizeStart(e, idx)}
                                        onDoubleClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleCsvColumnAutoFit(idx);
                                        }}
                                        style={{ background: 'rgba(99, 102, 241, 0.2)' }}
                                      >
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {csvPreviewRows.map((row, rowIdx) => {
                                  const evenRowClass = theme === 'dark' ? 'bg-gray-800/40' : 'bg-gray-50';
                                  const oddRowClass = theme === 'dark' ? 'bg-gray-900/80' : 'bg-white';
                                  const lineNumBgColor = theme === 'dark' ? '#1f2937' : '#f3f4f6';
                                  const isActiveRow = csvPreviewHasDataRows && rowIdx === activeCsvRowIndex;
                                  const rowHighlightStyle = isActiveRow ? { backgroundColor: csvRowHighlightBg } : null;
                                  return (
                                    <tr
                                      key={`csv-row-${rowIdx}`}
                                      ref={(el) => {
                                        if (!csvPreviewHasDataRows) return;
                                        if (el) {
                                          csvPreviewRowRefs.current.set(rowIdx, el);
                                        } else {
                                          csvPreviewRowRefs.current.delete(rowIdx);
                                        }
                                      }}
                                      onClick={csvPreviewHasDataRows ? () => handleCsvPreviewRowClick(rowIdx) : undefined}
                                      className={`${rowIdx % 2 === 0 ? evenRowClass : oddRowClass} ${csvPreviewHasDataRows ? 'cursor-pointer transition-colors' : ''}`}
                                      style={rowHighlightStyle || undefined}
                                    >
                                      <td
                                        className={`line-num-cell border-r border-b border-l border-gray-700 px-2 py-1 text-center select-none ${isActiveRow ? `${csvRowHighlightTextClass} font-semibold` : 'text-gray-500'}`}
                                        style={{ width: '60px', minWidth: '60px', backgroundColor: isActiveRow ? csvRowHighlightLineBg : lineNumBgColor, position: 'sticky', left: 0, zIndex: 20 }}
                                      >
                                        {rowIdx + 1}
                                      </td>
                                      {Array.from({ length: csvPreviewStats.columnCount }).map((_, cellIdx) => (
                                        <td
                                          key={`csv-cell-${rowIdx}-${cellIdx}`}
                                          className="border-r border-b border-gray-700 px-2 py-1 whitespace-pre overflow-hidden"
                                          style={{
                                            width: `${csvColumnWidthsForTab[cellIdx] || DEFAULT_CSV_COLUMN_WIDTH}px`,
                                            minWidth: `${MIN_CSV_COLUMN_WIDTH}px`,
                                            borderLeftWidth: cellIdx === 0 ? '1px' : '0',
                                            textOverflow: 'ellipsis'
                                          }}
                                        >
                                          {row[cellIdx] ?? ''}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-0.5 border-b border-gray-700/30">
                        <button
                          type="button"
                          className="flex-1 h-1 bg-transparent hover:bg-indigo-500/40 cursor-row-resize transition-colors flex items-center justify-center group"
                          aria-label="Resize CSV preview area"
                          onMouseDown={handleCsvPreviewResizeStart}
                        >
                          <span className="w-8 h-0.5 bg-gray-600 rounded-full group-hover:bg-indigo-400" />
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:text-white hover:border-indigo-400 transition-colors"
                          onClick={() => setIsCsvEditorCollapsed(prev => !prev)}
                          aria-pressed={isCsvEditorCollapsed}
                        >
                          {isCsvEditorCollapsed ? (
                            <span className="flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Expand Editor</span>
                          ) : (
                            <span className="flex items-center gap-1"><ChevronUp className="w-3 h-3" /> Collapse Editor</span>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                  {(!isMarkdownTab || !isMarkdownPreviewCollapsed) && renderEditorWorkspace()}

                </div>
              </div>
            </div>

            {/* Full-width Error Panel Below Editor */}
            {errorMessage && (
              <div className={`h-1/2 overflow-y-auto border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`font-bold text-lg ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                        ⚠️ Invalid {errorMessage.type} - Formatting Failed
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-700'}`}>
                        {errorMessage.allErrors?.length || 1} Error{(errorMessage.allErrors?.length || 1) > 1 ? 's' : ''} Found
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAIFix}
                        disabled={aiFixState.isLoading}
                        className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
                          aiFixState.isLoading
                            ? 'bg-purple-600/50 cursor-not-allowed text-white'
                            : theme === 'dark'
                              ? 'bg-purple-600 hover:bg-purple-700 text-white'
                              : 'bg-purple-500 hover:bg-purple-600 text-white'
                        }`}
                        title="Use AI to automatically fix errors"
                      >
                        {aiFixState.isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {aiFixState.progress ? aiFixState.progress.text : 'Fixing...'}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            AI Fix
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowAISettings(true)}
                        className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`}
                        title="Configure AI settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (errorMessage.type === 'JSON') {
                            formatJSON({ autoTriggered: false });
                          } else if (errorMessage.type === 'XML') {
                            formatXML({ autoTriggered: false });
                          }
                        }}
                        className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`}
                        title="Retry formatting after fixing errors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retry Format
                      </button>
                      <button
                        onClick={() => setErrorMessage(null)}
                        className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`}
                      >
                        <X className="w-4 h-4" />
                        Close
                      </button>
                    </div>
                  </div>

                  {/* Errors Grid */}
                  <div className="grid grid-cols-1 gap-3 mb-4">
                    {errorMessage.allErrors && errorMessage.allErrors.length > 0 ? (
                      errorMessage.allErrors.map((error, idx) => (
                        <div 
                          key={idx}
                          role="button"
                          tabIndex={0}
                          onClick={() => goToPosition(error.line, error.column)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              goToPosition(error.line, error.column);
                            }
                          }}
                          className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-400 border-l-4 ${error.isPrimary ? 'border-orange-400' : 'border-yellow-400'} ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} pl-4 pr-4 py-3 rounded-r-lg`}
                          title="Jump to this error location"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              Error #{idx + 1}
                            </span>
                            {error.isPrimary && (
                              <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                                PRIMARY ERROR
                              </span>
                            )}
                            {error.severity === 'warning' && (
                              <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                                WARNING
                              </span>
                            )}
                            <span className={`font-mono text-base font-bold ml-auto ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                              📍 Line {error.line}, Column {error.column}
                            </span>
                          </div>
                          <div className={`text-base leading-relaxed ${theme === 'dark' ? 'text-red-100' : 'text-red-900'}`}>
                            {error.message}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => goToPosition(errorMessage.line, errorMessage.column)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goToPosition(errorMessage.line, errorMessage.column);
                          }
                        }}
                        className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-400 border-l-4 border-yellow-400 pl-4 pr-4 py-3 rounded-r-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Error #1
                          </span>
                          {errorMessage.line && (
                            <span className={`font-mono text-base font-bold ml-auto ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                              📍 Line {errorMessage.line}, Column {errorMessage.column}
                            </span>
                          )}
                        </div>
                        <div className={`text-base leading-relaxed ${theme === 'dark' ? 'text-red-100' : 'text-red-900'}`}>
                          {errorMessage.message}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Fix Error Display */}
                  {aiFixState.error && (
                    <div className={`mb-4 p-4 rounded-lg border ${
                      theme === 'dark'
                        ? 'bg-red-900/20 border-red-800'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <X className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                          theme === 'dark' ? 'text-red-400' : 'text-red-600'
                        }`} />
                        <div>
                          <p className={`text-sm font-semibold ${
                            theme === 'dark' ? 'text-red-300' : 'text-red-900'
                          }`}>
                            AI Fix Failed
                          </p>
                          <p className={`text-xs mt-1 ${
                            theme === 'dark' ? 'text-red-400' : 'text-red-700'
                          }`}>
                            {aiFixState.error}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Common JSON Issues Section */}
                  {errorMessage.type === 'JSON' && errorMessage.tips && errorMessage.tips.length > 0 && (
                    <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-black bg-opacity-40' : 'bg-gray-200'}`}>
                      <button
                        onClick={() => setTipsCollapsed(prev => !prev)}
                        className={`w-full flex items-center justify-between font-bold text-base mb-3 ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}
                      >
                        <span>💡 Common JSON Issues to Check</span>
                        <span className="text-xs uppercase tracking-wide">
                          {tipsCollapsed ? 'Show' : 'Hide'}
                        </span>
                      </button>
                      {!tipsCollapsed && (
                        <ul className={`text-sm space-y-2 list-disc list-inside ${theme === 'dark' ? 'text-red-100' : 'text-gray-800'}`}>
                          {errorMessage.tips.map((tip, idx) => (
                            <li key={idx} className="leading-relaxed">{tip}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={`flex items-center justify-center h-full w-full ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            <div className="text-center max-w-2xl px-6">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>Welcome to Better Text Pad</p>
              <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                A powerful code & text editor with syntax highlighting, AI-assisted error fixing, and more
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-left mb-6">
                {/* Column 1: File Support & Editing */}
                <div>
                  <p className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>📝 File Support & Editing</p>
                  <div className={`text-xs space-y-1.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>40+ file types with syntax highlighting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>JSON/XML formatter & validator</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Structure tree for JSON, XML, YAML</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>CSV editor with live table preview</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Multi-tab editing with auto-save</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Save to original file (preserves extensions)</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: AI & Advanced Features */}
                <div>
                  <p className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>🤖 AI & Advanced Features</p>
                  <div className={`text-xs space-y-1.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>AI-assisted error fixing (JSON/XML)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Multiple AI providers (Ollama, Groq, OpenAI, Claude)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Side-by-side diff viewer for changes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Find & replace with regex support</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Notes & folders organization</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Todo list with categorization</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`text-xs mb-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                <p className="mb-1"><strong>Supported Languages:</strong></p>
                <p className="leading-relaxed">
                  JavaScript, TypeScript, JSX/TSX, Python, Java, PHP, Ruby, Go, Rust, C/C++, C#, Swift, Kotlin,
                  Scala, Dart, SQL, Bash, Lua, R, JSON, XML, YAML, TOML, Markdown, CSS, HTML, and more
                </p>
              </div>

              <p className={`text-sm mt-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Click{' '}
                <button
                  onClick={createNewTab}
                  className={`font-semibold underline hover:no-underline cursor-pointer ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  New
                </button>
                {' '}or{' '}
                <button
                  onClick={openFileWithDialog}
                  className={`font-semibold underline hover:no-underline cursor-pointer ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  Open File
                </button>
                {' '}to get started
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className={`border-t px-4 py-1.5 flex items-center justify-between text-xs ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-200 border-gray-300 text-gray-600'}`}>
        <div className="flex gap-4">
          <span>Tabs: {tabs.length}</span>
          {activeTab && (
            <>
              <span>Length: {String(activeTab.content || '').length} characters</span>
              <span>Lines: {String(activeTab.content || '').split('\n').length}</span>
              <span className="text-blue-400">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
            </>
          )}
        </div>
        <div>
          {activeTab?.isModified && <span className="text-yellow-400">● Modified</span>}
        </div>
      </div>
    </div>
  );
  };

  const renderPanel = () => {
    if (currentPanel === 'notes') return renderNotesPanel();
    if (currentPanel === 'todo') return renderTodoPanel();
    return renderDevPanel();
  };

  const navItems = [
    { id: 'dev', label: 'Developer Pad', icon: Code2 },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'todo', label: 'Todo', icon: CheckSquare }
  ];

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const MIN_STRUCTURE_WIDTH = 200;
  const MAX_STRUCTURE_WIDTH = 520;
  const MIN_NOTES_SIDEBAR_WIDTH = 220;
  const MAX_NOTES_SIDEBAR_WIDTH = 520;
  const MIN_TODO_SIDEBAR_WIDTH = 200;
  const MAX_TODO_SIDEBAR_WIDTH = 480;
  const handleStructureResizeMove = useCallback((event) => {
    if (!structureDragState.current.active) return;
    const delta = event.clientX - structureDragState.current.startX;
    const nextWidth = Math.min(
      MAX_STRUCTURE_WIDTH,
      Math.max(MIN_STRUCTURE_WIDTH, structureDragState.current.startWidth + delta)
    );
    setStructureWidth(nextWidth);
  }, []);

  const handleStructureResizeEnd = useCallback(() => {
    if (!structureDragState.current.active) return;
    structureDragState.current = {
      ...structureDragState.current,
      active: false
    };
    document.removeEventListener('mousemove', handleStructureResizeMove);
    document.removeEventListener('mouseup', handleStructureResizeEnd);
  }, [handleStructureResizeMove]);

  const handleStructureResizeStart = useCallback((event) => {
    event.preventDefault();
    structureDragState.current = {
      active: true,
      startX: event.clientX,
      startWidth: structureWidth
    };
    document.addEventListener('mousemove', handleStructureResizeMove);
    document.addEventListener('mouseup', handleStructureResizeEnd);
  }, [structureWidth, handleStructureResizeMove, handleStructureResizeEnd]);

  const handleNotesResizeMove = useCallback((event) => {
    if (!notesSidebarDragState.current.active) return;
    const delta = event.clientX - notesSidebarDragState.current.startX;
    const nextWidth = Math.min(
      MAX_NOTES_SIDEBAR_WIDTH,
      Math.max(MIN_NOTES_SIDEBAR_WIDTH, notesSidebarDragState.current.startWidth + delta)
    );
    setNotesSidebarWidth(nextWidth);
  }, []);

  const handleNotesResizeEnd = useCallback(() => {
    if (!notesSidebarDragState.current.active) return;
    notesSidebarDragState.current = {
      ...notesSidebarDragState.current,
      active: false
    };
    document.removeEventListener('mousemove', handleNotesResizeMove);
    document.removeEventListener('mouseup', handleNotesResizeEnd);
  }, [handleNotesResizeMove]);

  const handleNotesResizeStart = useCallback((event) => {
    event.preventDefault();
    notesSidebarDragState.current = {
      active: true,
      startX: event.clientX,
      startWidth: notesSidebarWidth
    };
    document.addEventListener('mousemove', handleNotesResizeMove);
    document.addEventListener('mouseup', handleNotesResizeEnd);
  }, [notesSidebarWidth, handleNotesResizeMove, handleNotesResizeEnd]);

  const handleTodoResizeMove = useCallback((event) => {
    if (!todoSidebarDragState.current.active) return;
    const delta = event.clientX - todoSidebarDragState.current.startX;
    const nextWidth = Math.min(
      MAX_TODO_SIDEBAR_WIDTH,
      Math.max(MIN_TODO_SIDEBAR_WIDTH, todoSidebarDragState.current.startWidth + delta)
    );
    setTodoSidebarWidth(nextWidth);
  }, []);

  const handleTodoResizeEnd = useCallback(() => {
    if (!todoSidebarDragState.current.active) return;
    todoSidebarDragState.current = {
      ...todoSidebarDragState.current,
      active: false
    };
    document.removeEventListener('mousemove', handleTodoResizeMove);
    document.removeEventListener('mouseup', handleTodoResizeEnd);
  }, [handleTodoResizeMove]);

  const handleTodoResizeStart = useCallback((event) => {
    event.preventDefault();
    todoSidebarDragState.current = {
      active: true,
      startX: event.clientX,
      startWidth: todoSidebarWidth
    };
    document.addEventListener('mousemove', handleTodoResizeMove);
    document.addEventListener('mouseup', handleTodoResizeEnd);
  }, [todoSidebarWidth, handleTodoResizeMove, handleTodoResizeEnd]);
  const handleCsvPreviewResizeMove = useCallback((event) => {
    if (!csvPreviewDragState.current.active) return;
    const delta = event.clientY - csvPreviewDragState.current.startY;
    const nextHeight = Math.min(
      MAX_CSV_PREVIEW_HEIGHT,
      Math.max(MIN_CSV_PREVIEW_HEIGHT, csvPreviewDragState.current.startHeight + delta)
    );
    setCsvPreviewHeight(nextHeight);
  }, []);

  const handleCsvPreviewResizeEnd = useCallback(() => {
    if (!csvPreviewDragState.current.active) return;
    csvPreviewDragState.current = {
      ...csvPreviewDragState.current,
      active: false
    };
    document.removeEventListener('mousemove', handleCsvPreviewResizeMove);
    document.removeEventListener('mouseup', handleCsvPreviewResizeEnd);
  }, [handleCsvPreviewResizeMove]);

  const handleCsvPreviewResizeStart = useCallback((event) => {
    event.preventDefault();
    csvPreviewDragState.current = {
      active: true,
      startY: event.clientY,
      startHeight: csvPreviewHeight
    };
    document.addEventListener('mousemove', handleCsvPreviewResizeMove);
    document.addEventListener('mouseup', handleCsvPreviewResizeEnd);
  }, [csvPreviewHeight, handleCsvPreviewResizeMove, handleCsvPreviewResizeEnd]);

  // Markdown preview resize handlers
  const handleMarkdownPreviewResizeMove = useCallback((event) => {
    if (!markdownPreviewDragState.current.active) return;
    const delta = event.clientY - markdownPreviewDragState.current.startY;
    const nextHeight = Math.min(
      MAX_CSV_PREVIEW_HEIGHT,
      Math.max(MIN_CSV_PREVIEW_HEIGHT, markdownPreviewDragState.current.startHeight + delta)
    );
    setMarkdownPreviewHeight(nextHeight);
  }, []);

  const handleMarkdownPreviewResizeEnd = useCallback(() => {
    if (!markdownPreviewDragState.current.active) return;
    markdownPreviewDragState.current = {
      ...markdownPreviewDragState.current,
      active: false
    };
    document.removeEventListener('mousemove', handleMarkdownPreviewResizeMove);
    document.removeEventListener('mouseup', handleMarkdownPreviewResizeEnd);
  }, [handleMarkdownPreviewResizeMove]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (markdownPreviewDragState.current.active) {
        handleMarkdownPreviewResizeMove(e);
      }
    };
    const handleMouseUp = () => {
      if (markdownPreviewDragState.current.active) {
        handleMarkdownPreviewResizeEnd();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMarkdownPreviewResizeMove, handleMarkdownPreviewResizeEnd]);

  const csvColumnResizeMoveRef = useRef(null);
  const csvColumnResizeEndRef = useRef(null);

  csvColumnResizeMoveRef.current = (event) => {
    if (!csvColumnDragState.current.active || csvColumnDragState.current.columnIndex === null) return;
    event.preventDefault();
    const delta = event.clientX - csvColumnDragState.current.startX;
    const nextWidth = Math.min(
      MAX_CSV_COLUMN_WIDTH,
      Math.max(MIN_CSV_COLUMN_WIDTH, csvColumnDragState.current.startWidth + delta)
    );
    const tabId = csvColumnDragState.current.tabId;
    const columnIndex = csvColumnDragState.current.columnIndex;
    setCsvColumnWidths(prev => {
      const newTabWidths = prev[tabId] ? [...prev[tabId]] : [];
      newTabWidths[columnIndex] = nextWidth;
      return { ...prev, [tabId]: newTabWidths };
    });
  };

  csvColumnResizeEndRef.current = () => {
    if (!csvColumnDragState.current.active) return;
    csvColumnDragState.current = {
      active: false,
      startX: 0,
      startWidth: DEFAULT_CSV_COLUMN_WIDTH,
      columnIndex: null,
      tabId: null
    };
    document.removeEventListener('mousemove', csvColumnResizeMoveRef.current);
    document.removeEventListener('mouseup', csvColumnResizeEndRef.current);
    if (typeof document !== 'undefined') {
      document.body.style.userSelect = '';
    }
  };

  const handleCsvColumnAutoFit = useCallback((columnIndex) => {
    if (!activeTab || !csvPreviewStats) return;

    // Get all values in this column (header + all rows)
    const header = csvPreviewStats.header[columnIndex] || `Column ${columnIndex + 1}`;
    const columnValues = [header];

    csvPreviewStats.rows.forEach(row => {
      const value = row[columnIndex] || '';
      columnValues.push(String(value));
    });

    // Calculate max length - rough estimate: 8px per character + padding
    const maxContentLength = Math.max(...columnValues.map(v => v.length));
    const estimatedWidth = Math.min(
      MAX_CSV_COLUMN_WIDTH,
      Math.max(MIN_CSV_COLUMN_WIDTH, maxContentLength * 8 + 32)
    );

    // Update the width
    setCsvColumnWidths(prev => {
      const newTabWidths = prev[activeTab.id] ? [...prev[activeTab.id]] : [];
      newTabWidths[columnIndex] = estimatedWidth;
      return { ...prev, [activeTab.id]: newTabWidths };
    });
  }, [activeTab, csvPreviewStats]);

  const handleCsvColumnResizeStart = useCallback((event, columnIndex) => {
    if (!activeTab) return;
    event.preventDefault();
    event.stopPropagation();
    const currentWidths = csvColumnWidths[activeTab.id] || [];
    csvColumnDragState.current = {
      active: true,
      startX: event.clientX,
      startWidth: currentWidths[columnIndex] || DEFAULT_CSV_COLUMN_WIDTH,
      columnIndex,
      tabId: activeTab.id
    };
    document.addEventListener('mousemove', csvColumnResizeMoveRef.current);
    document.addEventListener('mouseup', csvColumnResizeEndRef.current);
    if (typeof document !== 'undefined') {
      document.body.style.userSelect = 'none';
    }
  }, [activeTab, csvColumnWidths]);

  const navActiveClass = theme === 'dark'
    ? 'border-indigo-500 bg-gray-900 text-white'
    : 'border-indigo-500 bg-indigo-50 text-indigo-700';

  const navInactiveClass = theme === 'dark'
    ? 'border-transparent text-gray-400 hover:bg-gray-900 hover:text-white'
    : 'border-transparent text-gray-500 hover:bg-indigo-50 hover:text-indigo-700';

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden" data-theme={theme}>
      <div className="w-16 bg-gray-950 border-r border-gray-800 flex flex-col relative">
        <div className="flex items-center justify-center px-3 py-3 text-sm text-gray-400 uppercase tracking-wide">
          <LogoMark size={26} />
        </div>
        <div className="flex-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = currentPanel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPanel(item.id)}
                title={item.label}
                className={`w-full flex items-center justify-center px-3 py-3 border-l-4 transition-colors ${active ? navActiveClass : navInactiveClass}`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
        <div className="border-t border-gray-800 px-2 py-2 flex justify-center">
          <div className="relative w-full" ref={settingsMenuRef}>
            <button
              onClick={() => setIsSettingsOpen(open => !open)}
              title="Settings"
              className="w-full flex items-center justify-center px-2 py-2 rounded-md text-sm border border-transparent hover:border-indigo-400 text-gray-300 hover:text-white transition-colors"
              aria-haspopup="menu"
              aria-expanded={isSettingsOpen}
            >
              <Settings className="w-5 h-5" />
            </button>
            {isSettingsOpen && (
              <div className="absolute left-full bottom-0 ml-2 w-64 bg-gray-950 border border-gray-800 rounded-lg shadow-2xl z-40">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                  <span className="text-sm font-semibold">Settings</span>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-gray-400 hover:text-white"
                    aria-label="Close settings menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 space-y-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Theme</p>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: 'dark', label: 'Dark Mode', icon: <Moon className="w-4 h-4" /> },
                        { id: 'light', label: 'Light Mode', icon: <Sun className="w-4 h-4" /> }
                      ].map(option => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setTheme(option.id);
                            setIsSettingsOpen(false);
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded border ${
                            theme === option.id ? 'border-indigo-400 bg-indigo-900/40 text-white' : 'border-gray-700 hover:border-indigo-300 text-gray-300'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {option.icon}
                            {option.label}
                          </span>
                          {theme === option.id && <span className="text-xs text-indigo-200 uppercase tracking-wide">Active</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Editor</p>
                    <button
                      onClick={() => setAutoPairingEnabled(!autoPairingEnabled)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded border ${
                        autoPairingEnabled ? 'border-indigo-400 bg-indigo-900/40 text-white' : 'border-gray-700 hover:border-indigo-300 text-gray-300'
                      }`}
                    >
                      <span className="text-left">
                        <div className="font-medium">Auto-pairing</div>
                        <div className="text-xs text-gray-400 mt-0.5">Automatically close brackets and quotes</div>
                      </span>
                      <span className={`text-xs uppercase tracking-wide ${autoPairingEnabled ? 'text-indigo-200' : 'text-gray-500'}`}>
                        {autoPairingEnabled ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </div>
                  <div className="pt-3 border-t border-gray-800">
                    <a
                      href="/privacy.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-indigo-400 hover:bg-gray-900 rounded transition-colors"
                    >
                      <Info className="w-4 h-4" />
                      <span className="text-sm">Privacy Policy</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderPanel()}
      </div>

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded shadow-lg py-1 z-50"
          style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              closeTab(tabContextMenu.tabId);
              setTabContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Close Tab
          </button>
          <button
            onClick={() => {
              closeOtherTabs(tabContextMenu.tabId);
              setTabContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Close Other Tabs
          </button>
          <button
            onClick={() => {
              closeTabsToRight(tabContextMenu.tabId);
              setTabContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
            disabled={tabs.findIndex(t => t.id === tabContextMenu.tabId) === tabs.length - 1}
          >
            <X className="w-4 h-4" />
            Close Tabs to Right
          </button>
          <div className="border-t border-gray-700 my-1" />
          <button
            onClick={() => {
              closeAllTabs();
              setTabContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Close All Tabs
          </button>
        </div>
      )}

      {/* AI Fix Diff Viewer Modal */}
      {aiFixState.showDiff && aiFixState.fixedContent && aiFixState.originalContent && (
        <DiffViewerModal
          original={aiFixState.originalContent}
          fixed={aiFixState.fixedContent}
          onAccept={handleAcceptFix}
          onReject={handleRejectFix}
          theme={theme}
        />
      )}

      {/* AI Settings Modal */}
      {showAISettings && (
        <AISettingsModal
          settings={aiSettings}
          onSave={handleSaveAISettings}
          onClose={() => setShowAISettings(false)}
          theme={theme}
          isDesktop={isDesktop()}
          desktopAIService={aiService}
          onTriggerSetupWizard={handleTriggerSetupWizard}
        />
      )}

      {/* Ollama Setup Wizard (Desktop Only) */}
      {showOllamaSetup && aiService && (
        <OllamaSetupWizard
          onClose={() => setShowOllamaSetup(false)}
          onComplete={() => {
            localStorage.setItem('betternotepad-ollama-setup-completed', 'true');
            setShowOllamaSetup(false);
          }}
          theme={theme}
          desktopAIService={aiService}
          defaultModel={aiSettings.ollamaModel}
        />
      )}
    </div>
  );
};

export default BetterTextPad;
