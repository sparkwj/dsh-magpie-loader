import { spawn, execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

const command = 'magpie'
// fixed page port, away from magpie's defaults (gateway 3425, web 3430)
const WEB_ADDR = '127.0.0.1:' + (process.env.DSH_MAGPIE_WEB_PORT || '13430')
const args = ['web', '--no-open', '--addr', WEB_ADDR]
const REMOTE_NS = 'magpieLoader'
const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'
const URL_RE = /magpie web on (https?:\/\/\S+)/

let iconDataUrl = ''
try {
  iconDataUrl = 'data:image/png;base64,' + readFileSync(new URL('./icon.png', import.meta.url)).toString('base64')
} catch {}

/** `magpie status --json`: whether a magpie serves the gateway, and which. */
function gatewayStatus() {
  return new Promise((resolve) => {
    execFile(command, ['status', '--json'], {
      timeout: 3000,
      windowsHide: true,
      shell: process.platform === 'win32',
    }, (err, stdout) => {
      try {
        const s = JSON.parse(String(stdout || '').trim())
        resolve({
          running: !!s.running,
          version: s.version || '',
          role: s.role || '',
          pid: s.pid || 0,
          addr: s.addr || '',
        })
      } catch {
        resolve({ running: false, error: err ? String(err.message || err) : 'unreadable status' })
      }
    })
  })
}

/**
 * Starts `magpie web --no-open --addr 127.0.0.1:13430` with the Harness, reads
 * the page address it prints, and stops magpie when the plugin is disposed.
 * Status comes from `magpie status --json` (the gateway is what matters).
 */
export function apply(ctx) {
  const logger = ctx.logger ? ctx.logger('magpie-loader') : console
  const state = { url: '' }

  class MagpieInfo extends TypertRemoteService {
    constructor(c) { super(c, REMOTE_NS) }
    async getInfo() {
      const gateway = await gatewayStatus()
      return { url: state.url, icon: iconDataUrl, running: gateway.running, gateway }
    }
  }
  Object.defineProperty(MagpieInfo.prototype, REMOTE_METHOD_DESCRIPTOR, {
    configurable: true,
    value: Object.freeze({ version: 1, methods: Object.freeze([Object.freeze({ method: 'getInfo', invocation: Object.freeze({ kind: 'direct' }) })]) }),
  })
  ctx.plugin(MagpieInfo)

  ctx.effect(() => {
    let child
    let stopping = false
    try {
      child = spawn(command, args, {
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: process.env,
      })
    } catch (err) {
      logger.warn?.(`failed to start ${command}: ${err?.message ?? err}`)
      return () => {}
    }

    let buf = ''
    const onData = (chunk) => {
      if (state.url) return
      buf += chunk.toString()
      const m = buf.match(URL_RE)
      if (m) { state.url = m[1]; buf = '' }
      else if (/address already in use/.test(buf)) {
        logger.warn?.(`${WEB_ADDR} is already in use; magpie web did not start`)
        buf = ''
      } else if (buf.length > 65536) buf = buf.slice(-4096)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)

    child.on('error', (err) => logger.warn?.(`${command} error: ${err.message}`))
    child.on('exit', (code, signal) => {
      state.url = ''
      if (!stopping) logger.info?.(`${command} exited (code=${code}, signal=${signal})`)
    })

    const onExit = () => { try { child.kill() } catch {} }
    process.once('exit', onExit)

    return () => {
      stopping = true
      state.url = ''
      process.off('exit', onExit)
      if (child.exitCode !== null || child.killed) return
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
      } else {
        child.kill('SIGTERM')
        const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 5000)
        timer.unref?.()
        child.once('exit', () => clearTimeout(timer))
      }
    }
  })
}
