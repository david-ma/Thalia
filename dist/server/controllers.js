/**
 * Controllers - Useful shared controller functions for handling requests
 *
 * The controllers are useful functions you can call to do specific tasks on a http request. e.g.
 * 1. Handling requests
 * 2. Rendering templates
 * 3. Handling form submissions
 * 4. Handling file uploads
 */
import fs from 'fs';
import path from 'path';
import { eq, isNull } from 'drizzle-orm';
import url from 'url';
import crypto from 'crypto';
import https from 'https';
/**
 * Read the latest 10 logs from the log directory
 */
export const latestlogs = async (res, _req, website) => {
    try {
        const logDirectory = path.join(website.rootPath, 'public', 'log');
        if (!fs.existsSync(logDirectory)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('No logs found');
            return;
        }
        // Get list of log files
        const logs = fs
            .readdirSync(logDirectory)
            .filter((filename) => !filename.startsWith('.'))
            .slice(-10);
        if (logs.length === 0) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('No logs found');
            return;
        }
        // Get stats for all logs
        const stats = await Promise.all(logs.map((log) => fs.promises.stat(path.join(logDirectory, log))));
        // Prepare data for template
        const data = {
            stats: logs.map((log, i) => ({
                filename: log,
                size: stats[i]?.size ?? 0,
                created: stats[i]?.birthtime?.toLocaleString() ?? 'Unknown',
                lastModified: stats[i]?.mtime?.toLocaleString() ?? 'Unknown',
            })),
        };
        // Get and compile template
        const template = website.handlebars.partials['logs'];
        if (!template) {
            throw new Error('logs template not found');
        }
        const html = website.handlebars.compile(template)(data);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    catch (error) {
        console.error(`Error in ${website.name}/latestlogs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
export const version = async (res, _req, website) => {
    try {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(website.version));
    }
    catch (error) {
        console.error(`Error in ${website.name}/version: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
/**
 * The CrudFactory is a class that generates a CRUD controller for a given table.
 * CrudFactory is a Machine, which means it has an init method, and provides a controller method.
 *
 * The views are mainly in src/views/scaffold, and can be overwritten by the website's views.
 * Custom views can also be passed in to the CrudFactory constructor. (TODO)
 *
 * Currently very tightly coupled with SQLite, but should be extended to work with MariaDB. (TODO)
 *
 * Uses DataTables.net for the list view.
 */
export class CrudFactory {
    constructor(table, options) {
        this.table = table;
    }
    init(website, name) {
        this.name = name;
        this.website = website;
        this.db = website.db.drizzle;
        // this.sqlite = sqlite
        this.db
            .select()
            .from(this.table)
            .then((records) => {
            console.debug('CrudFactory', this.name, 'initialised, it has', records.length, 'records');
            // console.log("Found", records.length, "records in", this.name)
        });
    }
    static getAction(requestInfo) {
        const target = requestInfo.action || 'list';
        switch (target) {
            case 'columns':
                return 'read';
            case 'list':
                return 'read';
            case 'json':
                return 'read';
            case 'new':
                return 'create';
            case 'create':
                return 'create';
            case 'testdata':
                return 'create';
            case 'edit':
                return 'update';
            case 'update':
                return 'update';
            case 'delete':
                return 'delete';
            case 'restore':
                return 'update';
            default:
                return 'read';
        }
    }
    /**
     * Generate a CRUD controller for a given table.
     * We want:
     * - default: GET /tableName (shows the list of records by default, but can be overridden)
     * - list: GET /tableName/list (shows the list of records)
     * - new: GET /tableName/new (shows creation form)
     * - create: POST /tableName/create (receives form data, and inserts a new record into the database)
     * - read: GET /tableName/<id> (shows a single record)
     * - edit: GET /tableName/<id>/edit (shows the edit form)
     * - update: PUT /tableName/<id> (receives form data, and updates the record)
     * - delete: DELETE /tableName/<id> (deletes the record)
     * - columns: GET /tableName/columns (returns the columns for DataTables.net)
     * - json: GET /tableName/json (returns the data for DataTables.net)
     * - testdata: GET /tableName/testdata (generates test data, NODE_ENV=development only)
     */
    controller(res, req, website, requestInfo) {
        const target = requestInfo.action || 'list';
        switch (target) {
            case 'columns':
                this.columns(res, req, website, requestInfo);
                break;
            case 'list':
                this.list(res, req, website, requestInfo);
                break;
            case 'json':
                this.json(res, req, website, requestInfo);
                break;
            case 'new':
                this.new(res, req, website, requestInfo);
                break;
            case 'create':
                this.create(res, req, website, requestInfo);
                break;
            case 'testdata':
                this.testdata(res, req, website, requestInfo);
                break;
            case 'edit':
                this.edit(res, req, website, requestInfo);
                break;
            case 'update':
                this.update(res, req, website, requestInfo);
                break;
            case 'delete':
                this.delete(res, req, website, requestInfo);
                break;
            case 'restore':
                this.restore(res, req, website, requestInfo);
                break;
            default:
                this.show(res, req, website, requestInfo);
        }
    }
    testdata(res, req, website, requestInfo) {
        if (process.env.NODE_ENV !== 'development') {
            return this.reportError(res, new Error('Test data can only be generated in development mode'));
        }
        this.generateTestData(10).then(() => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('Test data generated');
        }, (error) => {
            this.reportError(res, new Error(`Error generating test data: ${error}`));
        });
    }
    async generateTestData(amount = 10) {
        if (process.env.NODE_ENV !== 'development') {
            throw new Error('Test data can only be generated in development mode');
        }
        const records = [];
        for (let i = 0; i < amount; i++) {
            const fields = this.filteredAttributes().reduce((acc, attribute) => {
                var value = 'Random String';
                if (attribute.type === 'date') {
                    value = new Date().toISOString();
                }
                else if (attribute.type === 'num') {
                    value = Math.random() * 100;
                }
                else if (attribute.type === 'bool') {
                    value = Math.random() < 0.5;
                }
                acc[attribute.name] = value;
                return acc;
            }, {});
            records.push(fields);
        }
        return Promise.all(records.map((record) => {
            return this.db.insert(this.table).values(record);
        }));
    }
    /**
     * Takes DELETE requests to the /delete endpoint.
     * Does not actually delete the record, but adds a deletedAt timestamp.
     * Adds a deletedAt timestamp to the record, and redirects to the list page.
     */
    delete(res, req, website, requestInfo) {
        const id = requestInfo.slug;
        if (!id) {
            return this.reportError(res, new Error('No ID provided'));
        }
        if (!this.table.deletedAt) {
            this.reportError(res, new Error('No deletedAt column found, cannot delete record'));
            return;
        }
        this.db
            .update(this.table)
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(this.table.id, id))
            .then((result) => {
            this.reportSuccess(res, 'Record deleted', `/${this.name}`);
        });
    }
    restore(res, req, website, requestInfo) {
        const id = requestInfo.slug;
        if (!id) {
            this.reportError(res, new Error('No ID provided'));
            return;
        }
        this.db
            .update(this.table)
            .set({ deletedAt: null })
            .where(eq(this.table.id, id))
            .then((result) => {
            this.reportSuccess(res, 'Record restored', `/${this.name}`);
        });
    }
    /**
     * Update an existing record
     *
     * Needs security checks.
     */
    update(res, req, website, requestInfo) {
        const id = requestInfo.slug;
        if (!id) {
            return this.reportError(res, new Error('No ID provided'));
        }
        try {
            parseForm(res, req).then(({ fields }) => {
                fields = Object.fromEntries(Object.entries(fields).filter(([key]) => !CrudFactory.blacklist.concat(['id']).includes(key)));
                this.db
                    .update(this.table)
                    .set(fields)
                    .where(eq(this.table.id, id))
                    .then((result) => {
                    this.reportSuccess(res, 'Record updated', `/${this.name}/show/${id}`);
                });
            });
        }
        catch (error) {
            this.reportError(res, new Error(`Error in ${website.name}/${this.name}/update: ${error}`));
        }
    }
    edit(res, req, website, requestInfo) {
        const id = requestInfo.slug;
        if (!id) {
            return this.reportError(res, new Error('No ID provided'));
        }
        this.db
            .select(this.table)
            .from(this.table)
            .where(eq(this.table.id, id))
            .then((records) => {
            if (records.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Record not found' }));
                return;
            }
            else if (records.length > 1) {
                // throw new Error('Multiple records found for ID')
                console.error('Multiple records found for ID', id);
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Multiple records found for ID' }));
                return;
            }
            const record = records[0];
            const isNotDeleted = record.deletedAt === null;
            const data = {
                controllerName: this.name,
                id,
                record,
                isNotDeleted,
                json: JSON.stringify(record),
                tableName: this.name,
                primaryKey: 'id',
                links: [],
            };
            const html = website.getContentHtml('edit')(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
    }
    show(res, req, website, requestInfo) {
        const id = requestInfo.slug;
        if (!id) {
            return this.reportError(res, new Error('No ID provided'));
        }
        // select distinct id, name from table?
        this.db
            .select(this.table)
            .from(this.table)
            .where(eq(this.table.id, id))
            .then((records) => {
            if (records.length === 0) {
                return this.reportError(res, new Error('Record not found'));
            }
            else if (records.length > 1) {
                return this.reportError(res, new Error('Multiple records found for ID'));
            }
            const record = records[0];
            const data = {
                controllerName: this.name,
                id,
                record,
                json: JSON.stringify(record),
                tableName: this.name,
                primaryKey: 'id',
                links: [],
            };
            const html = website.getContentHtml('show')(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
    }
    /**
     * Takes POST requests with form data from /new, and inserts a new record into the database
     */
    create(res, req, website, requestInfo) {
        try {
            parseForm(res, req).then(({ fields }) => {
                this.db
                    .insert(this.table)
                    .values(fields)
                    .then((result) => {
                    this.reportSuccess(res, 'Record created' + JSON.stringify(result), `/${this.name}`);
                }, (error) => {
                    this.reportError(res, new Error(`Error inserting record: ${error}`));
                });
            });
        }
        catch (error) {
            this.reportError(res, new Error(`Error in ${website.name}/${this.name}/create: ${error}`));
        }
    }
    /**
     * Takes GET requests to the /new endpoint, and renders the new form
     */
    new(res, req, website, requestInfo) {
        const removeList = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'locked', 'verified', 'role'];
        const fields = this.filteredAttributes().filter((field) => !removeList.includes(field.name));
        const data = {
            title: this.name,
            controllerName: this.name,
            fields,
        };
        const html = website.getContentHtml('new')(data);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    list(res, req, website, requestInfo) {
        const data = {
            controllerName: this.name,
            tableName: this.name,
            primaryKey: 'id',
            links: [],
        };
        const html = website.getContentHtml('list')(data);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    /**
     * Serve the data in DataTables.net json format
     * The frontend uses /columns to get the columns, and then asks for /json to get the data.
     */
    json(res, req, website, requestInfo) {
        const query = url.parse(requestInfo.url, true).query;
        const parsedQuery = CrudFactory.parseDTquery(query);
        // const columns = this.filteredAttributes().map(this.mapColumns)
        const offset = parseInt(parsedQuery.start);
        const limit = parseInt(parsedQuery.length);
        const drizzleQuery = this.db.select().from(this.table);
        if (this.table.deletedAt) {
            drizzleQuery.where(isNull(this.table.deletedAt));
        }
        drizzleQuery
            .limit(limit)
            .offset(offset)
            .then((records) => {
            // console.log("Found", records.length, "records in", this.name)
            const blob = {
                draw: parsedQuery.draw,
                recordsTotal: records.length,
                recordsFiltered: records.length,
                data: records,
                // columns: columns,
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(blob));
        });
    }
    /**
     * Get the list of columns and their attributes, for use with DataTables.net
     *
     * Other attributes:
     * { "keys": ["name", "keyAsName", "primary", "notNull", "default", "defaultFn", "onUpdateFn", "hasDefault", "isUnique", "uniqueName", "uniqueType", "dataType", "columnType", "enumValues", "generated", "generatedIdentity", "config", "table", "length"] }
     */
    attributes() {
        const typeMapping = {
            createdAt: 'date',
            updatedAt: 'date',
            deletedAt: 'date',
        };
        return this.cols().map((column) => {
            var data = {
                name: column,
                type: this.table[column].columnType,
                default: this.table[column].default,
                required: this.table[column].notNull,
                unique: this.table[column].unique,
                primaryKey: this.table[column].primaryKey,
                foreignKey: this.table[column].foreignKey,
                references: this.table[column].references,
            };
            if (typeMapping[column]) {
                data.type = typeMapping[column];
            }
            data.all = JSON.stringify(data);
            return data;
        });
    }
    filteredAttributes() {
        return this.attributes().filter((attribute) => !CrudFactory.blacklist.includes(attribute.name));
    }
    cols() {
        return Object.keys(this.table);
    }
    colsFiltered() {
        return this.cols().filter((key) => !CrudFactory.blacklist.includes(key));
    }
    /**
     * For the /columns endpoint
     * Used with DataTables.net
     */
    columns(res, req, website, requestInfo) {
        const columns = this.filteredAttributes().map(this.mapColumns);
        // TODO: Get the types/attributes?
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(columns));
    }
    // TODO: Get the types from the drizzle table?
    mapColumns(attribute) {
        // const type = SequelizeDataTableTypes[value.type.key]
        const type = attribute.type;
        const allowedTypes = ['string', 'num', 'date', 'bool'];
        const orderable = allowedTypes.includes(type);
        const searchable = allowedTypes.includes(type);
        var blob = {
            name: attribute.name,
            title: attribute.name,
            data: attribute.name,
            orderable,
            searchable,
            type,
        };
        return blob;
    }
    static parseDTquery(queryString) {
        const result = {
            draw: queryString.draw,
            start: queryString.start,
            length: queryString.length,
            order: {},
            search: {
                value: queryString['search[value]'],
                regex: queryString['search[regex]'],
            },
        };
        Object.entries(queryString)
            .filter(([key, value]) => {
            return key.startsWith('order');
        })
            .forEach(([key, value]) => {
            const regex = /order\[(\d+)\]\[(.*)\]/;
            const match = key.match(regex);
            if (match) {
                const index = match[1];
                const column = match[2];
                // Get the order for this index, or create it if it doesn't exist
                const order = result.order[index] || {};
                // Set the value for the column
                order[column] = value;
                // Set the order for this index
                result.order[index] = order;
            }
        });
        return result;
    }
    reportSuccess(res, message, redirect) {
        const html = this.website.getContentHtml('message')({
            state: 'Success',
            message,
            redirect,
        });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    /**
     * Pass an error back to the user.
     * Handy place to add logging for the webmaster.
     * Or add extra debugging information for the developer.
     */
    reportError(res, error) {
        // TODO: Add a way to log errors for the webmaster
        console.error(error);
        const html = this.website.getContentHtml('message')({
            state: 'Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            redirect: `/${this.name}`,
        });
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(html);
    }
}
// private db!: LibSQLDatabase<Record<string, never>>
// private sqlite!: libsql.Client
CrudFactory.blacklist = ['createdAt', 'updatedAt', 'deletedAt']; // Filter 'id' as well?
import formidable from 'formidable';
export function parseForm(res, req) {
    return new Promise((resolve, reject) => {
        const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (!methods.includes(req.method ?? '')) {
            res.writeHead(405, { 'Content-Type': 'text/html' });
            res.end('Method not allowed');
            reject(new Error('Method not allowed'));
            return;
        }
        const form = formidable({ multiples: false });
        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error('Error', err);
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end('Invalid form data');
                reject(err);
                return;
            }
            resolve({ fields: parseFields(fields), files });
        });
    });
    // I don't know why Formidable needs us to parse the fields like this
    function parseFields(fields) {
        return Object.entries(fields).reduce((obj, [key, value]) => {
            if (Array.isArray(value)) {
                obj[key] = value[0] ?? '';
            }
            else {
                obj[key] = value ?? '';
            }
            return obj;
        }, {});
    }
}
export class SmugMugUploader {
    constructor() {
        this.BASE_URL = 'https://api.smugmug.com';
        this.REQUEST_TOKEN_URL = `${this.BASE_URL}/services/oauth/1.0a/getRequestToken`;
        this.ACCESS_TOKEN_URL = `${this.BASE_URL}/services/oauth/1.0a/getAccessToken`;
        this.AUTHORIZE_URL = `${this.BASE_URL}/services/oauth/1.0a/authorize`;
        // This should be a reachable domain?
        // Try using ngrok?
        this.callbackUrl = 'http://localhost:3000/oauthCallback';
    }
    async init(website, name) {
        this.website = website;
        this.name = name;
        import(path.join(this.website.rootPath, 'config', 'secrets.js'))
            .then(({ smugmug }) => {
            this.tokens = smugmug;
            this.album = smugmug.album;
            return smugmug;
        })
            .then((smugmug) => {
            if (!smugmug.consumer_key || !smugmug.consumer_secret) {
                throw new Error('Consumer key and secret are required, expected in config/secrets.js');
            }
            if (smugmug.oauth_token && smugmug.oauth_token_secret) {
                // console.log('OAuth token and secret are already set')
                return smugmug;
            }
            // console.log('Getting a request token')
            // Get the request token
            const requestParams = {
                oauth_callback: 'oob',
                oauth_consumer_key: this.tokens.consumer_key,
                oauth_nonce: Math.random().toString().replace('0.', ''),
                oauth_signature_method: 'HMAC-SHA1',
                oauth_timestamp: Math.floor(Date.now() / 1000),
                oauth_version: '1.0',
            };
            const sortedParams = SmugMugUploader.sortParams(requestParams);
            const escapedParams = SmugMugUploader.oauthEscape(SmugMugUploader.expandParams(sortedParams));
            const signatureBaseString = `GET&${SmugMugUploader.oauthEscape(this.REQUEST_TOKEN_URL)}&${escapedParams}`;
            requestParams.oauth_signature = SmugMugUploader.b64_hmac_sha1(`${this.tokens.consumer_secret}&`, signatureBaseString);
            const requestOptions = {
                hostname: 'api.smugmug.com',
                port: 443,
                path: '/services/oauth/1.0a/getRequestToken?' + new URLSearchParams(requestParams).toString(),
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            };
            const req = https.request(requestOptions, (res) => {
                // console.log('Request Token Response Status:', res.statusCode)
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    const response = data.split('&').reduce((acc, item) => {
                        const [key, value] = item.split('=');
                        acc[key] = value;
                        return acc;
                    }, {});
                    if (response && response.oauth_callback_confirmed == 'true') {
                        this.tokens.oauth_token = response.oauth_token;
                        this.tokens.oauth_token_secret = response.oauth_token_secret;
                        // console.log("Request token is", this.tokens.oauth_token)
                        // console.log("Request token secret is", this.tokens.oauth_token_secret)
                        // Now we can get the authorization URL
                        const authorizationUrl = this.AUTHORIZE_URL +
                            '?' +
                            new URLSearchParams({
                                oauth_token: this.tokens.oauth_token,
                                oauth_callback: this.callbackUrl,
                            }).toString();
                        // console.log('Authorization URL is', authorizationUrl)
                    }
                    else {
                        console.error('Request token failed');
                    }
                });
            });
            req.on('error', (e) => {
                console.error('Request Token Error:', e);
            });
            req.end();
        })
            .catch((error) => {
            console.error('Error loading secrets:', error);
        });
    }
    // https://oauth1.wp-api.org/docs/basics/Auth-Flow.html
    oauthCallback(res, req, website, requestInfo) {
        const query = requestInfo.query;
        const tokenExchangeParams = {
            oauth_consumer_key: this.tokens.consumer_key,
            oauth_token: query.oauth_token,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: Date.now(),
            oauth_nonce: Math.random().toString().replace('0.', ''),
            oauth_verifier: query.oauth_verifier,
        };
        const sorted = SmugMugUploader.sortParams(tokenExchangeParams);
        const normalized = encodeURIComponent(Object.entries(sorted)
            .map(([key, value]) => `${key}=${value}`)
            .join('&'));
        const method = 'POST';
        tokenExchangeParams.oauth_signature = SmugMugUploader.b64_hmac_sha1(`${this.tokens.consumer_secret}&${this.tokens.oauth_token_secret}`, `${method}&${encodeURIComponent(this.ACCESS_TOKEN_URL)}&${normalized}`);
        const url = this.ACCESS_TOKEN_URL + '?' + new URLSearchParams(tokenExchangeParams).toString();
        // console.log('Token exchange url is', url)
        const options = {
            host: 'api.smugmug.com',
            port: 443,
            path: '/services/oauth/1.0a/getAccessToken?' + new URLSearchParams(tokenExchangeParams).toString(),
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
        };
        const httpsRequest = https.request(options, (httpsResponse) => {
            // console.log('Token Exchange Response Status:', httpsResponse.statusCode)
            let data = '';
            httpsResponse.on('data', (chunk) => {
                data += chunk;
            });
            httpsResponse.on('error', (e) => {
                console.error('Token Exchange Error:', e);
            });
            httpsResponse.on('end', () => {
                // console.log('Token Exchange Response:', data)
                const response = data.split('&').reduce((acc, item) => {
                    const [key, value] = item.split('=');
                    acc[key] = value;
                    return acc;
                }, {});
                // console.log('Response is', response)
                this.tokens.oauth_token = response.oauth_token;
                this.tokens.oauth_token_secret = response.oauth_token_secret;
                res.end(JSON.stringify(response));
            });
        });
        httpsRequest.on('error', (e) => {
            console.error('Token Exchange Error:', e);
        });
        httpsRequest.end();
    }
    controller(res, req, website, requestInfo) {
        const method = req.method ?? '';
        // console.log("Hey we're running a controller called 'uploadPhoto'")
        if (method != 'POST') {
            res.end('This should be a post');
            return;
        }
        parseForm(res, req)
            .then(this.uploadImageToSmugmug.bind(this))
            .then((data) => {
            // console.log('Finished uploading, with this data:', data)
            res.end(JSON.stringify(data));
        })
            .catch((err) => {
            console.error('Error uploading photo:', err);
            res.end('error');
        });
    }
    /**
     * Take a ParsedForm, and upload the image to SmugMug.
     * If the image already exists, return the existing image.
     * If the image doesn't exist, upload it to SmugMug, and return the new image.
     *
     * TODO:
     * - Tests
     * - Make it more efficient
     */
    async uploadImageToSmugmug(form) {
        const that = this;
        const file = form.files.fileToUpload?.[0];
        const drizzle = this.website.db.drizzle;
        if (!file) {
            return Promise.reject(new Error('No file provided'));
        }
        const md5sum = crypto.createHash('md5').update(fs.readFileSync(file.filepath)).digest('hex');
        return drizzle
            .select()
            .from(images)
            .where(eq(images.archivedMD5, md5sum))
            .then((imageResults) => {
            if (imageResults.length > 0) {
                return Promise.resolve(imageResults[0]);
            }
            else {
                return new Promise((resolve, reject) => {
                    const caption = form.fields.caption ?? '';
                    const filename = form.fields.filename ?? file.originalFilename ?? '';
                    const title = form.fields.title ?? filename ?? caption ?? '';
                    const keywords = form.fields.keywords ?? title ?? caption ?? filename ?? this.website.name ?? '';
                    const host = 'upload.smugmug.com';
                    const path = '/';
                    const targetUrl = `https://${host}${path}`;
                    const method = 'POST';
                    // Sign the request (same OAuth process)
                    const params = this.signRequest(method, targetUrl);
                    // https://forum.uipath.com/t/unable-to-pass-binary-image-data-inside-http-request-body/849190/8
                    // Create the multipart form data
                    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2, 8);
                    const formData = SmugMugUploader.createMultipartFormData(file, boundary);
                    const options = {
                        host: host,
                        port: 443,
                        path: path,
                        method: method,
                        headers: {
                            Authorization: SmugMugUploader.bundleAuthorization(targetUrl, params),
                            'Content-Type': `multipart/form-data; boundary=${boundary}`,
                            'Content-Length': formData.length,
                            'X-Smug-AlbumUri': `/api/v2/album/${this.album}`,
                            'X-Smug-Caption': caption,
                            'X-Smug-FileName': filename,
                            'X-Smug-Keywords': keywords,
                            'X-Smug-ResponseType': 'JSON',
                            'X-Smug-Title': title,
                            'X-Smug-Version': 'v2',
                        },
                    };
                    const httpsRequest = https.request(options, function (httpsResponse) {
                        let data = '';
                        httpsResponse.setEncoding('utf8');
                        httpsResponse.on('data', function (chunk) {
                            data += chunk;
                        });
                        httpsResponse.on('end', () => {
                            that.saveImage(JSON.parse(data)).then((newImage) => {
                                drizzle
                                    .select()
                                    .from(images)
                                    .where(eq(images.id, newImage[0].insertId))
                                    .then((imageResults) => {
                                    resolve(imageResults[0]);
                                })
                                    .catch((err) => {
                                    reject(err);
                                });
                            });
                        });
                    });
                    httpsRequest.on('error', function (e) {
                        console.error('problem with request:');
                        console.error(e);
                        reject(e);
                    });
                    // httpsRequest.on('close', () => {
                    //   console.log('httpRequest closed')
                    // })
                    httpsRequest.write(formData);
                    httpsRequest.end();
                });
            }
        });
    }
    async saveImage(data) {
        const AlbumImageUri = data.Image.AlbumImageUri;
        return this.smugmugApiCall(AlbumImageUri)
            .then((response) => {
            const responseData = JSON.parse(response);
            const drizzle = this.website.db.drizzle;
            return drizzle.insert(images).values({
                imageUri: data.Image.ImageUri,
                albumUri: data.Image.AlbumImageUri,
                caption: responseData.Response.AlbumImage.Caption,
                // albumId: responseData.Response.AlbumImage.AlbumKey,
                filename: responseData.Response.AlbumImage.FileName,
                url: data.Image.URL,
                originalSize: responseData.Response.AlbumImage.OriginalSize,
                originalWidth: responseData.Response.AlbumImage.OriginalWidth,
                originalHeight: responseData.Response.AlbumImage.OriginalHeight,
                thumbnailUrl: responseData.Response.AlbumImage.ThumbnailUrl,
                archivedUri: responseData.Response.AlbumImage.ArchivedUri,
                archivedSize: responseData.Response.AlbumImage.ArchivedSize,
                archivedMD5: responseData.Response.AlbumImage.ArchivedMD5,
                imageKey: responseData.Response.AlbumImage.ImageKey,
                preferredDisplayFileExtension: responseData.Response.AlbumImage.PreferredDisplayFileExtension,
                uri: responseData.Response.AlbumImage.Uri,
            });
        })
            .catch((err) => {
            console.error(err);
        });
    }
    // path=`${path}?_verbosity=1`
    async smugmugApiCall(path, method = 'GET') {
        return new Promise((resolve, reject) => {
            // Add verbosity as a query parameter to the URL
            const urlWithVerbosity = `${path}?_verbosity=1`;
            const targetUrl = `${this.BASE_URL}${urlWithVerbosity}`;
            const params = this.signRequest(method, targetUrl);
            const options = {
                host: 'api.smugmug.com',
                port: 443,
                path: urlWithVerbosity,
                method,
                headers: {
                    Authorization: SmugMugUploader.bundleAuthorization(targetUrl, params),
                    Accept: 'application/json',
                    'X-Smug-ResponseType': 'JSON',
                },
            };
            const httpsRequest = https.request(options, (httpsResponse) => {
                let data = '';
                httpsResponse.on('data', (chunk) => {
                    data += chunk;
                });
                httpsResponse.on('end', () => {
                    resolve(data);
                });
            });
            httpsRequest.on('error', (e) => {
                reject(e);
            });
            httpsRequest.end();
        });
    }
    signRequest(method, targetUrl) {
        // Parse the URL to extract base URL and query parameters
        const urlObj = new URL(targetUrl);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
        // Get query parameters from URL
        const queryParams = {};
        urlObj.searchParams.forEach((value, key) => {
            queryParams[key] = value;
        });
        const params = {
            oauth_consumer_key: this.tokens.consumer_key,
            oauth_nonce: Math.random().toString().replace('0.', ''),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: Math.floor(Date.now() / 1000),
            oauth_token: this.tokens.oauth_token,
            oauth_version: '1.0',
            ...queryParams, // Include query parameters in OAuth signature
        };
        const sortedParams = SmugMugUploader.sortParams(params);
        const escapedParams = SmugMugUploader.oauthEscape(SmugMugUploader.expandParams(sortedParams));
        params.oauth_signature = SmugMugUploader.b64_hmac_sha1(`${this.tokens.consumer_secret}&${this.tokens.oauth_token_secret}`, `${method}&${SmugMugUploader.oauthEscape(baseUrl)}&${escapedParams}`);
        // It seems like smugmug doesn't like the + in the signature,
        // and I don't know how to escape it properly, so I'm just
        // going to regenerate the signature if it contains a + or /
        return params.oauth_signature.match(/[\+\/]/) ? this.signRequest(method, targetUrl) : params;
    }
    static b64_hmac_sha1(key, data) {
        return crypto.createHmac('sha1', key).update(data).digest('base64');
    }
    static expandParams(params) {
        return Object.keys(params)
            .map((key) => `${key}=${params[key]}`)
            .join('&');
    }
    static sortParams(object) {
        const keys = Object.keys(object).sort();
        const result = {};
        keys.forEach(function (key) {
            result[key] = object[key];
        });
        return result;
    }
    static oauthEscape(string) {
        if (string === undefined) {
            return '';
        }
        if (string instanceof Array) {
            throw new Error('Array passed to _oauthEscape');
        }
        return encodeURIComponent(string)
            .replace(/\!/g, '%21')
            .replace(/\*/g, '%2A')
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29');
    }
    static bundleAuthorization(url, params) {
        const keys = Object.keys(params);
        // const authorization = `OAuth realm="${url}",${keys.map(key => `${key}="${encodeURIComponent(params[key])}"`).join(',')}`
        // const authorization = `OAuth realm="${url}",${keys.map((key) => `${key}="${params[key]}"`).join(',')}`
        const authorization = `OAuth realm="${url}",${keys
            .map((key) => {
            let value = params[key];
            // Double-encode the oauth_signature specifically
            if (key === 'oauth_signature') {
                value = encodeURIComponent(value);
            }
            return `${key}="${value}"`;
        })
            .join(',')}`;
        return authorization;
    }
    static createMultipartFormData(file, boundary) {
        const parts = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="file"; filename="' + file.originalFilename + '"',
            'Content-Type: ' + file.mimetype,
            '',
            fs.readFileSync(file.filepath),
            '', // Add empty line after file data
            `--${boundary}--`,
        ];
        return Buffer.concat(parts.map((part) => (typeof part === 'string' ? Buffer.from(part + '\r\n') : part)));
    }
    smugmugConfig() {
        return {
            database: {
                schemas: {
                    albums,
                    images,
                },
                machines: {
                    albums: AlbumMachine,
                    images: ImageMachine,
                },
            },
            controllers: {
                uploadPhoto: this.controller.bind(this),
                oauthCallback: this.oauthCallback.bind(this),
            },
        };
    }
}
import { albums, images } from '../models/smugmug.js';
const AlbumMachine = new CrudFactory(albums);
const ImageMachine = new CrudFactory(images);
import { marked } from 'marked';
export class MarkdownViewerFactory {
    constructor(folder) {
        this.folder = folder;
    }
    controller(res, req, website, requestInfo) {
        const folder_path = path.join(website.rootPath, this.folder);
        const files = fs.readdirSync(folder_path);
        const data = {
            controller: requestInfo.controller,
            slug: requestInfo.slug,
            filename: requestInfo.slug.replace('.md', ''),
            files: files,
        };
        if (files.includes(requestInfo.slug)) {
            const content = fs.readFileSync(path.join(folder_path, requestInfo.slug), 'utf8');
            data.obsidian_html = marked.parse(content);
            const html = website.getContentHtml('md_show', 'wrapper');
            res.end(html(data));
        }
        else {
            // console.log('Request info', requestInfo)
            const html = website.getContentHtml('md_list', 'wrapper');
            res.end(html(data));
        }
    }
}
//# sourceMappingURL=controllers.js.map