"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadViewsAsPartials = exports.setHandlebarsContent = exports.showWebpage = void 0;
/**
 * Shows a webpage using Handlebars templates
 */
function showWebpage(name, options) {
    options = options || {};
    return function (router) {
        router.readAllViews((views) => {
            const wrapper = options.wrapper || name;
            const template = router.handlebars.compile(views[wrapper]);
            loadViewsAsPartials(views, router.handlebars);
            setHandlebarsContent(views[name], router.handlebars).then(() => {
                try {
                    const html = template(options.variables || {});
                    router.res.end(html);
                }
                catch (error) {
                    console.log('Error loading content', error);
                    router.response.writeHead(500, { 'Content-Type': 'text/plain' });
                    router.response.end('Error loading webpage: ' + error.message);
                }
            });
        });
    };
}
exports.showWebpage = showWebpage;
/**
 * Sets Handlebars content
 */
async function setHandlebarsContent(content, Handlebars) {
    return new Promise((resolve) => {
        Handlebars.registerPartial('content', content);
        resolve();
    });
}
exports.setHandlebarsContent = setHandlebarsContent;
/**
 * Loads views as Handlebars partials
 */
function loadViewsAsPartials(views, Handlebars) {
    Object.entries(views).forEach(([name, content]) => {
        if (name.startsWith('_')) {
            Handlebars.registerPartial(name.slice(1), content);
        }
    });
}
exports.loadViewsAsPartials = loadViewsAsPartials;
//# sourceMappingURL=template.js.map