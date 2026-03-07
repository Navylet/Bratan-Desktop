# Prototype Mockups
## OpenClaw Desktop Key Screens
*Date: 2026‑03‑07*

This document provides wireframe‑style mockups for the redesigned OpenClaw Desktop interface. These are textual representations to guide implementation.

---

## Mockup 1: Main Layout (Chat Tab)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌──────┐  OpenClaw Desktop                           [👤 Dmitry ▼]  │
│ │  🫂  │  Gateway: ● Online  [Start] [Stop] [Restart]               │
│ └──────┘                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───┐ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🫂 │ │  Chat                                                   │ │
│ │   │ │                                                          │ │
│ │   │ │  [User]                             [2:30 PM]            │ │
│ │   │ │  Hello, can you help me?               [Copy 🔗]         │ │
│ │   │ │                                                          │ │
│ │   │ │  [Assistant]                          [2:31 PM]          │ │
│ │   │ │  Sure, what do you need?               [Copy 🔗]         │ │
│ │   │ │                                                          │ │
│ │   │ │  [Thinking...] (animated)                                 │ │
│ │   │ │                                                          │ │
│ │   │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ 📄 │ │  │ Type your message...                               │ │ │
│ │   │ │  │                                                     │ │ │
│ │   │ │  └─────────────────────────────────────────[📤 Send]───┘ │ │
│ │ 📁 │ │                                                          │ │
│ │ ✏️ │ └──────────────────────────────────────────────────────────┘ │
│ │ 🤖 │                                                              │
│ │ 🔗 │                                                              │
│ │ ⚙️ │                                                              │
│ └───┘                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
1. Sidebar (7 tabs, active Chat highlighted blue).
2. Top bar with gateway status and user menu.
3. Chat messages differentiated by color (blue for user, white for assistant).
4. Message actions appear on hover (copy icon).
5. Input area with send button.

---

## Mockup 2: Logs Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌──────┐  OpenClaw Desktop                           [👤 Dmitry ▼]  │
│ │  📄  │  Gateway: ● Online  [Start] [Stop] [Restart]               │
│ └──────┘                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───┐ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🫂 │ │  Logs                                                   │ │
│ │   │ │                                                          │ │
│ │   │ │  [All] [Info] [Warn] [Error] [Debug] [Search...]        │ │
│ │   │ │  [Wrap] [Clear]                                         │ │
│ │   │ │                                                          │ │
│ │   │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ 📄 │ │  │ 2026‑03‑07 17:45:23 INFO  Gateway started          │ │ │
│ │   │ │  │ 2026‑03‑07 17:45:24 ERROR Failed to connect         │ │ │
│ │   │ │  │ 2026‑03‑07 17:45:25 WARN  Retrying connection...    │ │ │
│ │   │ │  │ 2026‑03‑07 17:45:26 INFO  Connected to database     │ │ │
│ │   │ │  │ ... (scrollable)                                    │ │ │
│ │ 📁 │ │  └─────────────────────────────────────────────────────┘ │ │
│ │ ✏️ │ │                                                          │ │
│ │ 🤖 │ └──────────────────────────────────────────────────────────┘ │
│ │ 🔗 │                                                              │
│ │ ⚙️ │                                                              │
│ └───┘                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
1. Filter buttons for log levels.
2. Search input.
3. Log entries with colored text (green info, yellow warn, red error).
4. Horizontal scroll for long lines (optional wrap).

---

## Mockup 3: Files Tab (Grid View)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌──────┐  OpenClaw Desktop                           [👤 Dmitry ▼]  │
│ │  📁  │  Gateway: ● Online  [Start] [Stop] [Restart]               │
│ └──────┘                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───┐ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🫂 │ │  Files  [Grid] [List]                                   │ │
│ │   │ │  📁 workspace/  ⏵  📁 openclaw‑desktop/                 │ │
│ │   │ │                                                          │ │
│ │   │ │  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │ │
│ │ 📄 │ │  │  📄      │ │  📄      │ │  📁      │                 │ │
│ │   │ │  │index.html│ │renderer.js│ │ assets/ │                 │ │
│ │   │ │  │ 12 KB    │ │ 45 KB    │ │   --    │                 │ │
│ │ 📁 │ │  └──────────┘ └──────────┘ └──────────┘                 │ │
│ │   │ │                                                          │ │
│ │ ✏️ │ │  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │ │
│ │   │ │  │  📄      │ │  📄      │ │  📄      │                 │ │
│ │ 🤖 │ │  │package.json│tailwind.config│README.md │               │ │
│ │   │ │  │ 1.2 KB   │ │ 0.8 KB   │ │ 2.1 KB   │                 │ │
│ │ 🔗 │ │  └──────────┘ └──────────┘ └──────────┘                 │ │
│ │   │ │                                                          │ │
│ │ ⚙️ │ └──────────────────────────────────────────────────────────┘ │
│ └───┘                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
1. Breadcrumb navigation.
2. Grid/List toggle.
3. File cards with icon, name, size.
4. Folder cards distinguished by folder icon.

