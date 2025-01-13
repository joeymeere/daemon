<script lang="ts">
	import { daemonStore } from '$lib/stores/daemon.svelte';
	import { Daemon } from '@spacemangaming/daemon';

	console.log($daemonStore);
</script>

{#snippet char(daemon: Daemon)}
	<a href={'/chat?id=' + daemon.id + '&channel=1'} class="w-full">
		<div class="w-full rounded border-2 border-primary p-2">
			<div class="flex justify-between">
				<p class="text-xl">{daemon.character?.name}</p>
				<p>
					{daemon.id}
				</p>
			</div>
			<p>
				{daemon.character?.bio}
			</p>
			<p>
				{daemon.character?.lore}
			</p>
			<p>
				{daemon.character?.identityPrompt}
			</p>
		</div>
	</a>
{/snippet}

<div class="flex flex-col items-center gap-4">
	<p class="pt-2 text-2xl">Welcome to Daemon</p>
	<a href="/new">
		<button class="rounded-lg border-2 border-primary p-2"> + Create new daemon </button>
	</a>
	<div class="h-1 w-full bg-cta"></div>
	{#each $daemonStore as daemon}
		{@render char(daemon)}
	{/each}
</div>
