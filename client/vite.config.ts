import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	plugins: [sveltekit(), nodePolyfills()],
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:3000/sse',
				changeOrigin: true,
				rewrite: (path: string) => path.replace(/^\/api/, '')
			},
			'/messages': {
				target: 'http://localhost:3000/messages',
				changeOrigin: true,
				rewrite: (path: string) => path.replace(/^\/api/, '')
			}
		}
	}
});
