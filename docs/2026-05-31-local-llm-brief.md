# Session brief. Run your own local LLM (May 31, 2026)

**Format:** Tool Exploration, hands-on · **Bring:** your laptop (and its specs)
**Goal:** everyone gets *a* model running locally, then we compare speed + quality across our different hardware, and against the paid APIs we already use.

This came out of the WhatsApp thread: local models felt "soo slow comparing to API based" (Justas tried Qwen), some need NVIDIA GPUs, and Sany mentioned a tool that supposedly lets any PC run big models. So the session answers three questions: **what do you install, what can your machine actually run, and is it worth it vs paying.**

---

## 1. What to install (pick one before Sunday)

Three one-click-ish tools cover everyone. All of them download and manage models for you and run fully offline. All read the same model files (GGUF), so the *model* choice is separate from the *tool* choice.

| Tool | Best for | Interface | Notes |
|------|----------|-----------|-------|
| **LM Studio** | Beginners, "just give me a chat window" | Polished desktop GUI | Visual model browser, one-click download, shows if a model fits your RAM before you download. Friendliest start. Anonymous analytics on by default (turn off in Settings → Privacy). |
| **Jan** | Privacy-first, open-source ChatGPT clone | Clean desktop GUI | No account, no telemetry, MIT licensed. Also exposes a local API server. |
| **Ollama** | Developers, scripting, OpenClaw-style integration | CLI (`ollama run llama3.2`) | Lightweight, OpenAI-compatible API on `localhost:11434`, this is what you plug into other tools. Pair with Open WebUI if you want a browser chat UI. |

**Recommendation for the room:** non-devs install **LM Studio**, devs install **Ollama** (so we can also show wiring it into OpenClaw / editors). That split itself is a good comparison.

### Install in one line
- **LM Studio / Jan:** download the installer from lmstudio.ai / jan.ai, run it, click a suggested model. Done.
- **Ollama (Mac/Linux):** `curl -fsSL https://ollama.com/install.sh | sh` then `ollama run llama3.2`
- **Ollama (Windows):** download the installer from ollama.com, then in a terminal `ollama run llama3.2`

---

## 2. What your machine can actually run

The single number that matters is **memory**. VRAM if you have a dedicated GPU, otherwise system RAM. Models are sized in *billions of parameters* (B). You shrink them to fit with **quantization** (lower precision = smaller file, tiny quality loss).

**Quantization cheat sheet:** look for `Q4_K_M` (the practical default, ~75% smaller than full size, <3% quality drop) or `Q5_K_M` (a bit bigger, a bit better). Ignore the rest for now.

| Your hardware | Realistic model size | Good picks (Q4) | Expected speed |
|---------------|---------------------|-----------------|----------------|
| 8 GB RAM, no GPU (older laptop) | 3–4B | **Phi-4-mini (3.8B)**, Gemma 3 4B, Llama 3.2 3B | 10–30 tok/s, slow but usable |
| 16 GB RAM or 8 GB VRAM | 7–8B | **Llama 3.3 8B** (best all-round), **Qwen 3 7B** (code), Mistral Small 3 | comfortable, interactive |
| 12–16 GB VRAM | 12–17B | Gemma 3 12B, Llama 4 Scout 17B | fast |
| 32 GB+ / strong GPU | 70B | Llama 3.3 70B, Qwen 3 70B | noticeably smarter, needs the hardware |

**Rule of thumb for VRAM/RAM needed:** at Q4, a model needs roughly *half its parameter count in GB*, plus ~15% overhead. So a 7B model ≈ ~4–5 GB. An 8 GB GPU comfortably runs 7–8B models.

**Apple Silicon (M1/M2/M3 MacBooks)** punch above their weight here, unified memory means the GPU can use most of your RAM, so a 16 GB Mac runs models a similar Windows laptop can't.

**Demo model so we're all comparing the same thing:** everyone also pulls **Llama 3.2 3B** (tiny, runs on anything) so we have one apples-to-apples speed test across the room, then each person shows the biggest model their machine handles.

