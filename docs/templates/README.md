# Templates

## `medlemsliste-TEMPLATE.csv`

The empty member list, with the exact column headers Københavns Kommune wants.
Open it in Excel and **save the filled copy as `Medlemsliste AI Sundays.xlsx`
outside this repository.**

The first four rows are pre-seeded with the board and revisor. `Indmeldt` is set
to the founding date; `Kontingent betalt` is deliberately blank, because no bank
account exists on the night and the two dates will genuinely differ.

The last two columns, `E-mail` and `Telefon`, are **not** part of the kommune's
requirement. They are ours, for calling a generalforsamling under vedtægternes
§ 5.3. Keep them when you send the file to the kommune or strip them; either is
fine.

### ⚠️ Never commit the filled version

This repository is public. The filled member list contains home addresses and
dates of birth for real people.

`.gitignore` blocks `Medlemsliste*.xlsx`, `Medlemsliste*.csv` and
`docs/templates/medlemsliste-2*.csv`, but a gitignore rule is a safety net, not
a policy. **The filled file belongs on the kasserer's machine**, in one place,
shared with the kommune only as an application attachment, and deleted per
member when their membership ends.

Filling in this template in place and committing it is the single most likely
way this project leaks personal data.
