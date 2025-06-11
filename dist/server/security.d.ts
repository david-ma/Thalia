/// <reference types="node" />
import { ServerResponse, IncomingMessage } from 'http';
import { Website } from './website';
export interface SecurityOptions {
    websiteName: string;
    mailFrom: string;
    mailAuth: {
        user: string;
        pass: string;
    };
}
export declare function users(_options: SecurityOptions): {
    login: (_res: ServerResponse, _req: IncomingMessage, _website: Website) => void;
    logout: (_res: ServerResponse, _req: IncomingMessage, _website: Website) => void;
    register: (_res: ServerResponse, _req: IncomingMessage, _website: Website) => void;
};
