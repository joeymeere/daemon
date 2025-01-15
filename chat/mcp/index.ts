import { IdentityServerPostgres } from '@spacemangaming/mcp-servers';

const identityServicePort = process.env.IDENTITY_SERVICE_PORT || '6001';
console.log(process.env.POSTGRES_URL);
// Identity Server
const idServer = new IdentityServerPostgres(
    {
        url: process.env.POSTGRES_URL ?? 'postgres://postgres:postgres@localhost:5432/app'
    },
    {
        name: 'identity-server'
    }
);

try {
    await idServer.init();
    await idServer.start(parseInt(identityServicePort));
} catch (e) {
    console.error(`Failed to start identity server: ${e}`);
    process.exit(1);
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

app.all('*', async (c) => {
    const url = new URL(c.req.url);
    const targetUrl = `http://localhost:${identityServicePort}${url.pathname}${url.search}`;

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

export default app; // 3000 by default
