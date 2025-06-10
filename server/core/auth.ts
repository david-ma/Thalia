import { IncomingMessage, ServerResponse } from 'http'
import { randomBytes, createHash } from 'crypto'

export interface User {
  id: string
  username: string
  passwordHash: string
  email?: string
}

export interface Session {
  id: string
  userId: string
  expires: Date
}

export class AuthHandler {
  private users: Map<string, User>
  private sessions: Map<string, Session>
  private sessionDuration: number // in milliseconds

  constructor(sessionDuration: number = 24 * 60 * 60 * 1000) { // Default 24 hours
    this.users = new Map()
    this.sessions = new Map()
    this.sessionDuration = sessionDuration
  }

  public async register(username: string, password: string, email?: string): Promise<User> {
    if (this.users.has(username)) {
      throw new Error('Username already exists')
    }

    const passwordHash = this.hashPassword(password)
    const user: User = {
      id: randomBytes(16).toString('hex'),
      username,
      passwordHash,
      email
    }

    this.users.set(username, user)
    return user
  }

  public async login(username: string, password: string): Promise<Session> {
    const user = this.users.get(username)
    if (!user) {
      throw new Error('Invalid username or password')
    }

    const passwordHash = this.hashPassword(password)
    if (passwordHash !== user.passwordHash) {
      throw new Error('Invalid username or password')
    }

    const session: Session = {
      id: randomBytes(32).toString('hex'),
      userId: user.id,
      expires: new Date(Date.now() + this.sessionDuration)
    }

    this.sessions.set(session.id, session)
    return session
  }

  public async logout(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  public async validateSession(sessionId: string): Promise<User | null> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
    }

    if (session.expires < new Date()) {
      this.sessions.delete(sessionId)
      return null
    }

    const user = Array.from(this.users.values()).find(u => u.id === session.userId)
    return user || null
  }

  public setCookie(res: ServerResponse, sessionId: string): void {
    res.setHeader('Set-Cookie', `session=${sessionId}; HttpOnly; Path=/; Max-Age=${this.sessionDuration / 1000}`)
  }

  public getSessionFromCookie(req: IncomingMessage): string | null {
    const cookies = req.headers.cookie?.split(';').map(c => c.trim())
    const sessionCookie = cookies?.find(c => c.startsWith('session='))
    return sessionCookie ? sessionCookie.split('=')[1] : null
  }

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex')
  }
} 