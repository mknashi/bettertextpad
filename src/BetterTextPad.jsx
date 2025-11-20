import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Plus, Save, Upload, ChevronLeft, ChevronRight, Search, Replace, Code2, StickyNote, CheckSquare, ChevronsLeft, ChevronsRight, GripVertical, Bold, Italic, Underline, Sun, Moon, Settings, ChevronDown, ChevronUp, Info, FileText, Braces, FileCode } from 'lucide-react';
import { marked } from 'marked';

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
  const trimmed = text.trim();
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
  const trimmed = text.trim();
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
  const firstId = 1;
  return {
    tabs: [{ id: firstId, title: '', content: '', images: [] }],
    activeId: firstId,
    nextId: firstId + 1
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
  const sanitizeTabs = (tabs) => tabs.map(tab => ({
    id: typeof tab.id === 'number' ? tab.id : Number(tab.id) || Date.now(),
    title: typeof tab.title === 'string' ? tab.title : '',
    content: typeof tab.content === 'string' ? tab.content : '',
    images: Array.isArray(tab.images) ? tab.images : []
  }));

  try {
    const saved = storage.getItem('betternotepad-notes-state');
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

    const legacyTabs = storage.getItem('betternotepad-notes');
    if (legacyTabs) {
      const parsed = JSON.parse(legacyTabs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const tabs = sanitizeTabs(parsed);
        const ids = tabs.map(tab => Number(tab.id) || 0);
        const legacyActive = Number(storage.getItem('betternotepad-active-note'));
        storage.removeItem('betternotepad-notes');
        storage.removeItem('betternotepad-active-note');
        return {
          tabs,
          activeId: tabs.find(tab => tab.id === legacyActive)?.id ?? tabs[0].id,
          nextId: Math.max(...ids) + 1
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
  const [currentPanel, setCurrentPanel] = useState('dev');
  const initialNotesStateRef = useRef(loadNotesState());
  const initialTodosStateRef = useRef(loadTodosState());
  const [notesTabs, setNotesTabs] = useState(initialNotesStateRef.current.tabs);
  const [activeNoteTabId, setActiveNoteTabId] = useState(initialNotesStateRef.current.activeId);
  const [nextNoteId, setNextNoteId] = useState(initialNotesStateRef.current.nextId);
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
  const syncScrollVisuals = useCallback(() => {
    if (!textareaRef.current) return;
    const scrollTop = textareaRef.current.scrollTop;
    const scrollLeft = textareaRef.current.scrollLeft;

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

  // Load tabs from localStorage on mount
  useEffect(() => {
    const loadTabs = () => {
      const savedTabs = localStorage.getItem('notepad-tabs');
      const savedActiveId = localStorage.getItem('notepad-active-tab');

      if (savedTabs) {
        try {
          const parsed = JSON.parse(savedTabs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTabs(parsed);
            setActiveTabId(savedActiveId ? parseInt(savedActiveId, 10) : parsed[0]?.id);
            setNextId(Math.max(...parsed.map(t => t.id), 0) + 1);
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
      localStorage.setItem('notepad-tabs', JSON.stringify(tabs));
      if (activeTabId !== null) {
        localStorage.setItem('notepad-active-tab', activeTabId.toString());
      }
    }
  }, [tabs, activeTabId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window?.localStorage) return;
    try {
      window.localStorage.setItem('betternotepad-notes-state', JSON.stringify({
        tabs: notesTabs,
        activeId: activeNoteTabId,
        nextId: nextNoteId
      }));
    } catch (error) {
      console.warn('Failed to save notes', error);
    }
  }, [notesTabs, activeNoteTabId, nextNoteId]);

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

    const { tabId, content } = pendingAutoFormat;
    setPendingAutoFormat(null);

    const trimmed = content.trim();
    if (looksLikeJSON(trimmed) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      formatJSON({ tabId, content, autoTriggered: false });
    } else if (looksLikeXML(trimmed) || trimmed.startsWith('<')) {
      formatXML({ tabId, content, autoTriggered: false });
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
    if (!workingContent.trim()) {
      if (!autoTriggered) {
        setErrorMessage(null);
      }
      return false;
    }

    const trimmed = workingContent.trim();
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
    if (!workingContent.trim()) {
      if (!autoTriggered) {
        setErrorMessage(null);
      }
      return false;
    }

    const trimmed = workingContent.trim();
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
      const trimmed = content.trim();
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
    if (errorMessage) {
      setErrorMessage(null);
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

  const saveFile = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    const blob = new Blob([activeTab.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab.title.endsWith('.txt') ? activeTab.title : activeTab.title + '.txt';
    a.click();
    URL.revokeObjectURL(url);

    // Mark as saved
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, isModified: false }
        : tab
    ));
  };

  const openFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const newTabId = nextId;
      const newTab = {
        id: newTabId,
        title: file.name,
        content: content,
        isModified: false,
        filePath: file.name
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTabId);
      setNextId(nextId + 1);

      // Trigger auto-format via useEffect
      setPendingAutoFormat({ tabId: newTabId, content });
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
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
                {collapsed ? '+' : '−'}
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

    // XML auto-closing tags
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

  const activeNoteTab = notesTabs.find(tab => tab.id === activeNoteTabId) || notesTabs[0];
  const activeTodoTab = todoTabs.find(tab => tab.id === activeTodoTabId) || todoTabs[0];

  const createNoteTab = () => {
    const newTab = { id: nextNoteId, title: '', content: '', images: [] };
    setNotesTabs([...notesTabs, newTab]);
    setActiveNoteTabId(newTab.id);
    setNextNoteId(nextNoteId + 1);
  };

  const closeNoteTab = (id) => {
    if (notesTabs.length === 1) return;
    const filtered = notesTabs.filter(tab => tab.id !== id);
    setNotesTabs(filtered);
    if (activeNoteTabId === id) {
      setActiveNoteTabId(filtered[0].id);
    }
  };

  const updateNoteTab = (id, updates) => {
    setNotesTabs(tabs => tabs.map(tab => tab.id === id ? { ...tab, ...updates } : tab));
  };

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

  const addImageAttachmentFromDataURL = (dataUrl) => {
    if (!activeNoteTab || !dataUrl) return;
    updateNoteTab(activeNoteTab.id, {
      images: [...activeNoteTab.images, { id: Date.now(), url: dataUrl }]
    });
  };

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
  const editorLines = activeTab ? activeTab.content.split('\n') : [];
  const isCsvFileName = useMemo(() => {
    const name = (activeTab?.filePath || activeTab?.title || '').toLowerCase();
    return name.endsWith('.csv');
  }, [activeTab?.filePath, activeTab?.title]);
  const isCsvByContent = useMemo(() => {
    if (isCsvFileName) return false;
    if (!activeTab?.content) return false;
    return detectCSVContent(activeTab.content);
  }, [activeTab?.content, isCsvFileName]);
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
    return detectMarkdownContent(activeTab.content, activeTab?.title || '');
  }, [activeTab?.content, activeTab?.title, isMarkdownFileName]);
  const shouldAutoMarkdown = useMemo(() => {
    if (isMarkdownFileName) return true;
    return isMarkdownByContent;
  }, [isMarkdownFileName, isMarkdownByContent]);
  const isMarkdownTab = shouldAutoMarkdown && !isCSVTab; // CSV takes precedence

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
    const trimmed = activeTab.content.trim();
    if (!trimmed) return { type: null, nodes: [] };
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return { type: 'JSON', nodes: buildJSONStructure(activeTab.content) };
    }
    if (trimmed.startsWith('<')) {
      return { type: 'XML', nodes: buildXMLStructure(activeTab.content) };
    }
    return { type: null, nodes: [] };
  }, [activeTab?.content]);

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
      if (serializedExisting.trim() === (activeTab.content || '').trim()) {
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
    if (!activeNoteTab) return null;
    const sidebarStyle = { width: `${Math.round(notesSidebarWidth)}px` };
    return (
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
            <button onClick={createNoteTab} className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-200" title="Create New Note">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" onDoubleClick={(e) => { if (!e.target.closest('[data-note-card]')) createNoteTab(); }}>
          {notesTabs.map(tab => {
            const fallbackTitle = stripHtml(tab.content || '').split(/\s+/).slice(0, 5).join(' ').trim();
            const previewText = stripHtml(tab.content || tab.title || '').slice(0, 80) || 'Untitled';
            return (
              <div
                key={tab.id}
                data-note-card
                className={`px-4 py-3 border-b border-gray-800 cursor-pointer ${tab.id === activeNoteTabId ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
                onClick={() => setActiveNoteTabId(tab.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{tab.title?.trim() || fallbackTitle || 'Untitled'}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{previewText}</p>
                  </div>
                  {notesTabs.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); closeNoteTab(tab.id); }} className="text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
      <div className="px-6 py-4 border-b border-gray-800 space-y-3">
        <input
          type="text"
          value={activeNoteTab.title}
          onChange={(e) => updateNoteTab(activeNoteTab.id, { title: e.target.value })}
          placeholder="Title"
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2" dir="ltr" />
        <RichTextEditor
          value={activeNoteTab.content}
          onChange={(value) => updateNoteTab(activeNoteTab.id, { content: value })}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6" onPaste={(event) => {
        const items = event.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (!file) continue;
            const reader = new FileReader();
            reader.onload = (e) => {
              addImageAttachmentFromDataURL(e.target?.result);
            };
            reader.readAsDataURL(file);
            event.preventDefault();
          }
        }
      }}>
        <div>
          <div className="grid grid-cols-2 gap-3">
            {activeNoteTab?.images?.map(img => (
              <div key={img.id} className="bg-gray-800 rounded border border-gray-700 p-2">
                <img src={img.url} alt="attachment" className="w-full h-32 object-cover rounded" />
                <a href={img.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 block mt-1 truncate">
                  {img.url}
                </a>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500">Paste images directly into the editor area to attach them. URLs typed in the editor become clickable links automatically.</p>
        </div>
      </div>
      </div>
    </div>
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
                    <p className="font-semibold text-sm">{tab.title?.trim() || `List ${tab.id}`}</p>
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
          className="editor-line-numbers text-gray-500 text-right font-mono text-sm px-3 select-none border-r border-gray-700"
          style={{ minWidth: '60px', transform: 'translateZ(0)', paddingTop: editorTopPaddingPx, paddingBottom: '16px' }}
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
                className={`leading-6 px-1 ${hasError ? `${rowTone} font-bold` : ''} ${activeCsvClass}`}
                style={{ minHeight: '24px', backgroundColor }}
              >
                {hasError && <span className={`${accentClass} mr-1`}>●</span>}
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Editor with inline error markers */}
        <div className="flex-1 relative bg-gray-900 overflow-auto font-mono text-sm">
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
            onClick={() => updateCursorPosition()}
            className="absolute inset-0 z-20 w-full h-full bg-transparent text-gray-100 font-mono text-sm resize-none focus:outline-none caret-white"
            placeholder="Start typing..."
            spellCheck={false}
            style={{ lineHeight: '24px', whiteSpace: isCSVTab ? 'pre' : 'pre-wrap', wordBreak: isCSVTab ? 'normal' : 'break-all', overflowX: isCSVTab ? 'auto' : 'hidden', paddingTop: editorTopPaddingPx, paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px' }}
          />
        </div>
      </div>
    );
  };

  const renderDevPanel = () => {
    const structurePaneStyle = { width: `${Math.round(structureWidth)}px` };
    // Only show structure panel for JSON and XML files
    const showStructurePane = !isCSVTab && !isMarkdownTab && structureTree.type !== null;
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

          <label
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
            title="Open files: JSON, XML, CSV, HTML, JS, TXT, and more"
          >
            <Upload className="w-4 h-4" />
            Open File
            <input
              ref={fileInputRef}
              type="file"
              onChange={openFile}
              className="hidden"
              accept=".txt,.json,.xml,.html,.css,.js,.jsx,.md,.log,.csv"
            />
          </label>

          <button
            onClick={saveFile}
            disabled={!activeTab}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${!activeTab ? 'bg-gray-600 cursor-not-allowed opacity-50' : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
            title="Save File"
          >
            <Save className="w-4 h-4" />
            Save
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
                      <span className="text-gray-400">{structureTree.type || 'Plain'}</span>
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
                          className="flex-1 min-w-0 overflow-auto px-6 py-4"
                          style={{ backgroundColor: theme === 'dark' ? '#111827' : '#ffffff' }}
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
            <div className="text-center max-w-md px-6">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Welcome to Better Text Pad</p>
              <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                A powerful code & text editor with support for JSON, XML, CSV, and TXT files
              </p>
              <div className={`text-xs space-y-2 text-left ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>JSON formatter and validator</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>XML editor with syntax highlighting</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>CSV file editor with live preview</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Text files, logs, markdown & more</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Multi-tab editing and auto-save</span>
                </div>
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
                  onClick={() => fileInputRef.current?.click()}
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
              <span>Length: {activeTab.content.length} characters</span>
              <span>Lines: {activeTab.content.split('\n').length}</span>
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
    </div>
  );
};

export default BetterTextPad;
