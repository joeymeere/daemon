import type { Daemon } from '@spacemangaming/daemon';
import { writable, type Writable } from 'svelte/store';

export const daemonStore: Writable<Daemon[]> = writable([]);

export const updateDaemons = {
	addDaemon: (daemon: Daemon | null) => {
		daemonStore.update((state) => {
			if (!daemon) {
				console.error('daemon is null');
				return state;
			}
			return [...state, daemon];
		});
	}
};
