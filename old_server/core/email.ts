import nodemailer from 'nodemailer'
import { Thalia } from './types'

export type EmailOptions = {
  from: string
  to: string
  subject: string
  html: string
}

export type EmailNewAccountConfig = {
  email: string
  controller: Thalia.Controller
  mailAuth: {
    user: string
    pass: string
  }
}

/**
 * Sends an email using nodemailer
 */
function sendEmail(emailOptions: EmailOptions, mailAuth: { user: string; pass: string }): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: mailAuth
  })

  return new Promise((resolve, reject) => {
    transporter.sendMail(emailOptions, (error, info) => {
      if (error) {
        console.log('Error sending email:', error)
        reject(error)
      } else {
        console.log('Email sent:', info.response)
        resolve()
      }
    })
  })
}

/**
 * Checks if an email is valid
 */
export function checkEmail(controller: Thalia.Controller): boolean {
  const email = controller.req.body.email
  return email && email.includes('@')
}

/**
 * Sends a new account email
 */
export async function emailNewAccount(config: EmailNewAccountConfig): Promise<void> {
  const { email, controller, mailAuth } = config
  const websiteName = controller.website.config.name

  const emailOptions: EmailOptions = {
    from: mailAuth.user,
    to: email,
    subject: `Welcome to ${websiteName}`,
    html: `
      <h1>Welcome to ${websiteName}</h1>
      <p>Your account has been created successfully.</p>
      <p>You can now log in to your account.</p>
    `
  }

  await sendEmail(emailOptions, mailAuth)
} 