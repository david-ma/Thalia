import { Sequelize, Model, ModelStatic } from '@sequelize/core';
import { User } from './security.js';
import { Session } from './security.js';
import { Audit } from './security.js';
import { Album } from './smugmug.js';
import { Image } from './smugmug.js';
export interface SeqObject {
    sequelize: Sequelize;
    models: {
        [key: string]: ModelStatic<Model>;
    };
}
export interface SecurityObject extends SeqObject {
    models: {
        User: ModelStatic<User>;
        Session: ModelStatic<Session>;
        Audit: ModelStatic<Audit>;
    };
}
export interface SmugmugObject extends SeqObject {
    models: {
        Album: ModelStatic<Album>;
        Image: ModelStatic<Image>;
    };
}
//# sourceMappingURL=types.d.ts.map