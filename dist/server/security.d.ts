import { SecurityConfig } from './route-guard.js';
export type { SecurityConfig };
import { RawWebsiteConfig, RouteRule } from './types.js';
export interface RoleRouteRule extends RouteRule {
    path: string;
    permissions: {
        [key: string]: string[];
    };
    allowAnonymous?: boolean;
    ownerOnly?: string[];
}
export declare const securityConfig: RawWebsiteConfig;
//# sourceMappingURL=security.d.ts.map