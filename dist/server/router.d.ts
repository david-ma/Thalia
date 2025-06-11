/**
 * Router - Request routing implementation
 *
 */
import { Website } from './types.js';
export declare class Router {
    private websites;
    private default;
    constructor(websites: Website[]);
    getWebsite(domain: string): Website;
}
//# sourceMappingURL=router.d.ts.map