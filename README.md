[README.md](https://github.com/user-attachments/files/35037208/README.md)
# FRH Skills Helpers

Browser helper scripts used by the **frh-skills** Claude skills to do routine [Food Rescue Hero](https://foodrescuehero.org) (FRH) admin work safely: changing, creating and copying rescues and templates, managing donors, recipients and volunteers, and pulling reports.

The scripts contain no organization names, IDs, passwords or tokens. Anything specific to your organization (tags, recipients, cancel reasons) is read from the FRH page at run time.

## What's here

| File | Global | Used for |
|---|---|---|
| `frh-core-v10.js` | `window.frh` | Core: find rescues (with unclaimed / available / claimed filters), read a rescue, look up a volunteer, and the module loader `frh.use(...)` |
| `frh-rescues-v10.js` | `frh.use('rescues')` | Change rescues: plan and apply changes, publish, cancel and restore, Rescue CSV export and compare (`frh.diff`) |
| `frh-templates-v10.js` | `frh.use('templates')` | Recurring templates (schedule, repeat, publish, cancel), with the rescues module |
| `frh-create-v10.js` | `frh.use('create')` | Create rescues (one-time and recurring) and copies, saved as Drafts |
| `frh-records-v2.js` | `window.frhRec` | Donor, recipient and volunteer records and their sites: create (with a duplicate check), edit, set Active or Inactive, recipient site hours, location photos |

Earlier files (`frh-helpers-v9.js`, `frh-records-v1.js`) stay for anyone still on tag `v9`.

## How it works

The scripts call the same admin endpoints the FRH pages use when you click Save. They ride on your own signed-in FRH admin session. There is no separate API, no stored password, and nothing leaves your browser.

1. A skill asks the browser (through Claude in Chrome) to download a helper file from this repository at a pinned release tag.
2. The skill compares the file's length and check number to the values written in the skill. If they don't match, nothing is stored.
3. The verified code is saved in the browser's local storage for the FRH admin site and reused on later jobs.

Every change follows the same pattern: **plan, confirm, apply, re-read to verify, undo available.**

## Safety rules built in

- Nothing is ever deleted. Rescues can only be canceled, with a reason.
- New rescues are saved as Drafts. Publishing is a separate confirmed step and sends no notifications unless you ask.
- Date ranges FRH silently ignores are refused instead of guessed.
- Each job loads only the module it needs; read-only lookups load just the core.
- Template edits show the affected dates before anything is saved.

## Requirements

- An FRH admin account
- Chrome with Claude in Chrome
- The **frh-skills** plugin (`frh-change-rescues`, `frh-create-rescues`, `frh-rescue-form`, `frh-records`, `frh-lookup`, `frh-pull-report`)

## Versions

Each version is pinned to a release tag (for example `v9`) so later edits to this repository can't change what an installed version downloads. Always install from a tag, not from `main`.

## Updating

1. Edit the helper file and test it against test records only.
2. Bump the version, commit, and tag a release.
3. Update the expected length and check number in the skill's `references/helpers.md`.

## Maintainer

Only the maintainer should have write access. These scripts run inside admin sessions, so anyone who can change them controls what runs there.

## Disclaimer

Not affiliated with or endorsed by Food Rescue Hero. FRH's pages can change without notice and break a helper. Test on records made for testing before relying on a new version.
