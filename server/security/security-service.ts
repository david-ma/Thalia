import bcrypt from 'bcryptjs'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { users } from '../../models/security-models.js'
import type { Website } from '../website.js'

export type UserDetails = {
  email: string
  password: string
  name: string
  role: string
  locked: boolean
  verified: boolean
}

export class SecurityService {
  public website!: Website
  public db!: MySql2Database

  constructor(drizzleConfig: any) {
    this.db = drizzle(drizzleConfig.default.dbCredentials.url)
  }

  public createUser(user: UserDetails) {
    return bcrypt.hash(user.password, 10).then((hashedPassword) => {
      user.password = hashedPassword
      return this.db
        .insert(users)
        .values(user)
        .$returningId()
        .catch((error) => {
          console.error('Error creating user ' + user.email)
          return null
        })
    })
  }
}
