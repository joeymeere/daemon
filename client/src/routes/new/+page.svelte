<script lang="ts">
	let isMultiple = false;
	let name = '';
	let personality = '';

	$: amountOfDaemons = name.split(',').length;
	$: if (amountOfDaemons > 1) {
		isMultiple = true;
	} else {
		isMultiple = false;
	}
</script>

<div class="flex h-full flex-col gap-4">
	<p class="mx-auto pt-2 text-xl">Create a new daemon</p>

	<div class="mx-auto">
		<label class="inline-flex cursor-pointer items-center gap-2">
			<span class="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Single Daemon</span>
			<input type="checkbox" value="" class="peer sr-only" bind:checked={isMultiple} />
			<div
				class="peer relative h-6 w-11 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rtl:peer-checked:after:-translate-x-full dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"
			></div>
			<span class="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Multiple Daemons</span
			>
		</label>
	</div>

	<div class="w-full">
		<p>Name{isMultiple ? 's' : ''}</p>
		{#if isMultiple}
			<textarea
				bind:value={name}
				class="text-secondary placeholder:text-secondary w-full p-1 placeholder:opacity-50"
				placeholder="Enter names seperated by commas"
			></textarea>
		{:else}
			<input
				bind:value={name}
				class="text-secondary placeholder:text-secondary w-full p-1 placeholder:opacity-50"
				placeholder="What's my name?"
			/>
		{/if}
	</div>
	<div class="w-full">
		<p>Personality</p>
		<textarea
			bind:value={personality}
			class="text-secondary placeholder:text-secondary w-full p-1 placeholder:opacity-50"
			placeholder="what defines my personality"
		></textarea>
	</div>

	<button>
		Create {name.split(',').length} daemon{amountOfDaemons > 1 ? 's' : ''}
	</button>
</div>
