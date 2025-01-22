declare module 'mdsvex' {
    export interface MdsvexOptions {
        extensions?: string[];
        smartypants?: boolean | object;
        remarkPlugins?: any[];
        rehypePlugins?: any[];
        layout?: string | Record<string, string>;
        highlight?: any;
    }

    export function mdsvex(options?: MdsvexOptions): any;
}
