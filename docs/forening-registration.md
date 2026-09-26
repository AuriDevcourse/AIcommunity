# Founding the forening: what to collect, and how to register

Operating manual for turning AI Sundays into a registered Danish forening. Two
halves: **what information we need from whom**, and **the click-path through
virk.dk** once the founding meeting is done.

The legal documents themselves (vedtægter, referat, deltagerliste) live in the
Obsidian vault at `AI Workshop/Forening/`, in Danish. This file is the procedure
in English.

> **This repository is public.** No member's address, date of birth, phone
> number or CPR number may ever be committed here. See
> [Where the data actually lives](#where-the-data-actually-lives) before you
> fill anything in.

---

## The two gates

| Gate | What it gives | When |
|---|---|---|
| **1 · Founding meeting** | The forening legally exists | Sunday 27 September 2026, 12:30, Matrikel1 |
| **2 · CVR registration** | A CVR number and a public registreringsbevis | The week after, on virk.dk, free |

Gate 3 (bank + NemKonto) and gate 4 (folkeoplysende status at Københavns
Kommune) come later and neither blocks the other two.

**Five paying members is a gate 4 requirement, not a CVR one.** CVR needs a
board of three, vedtægter, a referat, a name, an address and a purpose.

---

## What we need from each person

### From every member · the kommune's member list

Københavns Kommune requires the member list as an Excel file with exactly these
columns. Collect all four **on the night**, at the same moment as the signature.

| Field | Notes |
|---|---|
| **Full name** | Spelled exactly as on their ID |
| **Street address and number** | |
| **Postcode and city** | A separate column from the street |
| **Date of birth** | A hard requirement, not a detail |

### From every member · the forening's own needs

| Field | Why |
|---|---|
| **Email** | Vedtægternes § 5.3 makes email the official notice channel |
| **Phone** | Nobody requires it. We have it for no one, and WhatsApp will not give it to us |

### From every member · on the night

- **Signature** on the deltagerliste
- **100 DKK paid.** The kommune counts *paying* members, not registered ones.
  `Indmeldt` and `Kontingent betalt` are separate columns and may carry
  different dates, which matters because no bank account exists yet.

### From the three board members only · at CVR filing

| Field | Who | Notes |
|---|---|---|
| **CPR number** | Formand, kasserer, bestyrelsesmedlem | Typed into virk.dk and **stored nowhere else** |

The **revisor does not need a CPR number.** They are elected in the referat but
are not part of the ledelse, so they do not go in the board field on virk.dk.

---

## Who holds which post

| Role | Person | Pays kontingent? | CPR needed? |
|---|---|---|---|
| Formand | Aurimas Baciauskas | Yes | Yes |
| Kasserer | Eividas Mačiulis | Yes | Yes |
| Bestyrelsesmedlem | Ignas Valavičius | Yes | Yes |
| Revisor | Andrei Prusu | Yes | No |
| Member | *(fifth person)* | Yes | No |

**There is no exemption for the board.** Vedtægternes § 4.2 means all five pay
the 100 DKK. Four people hold posts, so the fifth signature has to come from an
ordinary member.

**Five is a floor, not a target.** At exactly five, one person drifting puts the
forening back under the kommune's minimum. Ask more than five.

### ⚠️ Check the spelling against ID before anyone signs

**Mačiulis, Valavičius, Prusu, Baciauskas.** These are spelled inconsistently
across our own notes, with and without diacritics. CVR registration identifies
real people, and a mismatch between the vedtægter and a passport is what sends
you back for a second meeting. Ask each person to write their name as it appears
on their ID.

---

## Where the data actually lives

This repo is public, so the split is not a style preference.

| Data | Where it goes | Never |
|---|---|---|
| This procedure | Here, in `docs/` | — |
| Member names, addresses, birth dates | `Medlemsliste AI Sundays.xlsx`, held by the kasserer | Never in git |
| Signed deltagerliste | Scanned PDF in the vault, `AI Workshop/Forening/` | Never in git |
| Emails and phone numbers | The same spreadsheet | Never in git |
| **CPR numbers** | Typed into virk.dk at the moment of filing | **Never written down anywhere** |

The member list is personal data under GDPR. It lives in one place with the
kasserer, goes to Københavns Kommune only as an application attachment, and is
deleted when a membership ends.

`data/members-profile.json` in this repo holds names, LinkedIn URLs and photos
for the website. That is public-facing information members chose to publish.
**Do not extend it with addresses or birth dates.**

---

## Collecting it on the night

The page at **https://www.aisundays.org/forening/** has a form that builds a
person's details into a plain-text block they can send back over WhatsApp. It
stores nothing and posts nowhere: everything happens in their browser. Point
people at it rather than passing a laptop around.

Either way, the physical deltagerliste still has to be signed on paper and
scanned, because that signature is what CVR and the kommune accept as evidence
that the meeting happened.

**This is the one irreversible moment in the whole project.** Every other step
can be redone. Asking twenty-eight people for their address a second time cannot.

---

## Gate 2 · registering the CVR number on virk.dk

Do this in the week after 27 September, once the vedtægter and referat are
signed and scanned. It is free and takes minutes.

### Before you open the form

1. **Search for a name collision.** Go to https://datacvr.virk.dk/ and search
   for `Foreningen AI Sundays`. A collision is cheap to find now and expensive
   to find mid-form.
2. **Have two PDFs ready**, both signed on the night. Scans, not photos:
   - `PDF/01 Vedtaegter - Foreningen AI Sundays.pdf`
   - `PDF/02 Stiftende generalforsamling - referat.pdf`
3. **Have the three board members' CPR numbers to hand.** Not in a file, not in
   a chat message.

### The form

Start here: **https://virk.dk/myndigheder/stat/ERST/Frivillige_foreninger/**
then **Start selvbetjening**. Log in with Auri's **personal MitID** — the
forening has no MitID of its own yet, which is the part that confuses people.

| Field | Value |
|---|---|
| Virksomhedsform | **Frivillig forening** |
| Navn | **Foreningen AI Sundays** · matches vedtægternes § 1.1 word for word |
| Adresse | Else Alfelts Vej 58A, 2300 København S |
| Kommune | Københavns Kommune |
| Startdato | **2026-09-27**, the founding date, not the day you file |
| Branchekode | `94.99.00` Andre organisationer og foreninger i.a.n. |
| Regnskabsår | Calendar year. First one runs 2026-09-27 to 2026-12-31 |
| E-mail | See the warning below |
| Ejerforhold | None. A forening has members, not owners |

**Formål**, paste from vedtægternes § 2.1:

> Foreningens formål er at drive folkeoplysende virksomhed, der styrker
> deltagernes praktiske forståelse af kunstig intelligens og digitale værktøjer
> gennem regelmæssig, fælles læring.

**Ledelse**, from referatets § 5. Three people, each with their CPR number:

| Navn | Rolle | Tiltrådt |
|---|---|---|
| Aurimas Baciauskas | Formand | 2026-09-27 |
| Eividas Mačiulis | Kasserer | 2026-09-27 |
| Ignas Valavičius | Bestyrelsesmedlem | 2026-09-27 |

**Tegningsregel**, paste from § 9.1 exactly. The bank reads this back later and
a mismatch between CVR and the vedtægter means a second appointment:

> Foreningen tegnes af formanden i forening med kassereren, eller af formanden i
> forening med to øvrige bestyrelsesmedlemmer.

### 🔴 The email address is the trap

**A frivillig forening's CVR number expires after three years and is closed if
nobody renews it.** The renewal reminder goes to the email address on the
registration, and nowhere else.

Registering with a personal Gmail means the reminder arrives at an address that
may not belong to the forening in 2029. Create a forening-controlled address
first if you possibly can.

### Foreningsrepræsentant · read this before setting up MitID Erhverv

The form offers a **foreningsrepræsentant**: a named person who can then act for
the forening digitally with their own private MitID, including reading the
forening's Digital Post.

**This is probably all we need, and it avoids administering MitID Erhverv
entirely.** Note that a representative's name and address stay visible in CVR
even after they step down.

### What you get

- A **CVR number**
- A receipt by email the same day
- A public entry on datacvr.virk.dk **the following day**, not instantly
- A downloadable **registreringsbevis**, which is the documentation you send
  anyone who asks whether AI Sundays is a real organisation

### The same day the number arrives

1. Write the CVR number into `Foreningens stamdata.md` in the vault.
2. **Set a calendar reminder for the 3-year renewal.** Do it the day the number
   is issued, because nobody will remember in 2029.
3. Set up **Digital Post**, or register the foreningsrepræsentant instead.
4. **Book the bank appointment this same week.** It takes 2 to 4 weeks and is
   the only step where you wait on somebody else.

---

## After CVR

| Step | What it needs | Why it matters |
|---|---|---|
| **Bank account** | Vedtægter, referat, CVR number, board IDs, § 9 | 2 to 4 weeks. Arbejdernes Landsbank and Merkur are the most cooperative with small foreninger |
| **NemKonto** | The bank account | Københavns Kommune pays out to NemKonto only |
| **Folkeoplysende status** | Nine attachments, five paying members, 12 activities a year | Unlocks lokaletilskud, 65 to 75% of venue rent. Target 8 days |
| **Tuborgfondet Drømmepuljen** | CVR, and applicants aged **16 to 30** | Up to 100.000 DKK, answer in about a week. The under-30 members must be the named applicants |

---

## Contacts

| Who | For what |
|---|---|
| Erhvervsstyrelsens Kundecenter · 72 20 00 30 | CVR registration problems. Mon-Thu 8:30-16:00, Fri 9:00-15:00 |
| foreninger@kk.dk · 33 66 33 66 | Folkeoplysende forening questions |

## Source documents

Everything legal lives in the Obsidian vault at `AI Workshop/Forening/`:

| File | What it is |
|---|---|
| `progress.md` | The living status file. Read it first |
| `Vedtaegter (DA).md` | The statutes, 11 sections, 48 clauses |
| `Stiftende generalforsamling - referat.md` | The minutes template, run it top to bottom on the night |
| `Deltagerliste og medlemsliste.md` | The sheet people sign, plus the exact Excel columns |
| `CVR-registrering - datablad.md` | Every virk.dk field, pre-filled |
| `Beskeder til udsendelse.md` | The WhatsApp messages, ready to send |
| `PDF/00 Stiftelsespakke - samlet.pdf` | The printed meeting pack |
