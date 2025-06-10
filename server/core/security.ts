import { Thalia } from './types'
import { Views } from './types'
import { createSession } from './session'
import { checkEmail, emailNewAccount } from './email'

export type SecurityMiddleware = (
  controller: Thalia.Controller,
  success: ([views, user]: [Views, User]) => void,
  failure?: () => void
) => Promise<void>

export type SecurityOptions = {
  websiteName: string
  mailFrom?: string
  mailAuth: {
    user: string
    pass: string
  }
}

export type User = {
  id: number
  email: string
  [key: string]: any
}

/**
 * No-op security middleware that always succeeds
 */
export const noSecurity: SecurityMiddleware = async function (
  controller: Thalia.Controller,
  success: ([views, user]: [Views, User]) => void,
  failure?: () => void
) {
  const views = await new Promise<Views>((resolve) => controller.readAllViews(resolve))
  success([views, {} as User])
}

/**
 * Session-based security middleware
 */
export const checkSession: SecurityMiddleware = async function (
  controller: Thalia.Controller,
  success: ([views, user]: [Views, User]) => void,
  failure?: () => void
) {
  const views = await new Promise<Views>((resolve) => controller.readAllViews(resolve))
  const session = controller.req.session

  if (session && session.userId) {
    const user = await controller.db.User.findByPk(session.userId)
    if (user) {
      success([views, user])
      return
    }
  }

  if (failure) {
    failure()
  } else {
    controller.res.writeHead(401)
    controller.res.end('Unauthorized')
  }
}

/**
 * Creates a user management system with security middleware
 */
export function users(options: SecurityOptions) {
  return {
    checkSession,
    noSecurity,
    checkEmail,
    emailNewAccount,
    createSession
  }
} 