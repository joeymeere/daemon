<!-- +page.svelte -->
<script lang="ts">
    import { theme } from '$lib/theme.svelte';
    import { onMount } from 'svelte';
    import type { PageData } from './$types';
    import { page } from '$app/stores';
    import { afterNavigate } from '$app/navigation';
    
    interface FileEntry {
        slug: string;
        title: string;
        path: string;
        directory: string | null;
    }

    interface Heading {
        id: string;
        text: string;
        level: number;
        children: Heading[];
    }

    interface Sidebar {
        [key: string]: FileEntry[];
    }
    
    let { data } = $props<{ data: PageData }>();
    let content = $derived(data.content);
    let sidebar = $derived(data.sidebar);
    let currentSlug = $derived(data.currentSlug);
    let headings = $derived(data.headings);
    let sidebarOpen = $state(false);
    let activeHeading = $state<string | null>(null);
    let contentElement = $state<HTMLElement | null>(null);
    
    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
    }

    function scrollToHeading(id: string) {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            activeHeading = id;
            // Update URL without triggering navigation
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.hash = id;
                history.replaceState(null, '', url.toString());
            }
        }
    }

    // Handle initial hash and post-navigation hash scrolling
    onMount(() => {
        theme.initialize();
        
        // Handle initial hash if present
        if (window.location.hash) {
            const id = window.location.hash.slice(1);
            setTimeout(() => {
                const element = document.getElementById(id);
                if (element) {
                    scrollToHeading(id);
                }
            }, 100);
        }
    });

    // Handle hash changes
    if (typeof window !== 'undefined') {
        window.addEventListener('hashchange', () => {
            const id = window.location.hash.slice(1);
            if (id) {
                const element = document.getElementById(id);
                if (element) {
                    scrollToHeading(id);
                }
            }
        });
    }

    // Track active heading on scroll
    $effect(() => {
        if (!contentElement) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    activeHeading = entry.target.id;
                    // Update URL without triggering navigation
                    const newUrl = new URL(window.location.href);
                    newUrl.hash = entry.target.id;
                    window.history.replaceState({}, '', newUrl.toString());
                }
            });
        }, {
            root: null,
            rootMargin: '-100px 0px -66%',
            threshold: 0
        });

        // Observe all headings
        const headingElements = contentElement.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
        headingElements.forEach((heading) => {
            observer.observe(heading);
        });

        return () => observer.disconnect();
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
                <!-- File navigation -->
                <div class="nav-section">
                    <h3 class="nav-section-title">Pages</h3>
                    {#if typedSidebar.root}
                        {#each typedSidebar.root as file}
                            <a href="/{file.slug}" 
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
                                    <a href="/{directory}/{file.title.toLowerCase()}" 
                                        class="nav-link indented"
                                        class:active={currentSlug === `${directory}/${file.title.toLowerCase()}`}>
                                        {file.title}
                                    </a>
                                {/each}
                            </div>
                        {/if}
                    {/each}
                </div>

                <!-- Table of Contents -->
                {#if headings?.length}
                    <div class="nav-section">
                        <h3 class="nav-section-title">On This Page</h3>
                        <div class="table-of-contents">
                            {#each headings as heading}
                                <div class="heading-item" style="margin-left: 0px">
                                    <button 
                                       class="heading-link"
                                       class:active={activeHeading === heading.id}
                                       onclick={() => scrollToHeading(heading.id)}>
                                        {heading.text}
                                    </button>
                                    {#if heading.children.length}
                                        {#each heading.children as subheading}
                                            <div class="heading-item" style="margin-left: 16px">
                                                <button
                                                   class="heading-link"
                                                   class:active={activeHeading === subheading.id}
                                                   onclick={() => scrollToHeading(subheading.id)}>
                                                    {subheading.text}
                                                </button>
                                                {#if subheading.children.length}
                                                    {#each subheading.children as subsubheading}
                                                        <div class="heading-item" style="margin-left: 32px">
                                                            <button
                                                               class="heading-link"
                                                               class:active={activeHeading === subsubheading.id}
                                                               onclick={() => scrollToHeading(subsubheading.id)}>
                                                                {subsubheading.text}
                                                            </button>
                                                        </div>
                                                    {/each}
                                                {/if}
                                            </div>
                                        {/each}
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
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
        <main class="content-inner" bind:this={contentElement}>
            {#if content?.data?.fm}
                <h1>{content.data.fm.title}</h1>
                <h3>{content.data.fm.description}</h3>
                <hr />
                {#if content.code}
                    {@html content.code}
                {/if}
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
    
    .nav-section {
        margin-bottom: 2rem;
    }

    .nav-section-title {
        font-size: 0.875rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-muted);
        margin: 1.5rem 0 0.5rem;
        padding: 0 1rem;
    }

    .table-of-contents {
        padding: 0 1rem;
    }

    .heading-item {
        margin: 0.25rem 0;
    }

    .heading-link {
        display: block;
        padding: 4px 8px;
        color: var(--text-color);
        text-decoration: none;
        border-radius: 4px;
        transition: background-color 0.2s;
        font-size: 0.9rem;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        cursor: pointer;
        margin: 0;
    }

    .heading-link:hover {
        background-color: var(--hover-bg);
        text-decoration: none;
    }

    .heading-link.active {
        background-color: var(--active-bg);
        color: var(--active-text);
    }

    /* Add smooth scrolling to the content */
    .content-inner {
        scroll-behavior: smooth;
    }
</style>
