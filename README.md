# dsh-ai-credit-hub

A draggable panel for DeepSeek Harness that gathers the remaining credit balance of the AI tools you have connected locally into one small strip, expandable to a per-package breakdown.

```
⣿ ●豆包 1,924  ●千问 2,100  ●WorkBuddy 217.28
  ●Trae 900     ●Qoder 800            ⟳  详情
```

Click **详情** to open a larger box upward with the plan, account, every credit package's remaining/total and its expiry or reset time. Drag anywhere on the strip (or the box's title bar) to move it; position and expanded state are remembered.

## Where the numbers come from

It **signs in nowhere and calls no vendor**. It reads the read-only local routes that the connector plugins already publish:

| Tool | Route read |
| --- | --- |
| 豆包 / Doubao | `/plugins/dsh-connect-doubao/quota` |
| 千问工作 / Qwen Work | `/plugins/dsh-qwenwork-connect/status` |
| WorkBuddy | `/plugins/dsh-connect-workbuddy/usage` |
| Trae | `/plugins/dsh-connect-trae/usage` |
| Qoder | `/plugins/dsh-qoder-connect/status` (falls back to `global/status`) |

**This plugin is a companion, not a standalone tool.** Each row appears only when the matching connector plugin is installed and signed in. With none of them installed, the panel does not render at all. A connector that is installed but signed out is labelled as such instead of showing zero.

It never writes a credential, never talks to an upstream API, and adds no agent tools or prompt text.

## Install

```sh
dsh plugin --profile <your-profile> add dsh-ai-credit-hub
```

Or through the plugin manager in the app. The panel appears in the right part of the window once a page is loaded and at least one connector answers.

## Notes

- **The total** appears only in the expanded box. It sums the credits that were actually read; credits are not interchangeable between tools, so it is only a size comparison. Whenever a tool could not be read, it is prefixed with `≥` and shows its coverage (`3/5`). A transient failure keeps the last known number and labels it as stale.
- **Only these five connectors are supported.** Adding another tool means one adapter in `client.js`; a tool that publishes no balance route (Loomy, Volcengine) cannot be shown with a real number.
- The numbers are what the connector reports; how often each connector refreshes its own cache is up to that plugin.
- The remembered position lives in the browser's localStorage.

## Development

No build step: `client.js` is a plain lazy-CJS module and `index.js` registers nothing on the Host. `node tools/check.mjs` reads the live connector routes and renders both panel states against them, so adapter and render regressions show up without a browser.

## License

MIT