# Clearout

A free, local-first tool that helps you find your **own** listings on
people-search and data-broker sites, and walks you through opting out —
at your own pace, one site at a time.

## What this does

- Keeps a curated list of the highest-traffic people-search and
  background-check sites, each with a plain-language priority (crucial,
  high, normal), the opt-out method, and any special notes (costs money,
  requires an ID, etc).
- Fills in a "Search for yourself" link for each site using your name and
  state, so you can quickly check whether you're listed.
- Tracks your progress per site — not started, found, opt-out requested,
  removed, needs follow-up — with a due date for rechecking sites you've
  already cleared, since people-search sites tend to relist you over time.
- Surfaces California's official DROP portal up front if you're a CA
  resident, since it's a single request that covers many brokers at once.
- Runs entirely as a page in your own browser. There is no server, no
  account, and no company on the other end of this — see below.

## What this does NOT do

- **It does not solve CAPTCHAs or automate anything on a broker's site.**
  Every "Search for yourself" and "Open opt-out page" button just opens the
  real site in a new tab. You look, you decide, you click, you submit — a
  human does every step, every time.
- **Nothing you type ever leaves your device.** Your name, addresses,
  phone numbers, and emails are saved only in your browser's local storage.
  Clearout has no server and no analytics — there is nowhere for that data
  to go except a broker's own site, and only when you personally submit
  their form.
- **This is not a tool for looking up other people.** It's a self opt-out
  tool: it's meant to help you find and remove *your own* information, not
  to search for anyone else's.

## Running it on your own computer

Clearout is just a folder of plain files (HTML, CSS, and JavaScript) —
there's nothing to build and nothing to install as "an app." The only
catch is that browsers won't let a page load its own data file straight
off your hard drive, so you need one small local server running while you
use it. That sounds technical, but it's a single command, and you don't
need any coding experience to run it.

