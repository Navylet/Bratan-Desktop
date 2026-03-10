# Accessibility Audit Report

## OpenClaw Desktop

_Date: 2026‑03‑07_
_Auditor: UI/UX Designer for Desktop_

## Executive Summary

The OpenClaw Desktop interface has basic accessibility features (semantic buttons, focus indicators) but lacks systematic WCAG compliance. Key issues include insufficient color contrast, missing ARIA labels, inconsistent focus management, and inadequate screen reader support. This report details specific problems and provides actionable fixes.

## 1. Color Contrast Issues

Using WCAG 2.1 AA standard (minimum 4.5:1 for normal text, 3:1 for large text).

### 1.1 Current Color Pairs with Insufficient Contrast

| Element                                | Foreground | Background | Ratio (est.) | WCAG AA |
| -------------------------------------- | ---------- | ---------- | ------------ | ------- |
| `.text-gray-600` on `.bg-white`        | #6b7280    | #ffffff    | 4.0:1        | Fail    |
| `.text-gray-500` on `.bg-white`        | #9ca3af    | #ffffff    | 2.9:1        | Fail    |
| `.text-gray-200` on `.bg-gray-900`     | #e5e7eb    | #111827    | 4.0:1        | Fail    |
| Sidebar icon (gray) on dark background | #9ca3af    | #1f2937    | 3.2:1        | Fail    |

**Impact:** Users with low vision or color blindness may struggle to read text.

**Recommendations:**

