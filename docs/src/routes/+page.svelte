<script>
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { theme } from '$lib/theme.svelte';

  onMount(() => {
    theme.initialize();
  });
</script>

<div class="page-container">
  <button class="theme-toggle" on:click={theme.toggle} aria-label="Toggle theme">
    {#if theme}
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
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f0f9ff;
    --bg-gradient: linear-gradient(135deg, #f0f9ff 0%, #e1f4ff 100%);
    --text-primary: #1a202c;
    --text-secondary: #4a5568;
    --card-bg: #ffffff;
    --card-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    --button-bg: #4299e1;
    --button-hover: #3182ce;
  }

  :root.dark {
    --bg-primary: #1a202c;
    --bg-secondary: #2d3748;
    --bg-gradient: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
    --text-primary: #f7fafc;
    --text-secondary: #e2e8f0;
    --card-bg: #2d3748;
    --card-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    --button-bg: #4299e1;
    --button-hover: #2b6cb0;
  }

  :global(body) {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  .page-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 2rem;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .hero {
    margin-bottom: 3rem;
    overflow: hidden;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto 3rem;
  }

  .hero img {
    width: 60%;
    height: auto;
    display: block;
    border-radius: 0.5rem;
  }

  .hero-text {
    width: 40%;
    padding-right: 0;
    text-align: right;
  }

  .hero-text h1 {
    font-size: 4rem;
    margin: 0;
    line-height: 1;
    color: var(--text-primary);
  }

  .hero-text h3 {
    font-size: 1.5rem;
    margin: 1rem 0 2rem 0;
    font-weight: normal;
    color: var(--text-secondary);
  }

  .hero-text strong {
    color: #74e3e1;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    padding: 2rem 0;
  }

  .feature-card {
    background: var(--card-bg);
    padding: 2rem;
    border-radius: 0.5rem;
    box-shadow: var(--card-shadow);
    transition: transform 0.2s ease;
  }

  .feature-card:hover {
    transform: translateY(-5px);
  }

  .feature-card h2 {
    font-size: 1.5rem;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .feature-card p {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .feature-card a {
    color: #74e3e1;
    text-decoration: none;
  }

  .feature-card a:hover {
    text-decoration: underline;
  }

  .theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    padding: 0.5rem;
    font-size: 1.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 100;
    border-radius: 50%;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.3s ease;
  }

  .theme-toggle:hover {
    background-color: var(--bg-secondary);
  }

  .cta-button {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background-color: #74e3e1;
    color: #1a202c;
    text-decoration: none;
    border-radius: 0.375rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .cta-button:hover {
    background-color: #5ccac8;
    transform: translateY(-2px);
  }

  @media (max-width: 768px) {
    .hero {
      flex-direction: column;
      text-align: center;
    }

    .hero img {
      width: 100%;
      margin-bottom: 2rem;
    }

    .hero-text {
      width: 100%;
      text-align: center;
      padding-right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .hero-text h1 {
      font-size: 3rem;
    }

    .hero-text h3 {
      font-size: 1.25rem;
    }
  }
</style>
