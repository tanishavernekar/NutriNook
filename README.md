# NutriNook

A local-first nutrient journal built with React, TypeScript, Vite, IndexedDB and Web Audio. The recipe book is a reusable food library; the plate is what you actually ate on a given date. The shelf reads only from that plate.

## Run and preview

**No-terminal option:** Extract the entire **NutriNook – Open directly** ZIP, keep its files together, and double-click its `index.html` in Chrome. No install, internet, or server is needed. The GitHub **source** ZIP is for editing and publishing; its root `index.html` is not the compiled app. To create an open-directly copy from source, run `npm ci` and `npm run build:portable`, then open `dist-portable/index.html`.

The file copy and the hosted app do not share a journal. Use a JSON backup in Kitchen settings to transfer entries, and back up before moving the folder or switching browsers; local-file storage behavior varies by browser.

Use Node 22.12+ or Node 24 and npm. In this repository:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5187/**. No API key, account or backend is needed. The app bundles its own fonts and art. Use the same browser and URL to return to the same journal: changing host, port or browser changes the storage origin. Stop the server with Ctrl-C. If npm reports a permissions error in an existing global cache, use `npm ci --cache /tmp/cozy-kitchen-npm-cache` rather than changing directory ownership.

## Your first plate

The recipe book sizes itself to show every collapsed category without scrolling inside the book. When you expand categories, longer food lists scroll within the page.

On phones the shelf art, headings, and page margins are smaller. The shelf follows a swipe and settles on a jar when you lift your finger; tapping an arrow glides through the jars. With reduced motion enabled in the kitchen or on your device, the arrows move immediately. The arrows, food-row actions, and ingredient steppers keep at least 44-pixel tap targets; the layout does not rely on zooming out the page.

1. In **Food library**, search for _A2 Whole Milk_. Use the circle on the left to log the reference serving, 0.5 cup. The plate now contains one entry; the shelf shows 80 kcal and 4 g protein. The second `+` logs a separate entry. Click the heart to favorite the definition. Before logging, drag the portion pill **up to increase** or **down to decrease** the serving on a phone. A mouse drag also works in the mobile preview. Tap the number to type an exact amount, or use the desktop hover chevrons or ↑/↓ keys. Each step snaps to the next friendly size (¼, ½, ¾, 1, 1¼, 1½, 2, 2½, 3, 4, 5, 6, 8, 10, …). On the **Category** tab, nonempty groups start collapsed: **Dishes**, **Needs category**, and **Dairy & Protein** appear first, followed by the remaining categories alphabetically. **Open all** / **Close all** expands or collapses every group at once.
   On phones, every food row shows **+** above the favorite heart in a single column. Both can be tapped without first selecting the row. On desktop the actions appear on hover or keyboard focus, and saved hearts stay visible.
   Serving units stay on one line. If a long unit does not fit, only the unit ends in an ellipsis; hover over it to read the full name.
2. Click the **quantity** on the plate and choose **1 cup**: the snapshot now contributes 160 kcal and 8 g protein. Click the **name** for its scaled nutrition label or **×** to remove just that entry. Undo/Redo works across dates and switches to the affected plate. Reloading resets the temporary undo stack, not the journal.
3. A new kitchen starts with an **example profile** and its reference goals. Open **My goals** to replace the example with your details, or turn off **Use my profile for recommendations**. You can also expand a nutrient and **Set custom target**. Save to keep your choices. Click a jar to inspect its source, target, applicable UL and contributing foods; swipe or use the chevrons or ←/→ to see the next nutrient.
4. Click the tilted paper calendar to edit a different day. It hangs slightly over the ceramic plate’s left rim to leave more room for food pills. The pills scroll to the inner edge of the plain glazed rim. The plate stays the same height as you switch days, even when empty. A **Past day** or **Upcoming day** tag marks other dates; **Back to today** returns you to today. A small hand-drawn flower in the kitchen theme's colors marks each logged day. Saving goals on that date creates an effective-dated target set; it never edits logged foods.
5. Click an empty part of the ceramic plate or choose **View all** to edit that day’s log. Click a serving to pick a preset or enter a custom quantity. The trash button removes only that entry, not the recipe-book food. **Add from recipe book** adds a food at its listed serving or logs the ingredients of a saved dish. Repeat servings stay separate. **Undo last change** reverses the latest edit on this date.

## Stock the kitchen

The recipe book keeps the same height as you switch tabs, expand categories or search. On phones, the four tabs share one even row, with their labels centered above the painted page edge. Scroll inside the page to browse long lists; the tabs and search stay in place.

Search from any tab to find foods by name, brand or category and saved dishes by name. Clear the search to return to the selected tab.

- **Add new food** opens a recipe card. Set its reference amount/unit and enter nutrition _per that amount_. Empty is unknown; zero is a measured zero. Click an existing food's name **in the book** to edit, duplicate, archive or delete it. Find archived foods in **Kitchen settings → Food database & categories**; create or rename categories there too.
- **Pantry table** (the sheet button in the toolbar, where the speaker used to be) shows the whole food library as a spreadsheet. Edit any cell: changes save when you leave the cell or press Enter, and invalid values are outlined and left unsaved. **Add row** creates a new food. The trash icon deletes a food unless a saved dish uses it. To bulk add foods, copy rows from Google Sheets, Excel or Numbers, click the blank bottom row and press ⌘V / Ctrl+V. You can also use **Paste rows**. Headers such as `Food Item, Quantity, Calories, Protein (g)…` are matched automatically; without headers, the table's column order is assumed. Rows with no serving, such as `PROTIEN` or `VEGGIES`, set the category for the rows below them. Non-food rows such as `IDEAL RANGE` are skipped. A pasted food with the same name and brand updates the existing food instead of duplicating it. **Download CSV** exports the table. Sound options are in **Kitchen settings → Sounds & celebrations**.
- In **Dishes → Write a dish → From ingredients**, name your dish, search for foods by name or brand, and use **+ Add** beside each result. Under **In this dish**, type an exact amount or use **− / +** (or the up/down arrow keys) to adjust by half that food’s reference serving. For example, White Onion has a ¼-onion serving, so each step changes the amount by ⅛ onion. **Save dish** saves the recipe without logging it. Serving the dish later logs those amounts together as one undoable action.
- **Add new food** sits below the recipe book on phones and on its right edge on desktop. **Write a dish** appears alongside it on the Dishes tab. Both open the same _Add to the recipe book_ dialog with a **Food · Whole dish · From ingredients** toggle. The dialog stays the same size across modes; longer forms scroll below the toggle. _Whole dish_ saves a ready-made dish, such as a sandwich, with its own nutrition per serving and no ingredient list. It logs as one dish pill; edit it from its name in the Dishes tab.
- **Kitchen settings → Import or export food CSV** maps headers, validates values, previews rows and reports duplicates and missing data. Choose skip, replace or variations before confirming. Food CSV exports definitions; use **Complete backup & restore** to transfer an entire journal. A restore must pass validation and be explicitly confirmed before replacement.
- **Kitchen settings → Sounds & celebrations** controls sound, volume, celebrations and preview. Audio starts only after interaction; sound is optional and never carries essential information. Motion respects both system preferences and a local setting.

## Sources, interpretation and limits

The pantry table always has a blank **Paste food rows here…** row at the bottom, including when filtered. It is not counted, saved, or exported as a food. Paste one or many spreadsheet, CSV, or pipe-delimited Markdown rows directly into it. A Markdown `| --- |` divider is ignored; the first food above it is kept even without column headings. For headerless rows use the visible column order, beginning with food name and serving. Omitted nutrient values stay unavailable.

Use **Sort by** to order the visible foods by **Date added**, **Food name**, **Category**, or any nutrient **per listed serving**. The adjacent arrow button reverses the order. You can also click the **Food item**, **Category**, or a nutrient column heading, then click it again to reverse. Category sorting keeps foods alphabetical within each category. Unavailable nutrient values stay last in either direction; measured zeros sort as numbers. Sorting changes only the view, not your saved foods or selections.

New rows start in **Needs category**. When you enter a food name, NutriNook checks your pantry for a matching name, then uses familiar food names to suggest a category. Unrecognized or ambiguous names stay in **Needs category**; you can find them by typing that phrase in **Filter foods**. Choose a category yourself to keep it when renaming the food. Pasted rows and CSV imports use the same rules when no category or section heading is supplied; updates keep the matching food’s saved category.

The confirmation below the grid names the foods that were added or updated. If it says **0 added**, the matching foods are already in your pantry; the paste updated those rows in place. Select **Show last pasted rows** to inspect them, then **Show all foods** to return.

To copy into Excel or Google Sheets, **check the box beside a food for its entire row**, including columns offscreen. Check several boxes to copy multiple rows. For just part of the table, **drag from one cell into another** in the editable table, or click the first cell and Shift-click the last. Choose **Copy** below the grid or press **⌘C / Ctrl+C**, then paste into the first destination cell. Copy includes only visible rows, in the current sort order; missing values stay blank and measured zeros stay zero. Clicking and editing text inside a single cell still works.

For touch selection, keyboard range selection, or headings, choose **Select cells to copy**. Tap two opposite corners or extend with **Shift + arrow keys**. **Select full rows** expands a range across every column, and **Include headings** adds names and units. Choose **Copy selection**, then **Done** to return to editing.

The count below the table shows the total number of pantry foods until you select rows or cells. To delete multiple pantry foods, check the boxes beside their names, choose **Delete selected** below the table, and confirm. The checkbox beside **Food item** selects all foods in the current view. Individual selections stay checked across filters; the count flags hidden selections before deletion. Foods used in saved dishes can be copied but not deleted. Deleting pantry foods never changes logged plates.

`src/data/pantry.csv` supplies **136 distinct starter items**. It includes the simplified pantry names, cooked cup servings for the added vegetables, grains and pulses, and a 1-cup serving for guava. The CSV's _Sugar (g)_ is total sugar. _Added sugar (g)_ is separate and remains blank when unreported.

Revision 11 adds four one-piece dishes to starter kitchens: jola bhakri (40 g sorghum flour), chapati (30 g whole-wheat flour), naan (90 g plain naan) and butter naan (the same naan plus 5 g unsalted butter). To publish a starter change, register its category and catalog revision as well as its CSV row, keep the previous revision valid for saved journals, update the catalog checks, and run **Publish NutriNook to Pages** after committing. A CSV commit alone does not deploy the site.

The 127-item pantry gains five quarter-cup cooking staples on reload. USDA SR Legacy dry weights are 30 g for [atta (whole wheat flour)](https://fdc.nal.usda.gov/food-details/168893/nutrients), 41.75 g for [rawa (unenriched semolina)](https://fdc.nal.usda.gov/food-details/168933/nutrients), and 31.25 g for [maida (unenriched all-purpose wheat flour)](https://fdc.nal.usda.gov/food-details/169761/nutrients). [Fresh grated coconut](https://fdc.nal.usda.gov/food-details/170169/nutrients) uses 20 g; [full-fat canned coconut milk](https://fdc.nal.usda.gov/food-details/170173/nutrients) uses 56.5 g. Both are cooking ingredients on the Everyday Essentials shelf.

The 116-item pantry gains seven [Indian Nutrient Databank](https://www.anuvaad.org.in/indian-nutrient-databank/) dishes (aloo paratha, methi thepla, plain uttapam, aloo gobi, matar paneer, dal makhani and dahi bhaat), plus papaya pieces and pomegranate arils by the cup. Nut portions are **4 walnut halves** (8.1 g) and **4 shelled pistachio kernels** (about 2.31 g). Nutrients use the USDA weights of [14 walnut halves](https://fdc.nal.usda.gov/food-details/170187/nutrients) or [49 pistachio kernels](https://fdc.nal.usda.gov/food-details/170184/nutrients) per ounce, scaled before rounding.

Reloading the former 117-item pantry removes the starter Thai iced tea and the built-in **Beverages** section. Past plate entries stay unchanged. Other foods from that shelf move to **Needs category**; if a saved recipe uses the starter tea, its ingredient is archived rather than deleted.

The 105-item pantry gains eleven dishes on reload. The [Thai basil fried rice](https://www.snapcalorie.com/recipes/thai_spicy_basil_chicken_fried_rice.html) uses a chicken plate, not tofu; the [chicken Massaman curry](https://tastesbetterfromscratch.com/massaman-curry/) excludes rice. Both tacos are per taco, fried prawns per six, fried cod per fillet, fried wings per whole wing and veggie pizza per slice. These dishes and the fried fillet burger use [USDA survey food portions](https://fdc.nal.usda.gov/download-datasets/). All three burgers include the bun: [black bean](https://myplate.food/recipes/black-bean-burgers), [fried chicken fillet](https://fdc.nal.usda.gov/food-details/2707008/nutrients), or shredded chicken (85 g [roasted breast](https://fdc.nal.usda.gov/food-details/171477/nutrients) and a 55 g [plain bun](https://fdc.nal.usda.gov/food-details/172796/nutrients), no sauce or cheese).

The 101-item starter pantry gains four dishes on reload: [misal pav](https://ministryofcurry.com/spicy-misal-pav/) (one plate including two pav), [aloo samosa](https://www.vegrecipesofindia.com/samosa-recipe-punjabi-samosa/) (one samosa), [pani puri](https://nutriscan.app/calories-nutrition/pani-puri) (six filled puris) and [shev puri](https://www.vegrecipesofindia.com/sev-puri-recipe/) (six pieces with chutneys). Nutrition is per listed serving, not per puri.

The 91-item starter pantry gains idli, sambar, rava upma, khaman dhokla, plain khichdi, sabudana khichdi, palak paneer, egg curry, cucumber raita and rice kheer on reload. Portions follow the Indian Nutrient Databank recipes: one idli, one piece of dhokla, one small bowl of plain khichdi, or one bowl for the others. Neither total nor added sugar is reported for these estimates.

**Dish portions.** The 82-item starter pantry gains nine recipe estimates under **Dishes** on reload. A bowl or plate means one serving of the reference recipe, not a US cup or a restaurant standard. [Vada pav](https://www.vegrecipesofindia.com/vada-pav-how-to-make-wada-pav/) is one sandwich with chutneys; [chicken biryani](https://www.indianhealthyrecipes.com/chicken-biryani-recipe/) is one quarter of the four-serving recipe without sides. The other estimates come from the [Indian Nutrient Databank](https://www.anuvaad.org.in/indian-nutrient-databank/): pav bhaji is one fifth of the recipe (bhaji, butter and about 2½ pav); veggie pulav is one plate; chicken curry and veggie poha are each one bowl. Plain and masala dosa are each one dosa without sides. One plate of chicken curry with dosa includes one bowl of curry and one plain dosa. Free sugars are not counted as total or added sugar; reported K1 and K2 are combined for vitamin K.

The 78-food starter pantry gains four foods on reload, without resetting personal edits or restoring older deleted foods. Their 1-cup servings use USDA SR Legacy cooked weights: [long-grain brown rice](https://fdc.nal.usda.gov/food-details/169704/nutrients) (202 g), [maath (amaranth leaves)](https://fdc.nal.usda.gov/food-details/169202/nutrients) (132 g), [kuttu (roasted buckwheat groats)](https://fdc.nal.usda.gov/food-details/170686/nutrients) (168 g), and [large lima beans](https://fdc.nal.usda.gov/food-details/174253/nutrients) (188 g).

Reloading an earlier 57-food kitchen applies a one-time update: new starter foods are added once, unchanged starters receive their revised names and servings, and the retired soya chunks are omitted unless edited, favorited, archived or used in a recipe. Existing IDs, personal food definitions, logged meal snapshots and settings are retained. A serving is not switched from grams to cups if a saved recipe references that food. The built-in list is shared by new installations; subsequent personal edits still stay in each browser's journal.

**Starter nutrition corrections (Nov 2026).** [a2 Milk Whole, US label](https://www.a2milk.com/products/a2-milk-whole) reports values per 240 mL. The library uses half that serving (120 mL): 80 kcal, 4 g protein, 4.5 g fat, 6.5 g carbs, 0 g fiber, 6 g total sugar, 0 g added sugar, 150 mg calcium, 0 mg iron and 200 mg potassium. Magnesium and vitamin K are unreported. [USDA common raw guava, FDC 173044](https://fdc.nal.usda.gov/food-details/173044/nutrients) supplies 2.6 µg vitamin K per 100 g. Without a verified recipe or label, potassium and vitamin K for Moong Dal Chilla, and magnesium and vitamin K for the Qdoba Chicken Bowl, are unknown rather than zero. Paayri Mango's carbohydrate figures remain as supplied pending a cultivar-specific source and edible serving weight.

On first load or restore of an older journal, these four corrections update only starter definitions whose name, brand, type, serving and nutrient values still match the old data. Logged plates retain their original nutrition snapshots; user-edited values are not overwritten.

The kitchen opens directly on the shelf. Each jar has a vertical paper label and a separate amount badge. The round buttons below the book open goals, undo/redo, the pantry table and settings. A notched tag marks a jar’s 100% line: **Goal** for a minimum, **Min** for the lower edge of a range, **Max** for a recommended maximum, **UL** for an upper limit, or **Est.** for estimated energy. Without a target the jar has no tag and shows intake in physical units. A partial total is labeled incomplete, not treated as complete. Physical fill stops at 100%; the numerical percentage does not. Energy estimates and maxima are not success goals.

Total sugar has no DRI target. In its jar, **Set a personal sugar goal** opens **My goals → Total sugar** for the selected date. Choose **Set custom target**, enter your goal, and **Save goals**, or leave it unset to track grams only. Added sugar has its own separate setting.

Open a jar to see its intake bar. The percentage sits inside the bar at the end of the fill. Markers show the reference amount or both ends of a target range. If intake passes the reference (or an earlier applicable upper limit), the scale extends and the striped segment shows exactly how much lies beyond it. Stripes don’t mean “unsafe”: passing a minimum still counts as meeting that goal. Without a reference, the card shows the amount without a percentage.

Select **Guide** in a nutrient card’s header for its role in the body, a short list of familiar food sources, and what low or high intake can mean over time. **Dive deeper**, beside the food sources heading, opens the searchable portion comparison for the same nutrient and plate date. **Back** returns to the compact guide; **Back** again returns to the plate breakdown. Swipe to browse neighboring nutrients at the same level. The guides are bundled locally; only their external source links need internet access.

**Explore food sources.** Each result shows how much the food contributes in a typical portion and its share of the **full daily reference saved for the selected plate date**, including custom settings. Search by name or preparation (for example, `lentils boiled without salt`), then open a food to compare it to the full day. The calculation is `100 × daily reference ÷ nutrient per 100 g`; it does not subtract logged food. A range shows both endpoints, energy is an estimate, and a recommended maximum or UL is a limit comparison, never a target. Missing or conflicting references leave the guide available but do not produce a ranked list. Published household weights are shown only when there is a matching unambiguous measure for that same record. These are comparisons, not serving advice.

Select **ⓘ** beside the heading for the cutoff: only foods supplying **at least 10% of the saved reference in one documented portion** appear, highest contribution first. For a range this uses its lower endpoint. This is a browsing rule, not an FDA label claim or a recommended serving. Foods without a usable portion or nutrient value do not qualify. For example, the customary spice portion is ¼ teaspoon, not 100 g. In contrast, 90 g of boiled lentils without salt provides 7.11 g of fiber, or 28% of a 25 g reference. This filter affects only the guide; it does not change your pantry, plate or logged totals.

For SR Legacy, use a portion explicitly labeled as a serving for that record, or match a documented customary portion for a supported food type and preparation ([FDA table 2](https://www.law.cornell.edu/cfr/text/21/101.12), [USDA meat](https://www.law.cornell.edu/cfr/text/9/317.312) and [poultry](https://www.law.cornell.edu/cfr/text/9/381.412)). Volume-based rules require that record’s measured gram weight. A cup or spoon weight alone is **not** a customary serving. For added sugar, join the exact FPED food code to the **2017–18 FNDDS** positive default portion (“Quantity not specified”, code 90000); this is the survey’s estimate, not an individual’s measured intake. Open any result to see its portion basis and composition source.

- [USDA FoodData Central, SR Legacy, April 2018](https://fdc.nal.usda.gov/download-datasets/) supplies 7,793 food records with varying coverage. Each result links to its FDC ID. Vitamin K here is **K₁ (phylloquinone)**, not all forms; sugars are total sugars. The reference describes the foods as published, not necessarily a product’s current formulation.
- SR Legacy does **not** report added sugars. That guide instead uses the [USDA Food Patterns Equivalents Database 2017–2018](https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/food-surveys-research-group/docs/fped-databases/): 7,083 distinct survey food codes, 2,980 with positive estimated added sugars. Published teaspoon equivalents per 100 g are converted using [USDA’s 4.2 g per teaspoon equivalent](https://www.ars.usda.gov/research/publications/publication/?seqNo115=335039). These foods are identified by their own survey code, never matched to SR foods by name or inferred from total sugar.

The derived JSON files in `public/food-reference/` ship with the app; no API key, Python or database download is needed to run it. To reproduce them (optional, Python 3):

```sh
curl -fL https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip -o /tmp/cozy-sr.zip
curl -fL https://www.ars.usda.gov/ARSUserFiles/80400530/apps/FPED_1718.xls -o /tmp/cozy-fped.xls
curl -fL https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2020-10-30.zip -o /tmp/cozy-fndds.zip
python3 -m venv /tmp/cozy-reference-env
/tmp/cozy-reference-env/bin/pip install xlrd==2.0.2
/tmp/cozy-reference-env/bin/python scripts/build-food-reference.py /tmp/cozy-sr.zip /tmp/cozy-fped.xls /tmp/cozy-fndds.zip
```

The importer checks the release hashes and source columns/units before writing the files. USDA food data are public domain; the guide’s relative ranking and portion calculations are NutriNook’s, not USDA recommendations.

`src/data/recommendations.ts` contains adult DRI strata and source/version metadata: RDA, AI, AMDR, food-applicable ULs and EER are distinct. In **My goals**, click the **Height** or **Weight** label to choose cm/in or kg/lb independently. Switching units converts the display without changing the measurement or goals; **Save goals** remembers both choices. Only energy and energy-derived targets depend on activity. Goals are general estimates, not individualized medical advice.

- [NIH Office of Dietary Supplements: DRI overview and tables](https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx), with specific mineral and vitamin fact sheets linked in the app.
- [USDA DRI calculator](https://www.nal.usda.gov/human-nutrition-and-food-safety/dri-calculator) and [DRI macronutrient reference tables](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html).
- [Adult 2023 DRI energy equations by sex and activity](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html).

**Coverage boundaries:** No automatic targets below age 19. Pregnancy/lactation has supported adult nutrient references but no automatic energy estimate (the needed additional inputs are not collected). No automatic total- or added-sugar goal. The magnesium UL for _supplemental_ magnesium is intentionally not applied to food. Unit conversion supports compatible volume or mass units, not generic cups-to-grams guesses. The app is intended for one active editing tab, not concurrent editors. Clearing browser storage or ending a private browsing session can remove the journal; keep JSON backups.

## Editing the project

The [color and type field guide (PNG)](docs/nutrinook-color-and-type.png) shows the foundation colors, nutrient states, desktop and phone type sizes, and painted materials. With the dev server running, [open the source guide](http://127.0.0.1:5187/docs/visual-system.html) to select text and copy hex values.

| Location                                                              | Responsibility                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/model.ts`, `src/history.ts`                                      | Canonical units, food snapshots, aggregation, `getNutrientVisualStatus`, plate undo/redo |
| `src/Library.tsx`, `src/Journal.tsx`                                  | Book and food/dish editing; shelf, plate, labels, quantities and calendar                |
| `src/Goals.tsx`, `src/Settings.tsx`                                   | Profile, dated targets, data management and preferences                                  |
| `src/data/`, `src/storage.ts`                                         | Seed file, CSV mapping, references, IndexedDB schema v1 and backup validation            |
| `src/Artwork.tsx`, `src/jarAssets.ts`, `src/assets/`, `src/style.css` | Layered painted jars and shelf, asset manifest, layout, paper/wood, motion and colors    |
| `src/audio.ts`                                                        | Replaceable synthesized cue palette, envelopes, cooldowns, voice limit and cleanup       |
| `src/main.tsx`                                                        | Connects date, plate, food definitions, modal panels and feedback                        |

### Choose a kitchen theme

Open **Kitchen settings → Artwork themes** and choose **Cozy Wood** (the original wood, parchment, and sage paintings), **Periwinkle** (sky blue, violet, and blush; the default), or **Ink & Paper** (white surfaces, charcoal controls, and grayscale illustrations). The twelve painted fillings and nutrient-status colors stay the same. Your choice is stored with your journal and travels with a JSON backup. An older backup without an appearance starts in Periwinkle.

### Try custom artwork with a single PNG

Shared UI colors live in `src/style.css`; `scripts/build-assets.py` exports the alternate painted materials to `src/preset-art/`. Custom PNG imports are displayed without a color filter. All twelve built-in jar fillings are lossless crops of [painted-jars.png](public/themes/painted-jars.png), a contents-only sheet (1920 × 1280 px). Repaint that sheet to change just the fillings. **Reset custom artwork** restores the chosen built-in theme.

Download the [compact shelf & scenery PNG](public/themes/template-scene-v1.png) from **Kitchen settings → Artwork themes**. The [full paint-over PNG](public/themes/template-v1.png) remains available here; the older `art/spritesheet.png` is a reference poster, not an import file.

The **1536 × 1312** compact sheet has 20 half-size slots: twelve jar contents, front and back glass, ivy, plant, sprig, shelf cabinet, wall, and wainscot. Keep the glass silhouette aligned with the original jar mask. On import, only these slots are replaced; the rest of the app uses its original art, not a previous theme. The preview picker and GitHub Pages configuration accept either sheet and recognize it by canvas dimensions.

1. Open the compact template or the **3584 × 3179** full template in your drawing app. Paint on a new layer, keep each image in its labeled slot, and export a full-resolution **transparent PNG**. Do not trim, rescale, move slots, or flatten transparency onto a background. Leave untouched slots as they are; a transparent slot intentionally hides that layer. Printed labels and gutters are ignored.
2. Use **Preview a theme PNG** in the same settings panel. No upload or build is needed. Try another sheet, reset the preview, or pick a different kitchen theme. A failed import keeps the last working art. Previews are tab-only; on reload, an explicit `?theme=` artwork link wins, otherwise your saved kitchen theme takes precedence over the site's default artwork.
3. **For GitHub Pages:** add your PNG to `public/themes/`, e.g. `public/themes/autumn.png`. After deploying the normal `npm run build` output, visit `https://OWNER.github.io/REPO/?theme=autumn`. To make it the default, set `public/themes/config.json` to `{"defaultTheme":"autumn"}` and redeploy. Use lowercase letters, digits, or hyphens in filenames; `original` is reserved. `?theme=original` bypasses the site default. No domains, root-relative paths, or backend settings to change. The original theme does not download the atlas on startup.

**What to paint:** the 66 slots cover the painted shelf, jars and twelve contents, recipe book, category pictures, plate, calendar, kitchen scenery, and shared controls (including some reserved/unused art). Jar back, front, and alpha mask must line up; keep the mask’s interior opaque and exterior transparent. Keep the edges/corners of stretchable frames similar to the template, and make repeating textures seamless. Leave words and nutrition values out of the art: the app draws text, action icons, focus rings, target markers, and semantic tints separately. Themes change artwork, not nutrition logic, fonts, hit areas, or layout.

For maintainers, `src/theme-layout-v1.json` and `src/theme-layout-scene-v1.json` contain `[x, y, width, height]` in top-left-origin pixels. With Chrome installed, `npm run theme:template` regenerates the full sheet; `npm run theme:template -- --scene` regenerates the compact sheet. Changing slot geometry requires a new layout version, not moving the v1 slots. In `src/style.css`, bind painted layers directly to their sprite variables, e.g. `var(--paint-kitchen-ivy, url("./assets/kitchen/ivy.webp"))`. Run `npm run test:themes -- --dev` for the local preview and `npm run build && npm run test:themes` for the deployed layout.

### Replacing individual painted assets

Digits use locally bundled **Roboto Slab**, including in mixed labels such as “0.5 cup”. Letters keep their existing typeface, including **Special Elite** on painted controls.

The nutrient shelf is built from painted layers, with React and CSS handling only fill, tint, text and interaction. From back to front:

1. `jars/glass-back.png`: the full painted bottle.
2. `jars/contents/<nutrient>.webp`: the contents texture, masked by `jars/interior-mask.png`. It slides up with progress and tints toward the status color. The contents get a heaped top edge from `jars/heap.svg`.
3. A dashed target line.
4. `jars/glass-front.png`: outlines and highlights only. It is derived from the bottle, so the contents appear to sit behind the glass.
5. `jars/label.png` and `jars/badge.png`, with HTML text on top. The amount badge spans 72% of the jar’s width and sits horizontally centered, with its text optically centered inside the painted rim.

The cabinet (`shelf/cabinet.webp`) is a CSS 9-slice border image, so its corners and plank keep their shape at any width.

The recipe book uses the same approach. `book/page.webp` is a 9-slice page with the spiral binding painted out, so it stretches without seams. `book/ring.png` is a single ring that CSS repeats down the binding as a whole number of rings. The open tab uses `book/tab-open.png`, which the build script derives from `tab.png` by removing its bottom outline and tinting it to the page parchment, so it joins the page. `BookTabIcon.tsx` draws four small ink-and-wash icons for the tab labels; narrow screens keep the text alone. Food rows use the same heart as the Favorites tab: outlined when off and filled with muted rose when saved. Tabs, search, check circles, portion pills, the scrollbar thumb, row dividers and the "Add new food" bookmark are separate painted parts in `book/`. The bookmark is stored pre-rotated, with its slice values in the CSS swapped to match.

The kitchen backdrop is a fixed, full-viewport layer behind the app. The build script cuts `art/source/wall.png` into `kitchen/wall.webp`, the plaster that covers the viewport, and `kitchen/wainscot.webp`, a panel strip cropped seam-to-seam so it tiles left to right at any width. `art/source/decor.png` holds four items on magenta, side by side with clear gaps between them: ivy, crock, plant and sprig. They're keyed and trimmed into `kitchen/<item>.webp`. The crock is exported but not currently placed.

Today's plate is cut from `art/source/plate.png`, four parts in a row on a transparent background: the calendar note, a blank food pill, the remove button and the quantity pill. `art/source/empty-plate.png` becomes `plate/empty.png`, the plate shown when nothing is logged. All food types use the blush `plate/pill.png` with its ink outline and paper texture. Pills and the quantity pill are 9-slice, so they stretch to fit any food name. The decorations sit in the side gutters, shrink on narrow screens, and never take pointer events.

Shared controls come from `art/source/ui.png`, cut into `src/assets/ui/`: a recipe card (`card.png`, 9-slice dialog paper), round indigo and porcelain buttons (toolbar, close and slider thumb), and a wide indigo button for primary actions. Other dialog buttons reuse the plate's quantity pill; text fields reuse the book's search field; checkboxes reuse the book's check circles. Disabled toolbar buttons switch to the porcelain circle instead of fading.

The book's category headers use painted icons from `art/source/categories.png`: a transparent 4×3 grid in the order fruits, vegetables, nuts, legumes, grains, dairy, protein, essentials, snacks, beverages and other, with the last cell left empty. Single-icon sources named `art/source/category-<key>.png` (such as the combined `dairy-protein` icon and the `dishes` stew bowl) are added alongside it; a plain white background is cleared automatically. The build script cuts them into `src/assets/categories/<key>.webp`. Saved kitchens that still use the older "Dairy" and "Eggs & Protein" categories are merged into "Dairy & Protein", and "Grains & Rice" becomes "Grains & Bread", when they load. `src/categoryIcons.ts` maps category names to icons; custom categories get the herb bowl ("other").

The smoky fog along the bottom of the page is `src/assets/kitchen/fog-bottom.png` (white smoke on transparency, seamless sideways). It is tiled horizontally at its natural aspect ratio as a CSS mask filled with pale lilac, so it sits in front of the wall and book and behind the toolbar and status line. Replace the PNG directly to change its shape.

The current artwork is generated placeholder art. To replace it:

- **Draw over the size reference:** `art/spritesheet.png` shows every exported file at its pixel size, with the measured jar shoulder, base and walls marked.
- **Rebuild from source paintings:** replace `public/themes/painted-jars.png` for the fillings, or update `art/source/` for the surrounding art (`jar.png`, `shelf.png` on magenta, `paper-sheet.png`, `book.png`, and `book-parts.png` as 11 parts in rows). Run `python3 -m pip install --user pillow && python3 scripts/build-assets.py` to export the textures, re-measure the jar and book geometry, and regenerate the reference poster. Run `npm run theme:template` and `npm run theme:template -- --scene` to refresh both downloadable paint-over templates.
- **Overwrite exports directly:** you can also replace the exported files in `src/assets/` at the same sizes.

Daily entries keep the food definition as a snapshot. Shelf totals and label values are calculated rather than stored twice. Settings, definitions, entries, dishes, profiles and target history persist together in a versioned IndexedDB transaction. A load failure does not silently reseed over existing data.

## Test and deploy

```sh
npm test                 # Vitest calculation, history and data exchange cases
npm run build            # Type-check and build dist/
npm run test:browser     # With npm run dev running and Google Chrome installed
npm run preview          # Serve the production build; use the URL printed by Vite
```

The browser check starts a fresh isolated Chrome profile, logs food, changes portions, reloads immediately, edits dates and goals, creates a food/dish, and checks a 360px viewport, reduced motion and keyboard dismissal. Override `KITCHEN_URL` for another running preview, or `CHROME_CHANNEL` for another installed Chromium channel. It never edits your development journal.

Deploy `dist/` to a static HTTPS host (for example, GitHub Pages, Netlify or Cloudflare Pages). Set the build command to `npm run build` and publish directory to `dist`. Relative asset paths support a subdirectory. Deployment does **not** upload your local journal; export and restore a JSON backup to move it to a new origin.

**Publishing the source ZIP on GitHub:** Extract it first. Copy the **contents** of `nutrinook/` into your repository root, including `.github/` and `.gitignore`; `package.json` should sit beside `README.md`. Commit the source files, not the ZIP or `node_modules/`. To publish the site, choose **Settings → Pages → Source: GitHub Actions**, then **Actions → Publish NutriNook to Pages → Run workflow** on your intended branch. The workflow tests and builds the app and publishes only `dist/`. It does not run automatically on push.

Third-party notices for the bundled runtimes, icons and fonts are in [`public/licenses/`](public/licenses/); they are included in the static build.