**1. Get the files onto your computer.**
If someone already gave you the `Clearout` folder, skip ahead. Otherwise,
download it as a ZIP (e.g. GitHub's green "Code" → "Download ZIP" button)
and unzip it somewhere easy to find, like your Desktop or Downloads folder.

**2. Open a terminal.**
This is a plain text window for typing commands — it looks intimidating
the first time, but you'll only ever need it for this one step.
- **Mac:** press `Cmd + Space`, type `Terminal`, press Enter.
- **Windows:** click the Start menu, type `PowerShell`, press Enter.

**3. Check whether Python is installed.**
Clearout uses a built-in feature of Python (a very common programming
language) just to serve the files to your browser — you're not writing
any code. Type this and press Enter:

```bash
python3 --version
```

If that's not recognized on Windows, try:

```bash
python --version
```

If you see a version number (like `Python 3.12.1`), you already have it —
skip to step 4. If you see an error instead, install it for free from
[python.org/downloads](https://www.python.org/downloads/). **On Windows,**
tick the "Add python.exe to PATH" checkbox during setup. Once it's
installed, close and reopen your terminal and try the version command
again.

**4. Start the server.**
In the same terminal window, move into the folder you unzipped. If it's in
your Downloads folder, that's:

```bash
cd Downloads/Clearout
```

Then start the server:

```bash
python3 -m http.server 8000
```

(Use `python` instead of `python3` if that's what worked in step 3.) You
should see a line like `Serving HTTP on :: port 8000 ...`. **Leave this
window open** — it's what's serving the app. Closing it stops Clearout.

**5. Open it in your browser.**
Go to **http://localhost:8000** in Chrome, Firefox, Safari, or Edge.
That's the whole app, running entirely on your own machine.

When you're done, click back into that terminal window and press
`Ctrl + C` to stop the server. Your data isn't affected either way — it
lives in the browser, not the server.

*Prefer a permanent link instead of running a local server each time?*
Clearout is fully static, so it also works unmodified on GitHub Pages or
any other static host — no configuration needed beyond turning it on.

## Day-to-day workflow

1. Fill in the **Your info** panel — full name, other names you've used,
   current and past addresses, phone numbers, and emails. Only your name
   and a current address are really needed to build search links;
   everything else is optional and just helps some sites' verification
   match your record faster.
2. Click **Save**. Once you've saved a name, this panel collapses to a
   quiet summary line — click **Edit** any time to change it.
3. For each site in the list (grouped by priority — crucial first): click
   **Search for yourself**, look for a listing that's you in the new tab,
   and if you find one, click **Open opt-out page** and follow that site's
   own removal process there.
4. Update the status dropdown on the card (`Found`, `Opt-out requested`,
   `Removed`, etc.) so you can track progress. Open **Details** on a card
   for the opt-out method, the site's own notes, and a place for your own
   notes (a listing URL, a date, anything worth remembering).
5. Filter by priority, status, category, cost, or ID requirement using the
   controls above the list, sort it differently, or search by name.
6. **Re-check periodically.** People-search sites regularly re-scrape
   public records and can re-list you months after a successful opt-out.
   Marking a site `Removed` starts a 90-day recheck timer for it
   (adjustable per site in its Details panel). Use the **Due for recheck**
   filter to pull up exactly the sites it's time to revisit.
7. If you're in California, don't miss the callout near the top of the
   page pointing to the state's official DROP portal — one request there
   can cover many registered brokers at once.

## Important caveats

- **Opt-out pages change often.** If a link looks stale or broken, search
  `<site name> opt out` to find the current page.
- **Never pay for a basic opt-out.** Legitimate removal from the sites
  listed here is free. A site pushing a paid "premium removal" during
  opt-out is an upsell, not a requirement.
- **Identity verification varies.** A handful of sites ask for more
  sensitive info (last 4 of SSN, a photo ID) to process a request — that's
  flagged as "ID required" in the list. Only provide it if you're
  comfortable; most sites also offer a phone or email alternative.
- **This list isn't exhaustive.** It covers the highest-traffic
  people-search and background-check sites tracked by BADBOOL (see below).
  For broader, ongoing, or automated coverage, paid services like DeleteMe,
  Optery, Incogni, or Kanary exist and repeat this process across a larger
  list on a recurring basis — Clearout is a free, transparent, fully-manual
  complement to (not a replacement for) those.

## Files

- `index.html`, `css/style.css`, `js/app.js` — the app. Plain HTML/CSS/JS,
  no framework, no build step.
- `data/brokers.json` — the curated broker list (see schema and licensing
  below; safe to edit or extend).

### `data/brokers.json` schema

```json
{
  "id": "string",
  "name": "string",
  "category": "public_people_search | non_public_broker | search_engine | other",
  "priority": "crucial | high | normal",
  "search_url": "string, may contain {first}/{last}/{state}",
  "opt_out_url": "string",
  "method": "form | email | phone | mail | form+email_confirm",
  "requires_id": "boolean",
  "costs_money": "boolean",
  "notes": "string",
  "source": "string"
}
```

The file's top-level shape is `{ "_source": {...}, "brokers": [...] }` —
the `_source` object documents where the list came from and when it was
transcribed (JSON has no comment syntax, so this stands in for one).

## Licensing

- **App code** (`index.html`, `css/`, `js/`): **MIT** — see [`LICENSE`](LICENSE).
  Use it, fork it, host your own copy, change it however you like.
- **`data/brokers.json`**: derived from the
  [Big Ass Data Broker Opt-Out List (BADBOOL)](https://github.com/yaelwrites/Big-Ass-Data-Broker-Opt-Out-List)
  by [Yael Writes](https://yaelwrites.com/), used under
  **CC BY-NC-SA** (attribution required, noncommercial, share-alike). If
  you fork or redistribute the data file, keep this attribution and the
  same license. Consider
  [supporting BADBOOL](https://ko-fi.com/kofisupporter11745) — it's the
  reason this data exists and stays current.

## v2 (not built yet)

A companion browser extension that recognizes broker domains and offers to
autofill your local profile into their form fields, so the manual "type
your name into 40 different forms" part gets faster too. Same rules would
apply: local-only data, no auto-submission, a human confirms every step.
