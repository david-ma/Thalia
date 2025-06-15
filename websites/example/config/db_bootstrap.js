// "use strict";
// Object.defineProperty(exports, "__esModule", { value: true });
// const index_js_1 = require("thalia/dist/server/index.js");
// const cred = require('./cred.js').cred;
// let seqOptions = {
//     dialect: 'mariadb',
//     host: 'localhost',
//     port: 3306,
//     database: 'thalia',
//     user: 'thalia',
//     password: 'thalia',
//     logging: false,
// };
// const seq = (0, index_js_1.securityFactory)(seqOptions);
// seq.sequelize
//     .sync({})
//     .then(() => {
//     cred.users.forEach((user) => {
//         User.findOrCreate({
//             where: {
//                 email: user.email,
//             },
//             defaults: user,
//         });
//     });
// });
// exports.seq = seq;
