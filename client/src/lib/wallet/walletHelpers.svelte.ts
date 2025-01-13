import {
	Connection,
	PublicKey,
	Transaction,
	SystemProgram
} from '@solana/web3.js';
import { PUBLIC_RPC_URL } from '$env/static/public';
import { walletStore } from '$lib/wallet/walletStore.svelte';
import { get } from 'svelte/store';

// Check if Phantom wallet is available
export const checkWallet = async () => {
	if ('solana' in window && window.solana.isPhantom) {
		console.log('Phantom wallet found!');
		return window.solana;
	} else {
		alert('Phantom wallet not found. Please install it.');
		return null;
	}
};

// Connect to the wallet
export const connectWallet = async (connection?: Connection) => {
	const wallet = await checkWallet();
	if (!wallet) return;
	try {
		const response = await wallet.connect();
		const walletAddress = response.publicKey.toString();
		const balance = await getBalance(walletAddress, connection);

		// update wallet store with wallet address and balance
		walletStore.update((store) => ({
			...store,
			walletAddress,
			balance
		}));

		return { walletAddress, balance };
	} catch (error) {
		console.error('Wallet connection failed:', error);
	}
};

// Get wallet balance
export const getBalance = async (
	walletAddress: string,
	_connection?: Connection
) => {
	if (!walletAddress) return;

	const wallet = get(walletStore);

	// use connection prop if provided, otherwise use wallet store connection, lastly default connection
	let connection =
		_connection || wallet.connection || new Connection(PUBLIC_RPC_URL);

	// if not connection in store, update store with connection
	if (!wallet.connection) {
		walletStore.update((store) => ({
			...store,
			connection
		}));
	}

	try {
		const publicKey = new PublicKey(walletAddress);
		const lamports = await connection.getBalance(publicKey);
		const balance = lamports / 1e9; // Convert lamports to SOL
		return balance;
	} catch (error) {
		console.error('Failed to fetch balance:', error);
	}
};

// Send SOL transaction
export const sendTransaction = async (props: {
	walletAddress: string | null;
	recipient: string | null;
	amount: number | string;
	_connection?: Connection;
}) => {
	if (!props.walletAddress || !props.recipient || !props.amount) {
		alert('Please connect a wallet and fill out recipient and amount fields.');
		return;
	}

	let connection = props._connection || new Connection(PUBLIC_RPC_URL);

	try {
		const wallet = await checkWallet();
		if (!wallet) return;

		const transaction = new Transaction().add(
			SystemProgram.transfer({
				fromPubkey: new PublicKey(props.walletAddress),
				toPubkey: new PublicKey(props.recipient),
				lamports: parseFloat(props.amount.toString()) * 1e9 // Convert SOL to lamports
			})
		);

		transaction.feePayer = new PublicKey(props.walletAddress);
		const { blockhash } = await connection.getLatestBlockhash();
		transaction.recentBlockhash = blockhash;

		// Sign and send the transaction
		const signedTransaction = await wallet.signTransaction(transaction);
		const signature = await connection.sendRawTransaction(
			signedTransaction.serialize()
		);

		alert(`Transaction sent! Signature: ${signature}`);
		const balance = await getBalance(props.walletAddress, connection);

		return {
			signature,
			balanceAfterSend: balance
		};
	} catch (error) {
		console.error('Transaction failed:', error);
	}
};
