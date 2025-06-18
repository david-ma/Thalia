// // Drizzle schema for users table

// // import { integer, text } from 'drizzle-orm/sqlite-core'
// import { sqliteTable } from 'drizzle-orm/sqlite-core'

// // import { TableConfig } from 'drizzle-orm/sqlite-core'


// import { integer, text } from 'drizzle-orm/sqlite-core'
// // import { timestamp}


// // const userConfig: TableConfig = {
// //   name: 'users',
// //   columns: {
// //     id: integer('id').primaryKey(),
// //     name: text('name'),
// //     email: text('email'),
// //     // createdAt: timestamp('created_at').defaultNow(),
// //   },
// //   schema: 'main',
// //   dialect: 'sqlite'
// // }

// // export const users = sqliteTable(userConfig.name, userConfig.columns)


// export const users = sqliteTable('users', {
//   id: integer('id').primaryKey(),
//   name: text('name'),
//   email: text('email'),
// })

// const user: typeof usersTable.$inferInsert = {
//   name: 'John',
//   age: 30,
//   email: 'john@example.com',
// };

// await db.insert(usersTable).values(user);
// console.log('New user created!')

// const users = await db.select().from(usersTable);
// console.log('Getting all users from the database: ', users)

import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

// const userConfig: TableConfig = {
//   name: "users",
//   schema: "main",
//   dialect: 'sqlite',
//   columns: {
//     // id: 'number', //SQLiteColumn<any, {}, {}>'
//     id: integer('id').primaryKey() as any,
//     name: text('name') as any,
//     age: integer('age') as any,
//     email: text('email') as any,
//   }
// }

// export const users = sqliteTable('users_table', userConfig.columns)


// SQLiteColumn<any, {}, {}>'

export const users = sqliteTable("users_table", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  age: int().notNull(),
  email: text().notNull().unique(),
});

// // (alias) new SQLiteTable<TableConfig>(name: string, schema: string | undefined, baseName: string): SQLiteTable<TableConfig>
// const chairs = new SQLiteTableWithColumns("chairs", "string", "base")


// export const hats = new SQLiteTable("hats", "string",
//   "asdf"

// );