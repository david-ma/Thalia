import { CrudFactory, type Machine } from '../controllers.js'
import { users, sessions, audits } from '../../models/security-models.js'

export const UserMachine: Machine = new CrudFactory(users, {
  relationships: [
    {
      foreignTable: 'sessions',
      foreignColumn: 'userId',
      localColumn: 'id',
    },
  ],
})

export const SessionMachine: Machine = new CrudFactory(sessions, {
  relationships: [
    {
      foreignTable: 'users',
      foreignColumn: 'id',
      localColumn: 'userId',
    },
  ],
})

export const AuditMachine: Machine = new CrudFactory(audits, {
  relationships: [
    {
      foreignTable: 'users',
      foreignColumn: 'id',
      localColumn: 'userId',
    },
    {
      foreignTable: 'sessions',
      foreignColumn: 'sid',
      localColumn: 'sessionId',
    },
  ],
})
