import React, { useMemo, useRef, useEffect, useState } from 'react';
import { X, Check, XCircle } from 'lucide-react';
import { generateDiff, getDiffStats, getInlineDiff } from '../utils/DiffUtils';

const DiffViewerModal = ({ original, fixed, onAccept, onReject, theme }) => {
  const diff = useMemo(() => generateDiff(original, fixed), [original, fixed]);
  const stats = useMemo(() => getDiffStats(diff), [diff]);

  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const [syncScroll, setSyncScroll] = useState(true);
  const scrollingSideRef = useRef(null);

  // Synchronized scrolling
  useEffect(() => {
    if (!syncScroll) return;

    const handleLeftScroll = () => {
      if (scrollingSideRef.current === 'right') return;
      scrollingSideRef.current = 'left';
      if (rightPanelRef.current && leftPanelRef.current) {
        rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop;
      }
      setTimeout(() => { scrollingSideRef.current = null; }, 50);
    };

    const handleRightScroll = () => {
      if (scrollingSideRef.current === 'left') return;
      scrollingSideRef.current = 'right';
      if (leftPanelRef.current && rightPanelRef.current) {
        leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;
      }
      setTimeout(() => { scrollingSideRef.current = null; }, 50);
    };

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;

    if (leftPanel && rightPanel) {
      leftPanel.addEventListener('scroll', handleLeftScroll);
      rightPanel.addEventListener('scroll', handleRightScroll);

      return () => {
        leftPanel.removeEventListener('scroll', handleLeftScroll);
        rightPanel.removeEventListener('scroll', handleRightScroll);
      };
    }
  }, [syncScroll]);

  const getDiffLineClass = (type, theme, side) => {
    const baseClass = 'font-mono text-sm leading-6 px-2 py-1 whitespace-pre-wrap break-all min-h-[28px] flex items-start border-l-2';

    if (theme === 'dark') {
      switch (type) {
        case 'added':
          return `${baseClass} ${side === 'right' ? 'bg-green-900/30 border-green-600' : 'bg-gray-800/50 border-transparent'}`;
        case 'removed':
          return `${baseClass} ${side === 'left' ? 'bg-red-900/30 border-red-600' : 'bg-gray-800/50 border-transparent'}`;
        case 'modified':
          return `${baseClass} bg-blue-900/20 border-blue-600`;
        default:
          return `${baseClass} text-gray-300 border-transparent`;
      }
    } else {
      switch (type) {
        case 'added':
          return `${baseClass} ${side === 'right' ? 'bg-green-100 border-green-500' : 'bg-gray-50 border-transparent'}`;
        case 'removed':
          return `${baseClass} ${side === 'left' ? 'bg-red-100 border-red-500' : 'bg-gray-50 border-transparent'}`;
        case 'modified':
          return `${baseClass} bg-blue-50 border-blue-500`;
        default:
          return `${baseClass} text-gray-700 border-transparent`;
      }
    }
  };

  const getLineIndicator = (type, side) => {
    if (type === 'added' && side === 'right') return '+';
    if (type === 'removed' && side === 'left') return '-';
    if (type === 'modified') return '•';
    return ' ';
  };

  // Render inline character-level diff for modified lines
  const renderInlineDiff = (text, isChanged, theme) => {
    if (!isChanged) {
      return <span>{text}</span>;
    }

    return (
      <span className={
        theme === 'dark'
          ? 'bg-blue-600/40 px-0.5 rounded'
          : 'bg-blue-300/60 px-0.5 rounded'
      }>
        {text}
      </span>
    );
  };

  const renderModifiedLine = (line, side, theme) => {
    const text = side === 'left' ? line.original : line.fixed;
    if (!text) return ' ';

    if (line.type !== 'modified') {
      return text;
    }

    // Get character-level diff
    const inlineDiff = getInlineDiff(line.original, line.fixed);
    if (!inlineDiff) return text;

    const words = side === 'left' ? inlineDiff.original : inlineDiff.fixed;
    return (
      <>
        {words.map((word, idx) => (
          <React.Fragment key={idx}>
            {renderInlineDiff(word.text, word.changed, theme)}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className={`w-full max-w-[95vw] h-[90vh] rounded-lg shadow-2xl flex flex-col ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-3 ${
              theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
            }`}>
              <span>AI-Suggested Fix</span>
              <span className={`text-xs font-normal px-3 py-1 rounded-full ${
                theme === 'dark'
                  ? 'bg-purple-900/40 text-purple-300'
                  : 'bg-purple-100 text-purple-700'
              }`}>
                Diff View
              </span>
            </h2>
            <div className={`flex gap-4 mt-2 text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {stats.added > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-green-500">+{stats.added}</span>
                  <span>additions</span>
                </span>
              )}
              {stats.removed > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-red-500">-{stats.removed}</span>
                  <span>deletions</span>
                </span>
              )}
              {stats.modified > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-blue-500">•{stats.modified}</span>
                  <span>changes</span>
                </span>
              )}
              <span className="text-gray-500">|</span>
              <span>{stats.unchanged} unchanged</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
                className="w-4 h-4"
              />
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Sync Scroll
              </span>
            </label>

            <button
              onClick={onReject}
              className={`p-2 rounded transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diff Content - Side by Side */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Original */}
          <div className="flex-1 flex flex-col border-r border-gray-700">
            <div className={`px-4 py-2 font-semibold text-xs uppercase tracking-wide border-b flex items-center justify-between ${
              theme === 'dark'
                ? 'bg-gray-900 text-gray-400 border-gray-700'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              <span>Original (With Errors)</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${
                theme === 'dark' ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700'
              }`}>
                BEFORE
              </span>
            </div>
            <div
              ref={leftPanelRef}
              className={`flex-1 overflow-auto ${
                theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
              }`}
              style={{ scrollBehavior: syncScroll ? 'auto' : 'smooth' }}
            >
              {diff.map((line, idx) => {
                // Skip added lines in left panel
                if (line.type === 'added') {
                  return (
                    <div
                      key={idx}
                      className={`font-mono text-sm leading-6 px-2 py-1 min-h-[28px] ${
                        theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/50'
                      }`}
                    >
                      <span className="opacity-0">placeholder</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={getDiffLineClass(line.type, theme, 'left')}
                  >
                    <span className={`inline-block w-8 text-right mr-3 select-none flex-shrink-0 ${
                      theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {line.lineNum}
                    </span>
                    <span className={`inline-block w-4 mr-2 select-none flex-shrink-0 font-bold ${
                      line.type === 'removed'
                        ? 'text-red-500'
                        : line.type === 'modified'
                          ? 'text-blue-500'
                          : 'text-gray-500'
                    }`}>
                      {getLineIndicator(line.type, 'left')}
                    </span>
                    <span className={`flex-1 ${
                      theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      {renderModifiedLine(line, 'left', theme)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel - Fixed */}
          <div className="flex-1 flex flex-col">
            <div className={`px-4 py-2 font-semibold text-xs uppercase tracking-wide border-b flex items-center justify-between ${
              theme === 'dark'
                ? 'bg-gray-900 text-gray-400 border-gray-700'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              <span>AI-Fixed Version</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${
                theme === 'dark' ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700'
              }`}>
                AFTER
              </span>
            </div>
            <div
              ref={rightPanelRef}
              className={`flex-1 overflow-auto ${
                theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
              }`}
              style={{ scrollBehavior: syncScroll ? 'auto' : 'smooth' }}
            >
              {diff.map((line, idx) => {
                // Skip removed lines in right panel
                if (line.type === 'removed') {
                  return (
                    <div
                      key={idx}
                      className={`font-mono text-sm leading-6 px-2 py-1 min-h-[28px] ${
                        theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/50'
                      }`}
                    >
                      <span className="opacity-0">placeholder</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={getDiffLineClass(line.type, theme, 'right')}
                  >
                    <span className={`inline-block w-8 text-right mr-3 select-none flex-shrink-0 ${
                      theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {line.lineNum}
                    </span>
                    <span className={`inline-block w-4 mr-2 select-none flex-shrink-0 font-bold ${
                      line.type === 'added'
                        ? 'text-green-500'
                        : line.type === 'modified'
                          ? 'text-blue-500'
                          : 'text-gray-500'
                    }`}>
                      {getLineIndicator(line.type, 'right')}
                    </span>
                    <span className={`flex-1 ${
                      theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      {renderModifiedLine(line, 'right', theme)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${
          theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className={`flex items-start gap-2 text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            <span className="text-blue-500">ℹ️</span>
            <div>
              <p className="font-medium">Review changes before accepting</p>
              <p className="text-xs mt-1">
                Original content will be preserved in a new tab •
                <span className={theme === 'dark' ? 'text-green-400' : 'text-green-600'}> Green</span> = Added,
                <span className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}> Red</span> = Removed,
                <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}> Blue</span> = Modified
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onReject}
              className={`flex items-center gap-2 px-5 py-2.5 rounded transition-colors font-medium ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              <XCircle className="w-4 h-4" />
              Reject Changes
            </button>

            <button
              onClick={onAccept}
              className={`flex items-center gap-2 px-5 py-2.5 rounded transition-colors font-medium ${
                theme === 'dark'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Check className="w-4 h-4" />
              Accept Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffViewerModal;
