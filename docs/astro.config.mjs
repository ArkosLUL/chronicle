// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://docs.chronicleclassic.com',
	integrations: [
		starlight({
			title: 'Chronicle Docs',
			description: 'Documentation for Chronicle - game-play performance analysis for Classic World of Warcraft',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/Emyrk/chronicle' },
			],
			sidebar: [
				{
					label: 'Combat Log Parsing',
					autogenerate: { directory: 'parsing' },
				},
				{
					label: 'Encounter Detection',
					autogenerate: { directory: 'encounters' },
				},
				{
					label: 'Instances',
					autogenerate: { directory: 'instances' },
				},
				{
					label: 'Architecture',
					autogenerate: { directory: 'architecture' },
				},
			],
			editLink: {
				baseUrl: 'https://github.com/Emyrk/chronicle/edit/main/docs/',
			},
			customCss: ['./src/styles/custom.css'],
			// Force dark mode - override theme components
			components: {
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/ThemeSelect.astro',
			},
		}),
	],
});
