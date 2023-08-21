"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
const seq = {
    sequelize: models_1.dbConfig,
    Log: models_1.Log,
};
seq.sequelize.sync({
    alter: true,
});
exports.seq = seq;
