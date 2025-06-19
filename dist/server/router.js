/**
 * Router - Request routing implementation
 *
 */
export class Router {
    constructor(websites) {
        // assert that websites is not empty
        if (websites.length === 0) {
            throw new Error('No websites provided');
        }
        this.default = websites[0];
        // Create a map of websites
        this.domains = websites.reduce((acc, website) => {
            if (website.name == 'default') {
                this.default = website;
            }
            // Add all domains to the map
            const domains = website.config.domains ?? [];
            domains.forEach((domain) => {
                acc[domain] = website;
            });
            return acc;
        }, {});
    }
    getWebsite(domain) {
        return this.domains[domain] || this.default;
    }
}
//# sourceMappingURL=router.js.map