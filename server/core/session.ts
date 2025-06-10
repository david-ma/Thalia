import { Thalia } from './types'
import { User } from './security'

/**
 * Creates a new session for a user
 */
export async function createSession(
  userId: number,
  controller: Thalia.Controller,
  noCookie?: boolean
): Promise<void> {
  const session = {
    userId,
    createdAt: new Date()
  }

  if (!noCookie) {
    controller.setCookie('session', JSON.stringify(session), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  }

  controller.req.session = session
} 