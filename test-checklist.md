# Better Text Pad - Pre-Deployment Test Checklist

Run these tests before pushing to remote main branch.

## Build & Dependency Tests

- [ ] `npm install` - Install all dependencies without errors
- [ ] `npm run build` - Build succeeds without errors
- [ ] Check build output size is reasonable (dist folder)

## Core Functionality Tests

### Tab Management
- [ ] Create new tab (New button)
- [ ] Close tab (X button)
- [ ] Close all tabs (should show Welcome tab)
- [ ] Close other tabs (context menu)
- [ ] Close tabs to right (context menu)
- [ ] Rename tab (double-click on title)
- [ ] Switch between tabs
- [ ] Drag and drop tab reordering

### File Operations
- [ ] Open file (Upload button)
- [ ] Save file (Download button)
- [ ] File content persists in tabs
- [ ] localStorage saves tabs correctly
- [ ] Refresh page - tabs should restore

### Welcome Tab
- [ ] Welcome tab shows on first load
- [ ] Welcome tab shows when all tabs closed
- [ ] "New" link creates new tab
- [ ] "Open File" link opens file dialog
- [ ] Welcome content is non-editable

## Format & Validation Tests

### JSON Editor
- [ ] Paste valid JSON → Format JSON works
- [ ] Paste invalid JSON → Shows error panel
- [ ] Fix JSON errors → Error panel updates dynamically
- [ ] Fix all errors → Error panel closes
- [ ] Error panel shows multiple errors
- [ ] Click on error → Jumps to error line
- [ ] Manual close error panel (X button)
- [ ] Structure tree shows JSON structure
- [ ] Click structure node → Jumps to location

### XML Editor
- [ ] Paste valid XML → Format XML works
- [ ] Paste invalid XML → Shows error panel
- [ ] Fix XML errors → Error panel updates dynamically
- [ ] Fix all errors → Error panel closes
- [ ] Error panel shows error location
- [ ] Click on error → Jumps to error line
- [ ] Manual close error panel (X button)
- [ ] Structure tree shows XML structure

### CSV Editor
- [ ] Paste CSV data → Detects CSV automatically
- [ ] CSV preview panel shows data in table
- [ ] Edit CSV in bottom panel → Preview updates
- [ ] Collapse/Expand CSV preview works
- [ ] Resize CSV preview panel (drag handle)
- [ ] CSV detection message appears and disappears
- [ ] CSV with headers displays correctly
- [ ] Large CSV files load without freezing

### Markdown Editor
- [ ] Open .md file → Detects markdown
- [ ] Markdown preview shows formatted content
- [ ] Edit markdown → Preview updates
- [ ] Collapse/Expand markdown preview works
- [ ] Resize markdown preview panel (drag handle)
- [ ] Markdown detection message appears
- [ ] Headers, lists, code blocks render correctly
- [ ] Links and images render correctly
- [ ] Tables render correctly

## UI/UX Tests

### Theme
- [ ] Switch to Light theme → All UI elements update
- [ ] Switch to Dark theme → All UI elements update
- [ ] Theme persists after refresh
- [ ] Markdown preview respects theme
- [ ] CSV table respects theme
- [ ] Error panel respects theme

### Editor Features
- [ ] Line numbers display correctly
- [ ] Cursor position shows in status bar
- [ ] Character/word count shows in status bar
- [ ] Bracket matching highlights
- [ ] Syntax highlighting works
- [ ] Find & Replace works
- [ ] Text selection works
- [ ] Copy/Paste works
- [ ] Undo/Redo works

### Panels & Sidebars
- [ ] Structure panel shows/hides correctly
- [ ] Structure panel only shows for JSON/XML
- [ ] Resize structure panel (drag handle)
- [ ] Notes sidebar opens/closes
- [ ] Resize notes sidebar
- [ ] Todo sidebar opens/closes
- [ ] Resize todo sidebar
- [ ] Settings menu opens/closes

### Todo List
- [ ] Add new todo item
- [ ] Mark todo as complete
- [ ] Delete todo item
- [ ] Create new todo list
- [ ] Switch between todo lists
- [ ] Delete todo list
- [ ] Auto-focus on "New Task" input when panel opens
- [ ] Todos persist after refresh

### Notes
- [ ] Create new note
- [ ] Edit note content
- [ ] Delete note
- [ ] Switch between notes
- [ ] Notes persist after refresh
- [ ] Note timestamps update correctly

## Browser Compatibility

- [ ] Test in Chrome/Edge
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test on mobile (responsive)
- [ ] Test with JavaScript disabled (shows noscript message)

## Performance Tests

- [ ] Large file (>1MB) loads without freezing
- [ ] Multiple tabs (10+) don't slow down app
- [ ] Typing is responsive (no lag)
- [ ] Format operations complete quickly
- [ ] localStorage doesn't exceed quota
- [ ] Memory usage stays reasonable

## Error Handling

- [ ] Invalid JSON shows helpful error
- [ ] Invalid XML shows helpful error
- [ ] Network errors handled gracefully
- [ ] localStorage quota exceeded handled
- [ ] Malformed file content handled
- [ ] Browser compatibility issues detected

## Accessibility

- [ ] Keyboard navigation works
- [ ] Tab key moves through interactive elements
- [ ] Enter/Space activates buttons
- [ ] Focus indicators visible
- [ ] Contrast ratios meet WCAG standards
- [ ] Screen reader friendly (aria labels)

## SEO & Meta

- [ ] Page title correct
- [ ] Meta description accurate
- [ ] Open Graph tags present
- [ ] Twitter card tags present
- [ ] Favicon loads
- [ ] Manifest.json valid
- [ ] Robots.txt accessible
- [ ] Sitemap.xml valid

## Known Issues to Watch For

- [ ] No console errors in browser DevTools
- [ ] No React warnings in console
- [ ] No memory leaks (check DevTools Memory)
- [ ] No broken images or 404s
- [ ] No CORS errors
- [ ] No localStorage errors

## Final Checks

- [ ] All commits have meaningful messages
- [ ] No debug code or console.logs left
- [ ] No commented out code blocks
- [ ] Package.json version updated if needed
- [ ] README.md is up to date
- [ ] No sensitive data in code

---

## Quick Test Commands

```bash
# Install dependencies
npm install

# Build production
npm run build

# Check build size
du -sh dist/

# Serve production build locally
npx serve dist/
```

## Pass Criteria

- ✅ All critical tests pass
- ✅ No console errors
- ✅ Build completes successfully
- ✅ Major features work as expected
- ✅ No data loss on page refresh
- ✅ Theme switching works
- ✅ Error handling works properly

## Test Date: _____________
## Tested By: _____________
## Status: ⬜ PASS ⬜ FAIL
## Notes: _________________________________________________________________
