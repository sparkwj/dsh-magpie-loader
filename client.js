/**
 * Magpie loader — browser half.
 * - Plugin detail page title: a gateway status tag and an "Open Magpie" button.
 * - A main panel keyed by this plugin's entry id ("magpie-loader"), opened from
 *   the detail page: Back to this plugin's detail page, magpie's page below.
 *   Desktop embeds it in an Electron <webview> (own cookies, so the k= sign-in
 *   sticks); Web DSH has no <webview>, so the button opens a new window instead.
 */
window.__ModuleLoader__.load({
  id: 'dsh-magpie-loader',
  factory(require) {
    const React = require('react')
    const { Button } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    const PKG = 'dsh-magpie-loader'
    const PANEL_ID = 'magpie-loader' // the cordis.patch.yml entry id
    const REMOTE_NS = 'magpieLoader'
    const NS = 'magpie-loader'

    const zh = { open: '打开 Magpie', running: '运行中', stopped: '未运行', back: '返回', reload: '刷新', notReady: 'Magpie 网页尚未就绪' }
    const en = { open: 'Open Magpie', running: 'Running', stopped: 'Stopped', back: 'Back', reload: 'Reload', notReady: 'The magpie page is not ready yet' }

    // Desktop DSH runs in Electron, where <webview> exists; Web DSH does not.
    const IS_DESKTOP = typeof navigator !== 'undefined' && /\bElectron\//.test(navigator.userAgent || '')

    const IDENTITY_SCHEMA = {
      '~standard': { version: 1, vendor: PKG, validate: value => ({ value }) },
      parse: value => value,
    }
    const CONTRIBUTION = {
      package: PKG,
      descriptors: [{
        id: PKG + '#' + REMOTE_NS + '/getInfo',
        service: REMOTE_NS,
        namespace: REMOTE_NS,
        method: 'getInfo',
        invocation: { kind: 'direct' },
        parameters: [],
        result: { mode: 'strict', typeSymbol: PKG + '#getInfo:result', create: () => IDENTITY_SCHEMA },
      }],
    }

    const isMine = props => props && props.subject && props.subject.pkg && props.subject.pkg.name === PKG

    return {
      inject: ['slots', 'locale', 'remote'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'magpie: dictionaries')

        ctx.effect(() => {
          let disposed = false
          let disposer = null
          Promise.resolve(ctx.remote.$mount(CONTRIBUTION)).then(d => {
            if (disposed) { Promise.resolve(d()).catch(() => {}); return }
            disposer = d
          }, err => console.error('[magpie] remote mount failed', err))
          return () => { disposed = true; if (disposer) return disposer() }
        }, 'magpie: remote')

        const getInfo = () => {
          const ns = (typeof ctx.get === 'function' && ctx.get('remote.' + REMOTE_NS)) || (ctx.remote && ctx.remote[REMOTE_NS])
          if (!ns) return Promise.reject(new Error('magpie remote is not mounted yet'))
          return ns.getInfo().then(r => { if (!r.ok) throw r.error; return r.value })
        }

        let layout = null
        ctx.inject(['layout'], scoped => {
          layout = scoped.layout
          scoped.effect(() => () => {
            try { if (layout && layout.panelInfo.getSnapshot().activePanelId === PANEL_ID) layout.selectPanel(null) } catch {}
            layout = null
          }, 'magpie: layout')
        })

        let pluginNavigation = null
        ctx.inject(['pluginNavigation'], scoped => {
          pluginNavigation = scoped.pluginNavigation
          scoped.effect(() => () => { pluginNavigation = null }, 'magpie: plugin navigation')
        })

        const openPanel = () => {
          if (!layout) { console.warn('[magpie] layout unavailable'); return }
          layout.selectPanel(PANEL_ID)
        }
        // Back: this plugin's own detail page on the Plugins page.
        const goBack = () => {
          if (pluginNavigation && typeof pluginNavigation.openBundle === 'function') {
            try { pluginNavigation.openBundle(PKG); return } catch (err) { console.warn('[magpie] openBundle failed', err) }
          }
          if (layout) layout.selectPanel('plugins')
        }

        function useInfo() {
          const [info, setInfo] = React.useState(null)
          React.useEffect(() => {
            let live = true
            const load = () => getInfo().then(v => { if (live) setInfo(v || {}) }, () => { if (live) setInfo({}) })
            load()
            const timer = setInterval(load, 5000)
            return () => { live = false; clearInterval(timer) }
          }, [])
          return info
        }

        function StatusTag({ info }) {
          const on = !!(info && info.running)
          const g = (info && info.gateway) || {}
          const tip = on ? ['magpie ' + (g.version || ''), g.role, g.addr, g.pid ? 'pid ' + g.pid : ''].filter(Boolean).join(' · ') : (g.error || '')
          return h('span', {
            title: tip,
            style: {
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 999, fontSize: 12,
              background: on ? 'rgba(34,197,94,.15)' : 'rgba(127,127,127,.15)', color: on ? '#16a34a' : 'inherit',
            },
          }, h('span', { style: { width: 6, height: 6, borderRadius: 3, background: on ? '#22c55e' : '#9ca3af' } }), on ? t('running') : t('stopped'))
        }

        function Badge(props) {
          const info = useInfo()
          if (!isMine(props) || info === null) return null
          return h(StatusTag, { info })
        }

        function OpenAction(props) {
          const info = useInfo()
          if (!isMine(props)) return null
          const url = info && info.url
          if (!IS_DESKTOP) {
            // Web DSH: a plain link to magpie in a new window
            return h(Button, {
              variant: 'outline', size: 'sm', disabled: !url,
              onClick: () => { if (url) window.open(url, '_blank', 'noopener') },
            }, t('open'))
          }
          return h(Button, { variant: 'outline', size: 'sm', onClick: openPanel }, t('open'))
        }

        // Desktop main process only attaches a <webview> that carries a lease it
        // approved; get one from the same bridge DSH's own Browser uses.
        function MagpieView({ url, nonce }) {
          const hostRef = React.useRef(null)
          const [error, setError] = React.useState('')
          React.useEffect(() => {
            const host = hostRef.current
            const bridge = window.dshDesktop && window.dshDesktop.browser
            if (!host) return
            if (!bridge || typeof bridge.acquire !== 'function') {
              setError('no desktop browser bridge')
              console.warn('[magpie] window.dshDesktop.browser is unavailable')
              return
            }
            let disposed = false
            let lease = null
            let element = null
            let offOpen = null
            bridge.acquire(PKG).then(reservation => {
              if (disposed) { bridge.release(reservation.lease).catch(() => {}); return }
              lease = reservation.lease
              element = document.createElement('webview')
              element.setAttribute('name', reservation.lease)
              element.setAttribute('partition', reservation.partition)
              element.setAttribute('src', 'about:blank#' + reservation.lease)
              element.style.cssText = 'flex:1;width:100%;height:100%;border:none;display:flex'
              element.addEventListener('dom-ready', () => {
                if (disposed || element.dataset.magpieLoaded) return
                element.dataset.magpieLoaded = '1'
                element.loadURL(url).catch(err => console.warn('[magpie] loadURL failed', err))
              })
              element.addEventListener('did-fail-load', e => {
                if (e.isMainFrame && e.errorCode !== -3) console.warn('[magpie] load failed', e.errorCode, e.errorDescription)
              })
              if (typeof bridge.onOpenRequested === 'function') {
                offOpen = bridge.onOpenRequested(reservation.lease, u => window.open(u, '_blank', 'noopener'))
              }
              host.replaceChildren(element)
            }, err => {
              console.error('[magpie] webview lease refused', err)
              if (!disposed) setError(String((err && err.message) || err))
            })
            return () => {
              disposed = true
              if (offOpen) try { offOpen() } catch {}
              if (element) element.remove()
              if (lease) bridge.release(lease).catch(() => {})
            }
          }, [url, nonce])
          return h('div', { ref: hostRef, style: { flex: 1, minHeight: 0, display: 'flex' } },
            error ? h('div', { style: { margin: 'auto', opacity: 0.6, fontSize: 13 } }, error) : null)
        }

        // Same outer spacing and column as the plugin detail page.
        function MagpiePanel() {
          const info = useInfo()
          const [nonce, setNonce] = React.useState(0)
          const url = info && info.url
          return h('div', { style: { height: '100%', minHeight: 0, overflow: 'hidden', boxSizing: 'border-box', padding: '24px 32px' } },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0, maxWidth: 960, margin: '0 auto' } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' } },
                h(Button, { variant: 'ghost', size: 'sm', onClick: goBack }, '← ' + t('back')),
                h('span', { style: { fontWeight: 600, fontSize: 16 } }, 'Magpie'),
                info ? h(StatusTag, { info }) : null,
                h('div', { style: { flex: 1 } }),
                h(Button, { variant: 'ghost', size: 'sm', disabled: !url, onClick: () => setNonce(n => n + 1) }, t('reload'))),
              h('div', { style: { flex: 1, minHeight: 0, display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border, rgba(127,127,127,.25))' } },
                url
                  ? h(MagpieView, { url, nonce })
                  : h('div', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6, fontSize: 13 } }, info === null ? '' : t('notReady')))))
        }

        ctx.effect(() => ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
          name: 'plugins.detail.badge', id: 'magpie-loader.badge', order: 100,
        }, Badge)), 'magpie: badge')

        ctx.effect(() => ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
          name: 'plugins.detail.badge', id: 'magpie-loader.open', order: 101,
        }, OpenAction)), 'magpie: open beside badge')

        if (IS_DESKTOP) {
          ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
            name: 'main', key: PANEL_ID,
          }, MagpiePanel)), 'magpie: main panel')
        }
      },
    }
  },
})
