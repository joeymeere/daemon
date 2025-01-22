<!-- +page.svelte -->
<script lang="ts">
    import { theme } from '$lib/theme.svelte';
    import { onMount } from 'svelte';
    import type { PageData } from './$types';
    
    interface FileEntry {
        slug: string;
        title: string;
        path: string;
        directory: string | null;
    }

    interface Sidebar {
        [key: string]: FileEntry[];
    }
    
    let { data } = $props<{ data: PageData }>();
    let content = $derived(data.content);
    let sidebar = $derived(data.sidebar);
    let currentSlug = $derived(data.currentSlug);
    let sidebarOpen = $state(false);
    
    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
    }
    
    onMount(() => {
        theme.initialize();
    });

    const typedSidebar = $derived(sidebar as Sidebar);
</script>

<div class="page-container">
    <!-- Theme toggle button -->
    <button class="theme-toggle" onclick={theme.toggle} aria-label="Toggle theme">
        {#if !theme.dark}
            <span>🌙</span>
        {:else}
            <span>☀️</span>
        {/if}
    </button>
    
    <!-- Sidebar -->
    <aside class="sidebar" class:open={sidebarOpen}>
        <div class="sidebar-content">
            <nav class="sidebar-nav">
                {#if typedSidebar.root}
                    {#each typedSidebar.root as file}
                        <a href="/{file.slug}" 
                            data-sveltekit-preload-data
                            class="nav-link"
                            class:active={currentSlug === file.slug}>
                            {file.title}
                        </a>
                    {/each}
                {/if}
                
                {#each Object.entries(typedSidebar) as [directory, files]}
                    {#if directory !== 'root'}
                        <div class="directory-group">
                            <h3 class="directory-heading">{directory}</h3>
                            {#each files as file}
                                <a href="/{file.slug}" 
                                    data-sveltekit-preload-data
                                    class="nav-link indented"
                                    class:active={currentSlug === file.slug}>
                                    {file.title}
                                </a>
                            {/each}
                        </div>
                    {/if}
                {/each}
            </nav>
        </div>
    </aside>

    <!-- Mobile sidebar toggle -->
    <button type="button" 
        class="mobile-toggle"
        onclick={toggleSidebar}>
        <span class="sr-only">Toggle sidebar</span>
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
    </button>

    <!-- Main content -->
    <div class="content">
        <main class="content-inner">
            {#if content?.data?.fm}
                <h1>{content.data.fm.title}</h1>
                <h3>{content.data.fm.description}</h3>
                <hr />
                {@html content.code}
            {/if}
        </main>
    </div>
</div>

<style>
    .page-container {
        display: flex;
        min-height: 100vh;
        background: var(--bg-primary);
        color: var(--text-primary);
    }
    
    .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 40;
        height: 100vh;
        width: 16rem;
        background: var(--sidebar-bg);
        transform: translateX(-100%);
        transition: transform 0.3s ease-in-out;
    }
    
    .sidebar.open {
        transform: translateX(0);
    }
    
    @media (min-width: 1024px) {
        .sidebar {
            transform: translateX(0);
        }
    }
    
    .sidebar-content {
        display: flex;
        height: 100%;
        flex-direction: column;
        overflow-y: auto;
        border-right: 1px solid var(--border-color);
    }
    
    .sidebar-nav {
        flex: 1;
        padding: 1rem 0.5rem;
    }
    
    .nav-link {
        display: flex;
        align-items: center;
        padding: 0.5rem;
        margin-bottom: 0.25rem;
        border-radius: 0.5rem;
        color: var(--sidebar-text);
        text-decoration: none;
        transition: background-color 0.2s ease;
    }
    
    .nav-link:hover {
        background: var(--sidebar-hover);
    }
    
    .nav-link.active {
        background: var(--sidebar-hover);
        color: var(--accent-color);
    }
    
    .nav-link.indented {
        padding-left: 1.5rem;
    }
    
    .directory-heading {
        font-weight: 600;
        font-size: 1.1em;
        color: var(--text-primary);
        margin: 1rem 0 0.5rem;
        padding-left: 0.5rem;
    }

    .directory-group {
        margin-bottom: 1rem;
    }
    
    .theme-toggle {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 50;
        padding: 0.625rem;
        border-radius: 0.5rem;
        color: var(--text-secondary);
        background: var(--bg-secondary);
        transition: background-color 0.2s ease;
    }
    
    .theme-toggle:hover {
        background: var(--sidebar-hover);
    }
    
    .mobile-toggle {
        position: fixed;
        top: 1rem;
        left: 1rem;
        z-index: 50;
        padding: 0.5rem;
        border-radius: 0.5rem;
        color: var(--text-secondary);
        background: var(--bg-secondary);
        transition: background-color 0.2s ease;
    }
    
    @media (min-width: 1024px) {
        .mobile-toggle {
            display: none;
        }
    }
    
    .mobile-toggle:hover {
        background: var(--sidebar-hover);
    }
    
    .icon {
        width: 1.25rem;
        height: 1.25rem;
    }
    
    .content {
        flex: 1;
        margin-left: 0;
    }
    
    @media (min-width: 1024px) {
        .content {
            margin-left: 16rem;
        }
    }
    
    .content-inner {
        padding: 1rem;
    }
    
    @media (min-width: 768px) {
        .content-inner {
            padding: 2rem;
        }
    }
    
    :global(.content-inner h1) {
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 1rem;
        color: var(--text-primary);
    }
    
    :global(.content-inner h2) {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 1.5rem 0 1rem;
        color: var(--text-primary);
    }
    
    :global(.content-inner p) {
        margin-bottom: 1rem;
        line-height: 1.6;
        color: var(--text-secondary);
    }
    
    :global(.content-inner a) {
        color: var(--accent-color);
        text-decoration: none;
    }
    
    :global(.content-inner a:hover) {
        text-decoration: underline;
    }
    
    :global(.content-inner pre) {
        background: var(--bg-secondary);
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin: 1rem 0;
    }
    
    :global(.content-inner code) {
        font-family: monospace;
        background: var(--bg-secondary);
        padding: 0.2rem 0.4rem;
        border-radius: 0.25rem;
    }
</style>
