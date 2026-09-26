# Forening: the running checklist

Where AI Sundays is in becoming a registered Danish association, what is still
missing, and exactly what to do next. Updated 2026-09-26.

Detail on the fields and the virk.dk form is in
[forening-registration.md](forening-registration.md). The legal documents are in
the Obsidian vault at `AI Workshop/Forening/`.

---

## Right now

**The founding meeting is tomorrow, Sunday 27 September, 12:30, Matrikel1.**

| | |
|---|---|
| ✅ Done | The group agreed on 13 September, unanimously, Auri as formand |
| ✅ Done | Vedtægter, referat, deltagerliste, spørgeskema all written and rendered to PDF |
| ✅ Done | All four posts filled: Auri, Eividas, Ignas, Andrei |
| ✅ Done | The member-facing page is live at aisundays.org/forening/ |
| 🔴 **Missing** | **A fifth paying member.** Four people hold posts. The kommune wants five |
| 🔴 **Missing** | **Nobody's address, date of birth, email or phone.** Collected tomorrow |
| ⬜ Next | Sign tomorrow, then register the CVR number in the week after |

---

## Tomorrow · the only irreversible step

Everything else on this page can be redone. Asking twenty-eight people for their
home address a second time cannot.

### Before you leave the house

- [ ] Print `PDF/00 Stiftelsespakke - samlet.pdf` from the vault
- [ ] Print section 1 of `Deltagerliste og medlemsliste.md`, the sheet people sign
- [ ] Decide how the 100 kr. is collected. No bank account exists yet, so it is
      MobilePay to Auri personally, and `Indmeldt` and `Kontingent betalt` are
      separate columns for exactly this reason

### In the room

- [ ] Run `Stiftende generalforsamling - referat.md` top to bottom
- [ ] Fill in the venue, the attendee count, and the dirigent and referent names
- [ ] **Collect from every person: name, street address, postcode and city, date
      of birth, email, phone**
- [ ] Check the spelling of **Mačiulis, Valavičius, Prusu, Baciauskas** against
      each person's ID. CVR identifies real people and a mismatch means a second
      meeting
- [ ] Everyone signs the deltagerliste
- [ ] Sign the vedtægter and the referat
- [ ] Scan both to PDF. Scans, not photos

People can fill in their own details at
[aisundays.org/forening/#form](https://www.aisundays.org/forening/#form), which
builds a message they paste into WhatsApp. The paper signature is still required.

---

## The week after · the CVR number

Free, on virk.dk, takes minutes. Full field-by-field walkthrough in
[forening-registration.md](forening-registration.md#gate-2--registering-the-cvr-number-on-virkdk).

- [ ] Search datacvr.virk.dk for a name collision on **Foreningen AI Sundays**
- [ ] Have the two signed PDFs and the three board members' CPR numbers ready
- [ ] File at virk.dk → Start frivillig forening, with Auri's **personal MitID**
- [ ] 🔴 **Use a forening-controlled email, not a personal Gmail.** The CVR number
      dies after three years unless renewed, and the only reminder goes to this
      address
- [ ] Consider registering a **foreningsrepræsentant**, which lets a named person
      act for the forening with their own MitID and probably removes the need for
      MitID Erhverv entirely

### The same day the number arrives

- [ ] Write it into `Foreningens stamdata.md`
- [ ] **Set a 3-year renewal reminder.** Nobody will remember in 2029
- [ ] Book the bank appointment. It takes 2 to 4 weeks and is the only step where
      you wait on somebody else

---

## Later · no deadline

| | What it needs |
|---|---|
| Bank account + NemKonto | The CVR number. The kommune pays out to NemKonto only |
| Folkeoplysende status | Five paying members, 12 activities a year, nine attachments |
| Tuborgfondet | CVR, and the applicants must be aged 16 to 30 |

Detail on the bank and tax: [aisundays.org/forening/praktisk/](https://www.aisundays.org/forening/praktisk/).

---

## What goes where

| | Where |
|---|---|
| Member names, addresses, birth dates | `Medlemsliste AI Sundays.xlsx`, on the kasserer's machine. **Never in this repo** |
| Signed deltagerliste and referat | Scanned PDFs in the vault |
| CPR numbers | Typed into virk.dk at the moment of filing, **written down nowhere** |
| The empty template | `docs/templates/medlemsliste-TEMPLATE.csv` |

This repository is public. `.gitignore` blocks the obvious filenames, but that is
a safety net, not the policy.

---

## Keeping the page honest

The statutes on the website are a transcription of a legal document, so two
checks guard them:

```bash
npm run statutes:verify    # all 48 Danish clauses vs the vault, word for word
npm run forening:check     # renders, design, toggle, form  (add a URL to test live)
```

Run both after touching anything under `public/forening/`.
