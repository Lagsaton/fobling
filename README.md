# Fobling

A tiny creature that lives on an NFC keyring (NTAG213). Its whole life is packed into the
URL stored on the fob: tapping opens this page, which reads the pet from the link. Feeding,
playing and washing write the new state back to the fob with Web NFC. There's no server,
account or database.

**Live:** https://lagsaton.github.io/fobling/

## Using it

1. Open the site in **Chrome on Android** with NFC on.
2. Name your fobling, press *Hatch onto a fob*, and hold the fob to the back of the phone.
3. From then on, tapping the fob (with the phone unlocked) opens it. Feed, Play and Wash each
   start a ten-second mini-game; the better you do, the more xp. Then tap the fob to save.

Food lasts 20h, fun 16h, clean 30h. Once food runs out it has 48h before it dies. It grows
through five stages (baby, kid, teen, adult, elder), but only when it's old enough *and* has
enough xp from being cared for. It counts how many phones have looked after it, and each
holder can leave a short note on the fob for the next one.

iPhones can open the page (and see the pet) but can't write to the fob from a website.

### Growing up, battles and generations

- **Neglect** counts how often a need was left to run empty. An adult turns out *radiant*
  (at most 1 neglect), *grumpy* (6+), *cuddly* (cared for by 4+ different phones) or *classic*,
  settled the first time it's cared for as an adult.
- **Battles**: tap a rival's fob (read only), fight three rounds by stopping a needle in the
  sweet spot, then tap your own fob to save the result. Shapes go round in a circle:
  blob beats bean beats puff beats sprout beats blob. Once an hour; a battle also counts as play.
- **A living pet can't be replaced.** Hatch on a blank fob, or on a dead pet's fob: the new one
  is the next generation and inherits one of its traits. 1 in 64 hatch **shiny**.
- Hatching and evolving play a full-screen animation the first time each phone opens the pet
  afterwards.

### Weather, outfits and other bits

- **Weather** (opt-in, uses the phone's location with Open-Meteo, nothing goes on the fob):
  rain (leaf umbrella), snow (beanie and scarf, 2× play xp), storms (scared), fog, heat
  (sunglasses), wind, and the real moon phase at night.
- **Outfits**: Santa hat in December, a pumpkin in the last week of October, a party hat on every
  whole week of age.
- **Shake** the phone and it gets dizzy. **Share a photo** makes a 1080×1350 card of it.
- The first 11 characters of the hash are a reserved slot. An earlier version stamped the fob's
  tap counter there ("pats", since removed); links that still carry a stamped counter load fine,
  and the app offers the NFC command to switch the mirror off.

## Trying it on a computer

- `?sim` fakes the taps, e.g. `http://localhost:8000/?sim`
- `?skip=30` pretends 30 hours have passed
- `?weather=snow` (or rain, storm, fog, hot, cloudy, clear) shows a weather look; add `&windy`

```sh
python -m http.server 8000
npm test
```

## Deploying

Run `npm run bump` before pushing to `main`. It stamps a fresh `?v=` on every file and writes
`version.json`, so phones that cached an older copy switch to the new one straight away.

The fob stores the full URL, so never rename the repo or change the Pages address, and every
format change must still read older links (v1, v2 and v3 all exist on real fobs).

## Files

- `pet.js`: state, binary packing into the URL, needs, ageing, death, battles, outfits (no DOM; tested)
- `render.js`: draws the creature as SVG from its seed, stage, mood, form, weather and outfit
- `app.js`: the page and the Web NFC read-check-write flow
- `games.js`: the Feed, Play and Wash mini-games
- `battle.js`: the battle screen
- `weather.js`: Open-Meteo lookup and moon phase
- `photo.js`: the shareable photo card
- `ceremony.js`, `sound.js`: hatch/evolve animations, synthesized sounds
- `test/pet.test.js`: core tests (`npm test`)

The URL has to fit on an NTAG213 (144 bytes). The note gets trimmed if it would push the URL
past the budget.
