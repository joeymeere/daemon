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
        ).map(file => {
            const parts = file.split('/');
            return {
                path: file,
                slug: file.replace(/\.(md|svx)$/, ''),
                title: parts[parts.length - 1].replace(/\.(md|svx)$/, ''),
                directory: parts.length > 1 ? parts.slice(0, -1).join('/') : null
            };
        });

        // Group files by directory
        const groupedFiles = contentFiles.reduce((acc, file) => {
            if (file.directory) {
                if (!acc[file.directory]) {
                    acc[file.directory] = [];
                }
                acc[file.directory].push(file);
            } else {
                if (!acc['root']) {
                    acc['root'] = [];
                }
                acc['root'].push(file);
            }
            return acc;
        }, {} as Record<string, typeof contentFiles>);

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
            sidebar: groupedFiles,
            currentSlug: slug
        };
    } catch (e) {
        console.error(e);
        throw error(404, 'Content not found');
    }
});
