/**
 * Development harness for this bundle (not loaded at runtime).
 *
 *   node tools/check.mjs
 *
 * Reads every connector route the plugin reads — from the running Harness when
 * one answers at the printed origin — and renders the panel's strip and box
 * through a hook-scripted React stub, so adapter and render regressions show up
 * without a browser. The origin is only the default; override it with
 * DSH_ORIGIN=http://127.0.0.1:<port>.
 */
import fs from 'node:fs'

const ORIGIN = process.env.DSH_ORIGIN || 'http://127.0.0.1:57096'
const clientPath = new URL('../client.js', import.meta.url)
const source = fs.readFileSync(clientPath, 'utf8')

globalThis.window = {
  __ModuleLoader__: { load: (spec) => { globalThis.__captured = spec } },
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener() {},
  removeEventListener() {},
  localStorage: {
    store: new Map(),
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null },
    setItem(key, value) { this.store.set(key, value) },
  },
}
globalThis.document = { documentElement: { lang: 'zh-CN' }, body: {}, addEventListener() {}, removeEventListener() {} }
new Function(source)()
const captured = globalThis.__captured
if (!captured) throw new Error('the module loader was not called')

function makeReact(script) {
  let index = 0
  return {
    Fragment: Symbol('Fragment'),
    createElement(type, props, ...children) {
      return { type, props: props || {}, children: children.flat(4).filter((c) => c !== null && c !== undefined && c !== false) }
    },
    useCallback: (fn) => fn,
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: () => ({ current: null }),
    useState: () => {
      const value = script[index]
      index += 1
      return [value, () => {}]
    },
  }
}

function text(node, out = []) {
  if (node === null || node === undefined || node === false) return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const item of node) text(item, out)
    return out
  }
  if (node.type === 'style') return out
  for (const child of node.children || []) text(child, out)
  return out
}

function loadPlugin(React) {
  return captured.factory((id) => {
    if (id === 'react') return React
    if (id === 'react-dom') return { createPortal: (node) => node }
    throw new Error('unexpected require: ' + id)
  })
}

let failures = 0
const fail = (message) => {
  failures += 1
  console.log('FAIL ' + message)
}

console.log('== adapters (origin ' + ORIGIN + ')')
for (const adapter of loadPlugin(makeReact([])).__adapters) {
  let result
  try {
    const response = await fetch(ORIGIN + adapter.url, { headers: { accept: 'application/json' } })
    if (response.status === 404) {
      console.log('SKIP ' + adapter.id.padEnd(10) + ' 404 (connector not installed here)')
      continue
    }
    if (!response.ok) throw new Error('HTTP ' + response.status)
    result = adapter.read(await response.json())
  } catch (error) {
    fail(adapter.id + ' live read: ' + String(error))
    continue
  }
  const good = result.state === 'ok' && Number.isFinite(result.remaining)
  if (!good) fail(adapter.id + ' produced no number: ' + JSON.stringify(result).slice(0, 160))
  console.log((good ? 'OK  ' : 'BAD ') + adapter.id.padEnd(10), 'remaining=' + result.remaining, 'details=' + (result.details || []).length)
}

for (const adapter of loadPlugin(makeReact([])).__adapters) {
  for (const payload of [null, {}, { status: 'signed-out' }, { status: 'error' }, { ok: false }]) {
    try {
      adapter.read(payload)
    } catch (error) {
      fail(adapter.id + ' threw on ' + JSON.stringify(payload) + ': ' + String(error))
    }
  }
}

console.log('== render paths')
const ok = (id, remaining, extra = {}) => Object.assign({ id, state: 'ok', remaining, details: [{ label: id + '包', remain: remaining, size: 1000 }] }, extra)
const all = [ok('doubao', 1924, { plan: '免费体验' }), ok('qwenwork', 2100, { plan: '个人免费版', account: '桥北' }), ok('workbuddy', 217.28), ok('trae', 900), ok('qoder', 800, { unlimited: true })]

function render(script, activeLocaleId, existingLocale) {
  const locale = existingLocale !== undefined ? existingLocale : activeLocaleId === undefined ? null : makeLocaleService(activeLocaleId)
  const instance = loadPlugin(makeReact(script))
  let component = null
  let options = null
  instance.apply({
    get: (name) => (name === 'locale' && locale ? locale : undefined),
    effect: (fn) => {
      fn()
      return () => {}
    },
    slots: {
      inject: (key, callback) => {
        callback()
        return () => {}
      },
      register: (opts, comp) => {
        options = opts
        component = comp
        return () => {}
      },
    },
  })
  if (!component) throw new Error('the component was not registered')
  const tree = component({})
  return { tree, text: text(tree).join(' ').replace(/\s+/g, ' '), options }
}

/**
 * A stand-in for the Client locale service. It reproduces the two behaviours
 * that broke this panel: the snapshot's field is `active`, and the fallback
 * chain ends at English, so anything the chain cannot serve comes back as
 * English text.
 */
