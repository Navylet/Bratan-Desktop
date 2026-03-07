# UI/UX Design System Guide for OpenClaw Desktop

## 1. Current State Analysis

### 1.1 Overview
OpenClaw Desktop is an Electron application with 7 tabs: Chat, Logs, Files, Editor, Agents, Integrations, Settings. The UI uses Tailwind CSS via CDN with custom inline styles. No dedicated design system exists.

### 1.2 Color Palette (Current)
Extracted from index.html:
- **Primary Blue:** `bg-blue-500` (#3b82f6), `text-blue-700` (#1d4ed8)
- **Gray Scale:** `bg-gray-50` (#f9fafb), `bg-gray-100` (#f3f4f6), `bg-gray-200` (#e5e7eb), `bg-gray-300` (#d1d5db), `bg-gray-400` (#9ca3af), `bg-gray-500` (#6b7280), `bg-gray-600` (#4b5563), `bg-gray-900` (#111827)
- **Status Colors:** Green (`bg-green-500`), Red (`bg-red-500`), Yellow (`bg-yellow-500`)
- **Text Colors:** `text-gray-900`, `text-gray-600`, `text-gray-500`, `text-gray-200`

### 1.3 Typography (Current)
- **Font Family:** Inter (Google Fonts), fallback to sans-serif
- **Font Weights:** 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Font Sizes:** Tailwind defaults (text-sm, text-lg, text-xl)

### 1.4 Spacing (Current)
Tailwind's default spacing scale (0.25rem increments). Used: p-2, p-3, p-4, px-3, py-1, m-*, etc.

### 1.5 Components (Current)
- **Sidebar tabs:** circular buttons with icons, hover states
- **Top bar:** status indicators, gateway controls
- **Chat:** message bubbles, input field
- **Logs:** colored entries (stdout green, stderr red)
- **Files:** file list items with icons
- **Agents:** card grid with status dots
- **Buttons:** various styles (primary blue, secondary gray, outline)

### 1.6 Accessibility Issues (Preliminary)
- **Color Contrast:** Some gray text on gray backgrounds may not meet WCAG AA (4.5:1). Need verification.
- **Semantic HTML:** Usage of `<button>` for tabs is good, but could improve ARIA labels.
- **Focus Indicators:** Tailwind's default focus rings likely present (focus:ring-2 focus:ring-blue-500). Need to ensure keyboard navigation.
- **Screen Readers:** Missing aria-labels for icons, status updates not announced.

### 1.7 Visual Hierarchy
- **Strengths:** Clear tab separation, distinct status colors, consistent spacing.
- **Weaknesses:** 
  - Inconsistent button sizes (some small, some large)
  - Multiple shades of blue used without clear semantic meaning
  - Gray text on gray background may reduce readability
  - No clear visual distinction between primary and secondary actions

## 2. Design System Proposal

### 2.1 Color Palette (Proposed)

#### Light Theme
| Role | Hex | Tailwind Class | Usage |
|------|-----|----------------|-------|
| Primary | #2563eb | `bg-primary` | Primary buttons, active states |
| Primary Dark | #1d4ed8 | `bg-primary-dark` | Hover states |
| Secondary | #6b7280 | `bg-secondary` | Secondary buttons, less important text |
| Accent | #8b5cf6 | `bg-accent` | Accent elements, highlights |
| Success | #10b981 | `bg-success` | Positive status, confirmations |
| Warning | #f59e0b | `bg-warning` | Warnings, pending states |
| Error | #ef4444 | `bg-error` | Errors, destructive actions |
| Background | #f9fafb | `bg-background` | Main background |
| Surface | #ffffff | `bg-surface` | Cards, panels, modals |
| Border | #e5e7eb | `border-border` | Borders, separators |
| Text Primary | #111827 | `text-primary` | Main text |
| Text Secondary | #6b7280 | `text-secondary` | Secondary text |
| Text Muted | #9ca3af | `text-muted` | Placeholders, disabled text |

#### Dark Theme (Optional Future)
| Role | Hex | Tailwind Class |
|------|-----|----------------|
| Primary | #3b82f6 | `dark:bg-primary` |
| Background | #111827 | `dark:bg-background` |
| Surface | #1f2937 | `dark:bg-surface` |
| Text Primary | #f9fafb | `dark:text-primary` |

All colors tested for WCAG AA contrast (minimum 4.5:1 for text).

### 2.2 Typography (Proposed)

#### Font Stack
- **Primary:** Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- **Monospace:** 'JetBrains Mono', 'Cascadia Code', 'Menlo', 'Monaco', monospace (for logs, code editor)

#### Scale (Tailwind Classes)
- **Display (h1):** `text-4xl` (2.25rem) / 2.5rem line height / font-semibold (600)
- **Heading (h2):** `text-2xl` (1.5rem) / 2rem line height / font-semibold
- **Subheading (h3):** `text-xl` (1.25rem) / 1.75rem line height / font-medium
- **Title (h4):** `text-lg` (1.125rem) / 1.5rem line height / font-medium
- **Body Large:** `text-base` (1rem) / 1.5rem line height / font-normal
- **Body:** `text-sm` (0.875rem) / 1.25rem line height / font-normal
- **Caption:** `text-xs` (0.75rem) / 1rem line height / font-normal
- **Code:** `text-sm` font-mono

### 2.3 Spacing Scale
Keep Tailwind's default 0.25rem scale (0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64). Use consistent spacing tokens.

### 2.4 Components Specification

#### Buttons
**Primary Button:**
- Background: `bg-primary`
- Text: white, font-medium
- Padding: `px-4 py-2`
- Border radius: `rounded-lg`
- Hover: `bg-primary-dark`
- Focus: `ring-2 ring-primary ring-offset-2`
- Disabled: `opacity-50 cursor-not-allowed`

**Secondary Button:**
- Background: `bg-surface border border-border`
- Text: `text-primary`
- Hover: `bg-gray-100`

**Outline Button:**
- Background: transparent
- Border: `border border-primary`
- Text: `text-primary`
- Hover: `bg-primary bg-opacity-10`

**Ghost Button:**
- Background: transparent
- Text: `text-secondary`
- Hover: `bg-gray-100`

**Sizes:**
- Small: `px-3 py-1 text-sm`
- Medium: `px-4 py-2`
- Large: `px-6 py-3 text-lg`

#### Input Fields
- Background: white
- Border: `border border-border`
- Border radius: `rounded-lg`
- Padding: `px-4 py-2`
- Focus: `border-primary ring-2 ring-primary ring-offset-2`
- Error state: `border-error text-error`

#### Cards
- Background: white
- Border: `border border-border`
- Border radius: `rounded-lg`
- Shadow: `shadow-sm`
- Padding: `p-4` or `p-6`

#### Tabs
**Sidebar Tabs:**
- Inactive: `text-secondary hover:bg-gray-100`
- Active: `bg-primary text-white` (or `bg-primary bg-opacity-10 text-primary border-r-4 border-primary`)

**Horizontal Tabs:**
- Use underline indicator

#### Status Indicators
- Dot: `w-3 h-3 rounded-full`
- Online: `bg-success`
- Offline: `bg-error`
- Idle: `bg-warning`
- Busy: `bg-accent`

### 2.5 Accessibility Guidelines

#### Color Contrast
- All text must have contrast ratio ≥ 4.5:1 against background.
- Use [contrast checker](https://webaim.org/resources/contrastchecker/) for validation.
- Avoid using color alone to convey information (e.g., status should have text label).

#### Semantic HTML
- Use proper heading hierarchy (h1 → h6).
- Buttons must have accessible names (text content or aria-label).
- Form inputs must have associated labels (visible or aria-label).
- Use ARIA roles where appropriate (tablist, tab, tabpanel).

#### Keyboard Navigation
- All interactive elements must be focusable.
- Focus indicators must be visible (Tailwind's focus:ring).
- Tab order should follow visual flow.
- Provide keyboard shortcuts for power users.

#### Screen Reader Support
- Add aria-live regions for dynamic updates (logs, notifications).
- Use aria-describedby for complex controls.
- Provide alternative text for icons (aria-label on button).

### 2.6 Design Principles

1. **Clarity:** Interface should be self‑explanatory, with clear visual hierarchy.
2. **Consistency:** Same components look and behave the same across all tabs.
3. **Efficiency:** Minimize clicks for common actions, provide shortcuts.
4. **Accessibility:** Design for everyone, including users with disabilities.
5. **Adaptability:** Support different screen sizes (responsive where possible) and future theming.

## 3. Visual Redesign Proposals

### 3.1 Sidebar
**Current:** Dark gray background, circular icon buttons.
**Proposal:**
- Keep dark background for contrast.
- Increase hit area (size 44×44px minimum).
- Add subtle tooltips on hover (already present via title).
- Active tab: blue background with icon color white.

### 3.2 Top Bar
**Current:** White background, gateway status and controls, user info.
**Proposal:**
- Add subtle shadow to separate from content.
- Improve gateway status indicator: use badge component with icon.
- Move user info to right edge with avatar dropdown (future).

### 3.3 Chat Tab
**Current:** Message bubbles, simple input.
**Proposal:**
- Add typing indicator when assistant is "thinking".
- Add message timestamps (already present).
- Improve visual distinction between user/assistant messages (different background colors).
- Add quick actions (copy message, regenerate).

### 3.4 Logs Tab
**Current:** Dark background with colored entries.
**Proposal:**
- Keep dark theme for logs (good for readability).
- Add log level filtering buttons.
- Improve line wrapping and monospace font.

### 3.5 Files Tab
**Current:** File list with icons.
**Proposal:**
- Add grid/list view toggle.
- Add file size, modified date columns.
- Add search filter.
- Double-click to open in editor (planned).

### 3.6 Agents Tab
**Current:** Card grid with status dots.
**Proposal:**
- Add agent actions (stop, restart, view logs).
- Add CPU/memory usage indicators (future).
- Group agents by type.

### 3.7 Integrations & Settings Tabs
**Current:** Basic (not fully implemented).
**Proposal:**
- Use consistent card layout for integration tiles.
- Settings: categorized sections with descriptive labels.

## 4. Implementation Steps

### Phase 1: Design System Foundation
1. Define CSS custom properties (CSS variables) for colors, typography, spacing.
2. Create a Tailwind configuration file (`tailwind.config.js`) with extended theme.
3. Replace inline CDN with local Tailwind build for better customization.

### Phase 2: Component Refactoring
1. Create reusable button components with variant classes.
2. Standardize card, input, tab styles.
3. Update sidebar and top bar to use new design tokens.

### Phase 3: Accessibility Improvements
1. Add ARIA attributes where missing.
2. Test color contrast and fix issues.
3. Ensure keyboard navigation works.

### Phase 4: Enhanced Features
1. Implement dark/light theme toggle.
2. Add responsive design for smaller windows.
3. Polish animations and transitions.

## 5. Prototype Mockups

*(Will be created as wireframes or screenshots after approval.)*

---

*Document created by UI/UX Designer for OpenClaw Desktop.*
*Date: 2026‑03‑07*