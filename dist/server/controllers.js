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
import { eq } from 'drizzle-orm';
import url from 'url';
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
        const logs = fs.readdirSync(logDirectory)
            .filter(filename => !filename.startsWith('.'))
            .slice(-10);
        if (logs.length === 0) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('No logs found');
            return;
        }
        // Get stats for all logs
        const stats = await Promise.all(logs.map(log => fs.promises.stat(path.join(logDirectory, log))));
        // Prepare data for template
        const data = {
            stats: logs.map((log, i) => ({
                filename: log,
                size: stats[i]?.size ?? 0,
                created: stats[i]?.birthtime?.toLocaleString() ?? 'Unknown',
                lastModified: stats[i]?.mtime?.toLocaleString() ?? 'Unknown'
            }))
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
export class CrudFactory {
    constructor(table) {
        this.table = table;
    }
    init(website, db, sqlite, name) {
        this.name = name;
        this.website = website;
        this.db = db;
        this.sqlite = sqlite;
        db.select().from(this.table).then((records) => {
            console.debug("CrudFactory", this.name, "initialised, it has", records.length, "records");
            // console.log("Found", records.length, "records in", this.name)
        });
    }
    /**
     * Generate a CRUD controller for a given table.
     * We want:
     * - list: GET /tableName
     * - create: POST /tableName
     * - read: GET /tableName/id
     * - edit: GET /tableName/id/edit
     * - update: PUT /tableName/id
     * - delete: DELETE /tableName/id
     */
    controller(res, req, website, requestInfo) {
        const pathname = url.parse(requestInfo.url, true).pathname ?? '';
        const target = pathname.split('/')[2] || 'list';
        if (target === 'columns') {
            this.columns(res, req, website, requestInfo);
        }
        else if (target === 'list') {
            this.list(res, req, website, requestInfo);
        }
        else if (target === 'json') {
            this.fetchDataTableJson(res, req, website, requestInfo);
        }
        else if (target === 'new') {
            this.new(res, req, website, requestInfo);
        }
        else if (target === 'create') {
            this.create(res, req, website, requestInfo);
        }
        else if (target === 'testdata') {
            this.testdata(res, req, website, requestInfo);
        }
        else if (target === 'edit') {
            this.edit(res, req, website, requestInfo);
        }
        else if (target === 'update') {
            this.update(res, req, website, requestInfo);
        }
        else if (target === 'delete') {
            this.delete(res, req, website, requestInfo);
        }
        else {
            this.show(res, req, website, requestInfo);
        }
    }
    testdata(res, req, website, requestInfo) {
        this.generateTestData(10).then(() => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('Test data generated');
        }, (error) => {
            console.error('Error generating test data:', error);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('Error generating test data');
        });
    }
    async generateTestData(amount = 10) {
        if (process.env.NODE_ENV !== 'development') {
            throw new Error('Test data can only be generated in development mode');
        }
        const records = [];
        for (let i = 0; i < amount; i++) {
            const fields = this.filteredAttributes().reduce((acc, attribute) => {
                var value = "Random String";
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
    delete(res, req, website, requestInfo) {
        const id = requestInfo.url.split('/').pop();
        if (!id) {
            throw new Error('No ID provided');
        }
        this.db.update(this.table)
            // .set({ deletedAt: sql`CURRENT_TIMESTAMP` })
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(this.table.id, id))
            // this.db.delete(this.table).where(eq(this.table.id, id))
            .then((result) => {
            // console.log("Result:", result)
            // res.writeHead(200, { 'Content-Type': 'application/json' })
            // res.end(JSON.stringify(result))
            // show delete success, or just the list page
            // res.writeHead(200, { 'Content-Type': 'text/html' })
            // res.end('Record deleted')
            const html = this.website.getContentHtml('deleteSuccess')(result);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
    }
    update(res, req, website, requestInfo) {
        const id = requestInfo.url.split('/').pop();
        if (!id) {
            throw new Error('No ID provided');
        }
        try {
            parseForm(res, req).then(({ fields }) => {
                fields = Object.fromEntries(Object.entries(fields).filter(([key]) => !CrudFactory.blacklist.includes(key)));
                this.db.update(this.table).set(fields).where(eq(this.table.id, id)).then((result) => {
                    console.log("Result:", result);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                });
            });
        }
        catch (error) {
            console.error('Error in ${website.name}/${tableName}/update:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
    }
    edit(res, req, website, requestInfo) {
        const id = requestInfo.url.split('/').pop();
        if (!id) {
            throw new Error('No ID provided');
        }
        this.db.select(this.table).from(this.table)
            .where(eq(this.table.id, id))
            .then((record) => {
            if (!record.length) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Record not found' }));
                return;
            }
            const data = {
                controllerName: this.name,
                id: id,
                record: record[0],
                json: JSON.stringify(record),
                tableName: this.name,
                primaryKey: 'id',
                links: []
            };
            const html = website.getContentHtml('edit')(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
    }
    show(res, req, website, requestInfo) {
        const id = requestInfo.url.split('/').pop();
        if (!id) {
            throw new Error('No ID provided');
        }
        this.db.select(this.table).from(this.table)
            .where(eq(this.table.id, id))
            .then((record) => {
            if (!record.length) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Record not found' }));
                return;
            }
            const data = {
                controllerName: this.name,
                id: id,
                record: record[0],
                json: JSON.stringify(record),
                tableName: this.name,
                primaryKey: 'id',
                links: []
            };
            const html = website.getContentHtml('show')(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
    }
    create(res, req, website, requestInfo) {
        try {
            parseForm(res, req).then(({ fields }) => {
                this.db.insert(this.table).values(fields).then((result) => {
                    // console.log("Result:", result)
                    // res.writeHead(200, { 'Content-Type': 'application/json' })
                    // res.end(JSON.stringify(result))
                    const html = website.getContentHtml('list')(result);
                    res.writeHead(302, { 'Location': `/${this.name}` });
                    res.end();
                }, (error) => {
                    console.error('Error inserting record:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
                });
            });
        }
        catch (error) {
            console.error('Error in ${website.name}/${tableName}/create:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
    }
    new(res, req, website, requestInfo) {
        const data = {
            title: this.name,
            controllerName: this.name,
            fields: this.filteredAttributes()
        };
        const html = website.getContentHtml('create')(data);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    list(res, req, website, requestInfo) {
        const data = {
            controllerName: this.name,
            tableName: this.name,
            primaryKey: 'id',
            links: []
        };
        const html = website.getContentHtml('list')(data);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        // website.db.drizzle.select().from(this.table)
        // .then((records) => {
        // }, (error) => {
        //   console.error(`Error in ${website.name}/${this.name}/list:`, error)
        //   res.writeHead(500, { 'Content-Type': 'application/json' })
        //   res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
        // })
    }
    /**
     * Serve the data in DataTables.net json format
     */
    fetchDataTableJson(res, req, website, requestInfo) {
        const query = url.parse(requestInfo.url, true).query;
        const parsedQuery = CrudFactory.parseDTquery(query);
        // const columns = this.filteredAttributes().map(this.mapColumns)
        const offset = parseInt(parsedQuery.start);
        const limit = parseInt(parsedQuery.length);
        this.db.select().from(this.table).limit(limit).offset(offset).then((records) => {
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
            'createdAt': 'date',
            'updatedAt': 'date',
            'deletedAt': 'date',
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
            }
        };
        Object.entries(queryString).filter(([key, value]) => {
            return key.startsWith('order');
        }).forEach(([key, value]) => {
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
}
CrudFactory.blacklist = ['id', 'createdAt', 'updatedAt', 'deletedAt'];
import formidable from 'formidable';
function parseForm(res, req) {
    return new Promise((resolve, reject) => {
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
//# sourceMappingURL=controllers.js.map