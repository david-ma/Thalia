/// <reference types="node" />
import { EventEmitter } from 'events';
import { Socket } from 'socket.io';
import { Thalia } from './types';
import { Website } from './website';
export declare class ThaliaServer extends EventEmitter {
    private readonly websites;
    private readonly currentProject;
    private readonly rootPath;
    private readonly blacklist;
    private httpServer;
    private socketServer;
    constructor(options?: Thalia.ServerOptions);
    start(port: number): Promise<void>;
    stop(): Promise<void>;
    getWebsiteForSocket(socket: Socket): Website | null;
    private loadWebsites;
    private loadAllProjects;
    private loadSingleProject;
    private setupHttpServer;
    private setupSocketServer;
    private setupSocketHandlers;
    private getWebsiteForHost;
}
