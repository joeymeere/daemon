<script lang="ts">
  import { onMount } from 'svelte';
  import { Daemon } from '@spacemangaming/daemon';
  import { type Character } from '@spacemangaming/daemon';
  import { Keypair } from '@solana/web3.js';
  import { PUBLIC_OPENAI_API_KEY } from '$env/static/public';
  import { db } from '$lib/db';
  import { liveQuery } from 'dexie';
  import bs58 from 'bs58';
  import { nanoid } from 'nanoid';
  import { type Agent as DBAgent } from '$lib/db';

  global = global || window;

  type Agent = DBAgent & {
    id: number;
    keypair: Keypair;
  };


  const newCharacter = (name: string, identityPrompt: string, pubkey: string) => {
    let defaultCharacter: Character = {
    name: 'Bob',
    pubkey: '123',
    identityPrompt: 'You are Bob',
    identityServerUrl: 'http://localhost:3000/sse',
    modelSettings: {
      generation: {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        name: 'gpt-4o',
        apiKey: PUBLIC_OPENAI_API_KEY,
      },
      embedding: {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        name: 'text-embedding-3-small',
          apiKey: PUBLIC_OPENAI_API_KEY,
        },
      },
      bootstrap: []
    }
    
    return {
      ...defaultCharacter,
      name,
      identityPrompt,
      pubkey,
    }
  }

  let agents: Agent[] = [];
  
  let daemons: {
    [agentPubKey: string]: Daemon
  } = {};
  let showModal = false;
  let newAgentName = 'Bob the Builder';
  let newAgentDescription = 'You are Bob the builder.';

  let selectedAgent = agents[0];
  let messageInput = '';

  $: messagesQuery = liveQuery(async () => {
    return (await db.messages.where('agentPubKey').equals(selectedAgent?.character.pubkey || "").sortBy('timestamp'));
  });

  onMount(async () => {
    const dbAgents = await db.agents.toArray();
    let i = 0;
    agents = dbAgents.map(agent => ({
      id: i++,
      ...agent,
      character: {
        ...agent.character,
        modelSettings: {
          ...agent.character.modelSettings,
          generation: {
            ...agent.character.modelSettings.generation,
            apiKey: PUBLIC_OPENAI_API_KEY, // don't store api key in db
          },
          embedding: {
            ...agent.character.modelSettings.embedding,
            apiKey: PUBLIC_OPENAI_API_KEY, // don't store api key in db
          },
        },
      },
      keypair: Keypair.fromSecretKey(bs58.decode(agent.secretKey)),
    }));

    for (const agent of agents) {
      const newDaemon = new Daemon();
      await newDaemon.init(agent.character.identityServerUrl, {
        character: agent.character,
        privateKey: agent.keypair,
        modelApiKeys: {
          generationKey: PUBLIC_OPENAI_API_KEY,
          embeddingKey: PUBLIC_OPENAI_API_KEY,
        },
      });
      daemons[agent.character.pubkey] = newDaemon;
    }
  });
  
  async function addNewAgent(name: string, identityPrompt: string) {
    console.log('Adding new agent', name, identityPrompt);
    const keypair = Keypair.generate();
    const newAgent: Agent = {
      id: agents.length + 1,
      character: newCharacter(name, identityPrompt, keypair.publicKey.toBase58()),
      keypair,
      pubkey: keypair.publicKey.toBase58(),
      secretKey: bs58.encode(keypair.secretKey),
      channelId: nanoid(),
    };
    db.agents.add({
      pubkey: newAgent.character.pubkey,
      character: {
        ...newAgent.character,
        modelSettings: {
          ...newAgent.character.modelSettings,
          generation: {
            ...newAgent.character.modelSettings.generation,
            apiKey: "", // don't store api key in db
          },
          embedding: {
            ...newAgent.character.modelSettings.embedding,
            apiKey: "", // don't store api key in db
          },
        },
      },
      secretKey: bs58.encode(keypair.secretKey),
      channelId: newAgent.channelId,
    });
    const newDaemon = new Daemon();
    await newDaemon.init(newAgent.character.identityServerUrl, {
      character: newAgent.character,
      privateKey: keypair,
      modelApiKeys: {
        generationKey: PUBLIC_OPENAI_API_KEY,
        embeddingKey: PUBLIC_OPENAI_API_KEY,
      },
    });
    daemons[newAgent.character.pubkey] = newDaemon;
    agents = [...agents, newAgent];
  }

  function deleteAgent(id: number) {
    db.agents.delete(agents[id].character.pubkey);
    delete daemons[agents[id].character.pubkey];
    agents = agents.filter(agent => agent.id !== id);
    if (selectedAgent?.id === id) {
      selectedAgent = agents[0];
    }
  }


  async function sendMessage() {
    if (!selectedAgent) {
      selectedAgent = agents[0];
    }

    if (messageInput.trim()) {
      console.log('Sending message:', messageInput);
      console.log('Selected Agent:', selectedAgent.character.pubkey);
      console.log('Daemons:', daemons[selectedAgent.character.pubkey]);

      const response = await daemons[selectedAgent.character.pubkey].message(messageInput, {
        channelId: selectedAgent.channelId,
      });

      console.log('Full Response:', response);

      await db.messages.add({
        id: nanoid(),
        agentPubKey: selectedAgent.character.pubkey,
        message: messageInput,
        from: 'user',
        timestamp: Date.now(),
      });

      await db.messages.add({
        id: nanoid(),
        agentPubKey: selectedAgent.character.pubkey,
        message: response.output,
        from: 'agent',
        timestamp: Date.now(),
      });
      
      messageInput = '';
    }
  }

  function closeModal() {
    showModal = false;
  }

  function openModal() {
    showModal = true;
  }

