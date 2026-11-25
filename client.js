/**
 * Client half of the AI credit hub.
 *
 * A draggable panel in the frame-wide overlay layer that gathers the credit
 * balance every installed connector plugin already publishes over its own
 * read-only local route (`/plugins/<connector>/...`). It collapses to a single
 * summary line and expands to the per-package breakdown. Nothing here talks to
 * an upstream vendor, reads credentials, or writes state: a connector that is
 * not installed answers 404 and is omitted.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ai-credit-hub',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React

    const NS = 'ai-credit-hub'
    const REFRESH_MS = 60_000
    const FETCH_TIMEOUT_MS = 15_000
    const PANEL_WIDTH = 320
    const STRIP_MAX_WIDTH = 330
    const BODY_MAX_HEIGHT = 300
    const BODY_MIN_HEIGHT = 120
    const BOX_CHROME = 60
    const LAYOUT_KEY = 'ai-credit-hub.layout.v3'
    const LEGACY_LAYOUT_KEY = 'ai-credit-hub.layout.v2'

    const STRINGS = {
      zh: {
        title: 'AI 工具积分余额',
        shortTitle: '积分余额',
        total: '合计',
        details: '详情',
        refresh: '刷新',
        collapse: '收起',
        expand: '展开',
        dragHint: '按住标题栏可拖动位置',
        loading: '读取中',
        signedOut: '未登录',
        failed: '读取失败',
        creditsUnit: '积分',
        updatedAt: '更新于 {time}',
        neverUpdated: '尚未刷新',
        autoRefresh: '每 {seconds} 秒自动刷新',
        staleNote: '上次读取的值',
        account: '账号',
        unlimited: '不限量',
        expiresAt: '{date} 到期',
        resetAt: '{date} 重置',
        reasonTimeout: '本地接口读取超时',
        reasonHttp: '本地接口返回 {code}',
        reasonUnknown: '本地接口读取失败',
        totalHint: '已读到工具的剩余积分之和；不同工具的积分不能互换',
        totalHintPartial: '部分工具本次没能读到，合计只是已读到部分的下限',
        refreshHint: '立即重新读取全部额度',
      },
      en: {
        title: 'AI tool credit balances',
        shortTitle: 'Credits',
        total: 'Total',
        details: 'Details',
        refresh: 'Refresh',
        collapse: 'Collapse',
        expand: 'Expand',
        dragHint: 'Drag the title bar to move the panel',
        loading: 'Reading',
        signedOut: 'Signed out',
        failed: 'Unavailable',
        creditsUnit: 'credits',
        updatedAt: 'Updated {time}',
        neverUpdated: 'Not refreshed yet',
        autoRefresh: 'Refreshes every {seconds}s',
        staleNote: 'last known value',
        account: 'Account',
        unlimited: 'Unlimited',
        expiresAt: 'expires {date}',
        resetAt: 'resets {date}',
        reasonTimeout: 'local route timed out',
        reasonHttp: 'local route answered {code}',
        reasonUnknown: 'local route could not be read',
        totalHint: 'Sum of the remaining credits that were read; credits are not interchangeable between tools',
        totalHintPartial: 'Some tools could not be read this time, so the total is only a lower bound',
        refreshHint: 'Read every balance again now',
      },
    }

    const CSS = [
      '.achx{position:fixed;pointer-events:auto;box-sizing:border-box;display:flex;flex-direction:column;min-width:0;max-width:calc(100vw - 16px);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,14px);background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));backdrop-filter:var(--dsw-menu-backdrop-filter,none);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(15,23,42,.18));color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);text-align:left;overflow:hidden}',
      '.achx[data-dragging="true"]{box-shadow:var(--dsw-elevation-prominent,0 18px 40px rgba(15,23,42,.26))}',
      '.achx-strip{display:flex;align-items:flex-start;gap:9px;max-width:min(330px,calc(100vw - 32px));padding:9px 11px;cursor:grab;touch-action:none;user-select:none}',
      '.achx-flow{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px 9px;flex-wrap:wrap}',
      '.achx-spacer{margin-left:auto}',
      '.achx[data-dragging="true"] .achx-strip{cursor:grabbing}',
      '.achx-head{display:flex;align-items:center;gap:6px;padding:6px 8px 6px 6px;cursor:grab;touch-action:none;user-select:none;background:var(--dsw-alias-bg-layer-1)}',
      '.achx[data-dragging="true"] .achx-head{cursor:grabbing}',
      '.achx-item{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;font-size:var(--dsh-content-font-size-secondary,13px);line-height:20px}',
      '.achx-itemName{color:var(--dsw-alias-label-secondary)}',
      '.achx-itemValue{font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.achx-item[data-state="error"] .achx-itemValue,.achx-item[data-state="signed-out"] .achx-itemValue{color:var(--dsw-alias-state-error-primary);font-weight:500}',
      '.achx-item[data-state="stale"] .achx-itemValue{color:var(--dsw-alias-state-warn-primary)}',
      '.achx-grip{flex:none;width:10px;height:16px;margin-top:3px;opacity:.5;background-image:radial-gradient(currentColor 1px,transparent 1px);background-size:5px 5px;background-position:1px 1px;color:var(--dsw-alias-label-secondary)}',
      '.achx-title{flex:none;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.achx-total{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap}',
      '.achx-totalLabel{margin-right:3px;font-weight:400;color:var(--dsw-alias-label-secondary)}',
      '.achx-coverage{font-variant-numeric:tabular-nums;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 2px);color:var(--dsw-alias-label-secondary)}',
      '.achx-text{flex:none;padding:0 4px;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;line-height:22px;cursor:pointer}',
      '.achx-text:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}',
      '.achx-text:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.achx-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;line-height:1;cursor:pointer}',
      '.achx-icon:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}',
      '.achx-icon:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.achx-icon:disabled{cursor:default;opacity:.55}',
      '.achx-body{overflow:auto;max-height:' + BODY_MAX_HEIGHT + 'px;padding:2px 10px 8px;scrollbar-color:var(--dsh-scrollbar-thumb,transparent) transparent}',
      '.achx-row{display:flex;align-items:flex-start;gap:6px;padding:6px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
      '.achx-row:last-of-type{border-bottom:none}',
      '.achx-rowMain{flex:1;min-width:0}',
      '.achx-rowTop{display:flex;align-items:baseline;gap:6px}',
      '.achx-name{color:var(--dsw-alias-label-primary)}',
      '.achx-value{margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.achx-unit{margin-left:2px;font-weight:400;color:var(--dsw-alias-label-secondary)}',
      '.achx-sub{margin-top:1px;color:var(--dsw-alias-label-secondary);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 2px);line-height:15px;overflow-wrap:anywhere}',
      '.achx-detail{display:flex;align-items:baseline;gap:6px;margin-top:1px;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 2px);line-height:15px;color:var(--dsw-alias-label-secondary)}',
      '.achx-detailLabel{max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.achx-detailNum{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.achx-dot{flex:none;width:6px;height:6px;border-radius:50%}',
      '.achx-row .achx-dot{margin-top:6px}',
      '.achx-warn{color:var(--dsw-alias-state-warn-primary)}',
      '.achx-error{color:var(--dsw-alias-state-error-primary)}',
      '.achx-foot{padding-top:6px;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 2px);line-height:15px;color:var(--dsw-alias-label-secondary)}',
    ].join('\n')

    /** A finite number, or null when the value is absent or not numeric. */
    function num(value) {
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    }

    /** A non-empty trimmed string, or ''. */
    function str(value) {
      return typeof value === 'string' && value.trim() !== '' ? value.trim() : ''
    }

    function signedOut(state) {
      return state === 'error' ? 'error' : 'signed-out'
    }

    function formatNumber(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }

    function formatTime(ms) {
      const value = num(ms)
      if (value === null) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    /**
     * Each connector publishes its own vocabulary. Every adapter reduces one
     * payload to the same shape: the remaining credits plus readable detail
     * rows. Adapters read only fields the connectors document as read-only.
     */
    const PROVIDERS = [
      {
        id: 'doubao',
        label: '豆包',
        short: '豆包',
        color: '#3F5BD8',
        url: '/plugins/dsh-connect-doubao/quota',
        read(json) {
          if (!json || json.ok === false) return { state: signedOut('signed-out'), error: str(json && json.error) }
          const windows = json.windows && Array.isArray(json.windows.incentive) ? json.windows.incentive : []
          const details = []
          let remaining = 0
          let size = null
          for (const window of windows) {
            const total = num(window.totalAmount)
            const used = num(window.usedAmount)
            const left = total === null ? null : Math.max(0, total - (used === null ? 0 : used))
            if (left !== null) remaining += left
            if (total !== null) size = (size === null ? 0 : size) + total
            details.push({
              label: str(window.label) || '额度',
              remain: left,
              size: total,
              note: formatTime(window.resetsAt),
              noteKey: 'resetAt',
            })
          }
          if (windows.length === 0) return { state: 'ok', remaining: null, plan: str(json.plan), details: [] }
          return { state: 'ok', remaining, size, plan: str(json.plan), details, exhausted: json.exhausted === true }
        },
      },
      {
        id: 'qwenwork',
        label: '千问工作',
        short: '千问',
        color: '#7A5AF8',
        url: '/plugins/dsh-qwenwork-connect/status',
        read(json) {
          if (!json || json.status !== 'signed-in') return { state: signedOut(json && json.status) }
          const entitlements = Array.isArray(json.entitlements) ? json.entitlements : []
          const credits = entitlements.find((item) => item && item.key === 'credits') || null
          const remaining = num(json.remaining) ?? (credits ? num(credits.remain) : null)
          const details = entitlements.map((item) => ({
            label: str(item.label) || str(item.key) || '额度',
            remain: num(item.remain),
            size: num(json.creditBaseline),
          }))
          return {
            state: 'ok',
            remaining,
            size: num(json.creditBaseline),
            plan: str(json.tierName),
            account: str(json.nickname) || str(json.account),
            details,
          }
        },
      },
      {
        id: 'workbuddy',
        label: 'WorkBuddy',
        short: 'WorkBuddy',
        color: '#12B3A3',
        url: '/plugins/dsh-connect-workbuddy/usage',
        read(json) {
          if (!json || json.status !== 'signed-in') return { state: signedOut(json && json.status) }
          const credits = json.credits || {}
          const packages = Array.isArray(credits.packages) ? credits.packages : []
          const details = packages
            .filter((item) => (num(item.remain) ?? 0) > 0 || (num(item.size) ?? 0) > 0)
            .map((item) => ({
              label: str(item.packageName) || '额度包',
              remain: num(item.remain),
              size: num(item.size),
              note: formatTime(item.expiresAtMs),
              noteKey: 'expiresAt',
            }))
          return {
            state: 'ok',
            remaining: num(credits.total),
            size: null,
            account: str(json.accountName),
            details,
          }
        },
      },
      {
        id: 'trae',
        label: 'Trae',
        short: 'Trae',
        color: '#C9822B',
        url: '/plugins/dsh-connect-trae/usage',
        read(json) {
          if (!json || json.status !== 'signed-in') return { state: signedOut(json && json.status) }
          const credits = json.credits || {}
          const accounts = Array.isArray(credits.accounts) ? credits.accounts : []
          const details = accounts
            .filter((item) => (num(item.remain) ?? 0) > 0 || (num(item.size) ?? 0) > 0)
            .map((item) => ({
              label: str(item.displayDesc) || '额度',
              remain: num(item.remain),
              size: num(item.size),
              note: formatTime(item.expiresAtMs),
              noteKey: 'expiresAt',
            }))
          return {
            state: 'ok',
            remaining: num(credits.available) ?? num(credits.total),
            size: null,
            account: str(json.accountName),
            details,
          }
        },
      },
      {
        id: 'qoder',
        label: 'Qoder',
        short: 'Qoder',
        color: '#B85C7A',
        // The cn and global variants are separate accounts; try the other one
        // before reporting the tool as signed out.
        url: '/plugins/dsh-qoder-connect/status',
        fallbackUrl: '/plugins/dsh-qoder-connect/global/status',
        read(json) {
          if (!json || json.status !== 'signed-in') return { state: signedOut(json && json.status) }
          const credits = json.credits || {}
          const accounts = Array.isArray(credits.accounts) ? credits.accounts : []
          const details = accounts
            .filter((item) => (num(item.remain) ?? 0) > 0 || (num(item.size) ?? 0) > 0)
            .map((item) => ({
              label: str(item.packageName) || '额度包',
              remain: num(item.remain),
              size: num(item.size),
            }))
          const remaining = accounts.reduce((sum, item) => sum + (num(item.remain) ?? 0), 0)
          const size = num(credits.totalSize) ?? accounts.reduce((sum, item) => sum + (num(item.size) ?? 0), 0)
          return {
            state: 'ok',
            remaining,
            size,
            unlimited: credits.unlimited === true,
            details,
          }
        },
      },
    ]

    const warnedRoutes = new Set()

    function warnMissingRoute(provider) {
      if (warnedRoutes.has(provider.id)) return
      warnedRoutes.add(provider.id)
      try {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn('[' + NS + '] ' + provider.url + ' is not served; that connector is not installed or renamed')
        }
      } catch (error) {
        /* logging is best effort */
      }
    }

    async function fetchStatus(provider, url, signal) {
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal.addEventListener('abort', abort)
      const timer = setTimeout(abort, FETCH_TIMEOUT_MS)
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        })
        if (response.status === 404) return { state: 'missing' }
        if (!response.ok) return { state: 'error', error: 'HTTP ' + response.status }
        return provider.read(await response.json())
      } catch (error) {
        if (signal.aborted) return { state: 'aborted' }
        const name = error && error.name
        return { state: 'error', error: name === 'AbortError' ? 'timeout' : String((error && error.message) || error) }
      } finally {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
      }
    }

    async function loadProvider(provider, signal) {
      const primary = await fetchStatus(provider, provider.url, signal)
      if (primary.state === 'aborted') return { id: provider.id, state: 'aborted' }
      if (primary.state === 'missing') {
        warnMissingRoute(provider)
        return { id: provider.id, state: 'missing' }
      }
      if (primary.state !== 'ok' && str(provider.fallbackUrl) && !signal.aborted) {
        const fallback = await fetchStatus(provider, provider.fallbackUrl, signal)
        if (fallback.state === 'ok') return Object.assign({ id: provider.id }, fallback)
      }
      return Object.assign({ id: provider.id }, primary)
    }

    /**
     * The active locale id. The snapshot's own field is `active`; the other
     * shapes are accepted so a renamed field degrades to the same answer
     * instead of silently falling through to English.
     */
    function readActiveLocale(ctx) {
      try {
        const locale = ctx.get('locale')
        if (locale) {
          for (const read of ['getSnapshot', 'getLocale']) {
            if (typeof locale[read] !== 'function') continue
            const snapshot = locale[read]()
            if (!snapshot) continue
            for (const field of ['active', 'locale', 'id', 'current']) {
              const value = snapshot[field]
              if (typeof value === 'string' && value) return value
            }
          }
        }
      } catch (error) {
        /* fall through to the document language */
      }
      try {
        if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) {
          return document.documentElement.lang
        }
      } catch (error) {
        /* fall through to the navigator language */
      }
      try {
        if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
      } catch (error) {
        /* fall through to the default */
      }
      return 'en'
    }

    /**
     * Visible text is resolved on every call, so a language switched while the
     * panel is mounted takes effect without re-registering anything.
     *
     * The bundled dictionary wins over `locale.bind()` for this plugin's own
     * keys: the service resolves through the language's fallback chain, which
     * ends at English, so a locale the chain cannot serve (or a namespace that
     * failed to register) would otherwise turn a Chinese UI into English text.
     * The bound translator still covers keys this dictionary does not define.
     */
    function createTranslator(ctx) {
      const disposers = []
      let bound = null
      try {
        const locale = ctx.get('locale')
        if (locale && typeof locale.register === 'function') {
          // The typed form takes both baseline locales at once, and the extra
          // regional tag keeps a "zh-CN" active locale inside the zh chain.
          try {
            disposers.push(locale.register(NS, { zh: STRINGS.zh, en: STRINGS.en }))
          } catch (error) {
            for (const id of ['zh', 'en']) {
              try {
                disposers.push(locale.register(NS, id, id === 'zh' ? STRINGS.zh : STRINGS.en))
              } catch (inner) {
                /* another generation owns this namespace; its texts are ours too */
              }
            }
          }
          try {
            disposers.push(locale.register(NS, 'zh-CN', STRINGS.zh))
          } catch (error) {
            /* already registered by an earlier generation */
          }
          if (typeof locale.bind === 'function') {
            const candidate = locale.bind(NS)
            if (typeof candidate === 'function') bound = candidate
          }
        }
      } catch (error) {
        bound = null
      }

      const fill = (text, params) => {
        if (!params) return text
        let out = text
        for (const name of Object.keys(params)) out = out.split('{' + name + '}').join(String(params[name]))
        return out
      }

      const translate = (key, params) => {
        const dictionary = /^zh/i.test(readActiveLocale(ctx)) ? STRINGS.zh : STRINGS.en
        if (Object.prototype.hasOwnProperty.call(dictionary, key)) return fill(dictionary[key], params)
        if (bound) {
          try {
            const translated = bound(key, params)
            if (typeof translated === 'string' && translated !== '' && translated !== key) return translated
          } catch (error) {
            /* fall through to the key itself */
          }
        }
        return key
      }

      return {
        t: translate,
        dispose: () => {
          for (const disposer of disposers) {
            try {
              if (typeof disposer === 'function') disposer()
            } catch (error) {
              /* the registry already removed it */
            }
          }
        },
      }
    }

    function hasValue(entry) {
      return entry.state === 'ok' && typeof entry.remaining === 'number' && Number.isFinite(entry.remaining)
    }

    /**
     * The panel is anchored by its bottom-right corner, so the detail box grows
     * upward out of the strip instead of pushing down, and switching between the
     * two keeps that corner where the user put it.
     */
    function defaultLayout() {
      const innerHeight = typeof window === 'undefined' ? 800 : window.innerHeight
      const room = Math.max(80, innerHeight - (BODY_MAX_HEIGHT + BOX_CHROME) - 16)
      return { rx: 16, rb: Math.min(420, room), collapsed: true }
    }

    /**
     * Bounds for the bottom-right anchor.
     *
     * `rx` is the distance from the window's right edge and `rb` the distance
     * from its bottom edge. The right limit uses the panel's own width so the
     * whole panel stays on screen at every supported side — clamping against a
     * smaller constant let the left part of the strip run off the window while
     * the panel still "fit" by its right edge, which is what made dragging feel
     * one-sided.
     */
    function clampLayout(layout) {
      if (typeof window === 'undefined') return layout
      const width = Math.max(PANEL_WIDTH, STRIP_MAX_WIDTH)
      const maxRx = Math.max(8, window.innerWidth - width - 8)
      const maxRb = Math.max(8, window.innerHeight - 44)
      return Object.assign({}, layout, {
        rx: Math.min(Math.max(8, layout.rx), maxRx),
        rb: Math.min(Math.max(8, layout.rb), maxRb),
      })
    }

    function loadLayout() {
      const fallback = defaultLayout()
      try {
        const raw = window.localStorage.getItem(LAYOUT_KEY)
        if (!raw) return fallback
        const parsed = JSON.parse(raw)
        return clampLayout({
          rx: num(parsed.rx) === null ? fallback.rx : parsed.rx,
          rb: num(parsed.rb) === null ? fallback.rb : parsed.rb,
          collapsed: parsed.collapsed !== false,
        })
      } catch (error) {
        return fallback
      }
    }

    function makePanel(t) {
      return function AiCreditHub() {
        const [entries, setEntries] = useState(() => PROVIDERS.map((provider) => ({ id: provider.id, state: 'loading' })))
        const [busy, setBusy] = useState(false)
        const [updatedAt, setUpdatedAt] = useState(0)
        const [layout, setLayout] = useState(loadLayout)
        const [dragging, setDragging] = useState(false)
        const inflight = useRef(null)
        const drag = useRef(null)
        const sectionRef = useRef(null)
        const layoutRef = useRef(layout)
        layoutRef.current = layout

        const save = useCallback((next) => {
          try {
            window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ rx: next.rx, rb: next.rb, collapsed: next.collapsed }))
          } catch (error) {
            /* a blocked localStorage only loses the remembered position */
          }
        }, [])

        const applyLayout = useCallback(
          (next) => {
            const clamped = clampLayout(next)
            layoutRef.current = clamped
            setLayout(clamped)
            return clamped
          },
          [],
        )

        const refresh = useCallback(() => {
          if (inflight.current) inflight.current.abort()
          const controller = new AbortController()
          inflight.current = controller
          setBusy(true)
          Promise.all(PROVIDERS.map((provider) => loadProvider(provider, controller.signal))).then((results) => {
            if (controller.signal.aborted) return
            inflight.current = null
            setBusy(false)
            setEntries((previous) => {
              const before = new Map(previous.map((entry) => [entry.id, entry]))
              return results
                .filter((entry) => entry.state !== 'aborted')
                .map((entry) => {
                  // A transport failure is not a lost login: keep the last known
                  // number and say it is stale instead of blanking the row.
                  if (entry.state !== 'error') return entry
                  const previousEntry = before.get(entry.id)
                  if (!previousEntry || !hasValue(previousEntry)) return entry
                  return Object.assign({}, previousEntry, { stale: true, error: entry.error })
                })
            })
            setUpdatedAt(Date.now())
          })
        }, [])

        useEffect(() => {
          refresh()
          const timer = setInterval(refresh, REFRESH_MS)
          return () => {
            clearInterval(timer)
            if (inflight.current) inflight.current.abort()
          }
        }, [refresh])

        useEffect(() => {
          const onResize = () => applyLayout(layoutRef.current)
          window.addEventListener('resize', onResize)
          return () => window.removeEventListener('resize', onResize)
        }, [applyLayout])

        // One-time move of a layout saved before the panel was bottom-anchored:
        // the old value was the strip's top edge, so the strip's measured height
        // turns it into the same visual place.
        useEffect(() => {
          let stored = null
          try {
            const raw = window.localStorage.getItem(LEGACY_LAYOUT_KEY)
            window.localStorage.removeItem(LEGACY_LAYOUT_KEY)
            if (raw) stored = JSON.parse(raw)
          } catch (error) {
            stored = null
          }
          if (!stored || num(stored.y) === null || !sectionRef.current) return
          const height = sectionRef.current.getBoundingClientRect().height || 0
          const next = applyLayout({
            rx: num(stored.rx) === null ? layoutRef.current.rx : stored.rx,
            rb: window.innerHeight - stored.y - height,
            collapsed: stored.collapsed !== false,
          })
          save(next)
        }, [applyLayout, save])

        const onHeadPointerDown = (event) => {
          if (event.button !== 0 && event.pointerType === 'mouse') return
          const target = event.target
          if (target && typeof target.closest === 'function' && target.closest('button')) return
          drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originRx: layoutRef.current.rx,
            originRb: layoutRef.current.rb,
          }
          setDragging(true)
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch (error) {
            /* capture is an optimisation, not a requirement */
          }
          if (typeof event.preventDefault === 'function') event.preventDefault()
        }

        const onHeadPointerMove = (event) => {
          const state = drag.current
          if (!state || state.pointerId !== event.pointerId) return
          applyLayout({
            rx: state.originRx - (event.clientX - state.startX),
            rb: state.originRb - (event.clientY - state.startY),
            collapsed: layoutRef.current.collapsed,
          })
        }

        const endDrag = (event) => {
          const state = drag.current
          if (!state) return
          drag.current = null
          setDragging(false)
          try {
            if (event && event.currentTarget && typeof event.currentTarget.releasePointerCapture === 'function') {
              event.currentTarget.releasePointerCapture(state.pointerId)
            }
          } catch (error) {
            /* the capture was already released */
          }
          save(layoutRef.current)
        }

        const rows = PROVIDERS.map((provider) => ({
          provider,
          entry: entries.find((item) => item.id === provider.id) || { id: provider.id, state: 'loading' },
        })).filter((row) => row.entry.state !== 'missing')

        const total = rows.reduce((sum, row) => sum + (hasValue(row.entry) ? row.entry.remaining : 0), 0)
        const known = rows.filter((row) => hasValue(row.entry)).length
        const complete = rows.length > 0 && known === rows.length

        const chipText = (entry) => {
          if (hasValue(entry)) return formatNumber(entry.remaining)
          if (entry.state === 'loading') return '…'
          if (entry.state === 'signed-out') return t('signedOut')
          return t('failed')
        }

        const transportReason = (error) => {
          const text = str(error)
          if (text === 'timeout') return t('reasonTimeout')
          const http = /^HTTP (\d+)$/.exec(text)
          if (http) return t('reasonHttp', { code: http[1] })
          return t('reasonUnknown')
        }

        const detailLine = (item) => {
          const pieces = []
          if (item.remain !== null && item.remain !== undefined) {
            pieces.push(item.size !== null && item.size !== undefined ? formatNumber(item.remain) + ' / ' + formatNumber(item.size) : formatNumber(item.remain))
          } else if (item.size !== null && item.size !== undefined) {
            pieces.push(formatNumber(item.size))
          }
          if (str(item.note)) pieces.push(t(item.noteKey || 'expiresAt', { date: item.note }))
          return pieces.join(' · ')
        }

        const renderRow = (row) => {
          const { provider, entry } = row
          const meta = []
          if (entry.state === 'ok') {
            if (str(entry.plan)) meta.push(entry.plan)
            if (entry.unlimited === true) meta.push(t('unlimited'))
            if (str(entry.account)) meta.push(t('account') + ' ' + entry.account)
          }
          const details = Array.isArray(entry.details) ? entry.details : []
          let valueClass = 'achx-value'
          if (hasValue(entry)) {
            if (entry.stale === true) valueClass += ' achx-warn'
          } else if (entry.state === 'signed-out' || entry.state === 'loading') {
            valueClass += ' achx-warn'
          } else {
            valueClass += ' achx-error'
          }
          const notes = []
          if (entry.state === 'loading') notes.push(h('div', { className: 'achx-sub', key: 'loading' }, t('loading') + '…'))
          if (entry.state === 'error') notes.push(h('div', { className: 'achx-sub achx-error', key: 'error' }, transportReason(entry.error)))
          if (entry.stale === true) notes.push(h('div', { className: 'achx-sub achx-warn', key: 'stale' }, t('staleNote') + ' · ' + transportReason(entry.error)))
          if (entry.state === 'signed-out') notes.push(h('div', { className: 'achx-sub achx-warn', key: 'out' }, t('signedOut')))
          return h(
            'div',
            { className: 'achx-row', key: provider.id, 'data-row': provider.id },
            h('span', { className: 'achx-dot', style: { background: provider.color } }),
            h(
              'div',
              { className: 'achx-rowMain' },
              h(
                'div',
                { className: 'achx-rowTop' },
                h('span', { className: 'achx-name' }, provider.label),
                h(
                  'span',
                  { className: valueClass },
                  hasValue(entry) ? formatNumber(entry.remaining) : chipText(entry),
                  hasValue(entry) ? h('span', { className: 'achx-unit' }, t('creditsUnit')) : null,
                ),
              ),
              str(meta.join(' · ')) ? h('div', { className: 'achx-sub' }, meta.join(' · ')) : null,
              details.map((item, index) =>
                h(
                  'div',
                  { className: 'achx-detail', key: String(index) },
                  h('span', { className: 'achx-detailLabel' }, item.label || ''),
                  h('span', { className: 'achx-detailNum' }, detailLine(item)),
                ),
              ),
              notes,
            ),
          )
        }

        const toggle = () => {
          const current = layoutRef.current
          const expanding = current.collapsed === true
          let rb = current.rb
          if (expanding && typeof window !== 'undefined') {
            // The box opens upward: if the panel sits too high for it, bring the
            // shared bottom edge down far enough to keep the whole box on screen.
            const needed = BODY_MIN_HEIGHT + BOX_CHROME
            if (window.innerHeight - rb < needed) rb = Math.max(8, window.innerHeight - needed)
          }
          const next = applyLayout({ rx: current.rx, rb, collapsed: !current.collapsed })
          save(next)
        }

        const stateOf = (entry) => (entry.stale === true ? 'stale' : entry.state)

        const itemTitle = (provider, entry) => {
          const parts = [provider.label]
          if (hasValue(entry)) {
            parts.push(formatNumber(entry.remaining) + ' ' + t('creditsUnit'))
            if (str(entry.plan)) parts.push(entry.plan)
            if (entry.stale === true) parts.push(t('staleNote'))
          } else if (entry.state === 'error') {
            parts.push(transportReason(entry.error))
          } else if (entry.state === 'signed-out') {
            parts.push(t('signedOut'))
          }
          return parts.join(' · ')
        }

        const refreshButton = h(
          'button',
          {
            type: 'button',
            className: 'achx-icon',
            onClick: refresh,
            disabled: busy,
            'aria-busy': busy ? 'true' : 'false',
            'aria-label': t('refresh'),
            title: t('refreshHint'),
          },
          busy ? '…' : '⟳',
        )

        const collapsed = layout.collapsed === true
        const position = { right: layout.rx, bottom: layout.rb }
        // The box grows upward from the shared bottom edge, so its body is capped
        // by the room that exists above it.
        const bodyMax =
          typeof window === 'undefined'
            ? BODY_MAX_HEIGHT
            : Math.max(BODY_MIN_HEIGHT, Math.min(BODY_MAX_HEIGHT, window.innerHeight - layout.rb - BOX_CHROME))
        const dragProps = {
          onPointerDown: onHeadPointerDown,
          onPointerMove: onHeadPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onLostPointerCapture: endDrag,
        }

        const strip = h(
          'div',
          Object.assign({ className: 'achx-strip', title: t('dragHint') }, dragProps),
          h('span', { className: 'achx-grip', 'aria-hidden': true }),
          // The items wrap in their own column beside the grip, so every line
          // starts on the same left edge instead of stepping past the grip.
          h(
            'div',
            { className: 'achx-flow' },
            rows.map((row) =>
              h(
                'span',
                {
                  className: 'achx-item',
                  key: row.provider.id,
                  'data-state': stateOf(row.entry),
                  title: itemTitle(row.provider, row.entry),
                },
                h('span', { className: 'achx-dot', style: { background: row.provider.color } }),
                h('span', { className: 'achx-itemName' }, row.provider.short || row.provider.label),
                h('span', { className: 'achx-itemValue' }, chipText(row.entry)),
              ),
            ),
            h('span', { className: 'achx-spacer' }),
            refreshButton,
            h(
              'button',
              { type: 'button', className: 'achx-text', onClick: toggle, 'aria-expanded': 'false', title: t('expand') },
              t('details'),
            ),
          ),
        )

        const boxHead = h(
          'header',
          Object.assign({ className: 'achx-head', title: t('dragHint') }, dragProps),
          h('span', { className: 'achx-grip', 'aria-hidden': true }),
          h('span', { className: 'achx-title' }, t('shortTitle')),
          h(
            'span',
            { className: 'achx-total', title: complete ? t('totalHint') : t('totalHintPartial') },
            known > 0 ? h('span', { className: 'achx-totalLabel' }, t('total')) : null,
            known > 0 ? (complete ? '' : '≥ ') + formatNumber(total) : t('failed'),
          ),
          known > 0 && !complete ? h('span', { className: 'achx-coverage' }, known + '/' + rows.length) : null,
          refreshButton,
          h(
            'button',
            { type: 'button', className: 'achx-text', onClick: toggle, 'aria-expanded': 'true', title: t('collapse') },
            t('collapse'),
          ),
        )

        const boxBody = h(
          'div',
          { className: 'achx-body', style: { maxHeight: bodyMax } },
          rows.map(renderRow),
          h(
            'div',
            { className: 'achx-foot' },
            (updatedAt ? t('updatedAt', { time: formatTime(updatedAt) }) : t('neverUpdated')) + ' · ' + t('autoRefresh', { seconds: REFRESH_MS / 1000 }),
          ),
        )

        return h(
          'section',
          {
            className: 'achx',
            ref: sectionRef,
            style: collapsed ? position : Object.assign({ width: PANEL_WIDTH }, position),
            'data-dragging': dragging ? 'true' : 'false',
            'data-collapsed': collapsed ? 'true' : 'false',
            'aria-label': t('title'),
          },
          h('style', { key: 'style' }, CSS),
          collapsed ? strip : h(React.Fragment, null, boxHead, boxBody),
        )
      }
    }

    return {
      inject: ['slots'],
      // Pure payload adapters, exposed so a plain Node process can check them
      // against real connector responses without a browser.
      __adapters: PROVIDERS,
      // Pure position math, exposed so the drag bounds are testable without a
      // browser: the panel must stay fully on screen on every side.
      __layout: { clamp: clampLayout, defaults: defaultLayout },
      apply(ctx) {
        const translator = createTranslator(ctx)
        ctx.effect(() => translator.dispose, 'ai-credit-hub locale')
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'ai-credit-hub',
              order: 30,
              label: () => translator.t('title'),
            },
            makePanel(translator.t),
          ),
        )
      },
    }
  },
})
