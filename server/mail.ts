import nodemailer, { SendMailOptions, SentMessageInfo, Transporter } from 'nodemailer'
import path from 'path'
import type { Machine, MachineReport } from './types.js'
import { mysqlTable, text } from 'drizzle-orm/mysql-core'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { IncomingMessage, ServerResponse } from 'http'
import { Website } from './website'
import { RequestInfo } from './server'
import { recursiveObjectMerge } from './website'

/** Shape of `config/mailAuth.js` (transport and/or Gmail `mailAuth`, plus optional From). */
export type MailAuthModule = {
  transport?: unknown
  mailAuth?: unknown
  from?: unknown
  defaults?: unknown
}

/**
 * Default nodemailer options from a mail auth module.
 * File `from` wins over `defaults.from`. Constructor defaults are merged separately in {@link MailService.init}.
 */
export function resolveMailAuthDefaults(authModule: MailAuthModule | null | undefined): SendMailOptions {
  const defaults: SendMailOptions = {}
  if (authModule && typeof authModule.defaults === 'object' && authModule.defaults !== null && !Array.isArray(authModule.defaults)) {
    Object.assign(defaults, authModule.defaults)
  }
  if (typeof authModule?.from === 'string' && authModule.from.trim()) {
    defaults.from = authModule.from.trim()
  }
  return defaults
}

export class MailService implements Machine {
  private transporter!: Transporter
  private isInitialized = false
  private authPath: string
  public table: MySqlTableWithColumns<any> = mailTable
  private website!: Website
  private name!: string

  public defaultSendMailOptions: SendMailOptions

  /**
   * @param authPath - Path to `mailAuth.js`
   * @param defaultSendMailOptions - Constructor defaults; keys in the auth file win (`from` / `defaults`)
   *
   * The auth file should export `transport` (Mailcatcher or other SMTP) or `mailAuth` (Gmail user/pass).
   * Export `from` (and optionally `defaults`) so every `sendEmail` has an envelope sender.
   * Hosted SMTP often rejects an empty reverse-path (`MAIL FROM:<>`) as a bounce.
   * `from` must be a mailbox the authenticated account may send as — not the SMTP login name.
   */
  constructor(authPath: string, defaultSendMailOptions: SendMailOptions = {}) {
    this.authPath = authPath
    this.defaultSendMailOptions = defaultSendMailOptions
  }

  public async init(website: Website, name: string): Promise<MachineReport> {
    console.log('Initialising MailService for', website.name)
    this.website = website
    this.name = name

    const authModule = (await this.safeImport(this.authPath)) as MailAuthModule
    const fileDefaults = resolveMailAuthDefaults(authModule)
    this.defaultSendMailOptions = recursiveObjectMerge(
      this.defaultSendMailOptions as Record<string, any>,
      fileDefaults as Record<string, any>,
    ) as SendMailOptions

    const { mailAuth, transport } = authModule
    if (transport) {
      this.transporter = nodemailer.createTransport(transport as object, this.defaultSendMailOptions)
      this.isInitialized = true
      console.log('Mail transporter initialized successfully using transport config')
    } else if (mailAuth) {
      this.transporter = nodemailer.createTransport(
        {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: mailAuth as { user: string; pass: string },
        },
        this.defaultSendMailOptions,
      )
      this.isInitialized = true
      console.log('Mail transporter initialized successfully using mailAuth config')
    } else {
      console.error('No mailAuth found in mailAuth.js')
    }

    if (this.isInitialized && !this.defaultSendMailOptions.from) {
      console.warn(
        'MailService has no default From. SMTP may treat mail as a bounce (MAIL FROM:<>). Export `from` from mailAuth.js as a mailbox the SMTP account may send as.',
      )
    }

    return this.health()
  }

  public async health(): Promise<MachineReport> {
    const name = this.name || 'mail'
    if (this.isInitialized && this.transporter) {
      return { name, status: 'ok', detail: 'transporter ready' }
    }
    return {
      name,
      status: 'degraded',
      detail: 'mail transporter not ready (missing or invalid mailAuth)',
    }
  }

  public controller(res: ServerResponse, _req: IncomingMessage, _website: Website, requestInfo: RequestInfo) {
    console.debug("hey we're doing the mail controller")
    if (this.isInitialized) {
      if (this.website.env === 'development') {
        // Render the email that will be sent?

        // newUserEmail.hbs

        const html = this.website.getContentHtml('emailDebug')({
          websiteName: this.website.name,
          websiteURL: requestInfo.host,
          email: 'test@example.com',
          token: '1234567890',
        })

        res.end(html)
      } else {
        res.end('Mail service is ready')
      }
    } else {
      res.end('Mail service is not ready')
    }
  }

  async sendEmail(sendMailOptions: SendMailOptions): Promise<string> {
    const mailOptions: SendMailOptions = recursiveObjectMerge(
      this.defaultSendMailOptions as Record<string, any>,
      sendMailOptions as Record<string, any>,
    ) as SendMailOptions

    const doSend = () => {
      if (!this.transporter || !this.isInitialized) {
        console.error('No transporter found or not initialized')
        return Promise.resolve('No transporter found or not initialized')
      }
      return new Promise<string>((resolve) => {
        this.transporter.sendMail(mailOptions, (error: Error | null, info: SentMessageInfo) => {
          if (error) {
            console.trace('Error', error)
            resolve('We had an error sending mail, mailserver probably offline')
          } else {
            console.debug('Email sent', info)
            resolve('Email sent')
          }
        })
      })
    }

    if (this.website?.db?.drizzle) {
      try {
        await this.website.db.drizzle.insert(this.table).values({
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text,
          html: mailOptions.html,
        })
      } catch (error) {
        console.error('Error logging email to database', error)
      }
    }
    return doSend()
  }

  /**
   * Import a file; if it doesn't exist or fails to load, return {} so MailService can still init.
   * @param path - The path to the file to import
   * @returns The imported module or {} on error (avoids unhandled rejection when mailAuth.js is missing)
   */
  private async safeImport(modulePath: string): Promise<MailAuthModule> {
    const spec =
      modulePath.startsWith('file:') || modulePath.startsWith('data:')
        ? modulePath
        : path.isAbsolute(modulePath)
          ? `file://${modulePath}`
          : modulePath
    try {
      const mod = await import(spec)
      return (mod ?? {}) as MailAuthModule
    } catch (e) {
      console.warn(
        'Mail auth file not found or invalid (mail will not be ready):',
        modulePath,
        e instanceof Error ? e.message : String(e),
      )
      return {}
    }
  }

  /**
   * Check if the mail service is ready to send emails
   */
  isReady(): boolean {
    return this.transporter !== null && this.isInitialized
  }
}

import { baseTableConfig, vc } from '../models/util'

export const mailTable: MySqlTableWithColumns<any> = mysqlTable('mail', {
  ...baseTableConfig,
  from: vc('from', 500),
  to: vc('to', 1000),
  cc: vc('cc', 1000),
  bcc: vc('bcc', 1000),
  subject: vc('subject', 1000),
  text: text('text'),
  html: text('html'),
})
