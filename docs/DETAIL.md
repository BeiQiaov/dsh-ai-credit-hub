# AI credit hub

A draggable panel that keeps the remaining credits of every connected AI tool in one place.

## Placement and controls

- It starts as a **compact strip** in the right part of the window with one segment per tool: `豆包 1,924 · 千问 2,100 · WorkBuddy 217.28 · Trae 900 · Qoder 800`, followed by `⟳` and **Details**.
- The strip has a small maximum width (about 330px), so more tools wrap onto another line instead of stretching the strip.
- **Details** opens a **larger box upward**: its bottom-right corner stays put and the box grows up from the strip, so nothing below it moves. It lists one row per tool with its balance, plan/account, the remaining/total of every credit package, expiry or reset times, and the total. The body scrolls when it overflows, and **Collapse** returns to the strip.
- **Drag**: hold anywhere on the strip (or the box's title bar) to move it. Position and expanded state are remembered across reloads and are only bounded by the window. The corner that is remembered is the bottom-right one, so it stays put when the panel expands or collapses.
- The panel occupies only its own box: the overlay layer is click-through, so it never blocks the interface underneath.
- **⟳** reads everything again; otherwise it refreshes every 60 seconds.

## What it reads

The panel **signs in nowhere and calls no vendor**. It only reads the read-only local routes the installed connector plugins already publish:

| Tool | Source |
| --- | --- |
| Doubao | `GET /plugins/dsh-connect-doubao/quota` |
| Qwen Work | `GET /plugins/dsh-qwenwork-connect/status` |
| WorkBuddy | `GET /plugins/dsh-connect-workbuddy/usage` |
| Trae | `GET /plugins/dsh-connect-trae/usage` |
| Qoder | `GET /plugins/dsh-qoder-connect/status` (falls back to `global/status` when the cn account is signed out) |

A connector that is not installed answers 404 and its row is hidden; a connector that is signed out is labeled as such instead of reporting zero.

## About the total

The total appears only inside the expanded box and sums the remaining credits that were **actually read**. Credits are not interchangeable between tools, so it is only a quick size comparison; whenever a tool could not be read, the total is prefixed with `≥` and shows its coverage (for example `3/5`). When a tool merely hiccups, the panel keeps its last known number and labels it as such.

## Language

The panel's labels follow the current DSH interface language and **switch immediately when you change it in the app** — no page reload. Chinese shows 合计 / 详情 / 收起 / 积分, and English shows the matching English labels.

## Known limitations

- The numbers are what the connector reports; how often each connector refreshes its own cache is up to that plugin, and this panel never triggers an upstream refresh.
- Only the five connectors above are supported. A new tool needs one adapter in this plugin's `client.js`.
- The remembered position lives in this browser's localStorage, so it does not follow a different port or browser.