function makeLocaleService(activeId) {
  const registered = new Map()
  const state = { active: activeId }
  const service = {
    setActive: (id) => {
      state.active = id
    },
    getSnapshot: () => ({ active: state.active, locales: [{ id: state.active, label: state.active }], revision: 1 }),
    getLocale: () => service.getSnapshot(),
    register: (ns, arg, dict) => {
      if (typeof arg === 'object' && dict === undefined) {
        for (const id of Object.keys(arg)) {
          const key = ns + '\u0000' + id
          if (registered.has(key)) throw new Error('already registered: ' + key)
          registered.set(key, arg[id])
        }
      } else {
        const key = ns + '\u0000' + arg
        if (registered.has(key)) throw new Error('already registered: ' + key)
        registered.set(key, dict)
      }
      return () => {}
    },
    bind: (ns) => (key, params) => {
      // English is the end of every fallback chain: a zh lookup that reaches
      // here means the zh dictionary was never consulted.
      const dict = registered.get(ns + '\u0000en')
      let template = dict && dict[key]
      if (template === undefined) return key
      if (params) for (const name of Object.keys(params)) template = template.split('{' + name + '}').join(String(params[name]))
      return template
    },
  }
  return service
}

const boxOpensUpward = (tree) => {
  const section = find(tree, (node) => node.props && node.props.className === 'achx')
  if (!section) return [[false, 'panel section']]
  const style = section.props.style || {}
  return [
    [style.bottom === 420, 'panel is anchored by its bottom edge'],
    [style.top === undefined && style.y === undefined, 'panel has no top anchor'],
    [style.width === 320, 'expanded box width'],
  ]
}

const scenarios = [
  {
    name: 'strip shows every tool number and the Details control, no total',
    script: [all, false, 1795000000000, { rx: 16, rb: 420, collapsed: true }, false],
    expect: ['豆包', '1,924', '千问', '2,100', 'WorkBuddy', '217.28', 'Trae', '900', 'Qoder', '800', '详情'],
    reject: ['合计', '免费体验', '5,941.28'],
    inspect: (tree) => {
      const section = find(tree, (node) => node.props && node.props.className === 'achx')
      const style = (section && section.props.style) || {}
      return [
        [style.bottom === 420 && style.top === undefined, 'strip is anchored by its bottom edge'],
        [style.width === undefined, 'strip keeps its intrinsic width'],
      ]
    },
  },
  {
    name: 'box shows the total, plans and package details and opens upward',
    script: [all, false, 1795000000000, { rx: 16, rb: 420, collapsed: false }, false],
    expect: ['合计', '5,941.28', '免费体验', '个人免费版', 'doubao包', '1,924 / 1,000', '不限量', '收起'],
    reject: ['≥'],
    inspect: boxOpensUpward,
  },
  {
    name: 'box degrades a timeout, a missing route, a signed-out tool and a stale read',
    script: [
      [ok('doubao', 1924, { plan: '免费体验' }), { id: 'qwenwork', state: 'error', error: 'timeout' }, { id: 'workbuddy', state: 'missing' }, { id: 'trae', state: 'signed-out' }, Object.assign(ok('qoder', 800), { stale: true, error: 'HTTP 500' })],
      false,
      1795000000000,
      { rx: 16, rb: 420, collapsed: false },
      false,
    ],
    expect: ['≥', '2/4', '未登录', '本地接口读取超时', '上次读取的值', '本地接口返回 500'],
    reject: ['WorkBuddy'],
  },
  {
    name: 'strip wraps instead of growing without bound',
    script: [all, false, 1795000000000, { rx: 16, rb: 420, collapsed: true }, false],
    inspect(tree) {
      const strip = find(tree, (node) => node.props && node.props.className === 'achx-strip')
      const flow = find(tree, (node) => node.props && node.props.className === 'achx-flow')
      const css = find(tree, (node) => node.type === 'style')
      const source = css ? css.children.join('') : ''
      const stripRule = /\.achx-strip\{[^}]*\}/.exec(source)
      const flowRule = /\.achx-flow\{[^}]*\}/.exec(source)
      return [
        [Boolean(strip), 'strip element'],
        [Boolean(flow), 'items wrap in their own column beside the grip'],
        [Boolean(flowRule) && /flex-wrap:wrap/.test(flowRule[0]), 'items wrap'],
        [Boolean(stripRule) && /max-width:min\(330px/.test(stripRule[0]), 'strip max width'],
      ]
    },
  },
  {
    name: 'a zh locale renders Chinese labels, not the English fallback',
    script: [all, false, 1795000000000, { rx: 16, rb: 420, collapsed: true }, false],
    locale: 'zh',
    expect: ['详情'],
    reject: ['Details'],
  },
  {
    name: 'a zh locale expanded box stays Chinese',
    script: [all, false, 1795000000000, { rx: 16, rb: 420, collapsed: false }, false],
    locale: 'zh',
    expect: ['合计', '收起', '积分'],
    reject: ['Total', 'Collapse', 'credits'],
  },
  {
    name: 'a zh-CN locale stays on the Chinese dictionary',
    script: [all, false, 1795000000000, { rx: 16, rb: 420, collapsed: false }, false],
    locale: 'zh-CN',
    expect: ['合计', '收起'],
    reject: ['Total', 'Collapse'],
  },
  {
    name: 'an en locale renders English labels',
    script: [all, false, 1795000000000, { rx: 16, rb: 420, collapsed: false }, false],
    locale: 'en',
    expect: ['Total', 'Collapse', 'credits'],
    reject: ['合计', '收起'],
  },
]

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (!Array.isArray(node) && predicate(node)) return node
  const children = Array.isArray(node) ? node : node.children || []
  for (const child of children) {
    const hit = find(child, predicate)
    if (hit) return hit
  }
  return null
}

