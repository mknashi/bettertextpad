// Simple line-based diff utility
export const generateDiff = (original, fixed) => {
  const originalLines = original.split('\n');
  const fixedLines = fixed.split('\n');

  const diff = [];
  const maxLines = Math.max(originalLines.length, fixedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i];
    const fixedLine = fixedLines[i];

    if (origLine === undefined && fixedLine !== undefined) {
      // Line added
      diff.push({
        type: 'added',
        lineNum: i + 1,
        original: null,
        fixed: fixedLine
      });
    } else if (origLine !== undefined && fixedLine === undefined) {
      // Line removed
      diff.push({
        type: 'removed',
        lineNum: i + 1,
        original: origLine,
        fixed: null
      });
    } else if (origLine !== fixedLine) {
      // Line modified
      diff.push({
        type: 'modified',
        lineNum: i + 1,
        original: origLine,
        fixed: fixedLine
      });
    } else {
      // Line unchanged
      diff.push({
        type: 'unchanged',
        lineNum: i + 1,
        original: origLine,
        fixed: fixedLine
      });
    }
  }

  return diff;
};

// Calculate diff statistics
export const getDiffStats = (diff) => {
  const stats = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0
  };

  diff.forEach(line => {
    stats[line.type]++;
  });

  return stats;
};

// Get character-level diff for a line (simple word highlighting)
export const getInlineDiff = (original, fixed) => {
  if (!original || !fixed) return null;

  const origWords = original.split(/(\s+)/);
  const fixedWords = fixed.split(/(\s+)/);

  const origDiff = [];
  const fixedDiff = [];

  const maxWords = Math.max(origWords.length, fixedWords.length);

  for (let i = 0; i < maxWords; i++) {
    const origWord = origWords[i];
    const fixedWord = fixedWords[i];

    if (origWord !== fixedWord) {
      if (origWord !== undefined) {
        origDiff.push({ text: origWord, changed: true });
      }
      if (fixedWord !== undefined) {
        fixedDiff.push({ text: fixedWord, changed: true });
      }
    } else {
      origDiff.push({ text: origWord, changed: false });
      fixedDiff.push({ text: fixedWord, changed: false });
    }
  }

  return { original: origDiff, fixed: fixedDiff };
};
