<script lang="ts">
	import { onMount } from 'svelte';
	import { checkWallet, connectWallet, sendTransaction } from '$lib/wallet/walletHelpers.svelte';

	let walletAddress: string | null = null;
	let balance = 0;
	let recipient = ''; // Enter the recipient address here
	let amount = ''; // Enter the amount (in SOL) to send

	onMount(() => {
		checkWallet();

		if (window.solana) {
			connectWallet().then((res) => {
				if (!res) return console.error('Failed to connect wallet');
				walletAddress = res.walletAddress;
				balance = res.balance ?? 0;
			});
		}
	});
</script>

<div class="container">
	<h1>Solana Wallet</h1>

	{#if walletAddress}
		<p><strong>Connected Wallet:</strong> {walletAddress}</p>
		<p><strong>Balance:</strong> {balance} SOL</p>

		<input type="text" placeholder="Recipient Address" bind:value={recipient} />
		<input type="number" placeholder="Amount (SOL)" bind:value={amount} />

		<button
			class="btn"
			onclick={() =>
				sendTransaction({
					walletAddress,
					recipient,
					amount
				})}>Send Transaction</button
		>
	{:else}
		<button class="btn" onclick={() => connectWallet()}>Connect Wallet</button>
	{/if}
</div>

<style>
	.container {
		padding: 20px;
		max-width: 400px;
		margin: auto;
		font-family: Arial, sans-serif;
	}
	.btn {
		display: inline-block;
		padding: 10px 20px;
		margin: 10px 0;
		background-color: #4caf50;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		text-align: center;
	}
	.btn:hover {
		background-color: #45a049;
	}
	input {
		width: calc(100% - 20px);
		padding: 10px;
		margin: 10px 0;
		border: 1px solid #ccc;
		border-radius: 4px;
	}
</style>
