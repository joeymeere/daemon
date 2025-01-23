<script>
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { theme } from '$lib/theme.svelte.ts';

  onMount(() => {
    theme.initialize();
  });
</script>

<div class="page-container">
  <button class="theme-toggle" on:click={() => theme.toggle()} aria-label="Toggle theme">
    {#if theme.dark}
      <span>🌙</span>
    {:else}
      <span>☀️</span>
    {/if}
  </button>

  <main class="container">
    <div class="hero" transition:fade>
      <img src="/daemon.png" alt="Daemon Logo" />
      <div class="hero-text">
        <h1>Daemon</h1>
        <h3>a <strong>modular</strong> framework for building AI swarms</h3>  
        <a href="/docs" class="cta-button">Get Started →</a>
      </div>
    </div>

    <section class="features">
      <div class="feature-card">
        <h2>🚀 Tools-As-A-Service</h2>
        <p>Scalable multi agent architecture where agents can *pool* resources and keep the agents themselves extremely lightweight. </p>
      </div>

      <div class="feature-card">
        <h2>📚 Standards Based</h2>
        <p>Standards based modules using <a href="https://modelcontextprotocol.io">Model Context Protocol</a> that allow agents access to wide variety of tools and resources</p>
      </div>

      <div class="feature-card">
        <h2>💡 Works Out of the Box!</h2>
        <p>Basic memory and personality management out of the box, with options to extend it further</p>
      </div>
    </section>
  </main>
</div>

<style>
  .theme-toggle {
    position: fixed;
    top: 1rem;
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
    transform: scale(1.1);
  }

  .cta-button {
    display: inline-block;
    padding: 1rem 2rem;
    background-color: var(--button-bg);
    color: white;
    text-decoration: none;
    border-radius: 0.5rem;
    font-weight: bold;
    transition: background-color 0.2s ease;
  }

  .cta-button:hover {
    background-color: var(--button-hover);
  }

  a {
    color: var(--button-bg);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
</style>
