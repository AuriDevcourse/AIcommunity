# Members

Who is in the AI Sundays community. **This file is the source of truth**, read by
`scripts/build-data.js` into `src/data.json`.

It replaces the `| Name | Status |` table that used to live in the Obsidian vault
(`AI Workshop.md`). That table only existed on one laptop, so nobody else could add a
person, and Vercel builds fell back to a committed snapshot.

## How to edit

Add a row. That is the whole process. Then `npm run build:data`, which `npm run dev` runs
for you.

- **Name** must match the key in `data/members-profile.json` for that person to get their
  photo and LinkedIn link. If someone has no entry there they still appear, with a
  generated avatar.
- **Status** is `Organizer` or `Active`. Only `Organizer` draws a badge, and nobody
  currently carries it: Auri asked for his own to come off. The column stays because
  the badge is worth having if the community ever needs to point at who runs it.
- **Aliases** are the other names that person is recorded under in session notes,
  comma-separated. Session attendance is written in first names (`Auri`, `Sany`), so a
  member whose notes name does not match their row needs one here or their
  sessions-attended count reads zero. Leave blank when the first name already matches.

Do not add a row for a one-off guest. Sessions record attendance separately, and a guest
who is not a member simply does not get a count.

**No email addresses in this file.** The repo is public. Contact details are not needed by
anything the site renders.

| Name | Status | Aliases |
|---|---|---|
| Aurimas Baciauskas | Active | Auri |
| Aiza Watzlawek | Active | |
| Andrei Prusu | Active | |
| Cristina Bodnari | Active | |
| Dovile | Active | Dovile Perednyte |
| Dovydas Vinickis | Active | |
| Eividas Maciulis | Active | |
| Ernestas Sažinas | Active | Ernestas |
| Ignas Valavicius | Active | |
| Inigo Casillas | Active | Inigo |
| Justas Petrauskas | Active | |
| Kernius Savickas | Active | Kernius |
| Kristina Juozapaviciute | Active | Kristina |
| Maria Krupa | Active | Maria |
| Martin Windsor | Active | |
| Pavel Kucera | Active | Pavel |
| Sany Ivanova | Active | |
| Tady Kapic | Active | |
| Valentin | Active | |
| Vasare Liutkeviciute | Active | Vasare |

## Known gaps

Three names appear in session attendance and match nobody above: **Mari**, **Yogi** and
**Frederik**. They are either guests who never joined, or members recorded under a name
that needs an alias. Auri is the only person who knows which. Until then they are counted
as guests and get no member row, which is the safe default: guessing a full name into a
public repo is worse than leaving a gap.

The two `Unknown #1` and `Unknown #2` rows that used to come from the vault table were
headcount placeholders, not people. They are gone, so the Members tab no longer renders two
blank cards or claims them in its total.