</script>

<div class="flex h-screen bg-white">
  <!-- Sidebar -->
  <div class="w-80 border-r flex flex-col">
    <button
      on:click={openModal}
      class="m-4 p-3 bg-[#4477FF] text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
    >
      <span class="text-xl">+</span>
      New Agent
    </button>

    <div class="flex-1 overflow-y-auto">
      {#each agents as agent}
        <div
          class="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-start {selectedAgent?.id === agent.id ? 'bg-blue-50' : ''}"
          on:click={() => selectedAgent = agent}
          on:keydown={(e) => e.key === 'Enter' && (selectedAgent = agent) }
          role="button"
          tabindex="0"
        >
          <div>
            <h3 class="font-medium text-gray-900">{agent.character.name}</h3>
            <p class="text-gray-500 text-sm">{agent.character.identityPrompt.substring(0, 20)}...</p>
          </div>
          <button
            on:click|stopPropagation={() => deleteAgent(agent.id)}
            class="text-gray-400 hover:text-gray-600"
            aria-label="Delete agent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex flex-col">
    {#if selectedAgent}
      <div class="p-6 border-b">
        <h2 class="text-xl font-medium text-gray-900">{selectedAgent.character.name}</h2>
        <p class="text-gray-500">{selectedAgent.character.identityPrompt}</p>
      </div>
    {/if}

    <div class="flex-1 overflow-y-auto">
      {#each $messagesQuery as message}
        <div class="p-4 {message.from === 'user' ? 'bg-blue-50' : 'bg-gray-50'}">
          <p class="text-gray-600">{message.message}</p>
        </div>
      {/each}
    </div>

    <!-- Message Input -->
    <div class="p-4 border-t flex gap-2">
      <input
        type="text"
        bind:value={messageInput}
        placeholder="Type your message..."
        class="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
        on:keydown={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button
        on:click={sendMessage}
        class="p-3 bg-[#4477FF] text-white rounded-lg hover:bg-blue-600 transition-colors"
        disabled={!messageInput.trim()}
        aria-label="Send message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Add Agent Modal -->
  {#if showModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">Add New Agent</h2>
        <div class="mb-4">
          <label for="agentName" class="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
          <input
            type="text"
            id="agentName"
            bind:value={newAgentName}
            class="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter agent name"
          />
        </div>
        <div class="mb-4">
          <label for="agentDescription" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            id="agentDescription"
            bind:value={newAgentDescription}
            class="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter agent description"
            rows="3"
          ></textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button
            on:click={closeModal}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            on:click={() => {
              addNewAgent(newAgentName, newAgentDescription);
              closeModal();
            }}
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!newAgentName.trim()}
          >
            Add Agent
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>