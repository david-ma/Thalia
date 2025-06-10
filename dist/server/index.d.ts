export * from './core';
export { Thalia } from './thalia';
export declare function startServer(options?: {
    port?: number;
    project?: string;
}): Promise<void>;
