import nodemailer, { SendMailOptions, Transporter } from 'nodemailer'
import { Machine } from './controllers.js'
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { IncomingMessage, ServerResponse } from 'http'
import { Website } from './website.js'
import { RequestInfo } from './server.js'
import { recursiveObjectMerge } from './website.js'

export class MailService implements Machine {
  private transporter!: Transporter
  private isInitialized = false
  private authPath: string
  table!: SQLiteTableWithColumns<any>

  public defaultSendMailOptions: SendMailOptions

  /**
   * @param authPath - The path to the mail auth file
   *
   * This file should export an object with a full transport config (allowing you to use mailcatcher, or some other smtp server)
   * or an object with a just the username & password, for gmail.
   */
  constructor(authPath: string, defaultSendMailOptions: SendMailOptions = {}) {
    this.authPath = authPath
    this.defaultSendMailOptions = defaultSendMailOptions
  }

  public init() {
    this.safeImport(this.authPath).then(({ mailAuth, transport }) => {
      if (transport) {
        this.transporter = nodemailer.createTransport(transport)
        this.isInitialized = true
        console.log('Mail transporter initialized successfully')
      } else if (mailAuth) {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: mailAuth,
        })
        this.isInitialized = true
        console.log('Mail transporter initialized successfully')
      } else {
        console.error('No mailAuth found in mailAuth.js')
      }
    })
  }

  public controller(res: ServerResponse, _req: IncomingMessage, _website: Website, _requestInfo: RequestInfo) {
    if (this.isInitialized) {
      res.end('Mail service is ready')
    } else {
      res.end('Mail service is not ready')
    }
  }

  async sendEmail(sendMailOptions: SendMailOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.transporter || !this.isInitialized) {
        console.error('No transporter found or not initialized')
        reject('No transporter found or not initialized')
        return
      }

      const mailOptions: SendMailOptions = recursiveObjectMerge(this.defaultSendMailOptions, sendMailOptions)

      this.transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          reject(error)
        } else {
          resolve('Email sent')
        }
      })
    })
  }

  /**
   * Import a file, but if it doesn't exist, reject
   * @param path - The path to the file to import
   * @returns The imported file or an error
   */
  private async safeImport(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const data = import(path)
        resolve(data)
      } catch (e) {
        console.error(`Error importing ${path}:`, e)
        reject(e)
      }
    })
  }

  /**
   * Check if the mail service is ready to send emails
   */
  isReady(): boolean {
    return this.transporter !== null && this.isInitialized
  }
}
