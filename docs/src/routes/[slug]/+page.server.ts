import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
//@ts-ignore
import {compile} from 'mdsvex';

interface Content {
    type: 'file' | 'folder';
    path: string;
    slug: string;
    order: number;
    title: string;
    description: string;
    html: string;
}

interface NestedFolderLayout {
    [slug: string]: Content | NestedFolderLayout; // slug => file data | folder that has files
}

async function buildLayoutTree(dir: string): Promise<NestedFolderLayout> {
    const getSlugFromFile = (file: string) => {
        const relativePath = relative(dir, file);
        const slug = relativePath
            .replace(/\.svx$/, '')
            .replace(/\.md$/, '')
            .replace(/\\/g, '/')
            .replace(/\s+/g, '-')
            .toLowerCase();
        return slug;
    };

    async function traverse(currentDir: string): Promise<NestedFolderLayout> {
        const layout: NestedFolderLayout = {};
        const files = readdirSync(currentDir);
        
        for (const file of files) {
            const fullPath = join(currentDir, file);
            const stat = statSync(fullPath);
            if(stat.isDirectory()) {
                const folderLayout = await traverse(fullPath);
                layout[getSlugFromFile(fullPath)] = {
                    type: 'folder',
                    path: relative(currentDir, fullPath),
                    slug: getSlugFromFile(fullPath),
                    order: 0,
                    title: '',
                    description: '',
                    html: '',
                    ...folderLayout
                };
            } else {
                const contentFile = readFileSync(fullPath, 'utf-8');
                const {code, data} = await compile(contentFile);
                layout[getSlugFromFile(fullPath)] = {
                    type: 'file',
                    path: relative(currentDir, fullPath),
                    slug: getSlugFromFile(fullPath),
                    order: data.order ?? 0,
                    title: data.title,
                    description: data.description,
                    html: code
                };
            }
        }
        return layout;
    }
    return await traverse(dir);
}

export const load = (async ({ params }) => {
    const { slug } = params;
    const contentDir = join(process.cwd(), 'src/content');
    const layout = await buildLayoutTree(contentDir);
    return {
        layout,
        currentSlug: slug
    };
});