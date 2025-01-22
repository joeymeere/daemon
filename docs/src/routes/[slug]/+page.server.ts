import { error } from '@sveltejs/kit';
import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import * as path from 'path';
//@ts-ignore
import { compile } from 'mdsvex';

interface Heading {
    id: string;
    text: string;
    level: number;
    children: Heading[];
}

function extractHeadings(content: string): Heading[] {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: Heading[] = [];
    let lastHeadingByLevel: { [key: number]: Heading } = {};
    
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
        const level = match[1].length;
        const text = match[2];
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        const heading: Heading = {
            id,
            text,
            level,
            children: []
        };
        
        if (level === 1) {
            headings.push(heading);
        } else {
            let parentLevel = level - 1;
            while (parentLevel > 0) {
                if (lastHeadingByLevel[parentLevel]) {
                    lastHeadingByLevel[parentLevel].children.push(heading);
                    break;
                }
                parentLevel--;
            }
            if (parentLevel === 0) {
                headings.push(heading);
            }
        }
        
        lastHeadingByLevel[level] = heading;
    }
    
    return headings;
}

export const load = (async ({ params }) => {
    try {
        const { slug } = params;
        const contentDir = join(process.cwd(), 'src', 'content');

        // Create content directory if it doesn't exist
        if (!existsSync(contentDir)) {
            await mkdir(contentDir, { recursive: true });
            // Create a default index.md file
            const defaultContent = `# Welcome to the Documentation
            
## Getting Started
Welcome to the documentation. This is a default page created automatically.

## Next Steps
Start adding more markdown files to the \`src/content\` directory to build your documentation.
`;
            await writeFile(join(contentDir, 'index.md'), defaultContent, 'utf-8');
        }

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
        let rawContent = '';
        
        // Handle both direct file paths and directory/file paths
        const possiblePaths = [
            join(contentDir, `${slug}.svx`),
            join(contentDir, `${slug}.md`),
            join(contentDir, slug.replace(/\//g, '/').replace(/^\/+|\/+$/g, '') + '.svx'),
            join(contentDir, slug.replace(/\//g, '/').replace(/^\/+|\/+$/g, '') + '.md')
        ];

        let foundContent = false;
        for (const filePath of possiblePaths) {
            try {
                if (existsSync(filePath)) {
                    rawContent = await readFile(filePath, 'utf-8');
                    content = await compile(rawContent);
                    foundContent = true;
                    break;
                }
            } catch (err) {
                console.error(`Error reading file ${filePath}:`, err);
            }
        }

        if (!foundContent) {
            throw error(404, `Content not found for ${slug}`);
        }

        // Extract headings from the raw content
        const headings = extractHeadings(rawContent);

        // Add IDs to headings in the HTML content
        content.code = content.code.replace(
            /<h([1-6])>(.+?)<\/h\1>/g,
            (_, level, text) => {
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                return `<h${level} id="${id}">${text}</h${level}>`;
            }
        );

        return {
            content,
            sidebar: groupedFiles,
            currentSlug: slug,
            headings
        };
    } catch (e) {
        console.error(e);
        throw error(404, 'Content not found');
    }
});
