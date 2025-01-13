<script lang="ts">
	import { updateDaemons } from '$lib/stores/daemon.svelte';
	import { Keypair } from '@solana/web3.js';
	import { Daemon, type Character } from '@spacemangaming/daemon';

	let name = $state('');
	let bio = $state('');
	let lore = $state('');
	let identityPrompt = $state('');
	let char: Daemon | null = $state(null);
	let apiKey: string | null = $state(null);

	async function createDaemon() {
		const dae = new Daemon();
		const keypair = Keypair.generate();
		const character = {
			name: name,
			pubkey: keypair.publicKey.toBase58(),
			modelSettings: {
				generation: {
					provider: 'openai',
					endpoint: 'https://api.openai.com/v1',
					name: 'gpt-4o'
				},
				embedding: {
					provider: 'openai',
					endpoint: 'https://api.openai.com/v1',
					name: 'text-embedding-3-small'
				}
			},
			bio: [bio],
			lore: [lore],
			identityPrompt: identityPrompt
		} as Character;

		await dae.init({
			character,
			contextServerUrl: `http://localhost:5173/api`,
			privateKey: keypair,
			modelApiKeys: {
				generationKey: apiKey ?? process.env.OPENAI_API_KEY!,
				embeddingKey: apiKey ?? process.env.OPENAI_API_KEY!
			}
		});

		char = dae;

		console.log({ dae, char });

		updateDaemons.addDaemon(char);
	}
</script>

<div class="flex h-full flex-col gap-4">
	<a href="/">Back to Home</a>
	<p class="mx-auto pt-2 text-xl">Create a new daemon</p>

	<div class="w-full">
		<p>apiKey</p>
		<input
			bind:value={apiKey}
			class="w-full p-1 text-secondary placeholder:text-secondary placeholder:opacity-50"
			placeholder="openAi apikey"
		/>
	</div>

	<div class="w-full">
		<p>Name</p>
		<input
			bind:value={name}
			class="w-full p-1 text-secondary placeholder:text-secondary placeholder:opacity-50"
			placeholder="What's my name?"
		/>
	</div>

	<div class="w-full">
		<p>Bio</p>
		<input
			bind:value={bio}
			class="w-full p-1 text-secondary placeholder:text-secondary placeholder:opacity-50"
			placeholder="What's my bio?"
		/>
	</div>

	<div class="w-full">
		<p>Lore</p>
		<input
			bind:value={lore}
			class="w-full p-1 text-secondary placeholder:text-secondary placeholder:opacity-50"
			placeholder="What's my background lore?"
		/>
	</div>
	<div class="w-full">
		<p>Personality</p>
		<textarea
			bind:value={identityPrompt}
			class="w-full p-1 text-secondary placeholder:text-secondary placeholder:opacity-50"
			placeholder="what defines my personality identity?"
		></textarea>
	</div>

	<button onclick={createDaemon}> Create Daemon </button>

	<p>
		{JSON.stringify(char)}
	</p>
</div>
