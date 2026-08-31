# Recording → transcript → dashboard pipeline

How a raw meetup recording becomes (a) a private full transcript archive and (b) the
public session recap on the dashboard. Two repos, one chain. Everything runs locally
and offline.

## The one rule

**When Auri hands over a recording, it always goes through `run.py` in the `transcribe`
project.** Drop the file in the fixed incoming folder, run one command, review the two
drafts, re-run with `--vault`, then rebuild the dashboard data.

## Where to drop the file

```
C:\Users\User\Desktop\SideProjects\transcribe\recordings\incoming\
```

Always the same folder so the command never changes. Accepts `m4a / mp3 / wav / mp4`.

## The command

```bash
cd C:/Users/User/Desktop/SideProjects/transcribe
# ollama serve   # (usually already running as a service)

# 1) Dry run first, writes DRAFTS only, nothing touches the vault:
python run.py "recordings/incoming/<file>.m4a" --number 8 --date 2026-06-16

# 2) Review the two drafts (next to the input file):
#    <file>.transcript.draft.md   ← full clean transcript, profanity masked
#    <file>.session-note.draft.md ← public-safe recap for the dashboard

# 3) Happy? Re-run with --vault to publish both into Obsidian:
python run.py "recordings/incoming/<file>.m4a" --number 8 --date 2026-06-16 --vault
```

`--number` and `--date` are required, the pipeline can't guess them, Auri provides them.

## What it produces

`run.py` chains, all offline:

1. ffmpeg → 16 kHz mono wav
2. `diarize.py`, who spoke when (anonymous voices: SPEAKER_00, _01, …)
3. `match_speakers.py`, voiceprints (**fallback**, only knows previously-enrolled people)
3b. `name_from_intros.py`, names from each person's **self-introduction** (**primary**;
    overrides voiceprints because intros are true for *this* session). Speakers with no
    intro and no voiceprint stay as raw `SPEAKER_XX` labels, name them by hand in the map.
4. `apply_corrections.py`, apply names + product/term glossary
5. `cleanup_local.py`, local-LLM grammar/readability cleanup, drops filler (`.cleaned.*`)
6. **`archive_transcript.py`**, full clean transcript, **profanity masked**, written to a
   **private** vault folder (see below)
7. `roundup_local.py`, structured private roundup
8. `to_session_note.py`, **public-safe** recap → dashboard session note

## Two outputs, two homes (important)

| Output | Goes to | Public? | Built by |
| --- | --- | --- | --- |
| Full transcript (the whole conversation) | `Obsidian Vault/AI Workshop/Transcripts/#<N> TRANSCRIPT <date>.md` | **No**, internal archive | `archive_transcript.py` |
| Session recap (short, AI-tools only) | `Obsidian Vault/AI Workshop/Sessions/#<N> SESSION <date>.md` | **Yes**, shown on the dashboard | `to_session_note.py` |

The dashboard's `scripts/build-data.js` reads **only** the `Sessions/` folder. The
`Transcripts/` folder is never published, it's the long, searchable archive for the
group. Keeping them in separate folders is the privacy boundary.

### Naming speakers (do the intro round)

Attendees change every session, so **the reliable way to name voices is the intro round**:
at the very start, have **each person say their own name one at a time**, *"Hi, I'm
Justas."* `name_from_intros.py` reads those and maps each to its voice automatically.
Tips:
- One at a time, own name. *Auri naming everyone in one breath* ("this is X, this is Y")
  can't be auto-mapped, those names all come from Auri's single voice.
- Anyone the script couldn't name stays as `SPEAKER_XX` in the drafts. To fix by hand,
  edit `<base>.speakermap.json` (e.g. `"SPEAKER_06": "Andrei"`) and re-run from
  `apply_corrections.py` onward, or just correct the names directly in the two draft
  files before publishing.
- Voiceprints are a **fallback only** now. The old behaviour (a hardcoded name map)
  caused last session's names to leak onto this session's strangers, that's removed.

### Profanity masking

`archive_transcript.py` masks swearing **deterministically** (a fixed English +
Lithuanian word list, not an LLM guess), keeping the first letter: `fucking → f******`,
`blet → b***`. So the archive is shareable inside the group without raw swearing, and
filler words are already gone from the cleanup step. Edit the `PROFANITY` list in
`archive_transcript.py` to tune what gets masked.

## Push it to the live dashboard

After the recap note is in the vault:

```bash
cd C:/Users/User/Desktop/GITHUB/AIcommunity
npm run build:data        # parses the vault note into src/data.json
# review src/data.json, then commit + push (auto-deploys to Vercel)
```

## Files

- `transcribe/run.py`, the orchestrator (one command)
- `transcribe/archive_transcript.py`, full transcript + profanity masking (step 6)
- `transcribe/to_session_note.py`, public recap (step 8)
- `AIcommunity/scripts/build-data.js`, reads `Sessions/` notes into `src/data.json`
