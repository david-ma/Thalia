// import { SeqObject, securityFactory, DatabaseConfig, UserFactory } from 'thalia'
// // import { cred } from './cred.js'
// const cred = {
//   users: [
//     {
//       email: 'admin@example.com',
//       password: 'password',
//     },
//   ],
// }

// let seqOptions: DatabaseConfig = {
//   dialect: 'mariadb',
//   host: 'localhost',
//   port: 3306,
//   database: 'thalia',
//   user: 'thalia',
//   password: 'thalia',
//   logging: false,
// }

// const seq: SeqObject = securityFactory(seqOptions)
// const User = UserFactory(seq.sequelize)

// seq.sequelize
//   .sync({
//     // force: true,
//     // alter: true,
//   })
//   .then(() => {
//     cred.users.forEach((user: any) => {
//       User.findOrCreate({
//         where: {
//           email: user.email,
//         },
//         defaults: user,
//       })
//     })
//   })

// export { seq }
