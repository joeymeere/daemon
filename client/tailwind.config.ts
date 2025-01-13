import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {
			fontFamily: {
				'syne-mono': ['Syne Mono', 'monospace']
			},
			colors: {
				primary: '#FFF9EB',
				secondary: '#353535',
				highlight: '#F3E9D2',
				cta: '#558173'
			}
		}
	},

	plugins: []
} satisfies Config;