---

## 3. "Make any PC run big models", the offloading trick (Sany's tool)

The thing Sany was thinking of is almost certainly **layer-by-layer / disk offloading**. The well-known one is **AirLLM**, it runs a 70B model on a single 4 GB GPU by loading *one transformer layer at a time* from disk, computing, then swapping in the next.

**The honest catch:** it works, but it's *slow*, every layer is read from disk per token, so an NVMe SSD is mandatory and you still get a fraction of normal speed. It's a "I physically cannot fit this model otherwise" tool, not a "make it fast" tool. Good to demo as a party trick / proof it's possible, but for actual use, a smaller quantized model that fits in memory beats a giant offloaded one every time.

(Built into the ecosystem already: Ollama and llama.cpp do *partial* GPU offload via `num_gpu` / `-ngl`, run some layers on GPU, the rest on CPU. That's the practical middle ground for "model is a bit too big for my VRAM.")

---

## 4. The actual comparison to run live

Pick 2–3 prompts everyone runs on their local model + on a paid API (Claude/GPT) and we fill a table:

1. A coding prompt (write a small function + explain)
2. A reasoning prompt (a short logic puzzle)
3. A "local-only" prompt (something private you'd never send to a cloud API)

Compare on: **tokens/sec, answer quality, setup pain, your hardware.** That table is the takeaway, it shows where free+local is genuinely good enough and where paid still wins.

**The verdict to test, in plain terms:** local models are now genuinely good for small/private/offline tasks and cost nothing per token, but paid APIs still win on raw quality and speed unless you've got serious hardware. "Slow" is usually a sign you picked too big a model for your machine, the fix is a smaller quant, not better hardware.

---

## 5. Bonus topic if there's time. Beads

Separate from local LLMs, but it came up: **Beads** is a git-backed issue tracker that acts as *persistent memory for coding agents*. The "what blocks what" dependency logic lives in a Go binary instead of the agent's prompt, and it auto-summarizes closed tasks, which is why it **saves tokens** (the thing Justas flagged about OpenClaw/Hermes burning context). Worth a 5-min show-and-tell since a few of us are fighting token usage. (~18.7k GitHub stars, actively maintained.)

---

## Pre-session checklist (drop in the WhatsApp group)
- [ ] Install LM Studio (non-devs) or Ollama (devs), links above
- [ ] Pull `llama3.2` (3B) so we have a shared speed test
- [ ] Note your specs: RAM, GPU + its VRAM, Mac or Windows
- [ ] Optional: try the biggest model your machine handles, note tok/s

---

### Sources
- [SitePoint. Definitive guide to local LLMs 2026](https://www.sitepoint.com/definitive-guide-local-llms-2026-privacy-tools-hardware/)
- [DEV. Running local LLMs in 2026: Ollama, LM Studio, Jan compared](https://dev.to/synsun/running-local-llms-in-2026-ollama-lm-studio-and-jan-compared-5dii)
- [Local AI Master. Jan vs LM Studio vs Ollama](https://localaimaster.com/blog/jan-vs-lm-studio-vs-ollama)
- [SitePoint. Optimizing local LLMs for low-end hardware (8GB)](https://www.sitepoint.com/optimizing-local-llms-low-end-hardware-8gb/)
- [Will It Run AI. Q4 vs Q5 vs Q8 GGUF quantization guide](https://willitrunai.com/blog/quantization-guide-gguf-explained)
- [SitePoint. Best local LLM models 2026](https://www.sitepoint.com/best-local-llm-models-2026/)
- [Local AI Master. Best small language models for 8GB RAM](https://localaimaster.com/blog/small-language-models-guide-2026)
- [AirLLM (GitHub), 70B inference on a single 4GB GPU](https://github.com/lyogavin/airllm)
- [Better Stack. Beads: git-friendly issue tracker for AI agents](https://betterstack.com/community/guides/ai/beads-issue-tracker-ai-agents/)
