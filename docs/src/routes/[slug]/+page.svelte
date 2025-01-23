<script>
    import { onMount } from 'svelte';
    import { theme } from '$lib/theme.svelte.ts';

    const { data } = $props();

    onMount(() => {
        theme.initialize();
        console.log(data.currentSlug);
        console.log(data.layout);
    });

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
    <h2>Table of Contents</h2>
    <ul>
        <li><a href="#section1">Section 1</a></li>
        <li><a href="#section2">Section 2</a></li>
        <li><a href="#section3">Section 3</a></li>
    </ul>
</aside>

<main class="main-content">
    <section id="section1">
        <h2>Section 1</h2>
        <p>This is the content for section 1.</p>
    </section>
    <section id="section2">
        <h2>Section 2</h2>
        <p>This is the content for section 2.</p>
    </section>
    <section id="section3">
        <h2>Section 3</h2>
        <p>This is the content for section 3.</p>
    </section>
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
        background-color: var(--bg-secondary);
        height: 100vh;
        overflow-y: auto;
        transition: all 0.3s ease;
        position: fixed;
        top: 0;
        left: 0;
        width: 280px;
        padding: 5rem 0 2rem 0;
        box-shadow: var(--card-shadow);
        color: var(--text-primary);
    }

    .sidebar h2 {
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        padding: 0 1.5rem;
        margin: 2rem 0 0.5rem;
    }

    .sidebar ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .sidebar li {
        margin: 0;
        padding: 0;
    }

    .sidebar a {
        display: block;
        padding: 0.5rem 1.5rem;
        color: var(--text-primary);
        text-decoration: none;
        transition: background-color 0.2s ease;
    }

    .sidebar a:hover {
        background-color: var(--bg-primary);
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
