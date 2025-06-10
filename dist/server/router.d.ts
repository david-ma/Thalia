/**
 * Router - Request routing implementation
 *
 */
import { Website } from './types';
export declare class Router {
    private websites;
    constructor(websites: Website[]);
    getWebsite(path: string): Website | null;
}
//# sourceMappingURL=router.d.ts.map