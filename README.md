# Fobling

A tiny creature that lives on an NFC keyring (NTAG213). Its whole life is packed into the
URL stored on the fob: tapping opens this page, which reads the pet from the link. Feeding,
playing and washing write the new state back to the fob with Web NFC. There's no server,
account or database.

**Live:** https://lagsaton.github.io/fobling/

## Using it

1. Open the site in **Chrome on Android** with NFC on.
2. Name your fobling, press *Hatch onto a fob*, and hold the fob to the back of the phone.
3. From then on, tapping the fob (with the phone unlocked) opens it. Press Feed / Play / Wash,
   then tap again to save.

Food lasts 20h, fun 16h, clean 30h. Once food runs out it has 48h before it dies. It grows
through five stages (baby, kid, teen, adult, elder), but only when it's old enough *and* has
enough xp from being cared for. It counts how many phones have looked after it, and each
holder can leave a short note on the fob for the next one.

iPhones can open the page (and see the pet) but can't write to the fob from a website.

### Growing up, pats and generations

- **Neglect** counts how often a need was left to run empty. An adult turns out *radiant*
  (≤1 neglect), *grumpy* (6+), *cuddly* (40+ pats) or *classic*, settled the first time it's
  cared for as an adult.
- **Pats** use the NTAG213's built-in tap counter. With the counter mirror switched on, the chip
  stamps its tap count into the first 11 characters of the hash on every read, so every tap from
  any phone (iPhones too) counts as a pat and adds 1 xp. The app shows the exact NFC Tools
  commands under *Turn on pats*.
- **Generations**: hatch on a dead pet's fob and the new one is the next generation and inherits
  one of its traits. 1 in 64 hatch **shiny**.
- Hatching and evolving play a full-screen animation the first time each phone opens the pet
  afterwards.

## Trying it on a computer

- `?sim` fakes the taps, e.g. `http://localhost:8000/?sim`
- `?skip=30` pretends 30 hours have passed

```sh
python -m http.server 8000
npm test
```

## Files

- `pet.js`: state, binary packing into the URL, needs, ageing, death (no DOM; tested)
- `render.js`: draws the creature as SVG from its seed, stage and mood
- `app.js`: the page and the Web NFC read-check-write flow
- `test/pet.test.js`: core tests (`npm test`)

The URL has to fit on an NTAG213 (144 bytes). Pets pack into about 24–55 bytes, and the
note gets trimmed if it would push the URL past the budget.
