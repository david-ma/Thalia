import { Sequelize, Options } from 'sequelize';
export declare function securityFactory(seqOptions: Options): {
    sequelize: Sequelize;
    User: import("./security").UserStatic;
    Session: import("./security").SessionStatic;
    Audit: import("./security").AuditStatic;
};
