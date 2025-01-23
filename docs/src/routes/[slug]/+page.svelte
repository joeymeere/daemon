<script lang="ts">
    import { onMount } from 'svelte';
    import { theme } from '$lib/theme.svelte.ts';
    import type { Content, NestedFolderLayout } from './+page.server';
    import { page } from '$app/state';

    const { data } = $props();
    const { layout, currentSlug, html} = data;

    onMount(() => {
        theme.initialize();
    });

    const getRenderHTMLFromSlug = (slug: string, layout: Content | NestedFolderLayout): string | undefined => {
        // First search all the files in this layout to match against slug
        let files = [];
        let folders = [];
        for(let node of Object.values(layout)) {
            if(node.type && node.type === "file") {
                files.push(node);
            } else {
                folders.push(node);
            }
        }

        for(let file of files) {   
            if(file.slug === slug) {
                return file.html;
            }
        }
        // Then search all the folders in this layout (for loop) in recursive manner to match against slug
        // If you go through ALL FOLDERS and they are undefined, return undefined
        for(let folder of folders) {
            const subHtml = getRenderHTMLFromSlug(slug, folder);
            if(subHtml) return subHtml;
        }
        return undefined;
    }

    let renderHTML = $state("");
    $effect(() => {
        renderHTML = (getRenderHTMLFromSlug(currentSlug, layout) ?? "");
    })
</script>

<header>
    <h1>Daemon Documentation</h1>
    <button class="theme-toggle" onclick={() => theme.toggle()} aria-label="Toggle theme">
        {#if theme.dark}
            <span>🌙</span>
        {:else}
            <span>☀️</span>
        {/if}
    </button>
</header>

<aside class="sidebar">
    <h2>Documentation</h2>
    <nav>
        {#snippet NavItem(item: Content | NestedFolderLayout, path = '', level = 0)}
            {#if item.type === 'file'}
                <div style="margin-left: {level * 1.5}rem">
                    <a href="/{item.slug}" class:active={currentSlug === item.slug}>
                        {item.title || item.slug}
                    </a>
                </div>
            {:else}
                <div style="margin-left: {level * 1.5}rem">
                    <span style="text-transform: capitalize;">{item.title || (item.slug as string)}</span>
                </div>
                {#each Object.entries(item).filter(([key, val]) => typeof val === 'object' && key !== 'type') as [slug, child]}
                    {@render NavItem(child, `${path}${slug}/`, level + 1)}
                {/each}
            {/if}
        {/snippet}

        {#each Object.entries(layout) as [slug, item]}
            {@render NavItem(item, '', 0)}
        {/each}
    </nav>
</aside>

<main class="main-content">
    {@html renderHTML}
</main>

<style>
    header {
        background-color: var(--bg-secondary);
        color: var(--text-primary);
        padding: 0.75rem 1.5rem;
        width: 100%;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 100;
        height: 60px;
        display: flex;
        align-items: center;
        box-shadow: var(--card-shadow);
    }

    header h1 {
        font-size: 1.25rem;
        margin: 0;
        font-weight: 600;
    }

    .sidebar {
        padding: 1rem;
        border-right: 1px solid var(--border-color);
        min-width: 250px;
        max-width: 350px;
        background-color: var(--bg-secondary);
        height: 100vh;
        overflow-y: auto;
        transition: all 0.3s ease;
        position: fixed;
        top: 0;
        left: 0;
        color: var(--text-primary);
    }

    .sidebar nav {
        margin-top: 1rem;
    }

    .sidebar a {
        color: var(--text-color);
        text-decoration: none;
        display: block;
        padding: 0.5rem 0;
    }

    .sidebar a:hover {
        color: var(--accent-color);
    }

    .sidebar a.active {
        color: var(--accent-color);
        font-weight: bold;
    }

    .sidebar span {
        display: block;
        padding: 0.5rem 0;
        color: var(--text-muted);
        font-weight: bold;
    }

    .main-content {
        margin-left: 280px;
        padding: 5rem 2rem 2rem;
        max-width: 65rem;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        min-height: 100vh;
    }

    .main-content section {
        margin-bottom: 3rem;
    }

    .main-content h2 {
        font-size: 1.875rem;
        margin: 2rem 0 1rem;
        font-weight: 600;
    }

    .main-content p {
        line-height: 1.6;
        color: var(--text-secondary);
        margin: 1rem 0;
    }

    .theme-toggle {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        right: 1rem;
        padding: 0.5rem;
        border: none;
        background: var(--card-bg);
        border-radius: 50%;
        box-shadow: var(--card-shadow);
        cursor: pointer;
        transition: transform 0.2s ease;
        z-index: 1000;
    }

    .theme-toggle:hover {
        transform: translateY(-50%) scale(1.1);
    }

    @media (max-width: 768px) {
        .sidebar {
            width: 240px;
        }
        .main-content {
            margin-left: 240px;
            padding: 5rem 1rem 1rem;
        }
    }
</style>
