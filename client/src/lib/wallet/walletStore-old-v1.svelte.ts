import { writable, type Writable } from 'svelte/store';
import type { Adapter, WalletAdapter } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Connection, PublicKey } from '@solana/web3.js';
import { PUBLIC_RPC_URL } from '$env/static/public';

// Create wallet store
export const walletStore: Writable<{
	wallet: WalletAdapter | null;
	publicKey: PublicKey | null;
	connection: Connection | null;
	connected: boolean;
}> = writable({
	wallet: null,
	publicKey: null,
	connection: null,
	connected: false
});

// Create wallet adapters
export function createWalletAdapters() {
	const adapters = [new PhantomWalletAdapter()];
	const connection = new Connection(PUBLIC_RPC_URL, 'confirmed');
	walletStore.update((store) => ({
		...store,
		connection
	}));
	return {
		adapters,
		connection
	};
}

// Wallet connection utility
export function connectWallet(adapter: Adapter) {
	if (adapter.readyState === 'Installed') {
		adapter
			.connect()
			.then(() => {
				walletStore.update((store) => ({
					...store,
					wallet: adapter as WalletAdapter,
					publicKey: adapter.publicKey,
					connected: true
				}));
			})
			.catch((error: Error) => {
				console.error('Wallet connection failed', error);
			});
	}
}
// Disconnect wallet
export function disconnectWallet(adapter: Adapter) {
	adapter
		.disconnect()
		.then(() => {
			walletStore.update((store) => ({
				...store,
				wallet: null,
				publicKey: null,
				connected: false
			}));
		})
		.catch((error: Error) => {
			console.error('Wallet disconnection failed', error);
		});
}
