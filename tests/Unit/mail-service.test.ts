/**
 * MailService default From from mailAuth.js — no live SMTP.
 *
 * Run from Thalia root: bun test tests/Unit/mail-service.test.ts
 */

import { afterAll, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { SendMailOptions } from 'nodemailer'
import { MailService, resolveMailAuthDefaults } from '../../server/mail.js'
import type { Website } from '../../server/website.js'

describe('resolveMailAuthDefaults', () => {
  test('reads export const from', () => {
    expect(resolveMailAuthDefaults({ from: '  Site <noreply@example.test>  ' })).toEqual({
      from: 'Site <noreply@example.test>',
    })
  })

  test('reads defaults object', () => {
    expect(
      resolveMailAuthDefaults({
        defaults: { from: 'defaults@example.test', replyTo: 'ops@example.test' },
      }),
    ).toEqual({
      from: 'defaults@example.test',
      replyTo: 'ops@example.test',
    })
  })

  test('export const from wins over defaults.from', () => {
    expect(
      resolveMailAuthDefaults({
        defaults: { from: 'defaults@example.test' },
        from: 'from@example.test',
      }),
    ).toEqual({ from: 'from@example.test' })
  })

  test('ignores empty or missing from', () => {
    expect(resolveMailAuthDefaults({})).toEqual({})
    expect(resolveMailAuthDefaults({ from: '   ' })).toEqual({})
    expect(resolveMailAuthDefaults(null)).toEqual({})
  })
})

describe('MailService sendEmail merges From from mailAuth.js', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-mail-auth-'))
  const authPath = path.join(tmpDir, 'mailAuth.js')

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('sendEmail without from uses the file default; per-message from overrides', async () => {
    fs.writeFileSync(
      authPath,
      `export const from = 'Homelab <noreply@example.test>'
export const transport = { jsonTransport: true }
`,
    )

    const mail = new MailService(authPath, { from: 'constructor@example.test' })
    const report = await mail.init({ name: 'mail-from-test' } as Website, 'mail')
    expect(report.status).toBe('ok')
    expect(mail.isReady()).toBe(true)
    expect(mail.defaultSendMailOptions.from).toBe('Homelab <noreply@example.test>')

    const captured: SendMailOptions[] = []
    const transporter = (mail as unknown as { transporter: { sendMail: Function } }).transporter
    transporter.sendMail = (options: SendMailOptions, callback: (err: Error | null, info: object) => void) => {
      captured.push(options)
      callback(null, { messageId: 'test' })
    }

    await mail.sendEmail({ to: 'hello@example.test', subject: 'Reset', text: 'token' })
    expect(captured[0]?.from).toBe('Homelab <noreply@example.test>')
    expect(captured[0]?.to).toBe('hello@example.test')
    expect(captured[0]?.subject).toBe('Reset')

    await mail.sendEmail({
      from: 'Override <other@example.test>',
      to: 'hello@example.test',
      subject: 'Reset',
      text: 'token',
    })
    expect(captured[1]?.from).toBe('Override <other@example.test>')
  })

  test('constructor from is kept when the auth file omits from', async () => {
    const noFromDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-mail-auth-nofrom-'))
    const noFromPath = path.join(noFromDir, 'mailAuth.js')
    fs.writeFileSync(noFromPath, `export const transport = { jsonTransport: true }\n`)
    try {
      const mail = new MailService(noFromPath, { from: 'constructor@example.test' })
      const report = await mail.init({ name: 'mail-constructor-from' } as Website, 'mail')
      expect(report.status).toBe('ok')
      expect(mail.isReady()).toBe(true)
      expect(mail.defaultSendMailOptions.from).toBe('constructor@example.test')
    } finally {
      fs.rmSync(noFromDir, { recursive: true, force: true })
    }
  })
})
