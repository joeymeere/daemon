import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {
			fontFamily: {
				'syne-mono': ['Syne Mono', 'monospace']
			}
		}
	},

	plugins: []
} satisfies Config;
