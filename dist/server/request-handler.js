/**
 * A class based interpretation of the logic from website.ts
 *
 * This class will be more easily testable, and more easily extendable.
 */
import path from 'path';
import { dirname } from 'path';
import fs from 'fs';
import * as sass from 'sass';
export class RequestHandler {
    constructor(website) {
        this.website = website;
        this.rootPath = this.website.rootPath;
    }
    handleRequest(req, res, requestInfo, pathnameOverride) {
        this.req = req;
        this.res = res;
        this.requestInfo = requestInfo;
        this.pathname = pathnameOverride ?? requestInfo.pathname;
        this.projectPublicPath = path.join(this.rootPath, 'public', this.pathname);
        this.projectSourcePath = this.projectPublicPath.replace('public', 'src');
        this.thaliaRoot = path.join(dirname(import.meta.url).replace('file://', ''), '..', '..');
        this.thaliaSourcePath = path.join(this.thaliaRoot, 'src', this.pathname);
        // Start the request handler chain
        // Check, path exploit, route guard, controller, handlebars, static file, error
        RequestHandler.checkPathExploit(this)
            .then(this.website.routeGuard.handleRequestChain.bind(this.website.routeGuard, this))
            .then(RequestHandler.tryController)
            .then(RequestHandler.tryScss)
            .then(RequestHandler.tryHandlebars)
            .then((rh) => RequestHandler.tryStaticFile('dist', rh))
            .then((rh) => RequestHandler.tryStaticFile('public', rh))
            .then((rh) => RequestHandler.tryStaticFile('docs', rh))
            .then(RequestHandler.fileNotFound)
            .catch((message) => {
            if (typeof message === typeof Error) {
                this.renderError(message);
            }
            console.debug('Successfully finished the request handler chain', message);
        });
    }
    renderError(error) {
        console.log('Trying to render error', error);
        this.website.renderError(this.res, error);
    }
    static getContentType(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const contentTypes = {
            html: 'text/html',
            css: 'text/css',
            js: 'text/javascript',
            json: 'application/json',
            png: 'image/png',
            jpg: 'image/jpeg',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            ico: 'image/x-icon',
            webp: 'image/webp',
            woff: 'font/woff',
            woff2: 'font/woff2',
            ttf: 'font/ttf',
            eot: 'font/eot',
            otf: 'font/otf',
        };
        return contentTypes[ext ?? ''] || 'application/octet-stream';
    }
    // TODO: Implement this
    // private setSafeHeaders(headers: Record<string, string>): void {
    //   // Check if headers have not been set yet
    //   if(this.res.headersSent) {
    //     return
    //   }
    //   Object.entries(headers).forEach(([key, value]) => {
    //     this.res.setHeader(key, value)
    //   })
    // }
    static fileNotFound(requestHandler) {
        return new Promise((next, finish) => {
            requestHandler.res.writeHead(404);
            requestHandler.res.end('404 Not Found');
            return finish('404 Not Found');
        });
    }
    static tryStaticFile(folder, requestHandler) {
        const targetPath = path.join(requestHandler.rootPath, folder, requestHandler.pathname);
        return new Promise((next, finish) => {
            if (!fs.existsSync(targetPath)) {
                next(requestHandler);
                return;
            }
            if (fs.statSync(targetPath).isDirectory()) {
                const indexPath = path.join(requestHandler.pathname, 'index.html');
                requestHandler.handleRequest(requestHandler.req, requestHandler.res, requestHandler.requestInfo, indexPath);
                return finish(`Redirected to ${indexPath}`);
            }
            else {
                const contentType = RequestHandler.getContentType(requestHandler.pathname);
                requestHandler.res.setHeader('Content-Type', contentType);
                const stream = fs.createReadStream(targetPath);
                stream.on('error', (error) => {
                    console.error('Error streaming file:', error);
                    requestHandler.res.writeHead(500);
                    requestHandler.res.end('Internal Server Error');
                    return finish('Error streaming file');
                });
                stream.on('end', () => {
                    requestHandler.res.end();
                    return finish(`Successfully streamed file ${requestHandler.pathname}`);
                });
                stream.pipe(requestHandler.res);
            }
        });
    }
    static tryHandlebars(requestHandler) {
        return new Promise((next, finish) => {
            if (!requestHandler.pathname.endsWith('.html')) {
                return next(requestHandler);
            }
            const handlebarsPath = requestHandler.projectSourcePath.replace('.html', '.hbs');
            const thaliaHandlebarsPath = requestHandler.thaliaSourcePath.replace('.html', '.hbs');
            let target = null;
            if (fs.existsSync(handlebarsPath)) {
                target = handlebarsPath;
            }
            else if (fs.existsSync(thaliaHandlebarsPath)) {
                target = thaliaHandlebarsPath;
            }
            if (target) {
                requestHandler.website
                    .asyncServeHandlebarsTemplate({
                    res: requestHandler.res,
                    templatePath: target,
                    data: requestHandler.requestInfo, // Or send an empty object?
                })
                    .then(() => {
                    finish(`Successfully rendered handlebars template ${requestHandler.pathname}`);
                });
            }
            else {
                return next(requestHandler);
            }
        });
    }
    static tryScss(requestHandler) {
        return new Promise((next, finish) => {
            if (!requestHandler.pathname.endsWith('.css')) {
                return next(requestHandler);
            }
            const scssPath = requestHandler.projectSourcePath.replace('.css', '.scss');
            const thaliaScssPath = requestHandler.thaliaSourcePath.replace('.css', '.scss');
            let target = null;
            if (fs.existsSync(scssPath)) {
                target = scssPath;
            }
            else if (fs.existsSync(thaliaScssPath)) {
                target = thaliaScssPath;
            }
            if (target) {
                const css = sass.compile(target).css.toString();
                requestHandler.res.writeHead(200, { 'Content-Type': 'text/css' });
                requestHandler.res.end(css);
                return finish(`Successfully compiled scss file ${requestHandler.pathname}`);
            }
            else {
                return next(requestHandler);
            }
        });
    }
    static tryController(requestHandler) {
        return new Promise((next, finish) => {
            // console.debug(`Trying to execute controller '${requestHandler.requestInfo.controller}'`)
            const controllerSlug = requestHandler.requestInfo.controller;
            const controller = requestHandler.website.controllers[controllerSlug];
            if (!controller) {
                return next(requestHandler);
            }
            else {
                controller(requestHandler.res, requestHandler.req, requestHandler.website, requestHandler.requestInfo);
                return finish(`Successfully executed controller ${requestHandler.requestInfo.controller}`);
            }
        });
    }
    static checkPathExploit(requestHandler) {
        return new Promise((next, finish) => {
            const parts = requestHandler.pathname.split('/');
            if (parts.some((part) => part === '..')) {
                requestHandler.res.writeHead(400);
                requestHandler.res.end('Bad Request');
                return finish('Successfully blocked path exploit');
            }
            return next(requestHandler);
        });
    }
}
//# sourceMappingURL=request-handler.js.map