---

## Mockup 4: Agents Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌──────┐  OpenClaw Desktop                           [👤 Dmitry ▼]  │
│ │  🤖  │  Gateway: ● Online  [Start] [Stop] [Restart]               │
│ └──────┘                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───┐ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🫂 │ │  Agents  [All] [Running] [Stopped] [By Type]            │ │
│ │   │ │                                                          │ │
│ │   │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ 📄 │ │  │ 🤖 Agent‑1                            ● Running    │ │ │
│ │   │ │  │ Handles file processing                CPU: 12%     │ │ │
│ │   │ │  │                                        RAM: 45 MB   │ │ │
│ │ 📁 │ │  │ [Stop] [Restart] [Logs]                            │ │ │
│ │   │ │  └─────────────────────────────────────────────────────┘ │ │
│ │ ✏️ │ │                                                          │ │
│ │   │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ 🤖 │ │  │ 🤖 Agent‑2                            ● Stopped    │ │ │
│ │   │ │  │ API gateway                           CPU: 0%       │ │ │
│ │   │ │  │                                        RAM: 0 MB    │ │ │
│ │ 🔗 │ │  │ [Start] [Edit] [Logs]                              │ │ │
│ │   │ │  └─────────────────────────────────────────────────────┘ │ │
│ │ ⚙️ │ └──────────────────────────────────────────────────────────┘ │
│ └───┘                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
1. Agent cards with status badge (Running/Stopped).
2. Resource usage indicators.
3. Action buttons per card.
4. Filter tabs.

---

## Mockup 5: Integrations Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌──────┐  OpenClaw Desktop                           [👤 Dmitry ▼]  │
│ │  🔗  │  Gateway: ● Online  [Start] [Stop] [Restart]               │
│ └──────┘                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───┐ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🫂 │ │  Integrations  [All] [Messaging] [Storage] [AI]         │ │
│ │   │ │                                                          │ │
│ │   │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ 📄 │ │  │ 🔗 Telegram                           Connected    │ │ │
│ │   │ │  │ Send notifications to Telegram                       │ │ │
│ │   │ │  │ [Disconnect]                                         │ │ │
│ │ 📁 │ │  └─────────────────────────────────────────────────────┘ │ │
│ │   │ │                                                          │ │
│ │ ✏️ │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │   │ │  │ 🔗 GitHub                            Not connected   │ │ │
│ │   │ │  │ Sync with repositories                                │ │ │
│ │ 🤖 │ │  │ [Connect]                                            │ │ │
│ │   │ │  └─────────────────────────────────────────────────────┘ │ │
│ │ 🔗 │ │                                                          │ │
│ │ ⚙️ │ └──────────────────────────────────────────────────────────┘ │
│ └───┘                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
1. Integration cards with logo/icon.
2. Connection status badge.
3. Description text.
4. Connect/Disconnect button.

---

## Mockup 6: Settings Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌──────┐  OpenClaw Desktop                           [👤 Dmitry ▼]  │
│ │  ⚙️  │  Gateway: ● Online  [Start] [Stop] [Restart]               │
│ └──────┘                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───┐ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🫂 │ │  Settings                                               │ │
│ │   │ │  ┌─────────────────────┐ ┌────────────────────────────┐ │ │
│ │ 📄 │ │  │ [General]          │ │  Appearance                │ │ │
│ │   │ │  │ [Appearance]        │ │  ◉ Light theme             │ │ │
│ │ 📁 │ │  │ [Agents]           │ │  ◉ Dark theme              │ │ │
│ │   │ │  │ [Security]          │ │  ◉ Auto (system)           │ │ │
│ │ ✏️ │ │  │ [Advanced]         │ │                            │ │ │
│ │   │ │  │                     │ │  Font size:                │ │ │
│ │ 🤖 │ │  │                     │ │  [Small ● Medium ● Large] │ │ │
│ │   │ │  │                     │ │                            │ │ │
│ │ 🔗 │ │  │                     │ │  [Save Changes] [Reset]   │ │ │
│ │   │ │  └─────────────────────┘ └────────────────────────────┘ │ │
│ │ ⚙️ │ └──────────────────────────────────────────────────────────┘ │
│ └───┘                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
1. Sidebar navigation for settings categories.
2. Form fields for each category.
3. Save/Reset buttons sticky to panel bottom.

---

## Next Steps

1. Review mockups with development team.
2. Create high‑fidelity designs in Figma/Sketch (optional).
3. Implement component by component, starting with Design System.

---

*Mockups are conceptual; actual implementation may vary.*