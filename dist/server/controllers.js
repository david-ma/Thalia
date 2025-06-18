import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import url from 'url';
export const latestlogs = async (res, _req, website) => {
    try {
        const logDirectory = path.join(website.rootPath, 'public', 'log');
        if (!fs.existsSync(logDirectory)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('No logs found');
            return;
        }
        const logs = fs.readdirSync(logDirectory)
            .filter(filename => !filename.startsWith('.'))
            .slice(-10);
        if (logs.length === 0) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('No logs found');
            return;
        }
        const stats = await Promise.all(logs.map(log => fs.promises.stat(path.join(logDirectory, log))));
        const data = {
            stats: logs.map((log, i) => ({
                filename: log,
                size: stats[i]?.size ?? 0,
                created: stats[i]?.birthtime?.toLocaleString() ?? 'Unknown',
                lastModified: stats[i]?.mtime?.toLocaleString() ?? 'Unknown'
            }))
        };
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
        console.log(`We are initialising the CrudFactory ${this.name} on ${website.name}`);
        this.website = website;
        this.db = db;
        this.sqlite = sqlite;
        db.select().from(this.table).then((records) => {
            console.log("Found", records.length, "records in", this.name);
        });
    }
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
        else {
            this.show(res, req, website, requestInfo);
        }
    }
    testdata(res, req, website, requestInfo) {
        const data = [
            {
                name: 'apple',
                color: 'red',
                taste: 'sweet'
            },
            {
                name: 'banana',
                color: 'yellow',
                taste: 'sweet'
            },
            {
                name: 'orange',
                color: 'orange',
                taste: 'sour'
            },
            {
                name: 'pear',
                color: 'green',
                taste: 'sweet'
            },
            {
                name: 'pineapple',
                color: 'yellow',
                taste: 'sweet'
            }
        ];
        data.forEach((item) => {
            this.db.insert(this.table).values(item).then((result) => {
                console.log("Result:", result);
            });
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
    update(res, req, website, requestInfo) {
        const id = requestInfo.url.split('/').pop();
        if (!id) {
            throw new Error('No ID provided');
        }
        try {
            parseForm(res, req).then(({ fields }) => {
                const blacklist = ['id', 'createdAt', 'updatedAt'];
                fields = Object.fromEntries(Object.entries(fields).filter(([key]) => !blacklist.includes(key)));
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
            const html = website.show('edit')(data);
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
            const html = website.show('show')(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
    }
    create(res, req, website, requestInfo) {
        try {
            parseForm(res, req).then(({ fields }) => {
                this.db.insert(this.table).values(fields).then((result) => {
                    console.log("Result:", result);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
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
    filteredAttributes(table) {
        const columns = Object.keys(table).filter((key) => !['id', 'createdAt', 'updatedAt'].includes(key));
        return columns;
    }
    new(res, req, website, requestInfo) {
        const data = {
            title: this.name,
            controllerName: this.name,
            fields: this.filteredAttributes(this.table)
        };
        const html = website.show('create')(data);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    list(res, req, website, requestInfo) {
        website.db.drizzle.select({ id: this.table.id, name: this.table.name }).from(this.table).then((records) => {
            const data = {
                controllerName: this.name,
                records,
                tableName: this.name,
                primaryKey: 'id',
                links: []
            };
            const html = website.show('list')(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
    }
    fetchDataTableJson(res, req, website, requestInfo) {
        const query = url.parse(requestInfo.url, true).query;
        const parsedQuery = CrudFactory.parseDTquery(query);
        const columns = Object.keys(this.table).map(this.mapColumns);
        const offset = parseInt(parsedQuery.start);
        const limit = parseInt(parsedQuery.length);
        this.db.select().from(this.table).limit(limit).offset(offset).then((records) => {
            console.log("Found", records.length, "records in", this.name);
            const blob = {
                draw: parsedQuery.draw,
                recordsTotal: records.length,
                recordsFiltered: records.length,
                data: records,
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(blob));
        });
    }
    columns(res, req, website, requestInfo) {
        const columns = Object.keys(this.table).map(this.mapColumns);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(columns));
    }
    mapColumns(key) {
        const type = 'string';
        const allowedTypes = ['string', 'num', 'date', 'bool'];
        const orderable = allowedTypes.includes(type);
        const searchable = allowedTypes.includes(type);
        var blob = {
            name: key,
            title: key,
            data: key,
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
                const order = result.order[index] || {};
                order[column] = value;
                result.order[index] = order;
            }
        });
        return result;
    }
}
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