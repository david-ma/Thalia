export class Router {
    constructor(websites) {
        if (websites.length === 0) {
            throw new Error('No websites provided');
        }
        this.default = websites[0];
        this.domains = websites.reduce((acc, website) => {
            if (website.name == 'default') {
                this.default = website;
            }
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