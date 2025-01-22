import { error } from '@sveltejs/kit';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
//@ts-ignore
import { compile } from 'mdsvex';

export const load = (async ({ params }) => {
    try {
        const { slug } = params;
        const contentDir = join(process.cwd(), 'src', 'content');

        // Read all content files to build sidebar
        const files = await readdir(contentDir, { recursive: true });
        const contentFiles = files.filter(file => 
            file.endsWith('.md') || file.endsWith('.svx')
        ).map(file => ({
            path: file,
            slug: file.replace(/\.(md|svx)$/, ''),
            title: file.replace(/\.md$/, '').replace(/\.svx$/, ''),
        }));

        // Find the requested content file
        let content: {
            code: string,
            data: any
        } = {
            code: '',
            data: {}
        };
        const filePath = join(contentDir, `${slug}.svx`);
        try {
            content = await compile(await readFile(filePath, 'utf-8'));
        } catch {
            try {
                content = await compile(await readFile(join(contentDir, `${slug}.md`), 'utf-8'));
            } catch {
                throw error(404, `Content not found for ${slug}`);
            }
        }

        return {
            content,
            sidebar: contentFiles,
            currentSlug: slug
        };
    } catch (e) {
        console.error(e);
        throw error(404, 'Content not found');
    }
});
