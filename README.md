# Taxonomy

*Where did your tax dollars go?* Type a zip code on the map, then see a collage of what the federal government, your state, and your city spent money on.

Plain HTML, CSS, and JavaScript. No build step, nothing to install.

## How it works

1. **The map.** Every dot is a US zip code (about 41,000). As you type digits, the matching zip codes light up and the map zooms in. At five digits it circles your town.
2. **The collage.** Each spending category is a tile with a cutout image. Bigger tiles mean more money. The big number is how many dollars out of every $100 went there. Tap a tile to compare all three levels of government.

## Files

```
index.html               the page
css/style.css            all styling (colors at the top under :root)
js/map.js                the landing map and zip typing
js/collage.js            builds the category tiles
js/app.js                page flow: map -> results, level tabs, popup
data/categories.js       the categories: name, image, color, description
data/budgets.js          the money: federal, California, and cities
data/zips.js             every US zip code with its map position (generated, don't edit by hand)
assets/cutouts/          category images
assets/fonts/            Shrikhand + Archivo (both free, OFL license)
```

Good way to split the work: one person owns `css/` and `assets/`, the other owns `data/`.

## Swapping in real photo cutouts

The images in `assets/cutouts/` are **stand-ins** (Microsoft Fluent Emoji 3D, MIT license). The mood board calls for real photo cutouts, so replace them:

1. Find a photo (a bridge, a bus, a fire truck...). Good free sources: Unsplash, Pexels, Wikimedia Commons. Check the license.
2. Remove the background (Photoshop, remove.bg, or Preview on Mac) and export a **PNG with a transparent background**, about 600 to 800 px wide.
3. Save it over the old file with the same name (for example `assets/cutouts/roads.png`). Done. No code changes needed.

To use a different filename or color, edit `data/categories.js`.

## Categories

The 12 main ones: roads & bridges, public transit, parks & recreation, education, housing & homelessness, emergency services, police & public safety, libraries & culture, public health, water & environment, government operations, defense & veterans.

Plus five "extra" buckets that don't fit the 12 but are too big to hide: **Social Security**, **paying off debt**, **safety net**, **savings & reserves** (cities), and **everything else**. Social Security alone is about $22 of every $100 the federal government spends, so leaving it out would make the numbers misleading.

Categories a government barely funds show in a gray "barely any money here" strip, which is its own lesson (California's General Fund spends almost nothing on transit; that money comes from gas taxes and fees).

## Adding a city or state

Open `data/budgets.js` and copy one of the city blocks. The key is `"City Name|ST"`, spelled the way the zip lookup spells it (e.g. `"Los Angeles|CA"`). Fill in the values in millions using the category keys from `data/categories.js`. Search "[city] budget in brief" or "[city] adopted budget general fund" to find numbers. Add a note when you have to make a judgment call about which category something goes in.

States go under `states`, keyed by the two-letter code.

## Put it on GitHub

1. github.com > **New repository** > name it (e.g. `taxonomy`) > Public > Create.
2. Click **uploading an existing file**, drag in everything in this folder (keep the folders), commit.
3. **Settings > Collaborators > Add people** and invite your teammate.
4. **Settings > Pages** > Source: **Deploy from a branch** > `main`, `/ (root)` > Save. In a minute or two it's live at `https://<username>.github.io/taxonomy/`.

Working together: pull before you start, commit small changes often, and use a branch + pull request for big experiments. GitHub Desktop makes this easy if you haven't used git before.

Share a direct link to results with `?zip=95050` at the end of the URL.

## Data notes

- **Federal:** actual spending, fiscal year 2026 (Oct 2025 to Sep 2026), from the Treasury's final Monthly Treasury Statement. Mixes agency and function totals, so some categories are approximate.
- **California:** 2025-26 enacted General Fund (paid mostly by income and sales tax).
- **San José:** 2025-26 proposed General Fund. **Santa Clara:** 2025-26 adopted operating budget, without the city-owned utilities.
- Zip code positions come from the `zipcodes` npm package, projected with d3's Albers USA projection.
