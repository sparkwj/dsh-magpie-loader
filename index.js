import { spawn } from 'node:child_process'

/**
 * Starts magpie when the Harness activates this plugin and stops it
 * when the plugin is disposed (Harness exit, disable, or reload).
 */
export function apply(ctx, config = {}) {
  const command = config.command || 'magpie'
  const args = Array.isArray(config.args) ? config.args : []
  const logger = ctx.logger ? ctx.logger('magpie-loader') : console

  ctx.effect(() => {
    let child
    let stopping = false
    try {
      child = spawn(command, args, {
        shell: process.platform === 'win32',
        stdio: 'ignore',
        windowsHide: true,
        env: process.env,
      })
    } catch (err) {
      logger.warn?.(`failed to start ${command}: ${err?.message ?? err}`)
      return () => {}
    }

    child.on('error', (err) => logger.warn?.(`${command} error: ${err.message}`))
    child.on('exit', (code, signal) => {
      if (!stopping) logger.info?.(`${command} exited (code=${code}, signal=${signal})`)
    })

    // Kill magpie if the Harness process exits without disposing plugins.
    const onExit = () => { try { child.kill() } catch {} }
    process.once('exit', onExit)

    return () => {
      stopping = true
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
