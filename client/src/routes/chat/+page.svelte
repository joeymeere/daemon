<script lang="ts">
	import { page } from '$app/state';
	import { daemonStore } from '$lib/stores/daemon.svelte';
	import { Daemon } from '@spacemangaming/daemon';
	import { onMount } from 'svelte';

	const id = page.url.searchParams.get('id');
	const channelId = page.url.searchParams.get('channel');
	let selectedDaemon: Daemon | null = $state(null);

	let chatInput = $state('');
	let chatInputs: string[] = $state([]);
	let chatOutputs: { isMe: boolean; message: string }[] = $state([]);

	async function sendMessage() {
		const tempChat = chatInput;
		chatInputs.push({ isMe: true, message: chatInput ?? '' });

		const lifecycle = await selectedDaemon?.message(tempChat, {
			channelId: channelId ?? 'foobar'
		});

		chatOutputs.push(lifecycle?.output ?? '...');
	}

	onMount(() => {
		selectedDaemon = $daemonStore.find((daemon: Daemon) => daemon.id === id) ?? null;
	});
</script>

<div class="flex h-[2.5rem] items-center gap-2 bg-gray-500 p-2">
	<a href="/"> Back </a>
	<h1>| Chat with {selectedDaemon?.character?.name}</h1>
</div>
<div class="flex h-[calc(100vh-5rem)] flex-col">
	{#each chatOutputs as output}
		<p>{output}</p>
	{/each}
</div>
<div class="flex h-[2.5rem] items-center bg-gray-500 p-2">
	<input class="w-full bg-transparent p-1" bind:value={chatInput} />
	<button class="p-1" onclick={sendMessage}> {'>'} </button>
</div>
