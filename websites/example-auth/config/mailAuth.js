// Envelope/header From for every MailService.sendEmail (password reset, invites, debug).
// Required on hosted SMTP: an empty From becomes MAIL FROM:<> which providers treat as a bounce.
// Mailcatcher accepts any value. Production must be a mailbox the SMTP account may send as
// (not the cPanel / SMTP login name).
export const from = 'Example Auth <noreply@example.test>'

// This is a transport config for mailcatcher.
// https://mailcatcher.me/
export const transport = {
  host: '127.0.0.1',
  port: 1025,
  secure: false,
  auth: {
    user: 'user@email.com',
    pass: 'password',
  },
}
