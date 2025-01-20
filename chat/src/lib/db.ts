import type { Character } from '@spacemangaming/daemon';
import Dexie from 'dexie';

const db = new Dexie('daemon-chat') as Dexie & {
    agents: Dexie.Table<Agent, string>;
    messages: Dexie.Table<Messages, number>;
    settings: Dexie.Table<Settings, string>;
};

interface Agent {
    pubkey: string;
    character: Character;
    secretKey: string; // base58 encoded
    channelId: string;
}

interface Messages {
    id: string;
    agentPubKey: string;
    message: string;
    from: 'agent' | 'user';
    timestamp: number;
}

interface Settings {
    key: string;
    value: string;
}

db.version(1).stores({
    agents: 'pubkey, character, keypair, channelId',
    messages: 'id, agentPubKey, message, from, timestamp',
    settings: 'key, value'
});

export type { Agent, Messages };
export { db };