for (const scenario of scenarios) {
  const { tree, text: rendered, options } = render(scenario.script, scenario.locale)
  const problems = []
  for (const needle of scenario.expect || []) if (!rendered.includes(needle)) problems.push('missing ' + JSON.stringify(needle))
  for (const needle of scenario.reject || []) if (rendered.includes(needle)) problems.push('unexpected ' + JSON.stringify(needle))
  if (options.name !== 'shell.overlay' || options.id !== 'ai-credit-hub') problems.push('slot registration ' + JSON.stringify(options))
  if (scenario.inspect) {
    for (const [condition, label] of scenario.inspect(tree)) {
      if (!condition) problems.push('failed check: ' + label)
    }
  }
  if (problems.length) fail(scenario.name + ' → ' + problems.join('; '))
  else console.log('OK   ' + scenario.name)
}

console.log('== drag bounds stay symmetric')
{
  // The panel is anchored by its right and bottom edges. Pushing it to any
  // extreme must keep the whole panel on screen, so the reachable travel is the
  // same in both directions once the panel's own width is accounted for.
  const plugin = loadPlugin(makeReact([]))
  const { clamp } = plugin.__layout
  const width = 330
  const innerWidth = 1280
  const innerHeight = 800
  const problems = []

  const farRight = clamp({ rx: 0, rb: 0, collapsed: true })
  const farLeft = clamp({ rx: 100000, rb: 0, collapsed: true })

  const leftAtFarLeft = innerWidth - farLeft.rx - width
  // Dragging right increases rx toward 0, so the rightmost reachable right edge
  // is all the way at the window edge...
  if (farRight.rx !== 8) problems.push('a drag to the right should stop 8px from the right edge, got ' + farRight.rx)
  // ...and dragging left must stop with the panel still fully visible.
  if (leftAtFarLeft < 8) problems.push('panel runs off the left: its left edge would be at ' + leftAtFarLeft)
  // Travel must be non-zero in both directions.
  if (farLeft.rx <= farRight.rx) problems.push('no horizontal travel at all')

  // rb is the distance from the window's bottom edge: rb = 8 sits at the
  // bottom, and a large rb has been clamped so the panel cannot leave the top.
  const bottomMost = clamp({ rx: 0, rb: -1000, collapsed: true })
  const topMost = clamp({ rx: 0, rb: 1000000, collapsed: true })
  if (bottomMost.rb !== 8) problems.push('a drag to the bottom should stop 8px from the bottom edge, got ' + bottomMost.rb)
  const topEdge = innerHeight - topMost.rb - 44
  if (topEdge < 0) problems.push('panel can be pushed above the window: top would be ' + topEdge)
  if (topMost.rb <= bottomMost.rb) problems.push('no vertical travel at all')

  if (problems.length) fail('drag bounds → ' + problems.join('; '))
  else console.log('OK   the panel stays fully on screen at every horizontal and vertical extreme')
}

console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURES')

// A language switch after mount must be read at call time, not frozen at
// registration. The service below flips `active` between two renders.
console.log('== locale switch after mount')
{
  const locale = makeLocaleService('zh')
  const open = { rx: 16, rb: 420, collapsed: false }
  const boot = render([all, false, 1795000000000, open, false], undefined, locale)
  const zhText = boot.text
  locale.setActive('en')
  const after = render([all, false, 1795000000000, open, false], undefined, locale)
  const enText = after.text
  const problems = []
  if (!zhText.includes('合计')) problems.push('zh render missing 合计')
  if (!enText.includes('Total')) problems.push('en render missing Total after the switch')
  if (enText.includes('合计')) problems.push('en render kept 合计 after the switch')
  if (problems.length) fail('locale switch → ' + problems.join('; '))
  else console.log('OK   switching the locale after mount changes the rendered text')
}

console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURES')
process.exit(failures === 0 ? 0 : 1)