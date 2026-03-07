# Visual Redesign Proposals
## OpenClaw Desktop
*Date: 2026‑03‑07*

This document details specific redesign suggestions for each of the 7 tabs, based on the proposed Design System.

---

## 1. Sidebar Navigation

### Current State
- Dark gray background (`bg-gray-900`).
- Circular icon buttons with `text-gray-400`.
- Active tab highlighted with blue background (`bg-blue-500`).
- Tooltips on hover.

### Issues
1. Inactive icons too dim (low contrast).
2. Active tab background fills entire circle; icon color white – works but could be more refined.
3. No visual separation between sidebar and main content (border missing).
4. Hit area smaller than 44×44px (WCAG touch target minimum).

### Proposed Redesign
1. **Background:** Keep dark (`bg-gray-900`) for contrast.
2. **Icons:**
   - Inactive: `text-gray-300` (higher contrast).
   - Active: `bg-primary` (blue), `text-white`.
3. **Size:** Increase button size to `w-12 h-12` (48px).
4. **Border:** Add subtle right border `border-r border-gray-800` to separate from content.
5. **Animation:** Smooth transition on active state (scale‑up 105%).
6. **Accessibility:**
   - Add `aria-label` for each tab.
   - Implement `role="tablist"` and `role="tab"`.

### Visual Example
```
[🫂] Chat        (active: blue bg, white icon)
[📄] Logs        (inactive: gray icon)
[📁] Files       ...
[✏️] Editor
[🤖] Agents
[🔗] Integrations
[⚙️] Settings
```

---

## 2. Top Bar

### Current State
- White background, full width.
- Gateway status (dot + text), gateway controls (start/stop).
- User info (avatar + name) on right.
- Border bottom `border‑b border‑gray‑200`.

### Issues
1. Visually flat; no elevation to separate from content.
2. Gateway status dot uses color alone (red/green).
3. Controls are plain text links; could be more button‑like.
4. No responsive behavior on window resize.

### Proposed Redesign
1. **Elevation:** Add `shadow‑sm` (subtle drop shadow).
2. **Gateway Status:** Use badge component:
   - `bg‑success` + "Online", `bg‑error` + "Offline", `bg‑warning` + "Connecting".
   - Include icon (circle‑fill) and text.
3. **Controls:** Use small outline buttons (`px‑3 py‑1 text‑sm`).
4. **User Menu:** Move to right edge, add dropdown trigger (chevron down).
5. **Responsive:** On narrow windows, hide user name, keep avatar.

### Layout
```
[OpenClaw Logo]  |  [Gateway: ● Online] [Start] [Stop] [Restart]  |  [👤 Dmitry ▼]
```

---

## 3. Chat Tab

### Current State
- Messages in bubbles (gray background).
- Input at bottom: textarea + send button.
- Timestamps on hover.
- "Thinking" indicator (animated ellipsis).

### Issues
1. User vs assistant bubbles look identical (both `bg‑gray‑100`).
2. No visual hierarchy within conversation.
3. Send button is plain (`bg‑blue‑500`); could be more distinctive.
4. No message actions (copy, regenerate).
5. Input area lacks character count, formatting hints.

### Proposed Redesign
1. **Message Differentiation:**
   - User: `bg‑primary text‑white` (blue bubble, aligned right).
   - Assistant: `bg‑surface border border‑border` (white card, aligned left).
2. **Bubble Style:** Rounded corners (`rounded‑xl`), max‑width 80%.
3. **Message Actions:** Hover reveals icons (copy, regenerate) at top‑right of bubble.
4. **Input Area:**
   - Use `flex` layout with `textarea` growing.
   - Send button as primary button with icon only (paper‑plane).
   - Add `aria‑label="Send message"`.
5. **Thinking Indicator:** Use animated gradient bar or pulsating dots.

### Visual Example
```
[User]                                      [2:30 PM]
Hello, can you help me?                     [Copy 🔗]

[Assistant]                                 [2:31 PM]
Sure, what do you need?                     [Copy 🔗]

[Thinking...] (animated)
```

---

## 4. Logs Tab

### Current State
- Dark background (`bg‑gray‑900`).
- Monospace logs with colored text (green stdout, red stderr).
- Auto‑scroll toggle.
- Clear logs button.

### Issues
1. Long lines wrap awkwardly; horizontal scroll needed.
2. No filtering by log level (info, warn, error).
3. No timestamps in default view.
4. No search within logs.

### Proposed Redesign
1. **Layout:** Split into two panels:
   - Left: log entries with horizontal scrolling.
   - Right: log details (timestamp, level, source) when entry selected.
