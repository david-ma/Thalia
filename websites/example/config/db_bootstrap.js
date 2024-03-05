"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
let seqOptions = {
    dialect: 'sqlite',
    storage: `${__dirname}/database.sqlite`,
    logging: false,
    dialectOptions: {
        decimalNumbers: true,
    },
    define: {
        underscored: true,
    },
};
if (process.env.NODE_ENV === 'docker') {
    delete seqOptions.storage;
    seqOptions.database = 'postgres';
    seqOptions.username = 'postgres';
    seqOptions.password = 'postgres_password';
    seqOptions.dialect = 'postgres';
    seqOptions.host = 'db';
    seqOptions.port = 5432;
}
const seq = (0, models_1.securityFactory)(seqOptions);
seq.sequelize.sync({
    force: true,
    alter: true,
});
exports.seq = seq;
