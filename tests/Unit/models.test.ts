import { describe, expect, test } from 'bun:test'
import {
  AlbumFactory,
  AuditFactory,
  ImageFactory,
  SessionFactory,
  UserFactory,
  models,
  security,
  util as modelsUtil,
} from '../../models/index.js'
import { users, sessions, audits } from '../../models/security-models.js'
import { albums, images } from '../../models/smugmug.js'
import { baseTableConfig, vc } from '../../models/util.js'
import type { SecurityObject, SmugmugObject, SeqObject } from '../../models/types.js'

describe('models/util', () => {
  test('vc returns a column builder', () => {
    const col = vc('test_col', 128)
    expect(col).toBeDefined()
    expect(typeof col.notNull).toBe('function')
  })

  test('baseTableConfig exposes standard base columns', () => {
    expect(baseTableConfig.id).toBeDefined()
    expect(baseTableConfig.createdAt).toBeDefined()
    expect(baseTableConfig.updatedAt).toBeDefined()
    expect(baseTableConfig.deletedAt).toBeDefined()
  })

  test('models/util namespace matches direct util exports', () => {
    expect(modelsUtil.vc).toBe(vc)
    expect(modelsUtil.baseTableConfig).toBe(baseTableConfig)
  })
})

describe('models/index registry', () => {
  test('models object references canonical table exports', () => {
    expect(models.users).toBe(users)
    expect(models.sessions).toBe(sessions)
    expect(models.audits).toBe(audits)
    expect(models.albums).toBe(albums)
    expect(models.images).toBe(images)
  })

  test('security namespace aliases security-models tables', () => {
    expect(security.users).toBe(users)
    expect(security.sessions).toBe(sessions)
    expect(security.audits).toBe(audits)
  })

  test('models registry keys stay stable for consumers', () => {
    expect(Object.keys(models)).toEqual(['users', 'sessions', 'audits', 'albums', 'images'])
  })

  test('table factories return shared schema instances', () => {
    expect(UserFactory(baseTableConfig)).toBe(users)
    expect(SessionFactory(baseTableConfig)).toBe(sessions)
    expect(AuditFactory(baseTableConfig)).toBe(audits)
    expect(AlbumFactory(baseTableConfig)).toBe(albums)
    expect(ImageFactory(baseTableConfig)).toBe(images)
  })
})

describe('models/security-models tables', () => {
  test('users table exposes expected camelCase columns', () => {
    expect(Object.keys(users)).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'email',
        'password',
        'role',
        'locked',
        'verified',
      ]),
    )
  })

  test('sessions table uses sid as primary key column', () => {
    expect(Object.keys(sessions)).toEqual(expect.arrayContaining(['sid', 'userId', 'expires']))
  })
})

describe('models/smugmug tables', () => {
  test('albums table includes SmugMug-oriented columns', () => {
    expect(Object.keys(albums)).toEqual(
      expect.arrayContaining(['albumKey', 'webUri', 'uri', 'name']),
    )
  })

  test('images table links to albums and requires imageKey', () => {
    expect(Object.keys(images)).toEqual(
      expect.arrayContaining(['albumId', 'albumKey', 'imageKey', 'uri']),
    )
  })
})

describe('models/types structural assignability', () => {
  test('SecurityObject models shape is assignable to SeqObject', () => {
    const sample: SecurityObject = {
      db: {} as SeqObject['db'],
      models: {
        User: users,
        Session: sessions,
        Audit: audits,
      },
    }
    expect(sample.models.User).toBe(users)
  })

  test('SmugmugObject models shape is assignable to SeqObject', () => {
    const sample: SmugmugObject = {
      db: {} as SeqObject['db'],
      models: {
        Album: albums,
        Image: images,
      },
    }
    expect(sample.models.Album).toBe(albums)
  })
})
