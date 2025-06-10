/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
import { Thalia } from './thalia';
import http = require('http');
declare function start(router: Thalia.Router, handle: Thalia.Handle, port: string): http.Server<typeof IncomingMessage, typeof ServerResponse>;
export { start };
