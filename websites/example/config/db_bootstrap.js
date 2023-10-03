"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
const seq = {
    sequelize: models_1.dbConfig,
};
seq.sequelize.sync({
    alter: true,
});
exports.seq = seq;
