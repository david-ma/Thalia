/// <reference types="node" resolution-mode="require"/>
export declare const config: {
    domains: never[];
    data: boolean;
    dist: boolean;
    controllers: {
        login: (_res: import("http").ServerResponse<import("http").IncomingMessage>, _req: import("http").IncomingMessage, _website: import("thalia/website").Website) => void;
        logout: (_res: import("http").ServerResponse<import("http").IncomingMessage>, _req: import("http").IncomingMessage, _website: import("thalia/website").Website) => void;
        register: (_res: import("http").ServerResponse<import("http").IncomingMessage>, _req: import("http").IncomingMessage, _website: import("thalia/website").Website) => void;
    };
};
//# sourceMappingURL=config.d.ts.map