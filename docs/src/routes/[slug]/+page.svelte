<!-- +page.svelte -->
<script lang="ts">
    import { theme } from '$lib/theme.svelte';
	import type { PageProps } from './$types';

    let { data }: PageProps = $props()
    let { content, sidebar, currentSlug } = data
    let sidebarOpen = $state(false);
    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
    }

</script>

<div class="flex min-h-screen bg-white dark:bg-gray-900">
    <!-- Sidebar -->
    <aside class:translate-x-0={sidebarOpen} class:translate-x-[-100%]={!sidebarOpen} 
           class="fixed left-0 top-0 z-40 h-screen w-64 transition-transform lg:translate-x-0 bg-gray-50 dark:bg-gray-800">
        <div class="flex h-full flex-col overflow-y-auto border-r border-gray-200 dark:border-gray-700">
            <nav class="flex-1 space-y-1 px-2 py-4">
                {#each sidebar as { slug, path, title }}
                    <a href="/{slug}" 
                       class="flex items-center rounded-lg p-2 text-base font-normal
                              {currentSlug === slug ? 
                                'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 
                                'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}">
                        {title}
                    </a>
                {/each}
            </nav>
        </div>
    </aside>

    <!-- Mobile sidebar toggle -->
    <button type="button" 
            class="fixed top-4 left-4 z-50 lg:hidden rounded-lg p-2 
                   text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 
                   focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 
                   dark:focus:ring-gray-600"
            onclick={toggleSidebar}>
        <span class="sr-only">Toggle sidebar</span>
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
    </button>

    <!-- Main content -->
    <div class="flex-1 lg:ml-64">
        <main class="p-4 md:p-8">
            <!-- Theme toggle -->
            <button type="button" 
                    class="fixed top-4 right-4 z-50 rounded-lg p-2.5 
                           text-gray-500 hover:bg-gray-100 focus:outline-none 
                           focus:ring-4 focus:ring-gray-200 dark:text-gray-400 
                           dark:hover:bg-gray-700 dark:focus:ring-gray-700"
                    onclick={theme.toggle}>
                <span class="sr-only">Toggle dark mode</span>
                {#if theme.dark}
                    <!-- Sun icon -->
                    <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>
                    </svg>
                {:else}
                    <!-- Moon icon -->
                    <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                    </svg>
                {/if}
            </button>

            <!-- Content -->
            <article class="prose dark:prose-invert max-w-none">
                <h1>{content.data.fm.title}</h1>
                <h3>{content.data.fm.description}</h3>
                <hr />
                {@html content.code}
            </article>
        </main>
    </div>
</div>

<style lang="postcss">
    :global(.prose) {
        @apply prose-slate max-w-none;
    }
    :global(.dark .prose) {
        @apply prose-invert;
    }
</style>
