<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import { Buffer } from 'buffer';

	let { children } = $props();

	onMount(() => {
		// Polyfill for Buffer - needed for Solana wallet
		if (!window.Buffer) {
			window.Buffer = Buffer;
		}
	});
</script>

<div class="font-syne-mono flex h-screen w-screen flex-col">
	{@render children()}
</div>
