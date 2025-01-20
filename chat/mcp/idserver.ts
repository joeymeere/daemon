import { IdentityServerPostgres } from '@spacemangaming/mcp-servers';
const idPort = 6001;
const idProxy = 3001;

try {
    const idServer = new IdentityServerPostgres({url: process.env.POSTGRES_IDSERVER_URL ?? 'postgres://postgres:postgres@localhost:5432/idserver'}, {name: "idServer"});
    await idServer.init();
    await idServer.start(idPort);
} catch (e) {
    console.error(e); 
}  

// Hono Proxy
import { Hono } from 'hono';
import { cors } from 'hono/cors';
const app = new Hono();

app.use(
    '*',
    cors({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        exposeHeaders: ['Content-Length']
    })
);

app.get("/health", (c) => {
    return c.text("OK");
})

app.all('*', async (c) => {
    const url = new URL(c.req.url);
    const targetUrl = `http://localhost:${idPort}${url.pathname}${url.search}`;

    try {
        const response = await fetch(targetUrl, {
            method: c.req.method,
            headers: c.req.raw.headers,
            body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : await c.req.blob()
        });

        // Forward the response headers
        const headers = new Headers();
        response.headers.forEach((value, key) => {
            headers.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            headers
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return new Response('Proxy Error', { status: 502 });
    }
});

export default {
    port: idProxy,
    fetch: app.fetch
}; // 3000 by default
