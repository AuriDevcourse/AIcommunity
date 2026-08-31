// Seeds the starter poll(s) if they don't already exist.
// Local: writes data/polls-store.json. Production: set KV_REST_API_URL +
// KV_REST_API_TOKEN in the env and it seeds Upstash instead. Idempotent.
//
//   node scripts/seed-polls.js
import { createStore, handlePolls } from '../api/_polls-core.js';

const SEEDS = [
  {
    question: "Which local LLM tool are you bringing to Sunday's session?",
    multi: false,
    options: ['LM Studio', 'Ollama', 'Jan', 'GPT4All', 'Not sure yet, need help installing'],
    createdBy: 'Auri',
  },
];

const store = createStore();
const existing = await store.listPolls();

for (const seed of SEEDS) {
  if (existing.some((p) => p.question === seed.question)) {
    console.log(`seed-polls: already present, "${seed.question}"`);
    continue;
  }
  const { json } = await handlePolls({ method: 'POST', body: { action: 'create', ...seed }, store });
  console.log(json.ok ? `seed-polls: created, "${seed.question}"` : `seed-polls: FAILED, ${json.error}`);
}
