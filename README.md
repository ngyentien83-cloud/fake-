# malware_sim

Three scripted, **purely visual** fake-infection timelines that run in a browser. Nothing here
is malware: it draws screens. It has no capability to harm anything, and the claims below are
checks you can re-run yourself.

Open `malware-demo/index.html` by double-clicking it. No build step, no dependencies, no
network access, works offline.

## What it cannot do

| Claim | How it is enforced |
| --- | --- |
| Reads nothing from your machine | No File System Access API, no uploads, no `navigator.*` capability calls |
| Writes nothing | No storage APIs at all; a reload is a hard reset |
| Contacts nothing | No `fetch` / `XMLHttpRequest` / `WebSocket` / remote asset; the browser records zero network requests |
| Persists nothing | No service worker, no cookies, no background timers |
| Injects nothing | Zero `innerHTML` / `document.write`; every string goes in through `textContent` |
| Cannot run away from you | `ESC` cancels the single animation frame loop and stops all state |

Re-verify the first five rows yourself from the repository root (Git Bash on Windows):

```bash
grep -ohE "fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|clipboard|showOpenFilePicker|serviceWorker|document\.cookie|eval\(|new Function|innerHTML|document\.write|setTimeout|setInterval" malware-demo/* | sort -u
```

Expected output: nothing. To confirm that absence means something, run the same command against
`_snapshot/positive-control.js`, which plants one instance of each token and must report them all.
A clean scan is only evidence if the detector demonstrably fires on a planted positive.

## The three timelines

A shared era-aware engine (desktop substrate, taskbar, window manager, animated cursor, one
`requestAnimationFrame` clock) drives three selectable variants:

- **pipeline** (`era-pipe.js`, 31.6 s) — shell prompt, code rain, filesystem scan, C2 beacon,
  encryption sweep, persistence lines, exfiltration, a glitching collapse, then a ransom panel.
- **love letter** (`era-worm2000.js`, 28.8 s) — 2000-era bevel-grey desktop, an unread mail whose
  attachment ends `.TXT.vbs`, a letter typed into Notepad, a dialog cascade that will not close,
  a blue screen, then a relay log.
- **sweep & ransom** (`era-ransom2017.js`, 13.4 s) — office desktop, filenames flipping to
  `.WCRY` mid-list, the wallpaper taken over in red, then a decryption dialog with LED countdowns
  and a payment panel.

Each sequence ends on a held screen rather than looping.

## Controls

| Key | Action |
| --- | --- |
| click a card, or Enter/Space on a focused card | start that timeline (also requests fullscreen) |
| `ESC` | stop immediately, exit fullscreen, show the end screen |
| `H` | toggle the horror treatment (blood, red screen, synthesised wet sound) |
| `M` | mute |

The key box and `Decrypt` accept input and always answer that the key is wrong; `Copy` flashes
"Copied" without touching the clipboard.

## What is deliberately not authentic

- The ransom screens are **period-styled approximations**. Layout, typography, panel structure and
  wording patterns are reproduced from published screenshots; this is not a verified verbatim copy
  of any real ransom note.
- The bitcoin string is `1FakeDemoAddressNotARealWallet...` — an invalid address that cannot
  receive anything. It is kept visibly fake on purpose: a realistic-looking address on a shareable
  page is the one detail where a viewer could take an irreversible action.
- No watermark appears during a sequence, so a recording of this is visually indistinguishable
  from a real infection screen. Keep that in mind before pointing it at someone else's machine.
- The 2017 dialog carries the title `Wana Decrypt0r 2.0`, the name of a real attack.

## Verification

`verify.mjs` runs the shipped source (engine plus all three variants) inside a stub DOM under a
synthetic 60 fps clock and reports what actually happened:

```bash
node verify.mjs        # from the repository root; developed on Node 24
```

It asserts phase coverage for all three timelines, that `ESC` leaves state frozen across 15 more
simulated seconds, that the ransom panels and countdowns mount, that the key guard reaches
lockout, that the `Copy` label reverts from the timeline clock rather than a stray timer, and that
the blood renderer's droplets descend, pool, plateau to zero steady-state cost once settled, and
re-awaken when intensity rises.

**Not verified:** nobody has inspected the rendered pixels. The browser automation surface used
during development could not capture screenshots, so layout details — scanline weight, the fake
cursor's arrow shape, dialog proportions on very small viewports — are unconfirmed. The
`prefers-reduced-motion` query is honoured for the shake and glitch layers but has not been
exercised with the setting actually enabled.

## Layout

```
malware-demo/index.html      markup, all CSS, and the era-aware engine
malware-demo/era-pipe.js     terminal pipeline timeline
malware-demo/era-worm2000.js 2000-era love-letter worm
malware-demo/era-ransom2017.js 2017-era sweep and ransom dialog
verify.mjs                   stub-DOM harness driving the shipped source
_snapshot/index.v1.html      the original single-file build, kept intact
_snapshot/positive-control.js planted-token fixture for the scan above
```
