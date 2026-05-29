// Post Maker: turns session notes into a social post in the AI Workshop voice.
// Uses OpenRouter (Auri's key) so the dashboard needs no separate Anthropic key.
// Env: OPENROUTER_API_KEY (required), POST_MODEL (optional, default below).

const MODEL = process.env.POST_MODEL || 'anthropic/claude-sonnet-4.6';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export function postmakerConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY);
}

// The AI Workshop voice. The reader does NOT know TechBBQ — never reference it.
const VOICE = `You are the host of the AI Workshop community writing a social post about a meetup. You write as a real person (mostly "I", sometimes "we"), a builder talking to other builders. Warm, honest, a little playful, self-deprecating, never corporate or press-release. The reader does NOT know what TechBBQ is; never mention it or assume outside context.

About the community:
- A recurring meetup in Copenhagen where people build real things with AI and show each other what they made. Small and hands-on. It is a shipping community, not a lecture series. Tagline spirit: "Build with AI. Show what you learned."

What makes these posts work (learned from real performance):
- A human, honest, or playful hook beats a polished one. ("First AI meetup is done. No name yet. No fancy structure." and the "AI Anonymous" name-joke both performed best.)
- Keep it personal and a little vulnerable. Self-deprecating asides land ("us low attention span mammals", "I get confused way too often").
- Credit the people who presented, by name.
- Name the actual tools and results, but do not turn the post into a dense checklist. The heaviest, most-structured post (lots of ✅ bullets and a formal "Conclusion") performed the WORST. Favor short paragraphs over bullet lists.
- End with a simple, low-key CTA: some version of "If this sounds interesting, send me a message" with a wave emoji.
- A rocket or wave emoji as an anchor is on-brand; do not overdo emojis.

Hard rules:
- Never invent attendance numbers, names, tools, or outcomes that are not in the brief. If a detail is not given, leave it out.
- Banned filler: "excited to announce", "thrilled", "game changer", "synergy", "disruption", "dive deep", "unlock", "in today's fast-paced world", "revolutionize".`;

// Real posts from the community, labelled by how they performed. Few-shot guide.
const EXAMPLES = `Study these REAL past posts and how they performed. Match the voice of the ones that did well; avoid the structure of the one that did not.

[PERFORMED REALLY WELL]
First AI meetup is done.

No name yet. No fancy structure. But a group of curious people showed up, shared what they're working on, and exchanged ideas, tools, and tips. That's already a win.

Starting something new is rarely perfect. But when you bring enthusiastic people together, something good always comes out of it.

We talked about building websites with Windsurf and GitHub Pages, keeping free servers alive with UptimeRobot, and tools like Puppeteer, Responsively App, and Fluxai to automate or create.

Some goals for next time:
Come up with a name. Bring in more new people. Keep sharing tools and tips.

Interested in joining the group? Send a message. 👋

[PERFORMED QUITE WELL]
"AA Meeting". Artificial Intelligence Anonymous 😅

This was the #2 meetup, and it's starting to take shape. The name is still missing, but what we do have is new members with fresh insights. 🚀

This time we explored how to break a project into smaller steps to improve accuracy, focus, and flow. We also talked about where AI automation tools like Make and n8n might take us.

Ignas shared an idea he's exploring: an agent that analyzes images from the cloud, writes captions, and posts them through Make. Smart and practical. ⚙️

Tools we talked about: ChatGPT, Windsurf, Make, n8n.

Things are moving fast. If this sounds interesting, send a message 🖐

[PERFORMED WORST — too dense and listy, do NOT copy this structure]
Analysis Paralysis in the AI Age. So many tools to choose from... 🚀

This was our 3rd meetup. This time we explored generative AI for image creation, and 3D modeling in particular. Initial tests showed a clear winner: Hyper3D Rodin.
Still, a few caveats:
✅ We only tested one prompt.
✅ All tools were on free tiers.
✅ Some offered more file formats, others more iterations.
Conclusion: you still cannot rely on a single tool.
[Why it underperformed: too many bullets, a formal "Conclusion", a long tool dump. It reads like a report, not a person.]`;

const FORMAT_RULES = {
  linkedin: `FORMAT: LINKEDIN POST
- Structure: specific hook line; 2 to 4 short lines on what was built/demoed/learned (name tools + results); one line on why it is worth doing; an inviting low-pressure CTA (come build with us / DM to join the next one).
- Target length 70 to 110 words.
- End with 3 to 6 hashtags such as #BuildWithAI #AICommunity #Copenhagen #AIWorkshop #ShipIt.
- 1 to 3 emoji max, only at the start or end of a line.`,
  instagram: `FORMAT: INSTAGRAM CAPTION
- First line must work as a standalone hook (it shows before "more").
- 50 to 120 words, casual and punchy, short lines.
- Soft CTA (DM us, link in bio, come next time).
- End with a block of 5 to 12 hashtags (add #AItools #buildinpublic #copenhagentech #developercommunity #weekendbuild to the core ones).
- A few emoji are fine, only at line start or end.`,
};

export function buildSystemPrompt(format = 'linkedin') {
  return `${VOICE}

${EXAMPLES}

${FORMAT_RULES[format] || FORMAT_RULES.linkedin}

OUTPUT RULES:
- Plain text only. No markdown bold/italic, no HTML, no asterisks.
- NEVER use the em dash character " — ". Use commas, periods, or restructure.
- Hashtags plain (#AIWorkshop, never \\#AIWorkshop), always at the bottom.
- Output ONLY the post text. No preamble, no explanation, no quotes around it.`;
}

// House-style cleanup: kill em dashes, stray markdown, double spaces.
export function postProcess(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S.*?\S)\*(\s|$)/g, '$1$2$3')
    .replace(/ — /g, ', ')
    .replace(/ – /g, ', ')
    .replace(/—/g, ', ')
    .replace(/–/g, ', ')
    .replace(/, ,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ ([.,!?:;])/g, '$1')
    .trim();
}

async function callGemini(system, notes) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: notes }] }],
      // thinkingBudget 0 — no hidden reasoning tokens eating the output (Gemini 2.5 thinks by default).
      generationConfig: { temperature: 0.8, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Gemini ${r.status}`);
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}

async function callOpenRouter(system, notes) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'AI Workshop Post Maker',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      temperature: 0.7,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: notes },
      ],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `OpenRouter ${r.status}`);
  return j.choices?.[0]?.message?.content || '';
}

export async function handleGeneratePost({ body }) {
  if (!postmakerConfigured()) return { status: 200, json: { ok: false, configured: false } };
  const notes = String(body?.notes || '').trim();
  const format = body?.format === 'instagram' ? 'instagram' : 'linkedin';
  if (!notes) return { status: 400, json: { ok: false, error: 'notes required' } };

  try {
    const system = buildSystemPrompt(format);
    // Prefer Gemini when its key is set, else OpenRouter.
    const raw = process.env.GEMINI_API_KEY ? await callGemini(system, notes) : await callOpenRouter(system, notes);
    return { status: 200, json: { ok: true, text: postProcess(raw) } };
  } catch (e) {
    return { status: 500, json: { ok: false, error: e.message } };
  }
}
