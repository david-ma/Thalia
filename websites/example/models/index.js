"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = exports.dbConfig = void 0;
const sequelize = __importStar(require("sequelize"));
const log_1 = require("./log");
let seqOptions = {
    "dialect": "sqlite",
    "storage": `${__dirname}/database.sqlite`,
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
console.log('seqOptions', seqOptions);
exports.dbConfig = new sequelize.Sequelize(seqOptions);
exports.Log = (0, log_1.LogFactory)(exports.dbConfig);