2. **Filter Bar:** Add buttons to filter by level (All, Info, Warn, Error, Debug).
3. **Search Box:** Add `input` with placeholder "Search logs...".
4. **Line Wrapping:** Option to toggle wrap/no‑wrap.
5. **Accessibility:** Use `aria‑live="polite"` for new entries.

### Visual Example
```
[All] [Info] [Warn] [Error] [Debug]  [Search...] [Wrap] [Clear]

[2026‑03‑07 17:45:23] INFO  Gateway started on port 3000
[2026‑03‑07 17:45:24] ERROR Failed to connect to database
```

---

## 5. Files Tab

### Current State
- List of files with icons (file‑alt, folder‑open).
- File name, maybe size.
- "Open" button (not yet functional).

### Issues
1. No visual distinction between files and folders.
2. No grid view.
3. No sorting (name, size, date).
4. No breadcrumb navigation for subfolders.
5. No preview pane.

### Proposed Redesign
1. **View Toggle:** Grid vs list view.
2. **File Cards (grid):**
   - Icon (size based on file type).
   - Name (truncated).
   - Metadata (size, modified date) in small text.
3. **List View:** Table with columns (Name, Size, Modified, Actions).
4. **Breadcrumb:** Above file list, clickable path.
5. **Preview Pane:** Right side shows file content (text) or thumbnail (image).
6. **Actions:** Open, Rename, Delete (with confirmation).

### Visual Example
```
📁 workspace/  ⏵  📁 openclaw‑desktop/  ⏵  [design‑system]

[Grid] [List]

[📄] index.html      12 KB  2026‑03‑07
[📄] renderer.js     45 KB  2026‑03‑07
[📁] assets/          --    2026‑03‑07
```

---

## 6. Agents Tab

### Current State
- Grid of cards, each with:
  - Agent name, description.
  - Status dot (green/red).
  - CPU/RAM usage (placeholder).
  - Buttons: Start, Stop, Restart.

### Issues
1. Cards have inconsistent heights.
2. Status dot small and color‑only.
3. No grouping by agent type.
4. No details view.

### Proposed Redesign
1. **Card Consistency:** Fixed height, equal width.
2. **Status Badge:** Use badge with icon + text (Running, Stopped).
3. **Grouping:** Tabs for "All", "Running", "Stopped", "By Type".
4. **Details Panel:** Click card to expand details (logs, configuration).
5. **Actions:** Move Start/Stop/Restart to hover‑reveal buttons to reduce clutter.

### Visual Example
```
[All] [Running] [Stopped] [By Type]

🤖 Agent‑1
Description: Handles file processing
Status: ● Running
CPU: 12% | RAM: 45 MB
[Stop] [Restart] [Logs]

🤖 Agent‑2
Description: API gateway
Status: ● Stopped
[Start] [Edit] [Logs]
```

---

## 7. Integrations Tab

### Current State
- Placeholder content "Integrations".

### Proposed Design
1. **Integration Tiles:** Card grid, each tile:
   - Logo/icon.
   - Name.
   - Brief description.
   - Status (Connected / Not connected).
   - "Connect" button.
2. **Categories:** Group by type (Messaging, Storage, AI, etc.).
3. **Search/Filter:** By name, category.

### Visual Example
```
[All] [Messaging] [Storage] [AI]

[🔗] Telegram
Send notifications to Telegram
Status: Connected
[Disconnect]

[🔗] GitHub
Sync with repositories
Status: Not connected
[Connect]
```

---

## 8. Settings Tab

### Current State
- Basic form fields (not fully implemented).

### Proposed Design
1. **Sidebar Navigation:** Left‑hand categories (General, Appearance, Agents, Security, Advanced).
2. **Content Panel:** Form for selected category.
3. **Consistent Inputs:** Use design‑system input components.
4. **Save/Reset:** Sticky footer with "Save Changes" and "Reset" buttons.

### Visual Example
```
[General]    [Appearance]    [Agents]    [Security]    [Advanced]

Appearance
◉ Light theme
◉ Dark theme
◉ Auto (system)

Font size:  [Small ● Medium ● Large]

[Save Changes] [Reset]
```

---

## Implementation Notes

### Phasing
1. **Phase 1 (Quick Wins):** Sidebar, top bar, chat bubble colors.
2. **Phase 2 (Medium):** Logs filtering, files grid/list, agent card redesign.
3. **Phase 3 (Full):** Integrations, settings, advanced features.

### Design Tokens
All colors, spacing, and components should reference the Design System Guide.

### Accessibility
Each change must be evaluated for WCAG compliance (contrast, semantics, keyboard navigation).

---

*Proposals are subject to discussion with the development team.*