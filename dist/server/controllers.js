import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
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
export function crudFactory(options) {
    const { website, table, db, relationships = [], hideColumns = [], template = 'crud' } = options;
    const tableName = table.name;
    return {
        list: async (res, _req, website, _requestInfo) => {
            try {
                const records = await db.select().from(table);
                const data = { records, tableName };
                const html = website.handlebars.compile(template)(data);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            }
            catch (error) {
                console.error(`Error in ${website.name}/${tableName}/list:`, error);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        },
        create: async (res, req, website, _requestInfo) => {
            try {
                const body = await parseBody(req);
                const result = await db.insert(table).values(body).returning();
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result[0]));
            }
            catch (error) {
                console.error(`Error in ${website.name}/${tableName}/create:`, error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        },
        read: async (res, _req, website, requestInfo) => {
            try {
                const id = requestInfo.url.split('/').pop();
                if (!id) {
                    throw new Error('No ID provided');
                }
                const record = await db.select().from(table).where(eq(table.id, id));
                if (!record.length) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Record not found' }));
                    return;
                }
                const data = { record: record[0], tableName };
                const html = website.handlebars.compile(template)(data);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            }
            catch (error) {
                console.error(`Error in ${website.name}/${tableName}/read:`, error);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        },
        edit: async (res, _req, website, requestInfo) => {
            try {
                const id = requestInfo.url.split('/').pop();
                if (!id) {
                    throw new Error('No ID provided');
                }
                const record = await db.select().from(table).where(eq(table.id, id));
                if (!record.length) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Record not found' }));
                    return;
                }
                const data = { record: record[0], tableName };
                const html = website.handlebars.compile(`${template}-edit`)(data);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            }
            catch (error) {
                console.error(`Error in ${website.name}/${tableName}/edit:`, error);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        },
        update: async (res, req, website, requestInfo) => {
            try {
                const id = requestInfo.url.split('/').pop();
                if (!id) {
                    throw new Error('No ID provided');
                }
                const body = await parseBody(req);
                const result = await db.update(table)
                    .set(body)
                    .where(eq(table.id, id))
                    .returning();
                if (!result.length) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Record not found' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result[0]));
            }
            catch (error) {
                console.error(`Error in ${website.name}/${tableName}/update:`, error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        },
        delete: async (res, _req, website, requestInfo) => {
            try {
                const id = requestInfo.url.split('/').pop();
                if (!id) {
                    throw new Error('No ID provided');
                }
                const result = await db.delete(table)
                    .where(eq(table.id, id))
                    .returning();
                if (!result.length) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Record not found' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            }
            catch (error) {
                console.error(`Error in ${website.name}/${tableName}/delete:`, error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        }
    };
}
async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            }
            catch (error) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}
export class CrudMachine {
    constructor(table) {
        this.table = table;
    }
    init(website, db, sqlite, name) {
        this.name = name;
        console.log(`We are initialising the CrudMachine ${this.name} on ${website.name}`);
        this.website = website;
        this.db = db;
        this.sqlite = sqlite;
        db.select().from(this.table).then((records) => {
            console.log("Found", records.length, "records in", this.name);
        });
    }
    entrypoint(res, req, website, requestInfo) {
        const path = requestInfo.url.split('/');
        const target = path[2];
        if (target === 'columns') {
            this.columns(res, req, website, requestInfo);
        }
        else if (target === 'list') {
            this.list(res, req, website, requestInfo);
        }
        else {
            this.list(res, req, website, requestInfo);
        }
    }
    list(res, req, website, requestInfo) {
        website.db.drizzle.select({ id: this.table.id, name: this.table.name }).from(this.table).then((records) => {
            const data = { records, tableName: this.name };
            const html = website.show('list')({ data });
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
    }
    columns(res, req, website, requestInfo) {
        const columns = Object.keys(this.table);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(columns));
    }
}
//# sourceMappingURL=controllers.js.map