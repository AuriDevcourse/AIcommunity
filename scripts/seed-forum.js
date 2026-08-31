// Seed the Discussions forum with fake topics + comments for demoing.
// Usage: npm run seed:forum   (writes to the local file store in dev, or Upstash
// if KV env vars are set). Adds topics on each run, it does not clear existing.
import { handleTopics } from '../api/_topics.js';
import { handleThreads } from '../api/_threads.js';

const AUTHORS = ['Auri', 'Eividas', 'Justas', 'Sany', 'Ignas', 'Dovydas', 'Maria', 'Pavel', 'Martin', 'Ernestas', 'Dovile', 'Kernius', 'Cristina', 'Valentin'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

const TOPICS = [
  {
    title: 'Best local LLM for 16GB RAM?',
    comments: [
      'Running llama3.1:8b on Ollama, fits comfortably and quality is solid for code.',
      'Try Qwen2.5 7B, it punches above its weight on reasoning.',
      'LM Studio makes it dead simple if you do not want the terminal.',
      'Quantized 14B models work too if you close everything else first.',
      'Honestly for 16GB I stick to 7-8B and offload the heavy stuff to an API.',
    ],
  },
  {
    title: 'Show & Tell next session, who is demoing?',
    comments: [
      'I can show a tiny RAG app I built over the weekend.',
      'Count me in, I want to demo an agent that books my calendar.',
      'Can we keep demos to 5 min each? Last time we ran way over.',
      'I will bring the local LLM benchmark setup we talked about.',
    ],
  },
  {
    title: 'Cursor vs Windsurf, what are you using daily?',
    comments: [
      'Windsurf at work, Cursor for side projects. Both great honestly.',
      'Cursor tab completion still feels a step ahead to me.',
      'Switched fully to Windsurf after the last update, the agent mode is smooth.',
      'I keep both open and use whichever has the better model that week.',
    ],
  },
  {
    title: 'Cheapest way to run agents in production?',
    comments: [
      'Vercel functions + a queue got me surprisingly far on the free tier.',
      'Watch the token costs, batching requests saved me ~40%.',
      'Hetzner box + systemd for anything long-running, Vercel for stateless.',
      'Bedrock multi-vendor now means you can swap to whatever is cheapest.',
    ],
  },
  {
    title: 'Anyone tried Gemini 3.5 Flash pricing on a side project?',
    comments: [
      'Retested my app, the cost delta vs Sonnet is real. Worth a look.',
      'Quality dipped slightly on long context but for the price I will take it.',
      'Spark on Antigravity is the part I actually want to try.',
    ],
  },
  {
    title: 'Venue ideas for the next Copenhagen meetup',
    comments: [
      'Matrikel1 worked well last time, good wifi and space.',
      'Could ask Performativ, they are AI-native and in our backyard.',
      'A cafe with a back room would be cozy for a smaller group.',
      'Whatever we pick, please somewhere with power outlets this time.',
    ],
  },
  {
    title: 'How do you handle prompt versioning?',
    comments: [
      'Plain git, prompts live as .md files next to the code.',
      'I tag each prompt with a version string and log it with the output.',
      'Started using a tiny eval set so I can compare versions objectively.',
    ],
  },
  {
    title: 'RAG vs long context in 2026, still worth it?',
    comments: [
      'For big static knowledge bases RAG still wins on cost.',
      'Long context is great until you see the bill.',
      'Hybrid: retrieve to narrow it down, then stuff the top chunks. Best of both.',
      'Depends on freshness, RAG if your data changes often.',
    ],
  },
  {
    title: 'What broke for you this week? (debugging horror stories)',
    comments: [
      'Spent 3 hours on a bug that was a trailing space in an API key.',
      'Hash routing ate my OAuth callback. Fun times.',
      'Model returned valid JSON wrapped in markdown and crashed my parser.',
      'Forgot to await a promise and shipped a race condition to prod.',
    ],
  },
  {
    title: 'Best free APIs for hackathon projects',
    comments: [
      'Fear & Greed index + CoinGecko are free and surprisingly useful.',
      'OpenRouter has a few free models if you do not mind rate limits.',
      'Supabase free tier covers auth + db for most demos.',
      'The Guardian and NewsAPI for anything news-related.',
    ],
  },
];

async function run() {
  let topicCount = 0;
  let commentCount = 0;
  let voteCount = 0;

  for (const t of TOPICS) {
    const res = await handleTopics({ method: 'POST', body: { action: 'create', title: t.title, name: pick(AUTHORS) } });
    if (!res.json?.ok) { console.error('topic failed:', t.title, res.json); continue; }
    const topicId = res.json.topic.id;
    topicCount++;

    const rootIds = [];
    for (const text of t.comments) {
      const author = pick(AUTHORS);
      // ~30% of comments after the first become a reply to an existing root.
      const parentId = rootIds.length && chance(0.3) ? pick(rootIds) : null;
      const pr = await handleThreads({ method: 'POST', body: { action: 'post', key: topicId, name: author, text, parentId } });
      if (!pr.json?.ok) continue;
      const cid = pr.json.comment.id;
      commentCount++;
      if (!parentId) rootIds.push(cid);

      // Random votes from other members.
      for (const voter of AUTHORS) {
        if (voter === author) continue;
        if (!chance(0.22)) continue;
        await handleThreads({ method: 'POST', body: { action: 'vote', key: topicId, id: cid, name: voter, dir: chance(0.85) ? 'up' : 'down' } });
        voteCount++;
      }
    }
    console.log(`seeded: ${t.title}`);
  }

  console.log(`\nDone: ${topicCount} topics, ${commentCount} comments, ${voteCount} votes.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