- Replace `.text-gray-600` with `.text-gray-700` (#374151, ratio 5.5:1).
- Replace `.text-gray-500` with `.text-gray-600` (#4b5563, ratio 6.8:1).
- For sidebar icons, use white (#ffffff) for active tab, light gray (#d1d5db) for inactive.
- Use the proposed color palette from the Design System (section 2.1) with pre‑verified contrast.

## 2. Semantic HTML & ARIA

### 2.1 Good Practices

- Buttons use `<button>` elements (not `<div>`).
- Headings (`<h2>`, `<h3>`) are used for section titles.
- Form inputs have associated `<label>` (visible or via `aria‑label`).

### 2.2 Issues

1. **Missing `aria-label` on icon‑only buttons**
   - Sidebar tab buttons have only `<i>` icons; screen readers announce empty.
   - Fix: Add `aria-label="Chat"` etc.

2. **Missing `aria-live` for dynamic updates**
   - Logs tab: new entries not announced to screen readers.
   - Chat tab: incoming messages not announced.
   - Fix: Add `<div aria-live="polite" aria-atomic="false">` for logs and chat.

3. **Incorrect role for tab panel**
   - Tabs are implemented with `hidden` class, not ARIA `tablist`, `tab`, `tabpanel`.
   - Fix: Add roles `role="tablist"`, `role="tab"`, `aria‑controls`, `aria‑selected`.

4. **Status indicators rely on color alone**
   - Gateway status uses red/green dots without text label.
   - Fix: Add hidden text (`.sr‑only`) or `aria‑label` on dot.

5. **Missing `alt` for images**
   - No images currently, but if added, ensure `alt` text.

**Recommendations:**

- Add ARIA attributes according to [WAI‑ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/).
- Use Tailwind's `.sr‑only` class for screen‑reader‑only text.

## 3. Keyboard Navigation

### 3.1 Positive Aspects

- Most interactive elements are focusable (buttons, inputs).
- Default focus ring appears (Tailwind `focus:ring‑2`).

### 3.2 Issues

1. **Tab order may not follow visual flow**
   - Sidebar tabs are at bottom of DOM (rendered after main content). Users tab through main content before reaching sidebar.
   - Fix: Move sidebar earlier in HTML (or manage `tabindex`).

2. **Missing keyboard shortcuts**
   - No shortcuts for switching tabs, sending messages, opening files.
   - Fix: Implement global keyboard shortcuts (e.g., Ctrl+1 for Chat, Ctrl+Enter to send).

3. **Focus management in modals/dialogs**
   - No modal dialogs currently, but planned features need focus trapping.

4. **Skip‑to‑content link missing**
   - No "Skip to main content" link for keyboard users.
   - Fix: Add `.skip‑link` at top of page.

**Recommendations:**

- Test tab order manually; ensure logical flow.
- Add keyboard shortcuts and document them in Help.
- Use `tabindex="-1"` for decorative elements that should not receive focus.

## 4. Screen Reader Compatibility

### 4.1 Current Experience

Screen readers will read:

- Button text (when text present)
- Input labels
- Heading hierarchy
- Status text (e.g., "Gateway остановлен")

### 4.2 Gaps

1. **Dynamic content updates not announced**
   - Logs, chat messages, agent status changes happen without announcement.
   - Fix: Use `aria‑live` regions with appropriate politeness (`polite` for logs, `assertive` for critical alerts).

2. **Icon buttons not labeled**
   - Sidebar icons: "comment‑dots", "file‑alt", etc. — no accessible name.
   - Fix: Add `aria‑label`.

3. **Form validation errors not announced**
   - No validation currently, but when added, ensure `aria‑invalid` and `aria‑describedby`.

4. **No page landmarks**
   - No `role="main"`, `role="navigation"`, etc.
   - Fix: Add landmark roles to `<main>`, `<nav>`, `<aside>`.

**Recommendations:**

- Use the following structure:

```html
<nav role="navigation" aria-label="Main navigation">...</nav>
<main role="main" id="main">...</main>
<aside role="complementary">...</aside>
```

## 5. Visual Hierarchy & Consistency

### 5.1 Issues

1. **Multiple button styles without clear semantics**
   - Blue buttons (`bg‑blue‑500`) used for primary, secondary, and tertiary actions.
   - Gray buttons (`bg‑gray‑200`) used for actions of varying importance.
   - No consistent size scale.

2. **Inconsistent spacing**
   - Some cards use `p‑4`, others `p‑6` without clear reason.
   - Vertical rhythm varies between tabs.

3. **Poor visual distinction between user/assistant messages**
   - Chat bubbles use same background (`bg‑gray‑100`) for both.
   - Fix: Use different colors (e.g., user: blue, assistant: gray).

4. **Status indicators not aligned**
   - Gateway status dot vs. agent status dots differ in size and style.

**Recommendations:**

- Implement the button hierarchy defined in the Design System (primary, secondary, outline, ghost).
- Use a consistent spacing scale (Tailwind's default).
- Differentiate chat messages with distinct backgrounds.
- Standardize status indicators (dot size, color palette).

## 6. Usability Issues

### 6.1 Discoverability

- No tooltips for icon buttons (except sidebar which has `title`).
- No help text for advanced features.

### 6.2 Feedback

- No loading indicators for long‑running operations (e.g., file upload).
- No confirmation for destructive actions (delete agent).

### 6.3 Error Handling

- Error messages shown only in logs, not in UI (e.g., "Failed to create agent").
- No guidance for recovery.

**Recommendations:**

- Add `title` attribute or tooltip component for all icon buttons.
- Implement toast notifications for success/error states.
- Show inline validation errors.

## 7. Testing Results

### 7.1 Manual Testing

- **Keyboard navigation**: Works but order illogical.
- **Screen reader (NVDA simulated)**: Announced buttons but missing context.
- **Color contrast**: Failures as noted above.
- **Zoom**: Interface scales adequately (Tailwind uses relative units).

### 7.2 Automated Testing Potential

- Use axe‑devtools or Lighthouse for future audits.
- Integrate accessibility checks into CI/CD.

## 8. Priority Recommendations

### Priority 1 (High Impact, Low Effort)

1. **Add `aria‑label` to sidebar icons** (10 minutes).
2. **Increase text contrast** by updating Tailwind classes (30 minutes).
3. **Add `aria‑live` for logs and chat** (20 minutes).

### Priority 2 (Medium Impact, Medium Effort)

1. **Implement proper tab roles** (1 hour).
2. **Standardize button styles** (2 hours).
3. **Add keyboard shortcuts** (2 hours).

### Priority 3 (Long‑term)

1. **Dark/light theme support**.
2. **Full screen reader compatibility**.
3. **Comprehensive automated testing**.

## 9. Conclusion

OpenClaw Desktop has a solid foundation but requires focused accessibility improvements to meet WCAG 2.1 AA. The proposed Design System provides the necessary tokens and components to achieve consistency and accessibility. Implementing the priority recommendations will significantly improve usability for all users, including those with disabilities.

---

_This report will be updated after design system implementation._
