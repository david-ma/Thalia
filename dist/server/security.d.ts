import { Permission, Role, SecurityConfig } from './route-guard.js';
export type { SecurityConfig };
import { RawWebsiteConfig, RouteRule } from './types.js';
export interface RoleRouteRule extends RouteRule {
    path: string;
    permissions: Partial<Record<Role, Permission[]>>;
}
export declare class ThaliaSecurity {
    static securityConfig: RawWebsiteConfig;
}
//# sourceMappingURL=security.d.ts.map