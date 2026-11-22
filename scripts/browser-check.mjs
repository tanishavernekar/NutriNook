import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: process.env.CHROME_CHANNEL || "chrome",
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const button = (name) => page.getByRole("button", { name, exact: true }),
    dialog = () => page.getByRole("dialog");
  await page.goto(process.env.KITCHEN_URL || "http://127.0.0.1:5187");
  await button("My goals").waitFor();
  assert.equal(await page.locator("#goals-hint").count(), 0);
  await page.evaluate(() => document.fonts.ready);
  assert.ok(
    await page.evaluate(() =>
      [...document.fonts].some(
        (f) => f.family.includes("Special Elite") && f.status === "loaded",
      ),
    ),
  );
  async function checkBookSize() {
    const book = page.locator(".book");
    await book.waitFor();
    const height = (await book.boundingBox()).height;
    for (const name of ["Favorites", "Dishes", "Recents", "Category"]) {
      await button(name).click();
      assert.equal((await book.boundingBox()).height, height);
    }
    const search = page.getByLabel("Search recipe book");
    await search.fill("no-such-food");
    assert.equal((await book.boundingBox()).height, height);
    await search.fill("");
    assert.equal(await page.locator(".list details[open]").count(), 0);
    assert.ok(
      await page
        .locator(".list")
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      "All collapsed category headings fit on the book page.",
    );
    await button("Open all").click();
    assert.ok(
      await page
        .locator(".list")
        .evaluate((el) => el.scrollHeight > el.clientHeight),
    );
    await button("Close all").click();
  }
  await checkBookSize();
  const dishGroup = page.locator(".list details").filter({
    has: page.locator("summary", { hasText: /^Dishes\d+$/ }),
  });
  const initialDishCount = Number(
    (await dishGroup.locator("summary").textContent()).replace(/^Dishes/, ""),
  );
  await page.getByLabel("Search recipe book").fill("A2 Whole Milk");
  {
    const serving = page.getByLabel("Serving quantity for A2 Whole Milk");
    const start = await serving.inputValue();
    await page.locator(".portion").first().hover();
    await button("Increase serving of A2 Whole Milk").click();
    assert.notEqual(await serving.inputValue(), start);
    await serving.focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await serving.inputValue(), start);
  }
  await button("Add A2 Whole Milk").click();
  await button("Change quantity of A2 Whole Milk").click();
  await dialog().getByRole("button", { name: "1 cup", exact: true }).click();
  await button("View nutrition for A2 Whole Milk").click();
  assert.match(await dialog().innerText(), /160 kcal/);
  assert.match(await dialog().innerText(), /Potassium\s+400 mg/);
  assert.match(await dialog().innerText(), /Added sugar\s+0 g/);
  assert.match(await dialog().innerText(), /Magnesium\s+Unavailable/);
  await button("Close dialog").click();
  await page.locator(".jar").first().click();
  assert.equal(
    await dialog()
      .locator("header h2")
      .evaluate(
        (el) =>
          el === document.activeElement &&
          getComputedStyle(el).outlineStyle === "none",
      ),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await dialog()
      .locator(".guide-toggle")
      .evaluate(
        (el) =>
          el.matches(":focus-visible") &&
          getComputedStyle(el).outlineStyle !== "none",
      ),
    true,
  );
  const size = () =>
    dialog().evaluate((el) => [el.offsetWidth, el.offsetHeight]);
  const card = await size();
  async function checkBarLabel() {
    const aligned = await dialog()
      .locator(".bar-track")
      .evaluate((track) => {
        const label = track
          .querySelector(".bar-percent")
          .getBoundingClientRect();
        const ink = (
          track.querySelector(".bar-overflow") ??
          track.querySelector(".bar-fill")
        ).getBoundingClientRect();
        const bounds = track.getBoundingClientRect();
        const expected = Math.max(
          bounds.left + track.clientLeft + label.width,
          ink.right,
        );
        return (
          Math.abs(label.right - expected) < 2 &&
          label.left >= bounds.left &&
          label.right <= bounds.right &&
          label.top >= bounds.top &&
          label.bottom <= bounds.bottom
        );
      });
    assert.ok(
      aligned,
      "Percentage should follow the fill and remain inside the track",
    );
  }
  await page.getByRole("button", { name: /^Next nutrient/ }).click();
  assert.equal(await dialog().getAttribute("aria-label"), "Protein");
  await dialog()
    .getByRole("img", { name: /Protein: 8 g\. Minimum: 46 g\. 17%/ })
    .waitFor();
  assert.equal(await dialog().locator(".bar-overflow").count(), 0);
  await checkBarLabel();
  assert.deepEqual(await size(), card);
  const guideButton = dialog()
    .locator("header")
    .getByRole("button", { name: "Guide" });
  const backButton = dialog().getByRole("button", {
    name: "Back",
    exact: true,
  });
  const toggleSize = (button) =>
    button.evaluate((el) => [el.offsetWidth, el.offsetHeight]);
  const guideSize = await toggleSize(guideButton);
  await guideButton.click();
  assert.equal(await backButton.getAttribute("aria-pressed"), "true");
  assert.deepEqual(await toggleSize(backButton), guideSize);
  await dialog().getByRole("region", { name: "Protein guide" }).waitFor();
  await page.getByRole("button", { name: /^Next nutrient/ }).click();
  const fiberGuide = dialog().getByRole("region", { name: "Fiber guide" });
  for (const heading of [
    "What it does",
    "Rich food sources",
    "Too little",
    "Too much",
  ])
    await fiberGuide.getByRole("heading", { name: heading }).waitFor();
  const sources = () =>
    dialog().getByRole("searchbox", { name: "Search food sources" });
  assert.deepEqual(
    await fiberGuide.locator(".guide-food-chips li").allTextContents(),
    ["Black beans", "Lentils", "Raspberries", "Wheat bran", "Chia seeds"],
  );
  assert.equal(await sources().count(), 0);
  const diveButton = button("Dive deeper");
  await diveButton.press("Enter");
  const deepDive = dialog().getByRole("region", {
    name: "Fiber food source deep dive",
  });
  await deepDive.waitFor();
  assert.equal(await fiberGuide.count(), 0);
  assert.deepEqual(await size(), card);
  const info = deepDive.getByRole("button", {
    name: "About these food sources",
  });
  const details = deepDive.locator(".source-info");
  assert.equal(await info.getAttribute("aria-expanded"), "false");
  assert.equal(await details.isVisible(), false);
  await info.press("Enter");
  assert.equal(await info.getAttribute("aria-expanded"), "true");
  assert.ok(await details.isVisible());
  assert.match(await details.innerText(), /USDA SR Legacy 2018/);
  assert.match(await details.innerText(), /at least 10%/);
  await info.click();
  assert.equal(await details.isVisible(), false);
  const lentilQuery = "lentils without salt boiled";
  await button("Next food results").click();
  assert.match(
    await deepDive.locator(".source-count").innerText(),
    /^6–10 of /,
  );
  await sources().fill("paprika");
  assert.match(
    await deepDive.locator(".source-count").innerText(),
    /No matching foods/,
  );
  await sources().fill(lentilQuery);
  assert.match(
    await deepDive.locator(".source-list").innerText(),
    /7.11 g in a 90 g portion · 28.44% of your daily goal/,
  );
  await sources().press("ArrowLeft");
  assert.equal(await dialog().getAttribute("aria-label"), "Fiber");
  await deepDive
    .getByRole("button", {
      name: /^Lentils, mature seeds, cooked, boiled, without salt/,
    })
    .click();
  const portion = () => dialog().locator(".source-portion");
  assert.match(await portion().innerText(), /about 316 g of this food/);
  assert.match(await portion().innerText(), /1 cup weighs 198 g/);
  assert.match(await portion().innerText(), /About 1.6 cups/);
  assert.match(
    await portion()
      .getByRole("link", { name: /FDC 172421/ })
      .getAttribute("href"),
    /172421/,
  );
  assert.deepEqual(await size(), card);
  await page.keyboard.press("ArrowLeft");
  await dialog()
    .getByRole("region", { name: "Protein food source deep dive" })
    .waitFor();
  await backButton.click();
  await dialog().getByRole("region", { name: "Protein guide" }).waitFor();
  assert.equal(
    await diveButton.evaluate((el) => el === document.activeElement),
    true,
  );
  await backButton.click();
  assert.deepEqual(await toggleSize(guideButton), guideSize);
  await dialog()
    .getByRole("img", { name: /^Protein: 8 g/ })
    .waitFor();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await dialog().getAttribute("aria-label"), "Calories");
  await page.getByRole("button", { name: /^Previous nutrient/ }).click();
  assert.notEqual(await dialog().getAttribute("aria-label"), "Calories");
  await button("Close dialog").click();
  await button("Add another A2 Whole Milk").click();
  assert.equal(await page.locator(".pill").count(), 2);
  await page
    .locator(".pill")
    .first()
    .getByRole("button", { name: "Remove A2 Whole Milk" })
    .click();
  assert.equal(await page.locator(".pill").count(), 1);
  await button("Undo").click();
  assert.equal(await page.locator(".pill").count(), 2);
  await button("Redo").click();
  assert.equal(await page.locator(".pill").count(), 1);
  await button("My goals").click();
  assert.equal(
    await page.getByLabel("Use my profile for recommendations").isChecked(),
    true,
  );
  assert.equal(await page.getByLabel("Age in years").inputValue(), "30");
  const heightUnit = page.getByRole("combobox", { name: "Height unit" });
  const weightUnit = page.getByRole("combobox", { name: "Weight unit" });
  const caloriesSummary = dialog()
    .locator("summary")
    .filter({ hasText: /^Calories/ });
  const originalEnergy = await caloriesSummary.innerText();
  await heightUnit.selectOption("in");
  assert.equal(
    await page.getByLabel("Height (in)", { exact: true }).inputValue(),
    "64.9606",
  );
  assert.equal(await weightUnit.inputValue(), "kg");
  await weightUnit.selectOption("lb");
  assert.equal(
    await page.getByLabel("Weight (lb)", { exact: true }).inputValue(),
    "143.3005",
  );
  await heightUnit.selectOption("cm");
  assert.equal(
    await page.getByLabel("Height (cm)", { exact: true }).inputValue(),
    "165",
  );
  assert.equal(await caloriesSummary.innerText(), originalEnergy);
  await page.getByLabel("Weight (lb)", { exact: true }).fill("150");
  await weightUnit.selectOption("kg");
  assert.equal(
    await page.getByLabel("Weight (kg)", { exact: true }).inputValue(),
    "68.0389",
  );
  await weightUnit.selectOption("lb");
  await page.getByLabel("Age in years").fill("42");
  await dialog()
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Protein" }) })
    .locator("summary")
    .click();
  await button("Set custom target").filter({ visible: true }).click();
  await page.getByLabel(/Amount \/ lower bound/).fill("8");
  await button("Save goals").click();
  assert.match(await page.locator(".jar").nth(1).innerText(), /50%/);
  await button("Add another A2 Whole Milk").click();
  assert.match(
    await page.locator(".jar").nth(1).innerText(),
    /100%[\s\S]*Goal reached/,
  );
  await page.locator(".jar").nth(1).click();
  assert.equal(
    await dialog()
      .locator(".bar-fill")
      .evaluate((el) => el.style.width),
    "100%",
  );
  assert.equal(await dialog().locator(".bar-overflow").count(), 0);
  await guideButton.click();
  await diveButton.click();
  await sources().fill(lentilQuery);
  await dialog()
    .getByRole("button", {
      name: /^Lentils, mature seeds, cooked, boiled, without salt/,
    })
    .click();
  assert.match(await portion().innerText(), /about 88.7 g of this food/);
  assert.match(await portion().innerText(), /Custom setting .*: 8 g protein/);
  await button("Close dialog").click();
  await button("Add another A2 Whole Milk").click();
  await page.locator(".jar").nth(1).click();
  await dialog()
    .getByRole("img", { name: /150%.*Goal reached.*4 g beyond minimum/ })
    .waitFor();
  const split = await dialog()
    .locator(".bar-overflow")
    .evaluate(
      (el) => el.getBoundingClientRect().width / el.parentElement.clientWidth,
    );
  assert.ok(Math.abs(split - 1 / 3) < 0.01);
  await checkBarLabel();
  await button("Close dialog").click();
  await button("Undo").click();
  await page.getByRole("button", { name: /^Total sugar:/ }).click();
  await dialog().locator(".nutrient-bar.unscaled").waitFor();
  assert.equal(await dialog().locator(".bar-fill").count(), 0);
  const sugarLink = page.getByRole("link", {
    name: "Set a personal sugar goal",
  });
  const checkSugarEditor = async () => {
    const section = page
      .getByRole("dialog", { name: "My goals" })
      .locator("details[open]")
      .filter({ has: page.locator("summary", { hasText: /^Total sugar/ }) });
    await section.getByRole("button", { name: "Set custom target" }).waitFor();
    assert.ok(
      await section
        .locator("summary")
        .evaluate((el) => el === document.activeElement),
    );
    return section;
  };
  await sugarLink.press("Enter");
  await checkSugarEditor();
  const closeButton = button("Close dialog");
  await dialog().evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)),
  );
  const closePosition = await closeButton.boundingBox();
  await dialog()
    .locator(".modal-body")
    .evaluate((body) => {
      body.scrollTop = body.scrollHeight;
      if (!body.scrollTop) throw Error("Expected scrollable goal settings");
    });
  assert.deepEqual(await closeButton.boundingBox(), closePosition);
  await closeButton.click();
  await sugarLink.waitFor();
  await sugarLink.click();
  await checkSugarEditor();
  await page.goBack();
  await sugarLink.waitFor();
  await sugarLink.click();
  const sugarSection = await checkSugarEditor();
  await sugarSection.getByRole("button", { name: "Set custom target" }).click();
  await sugarSection.getByLabel("Goal type").selectOption("maximum");
  await sugarSection.getByLabel(/Amount \/ lower bound/).fill("30");
  await button("Save goals").click();
  await dialog()
    .getByRole("img", { name: /Total sugar:.*Recommended maximum: 30 g/ })
    .waitFor();
  assert.equal(await sugarLink.count(), 0);
  assert.equal(
    await page.getByRole("button", { name: /^Added sugar:/ }).count(),
    0,
  );
  await button("Close dialog").click();
  await page.reload();
  await button("My goals").waitFor();
  await button("My goals").click();
  assert.equal(await page.getByLabel("Age in years").inputValue(), "42");
  assert.equal(await heightUnit.inputValue(), "cm");
  assert.equal(await weightUnit.inputValue(), "lb");
  assert.equal(
    await page.getByLabel("Weight (lb)", { exact: true }).inputValue(),
    "150",
  );
  await button("Close dialog").click();
  assert.equal(await page.locator(".pill").count(), 2);
  assert.match(await page.locator(".jar").nth(1).innerText(), /100%/);
  const plateSize = () =>
    page.locator(".plate").evaluate((el) => [el.offsetWidth, el.offsetHeight]);
  const loggedPlateSize = await plateSize();
  const loggedFoods = await page.locator(".pill").evaluateAll((pills) =>
    pills.map((pill) =>
      Array.from(pill.querySelectorAll("button"))
        .slice(1)
        .map((btn) => btn.textContent),
    ),
  );
  await page.locator(".plate").click({ position: { x: 240, y: 16 } });
  await page.getByRole("dialog", { name: "On the plate" }).waitFor();
  assert.deepEqual(
    await dialog()
      .locator(".plate-list li")
      .evaluateAll((rows) =>
        rows.map((row) => [
          row.querySelector("strong").textContent,
          row.querySelector("[aria-expanded]").textContent.trim(),
        ]),
      ),
    loggedFoods,
  );
  await page.keyboard.press("Escape");
  assert.ok(
    await button("View all (2)").evaluate(
      (el) => el === document.activeElement,
    ),
  );
  await page.getByRole("button", { name: /Open calendar for/ }).click();
  await button("Previous month").click();
  await dialog()
    .getByRole("button", { name: /^\d{4}-\d\d-01$/ })
    .click();
  assert.equal(await page.locator(".pill").count(), 0);
  assert.equal(await page.locator(".plate.away").count(), 1);
  assert.deepEqual(await plateSize(), loggedPlateSize);
  assert.match(await page.locator(".daytag").innerText(), /Past day/);
  await button("View all (0)").press("Enter");
  await dialog().getByText("No foods logged for this day.").waitFor();
  assert.equal(
    await dialog().locator("time").getAttribute("datetime"),
    (await page.locator(".wallcalendar").getAttribute("aria-label")).slice(-10),
  );
  const picker = dialog().getByLabel("Add from recipe book");
  const milkOption = await picker
    .locator("option")
    .filter({ hasText: "A2 Whole Milk" })
    .first()
    .getAttribute("value");
  for (let i = 0; i < 2; i++) {
    await picker.selectOption(milkOption);
    await dialog().getByRole("button", { name: "Add", exact: true }).click();
  }
  const rows = dialog().locator(".plate-list li");
  const serving = (row) =>
    row.getByRole("button", { name: /Edit serving for A2 Whole Milk/ });
  await serving(rows.last()).click();
  await rows.last().getByLabel("Custom quantity (cup)").fill("1.25");
  await rows.last().getByRole("button", { name: "Apply quantity" }).click();
  assert.match(await serving(rows.first()).innerText(), /0.5 cup/);
  assert.match(await serving(rows.last()).innerText(), /1.25 cup/);
  await rows
    .last()
    .getByRole("button", { name: "Remove A2 Whole Milk from this plate" })
    .click();
  assert.equal(await rows.count(), 1);
  await dialog().getByRole("button", { name: "Undo last change" }).click();
  assert.match(await serving(rows.last()).innerText(), /1.25 cup/);
  assert.equal(await page.locator(".pill").count(), 2);
  for (let i = 0; i < 3; i++) await button("Undo last change").click();
  await dialog().getByText("No foods logged for this day.").waitFor();
  await button("Close dialog").click();
  await page.locator(".jar").nth(1).click();
  await guideButton.click();
  await diveButton.click();
  await dialog()
    .getByText(/No goal is saved for this date/)
    .waitFor();
  assert.equal(await dialog().locator(".source-list button").count(), 0);
  await button("Close dialog").click();
  await button("Back to today").click();
  assert.equal(await page.locator(".plate.away").count(), 0);
  assert.deepEqual(await plateSize(), loggedPlateSize);
  assert.equal(await page.locator(".pill").count(), 2);
  await page.getByRole("button", { name: /Open calendar for/ }).click();
  await button("Previous month").click();
  await dialog()
    .getByRole("button", { name: /^\d{4}-\d\d-01$/ })
    .click();
  await page.getByRole("button", { name: /Open calendar for/ }).click();
  await button("Return to today").click();
  assert.equal(await page.locator(".pill").count(), 2);
  await button("Remove all 2 foods from the plate").click();
  assert.equal(await page.locator(".pill").count(), 0);
  await button("Undo").click();
  assert.equal(await page.locator(".pill").count(), 2);
  await button("Redo").click();
  assert.equal(await page.locator(".pill").count(), 0);
  await button("Undo").click();
  assert.equal(await page.locator(".pill").count(), 2);
  await button("Kitchen settings").click();
  await page.getByText("Sounds & celebrations").click();
  await page
    .getByRole("checkbox", { name: "Kitchen sounds", exact: true })
    .uncheck();
  await button("Close dialog").click();
  await page.reload();
  await button("Kitchen settings").click();
  await page.getByText("Sounds & celebrations").click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Kitchen sounds", exact: true })
      .isChecked(),
    false,
  );
  await button("Close dialog").click();
  await button("Pantry table").click();
  await dialog().evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  );
  const gridBox = () => dialog().locator(".sheet-scroll").boundingBox();
  const selectionSummary = dialog().locator(".selection-summary");
  const totalLabel = `${await dialog().locator(".edit-scroll tbody tr").count()} food items`;
  assert.equal(await selectionSummary.innerText(), totalLabel);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  const readClipboard = () =>
    page.evaluate(() => navigator.clipboard.readText());
  const milkName = dialog().getByLabel("Name of A2 Whole Milk", {
    exact: true,
  });
  const milkCheck = dialog().getByLabel("Select A2 Whole Milk", {
    exact: true,
  });
  const fullMilk = [
    "A2 Whole Milk",
    "1/2 cup",
    "80",
    "4",
    "0",
    "4.5",
    "6.5",
    "6",
    "150",
    "0",
    "",
    "200",
    "",
    "0",
    "Dairy & Protein",
    "",
  ].join("\t");
  await milkCheck.check();
  assert.equal(await selectionSummary.innerText(), "1 selected");
  await page.keyboard.press("ControlOrMeta+c");
  assert.equal(
    await readClipboard(),
    fullMilk,
    "A checked row includes every data column, including offscreen values.",
  );
  await button("Clear selection").click();
  assert.equal(await selectionSummary.innerText(), totalLabel);
  // Reproduce starting the drag *inside already-highlighted name text* in the editable view.
  await milkName.focus();
  await milkName.evaluate((el) => el.select());
  const nameBox = await milkName.boundingBox();
  const farBox = await dialog()
    .getByLabel("Protein in Eggs", { exact: true })
    .boundingBox();
  await page.mouse.move(nameBox.x + 18, nameBox.y + nameBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    farBox.x + farBox.width / 2,
    farBox.y + farBox.height / 2,
    { steps: 18 },
  );
  await page.mouse.up();
  assert.equal(await dialog().locator("[data-copy-cell]").count(), 8);
  await page.keyboard.press("ControlOrMeta+c");
  assert.equal(
    await readClipboard(),
    "Eggs\t2 large\t143\t12.6\nA2 Whole Milk\t1/2 cup\t80\t4",
  );
  // A corner past the horizontal viewport and the category select are copyable, too.
  await milkName.click();
  await dialog()
    .getByLabel("Brand of A2 Whole Milk", { exact: true })
    .click({ modifiers: ["Shift"] });
  await button("Copy").click();
  assert.equal(await readClipboard(), fullMilk);
  await button("Clear selection").click();
  await milkName.click();
  await milkName.evaluate((el) => el.setSelectionRange(3, 8));
  await page.keyboard.press("ControlOrMeta+c");
  assert.equal(
    await readClipboard(),
    "Whole",
    "Copying text inside one editor remains native.",
  );
  await button("Select cells to copy").click();
  const copyGrid = dialog().getByRole("grid", { name: "Pantry cells to copy" });
  const milkCells = copyGrid
    .getByRole("row")
    .filter({
      has: page.getByRole("gridcell", { name: "A2 Whole Milk", exact: true }),
    })
    .getByRole("gridcell");
  const eggsCells = copyGrid
    .getByRole("row")
    .filter({ has: page.getByRole("gridcell", { name: "Eggs", exact: true }) })
    .getByRole("gridcell");
  const startBox = await milkCells.nth(2).boundingBox();
  const endBox = await eggsCells.first().boundingBox();
  await page.mouse.move(
    startBox.x + startBox.width / 2,
    startBox.y + startBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    endBox.x + endBox.width / 2,
    endBox.y + endBox.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  assert.equal(await copyGrid.locator('[aria-selected="true"]').count(), 6);
  await dialog().getByLabel("Include headings").check();
  await eggsCells.first().press("ControlOrMeta+c");
  const receiver = await context.newPage();
  await receiver.setContent(
    "<textarea aria-label='Paste destination'></textarea>",
  );
  await receiver.getByRole("textbox").press("ControlOrMeta+v");
  assert.equal(
    await receiver.getByRole("textbox").inputValue(),
    "Food item\tServing\tCalories (kcal)\nEggs\t2 large\t143\nA2 Whole Milk\t1/2 cup\t80",
  );
  await receiver.close();
  await page.bringToFront();
  await eggsCells.first().press("ArrowRight");
  await eggsCells.nth(1).press("Shift+ArrowDown");
  assert.equal(await copyGrid.locator('[aria-selected="true"]').count(), 2);
  await dialog().getByLabel("Filter pantry table").fill("milk");
  assert.ok(await button("Copy selection").isDisabled());
  await dialog().getByLabel("Sort by").selectOption("name");
  await button("Select all cells").click();
  await button("Copy selection").click();
  const namesCopied = (
    await page.evaluate(() => navigator.clipboard.readText())
  )
    .split("\n")
    .map((line) => line.split("\t")[0]);
  const milkNames = await copyGrid.locator("tbody th").allTextContents();
  assert.deepEqual(namesCopied, milkNames);
  assert.ok(milkNames.every((name) => name.toLowerCase().includes("milk")));
  await dialog().getByLabel("Filter pantry table").fill("");
  await dialog().getByLabel("Sort by").selectOption("createdAt");
  await dialog()
    .getByRole("button", { name: /^Reverse sort order: Newest first/ })
    .click();
  await button("Done").click();
  const allCheck = dialog().getByRole("checkbox", {
    name: "Select all foods in this view",
  });
  for (const width of [360, 864, 1280]) {
    await page.setViewportSize({ width, height: 860 });
    const hint = await dialog().locator(".pantry-copy-entry .sheet-count").innerText();
    assert.equal(hint.includes("Ctrl+C"), width > 650);
    if (width === 360) {
      const summary = await selectionSummary.boundingBox();
      for (const action of await dialog().locator(".pantry-selection button").all()) {
        const box = await action.boundingBox();
        assert.ok(box.y >= summary.y + summary.height && box.x + box.width <= width);
      }
    }
    const toolbarLayout = await dialog()
      .locator(".pantry-toolbar")
      .evaluate((el) => {
        const bar = el.getBoundingClientRect();
        const controls = [...el.querySelectorAll("input, select, button")].map(
          (c) => c.getBoundingClientRect(),
        );
        const lines = (boxes) =>
          new Set(boxes.map((r) => Math.round(r.top + r.height / 2))).size;
        return {
          fits: controls.every(
            (r) => r.left >= bar.left - 1 && r.right <= bar.right + 1,
          ),
          lines: lines(controls),
          actionLines: lines(controls.slice(-3)),
        };
      });
    assert.ok(toolbarLayout.fits);
    assert.equal(toolbarLayout.actionLines, 1);
    assert.equal(toolbarLayout.lines, width === 360 ? 3 : 1);
    const nameLayout = await dialog()
      .locator(".edit-scroll")
      .evaluate((sheet) => {
        const heading = sheet.querySelector(".sort-heading");
        const textStart = (el) =>
          el.getBoundingClientRect().left +
          parseFloat(getComputedStyle(el).paddingInlineStart);
        const original = sheet.scrollLeft;
        try {
          return [0, sheet.scrollWidth].every((x) => {
            sheet.scrollLeft = x;
            return [...sheet.querySelectorAll('input[data-col="name"]')].every(
              (el) =>
                Math.abs(textStart(el) - textStart(heading)) < 1 &&
                el.getBoundingClientRect().right <=
                  el.closest("th").getBoundingClientRect().right - 1,
            );
          });
        } finally {
          sheet.scrollLeft = original;
        }
      });
    assert.ok(
      nameLayout,
      "Food names align with the header and stay inside the sticky column.",
    );
    const before = await gridBox();
    const checks = await dialog()
      .getByRole("checkbox")
      .evaluateAll((inputs) =>
        inputs.map((input) => {
          const { x, width, height } = input.getBoundingClientRect();
          return { x, width, height };
        }),
      );
    assert.ok(checks.length > 1);
    for (const check of checks) {
      assert.equal(check.x, checks[0].x);
      assert.equal(check.width, 12);
      assert.equal(check.height, 12);
    }
    assert.ok(await button("Delete selected").isDisabled());
    const eggsCheck = dialog().getByLabel("Select Eggs", { exact: true });
    await eggsCheck.locator("..").click({ position: { x: 2, y: 14 } });
    assert.ok(
      await eggsCheck.isChecked(),
      "The gutter is clickable outside the small checkbox.",
    );
    assert.deepEqual(await gridBox(), before);
    await allCheck.check();
    assert.deepEqual(await gridBox(), before);
    await button("Clear selection").click();
    assert.deepEqual(await gridBox(), before);
  }
  const appendBox = page.getByRole("textbox", { name: "Paste new food rows" });
  const pantryRows = dialog().locator(".sheet-scroll tbody tr");
  const beforePaste = await pantryRows.count();
  const sample = [
    "| Salmon Fillet | 1 small (4oz) | 184 | 23 | 0 | 9 | 0 | 0 | 12 | 0.9 | 30 | 412 | 0.5 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| Chicken Drumstick | 1 medium | 149 | 18 | 0 | 8 | 0 | 0 | 11 | 0.9 | 16 | 183 | 1.8 |",
    "| Golden Pompano | 1 small (4oz) | 228 | 21 | 0 | 14 | 0 | 0 | 25 | 0.7 | 31 | 380 | 0.1 |",
  ].join("\n");
  assert.ok(
    await appendBox.evaluate((el) => {
      const bottom = el.getBoundingClientRect().bottom;
      return (
        Math.abs(
          bottom - el.closest(".sheet-scroll").getBoundingClientRect().bottom,
        ) < 6
      );
    }),
    "The empty row should be visible without scrolling.",
  );
  async function pasteIntoBlank(text) {
    await appendBox.click();
    await appendBox.evaluate((el, text) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, text);
  }
  await pasteIntoBlank(sample);
  assert.match(await dialog().innerText(), /0 added, 3 updated/);
  assert.equal(await pantryRows.count(), beforePaste);
  assert.match(
    await dialog().locator(".paste-receipt output").innerText(),
    /Matching foods were updated in place/,
  );
  await button("Show last pasted rows").click();
  assert.equal(await pantryRows.count(), 3);
  await page.getByLabel("Name of Chicken Drumstick", { exact: true }).waitFor();
  await button("Show all foods").click();
  assert.equal(await pantryRows.count(), beforePaste);
  assert.equal(
    await page.getByLabel("Vitamin K in Golden Pompano").inputValue(),
    "0.1",
  );
  assert.equal(
    await page.getByLabel("Added sugar in Salmon Fillet").inputValue(),
    "",
  );
  assert.equal(await appendBox.inputValue(), "");
  await pasteIntoBlank(
    sample.replace(
      /Salmon Fillet|Chicken Drumstick|Golden Pompano/g,
      (name) => `Test ${name}`,
    ),
  );
  assert.match(await dialog().innerText(), /3 added, 0 updated/);
  assert.equal(await pantryRows.count(), beforePaste + 3);
  const rowNames = () =>
    pantryRows
      .locator('input[data-col="name"]')
      .evaluateAll((cells) => cells.map((cell) => cell.value));
  const sortBy = dialog().getByRole("combobox", { name: "Sort by" });
  const reverse = dialog().getByRole("button", {
    name: /^Reverse sort order:/,
  });
  const salmon = "Test Salmon Fillet",
    chicken = "Test Chicken Drumstick",
    pompano = "Test Golden Pompano";
  const alphabetical = [chicken, pompano, salmon];
  assert.deepEqual((await rowNames()).slice(-3).sort(), alphabetical);
  await reverse.click();
  assert.deepEqual((await rowNames()).slice(0, 3).sort(), alphabetical);
  const categoriesInOrder = () =>
    pantryRows
      .locator("select")
      .evaluateAll((cells) => cells.map((cell) => cell.value));
  const categoryHeader = dialog().getByRole("columnheader", {
    name: "Category",
    exact: true,
  });
  const originalCategories = await categoriesInOrder();
  assert.ok(new Set(originalCategories).size > 1);
  const byCategory = originalCategories.sort(
    new Intl.Collator(undefined, { sensitivity: "base", numeric: true })
      .compare,
  );
  await categoryHeader.getByRole("button").click();
  assert.equal(await sortBy.inputValue(), "category");
  assert.equal(await categoryHeader.getAttribute("aria-sort"), "ascending");
  assert.deepEqual(await categoriesInOrder(), byCategory);
  await reverse.click();
  assert.equal(await categoryHeader.getAttribute("aria-sort"), "descending");
  assert.deepEqual(await categoriesInOrder(), [...byCategory].reverse());
  await button("Show last pasted rows").click();
  await sortBy.selectOption("name");
  assert.deepEqual(await rowNames(), alphabetical);
  await button("Food item").click();
  assert.deepEqual(await rowNames(), [...alphabetical].reverse());
  await sortBy.selectOption("protein");
  assert.deepEqual(await rowNames(), [salmon, pompano, chicken]);
  await dialog()
    .getByRole("button", { name: /^Protein\b/ })
    .click();
  assert.deepEqual(await rowNames(), [chicken, pompano, salmon]);
  for (const [name, sugar] of [
    [chicken, "0"],
    [pompano, "2.5"],
  ]) {
    const cell = page.getByLabel(`Added sugar in ${name}`, { exact: true });
    await cell.fill(sugar);
    await cell.press("Tab");
  }
  await sortBy.selectOption("addedSugar");
  assert.deepEqual(await rowNames(), [pompano, chicken, salmon]);
  await reverse.click();
  assert.deepEqual(await rowNames(), [chicken, pompano, salmon]);
  const selectAll = dialog().getByRole("checkbox", {
    name: "Select all foods in this view",
  });
  await dialog()
    .getByLabel("Select Test Salmon Fillet", { exact: true })
    .check();
  assert.ok(await selectAll.evaluate((el) => el.indeterminate));
  await selectAll.check();
  await button("Clear selection").click();
  assert.equal(
    await dialog().getByRole("checkbox", { checked: true }).count(),
    0,
  );
  await selectAll.check();
  await page.getByLabel("Filter pantry table").fill("Test Golden Pompano");
  assert.match(
    await dialog().locator(".selection-summary").innerText(),
    /2 hidden/,
  );
  const deleteThree = button("Delete selected");
  page.once("dialog", async (d) => {
    assert.match(d.message(), /2 selected outside this filter/);
    await d.dismiss();
  });
  await deleteThree.click();
  assert.equal(await deleteThree.count(), 1);
  page.once("dialog", (d) => d.accept());
  await deleteThree.click();
  await page.getByLabel("Filter pantry table").fill("");
  assert.equal(await pantryRows.count(), beforePaste);
  assert.equal(
    await dialog()
      .getByLabel("Name of Test Salmon Fillet", { exact: true })
      .count(),
    0,
  );
  await page.getByLabel("Filter pantry table").fill("no-such-food");
  assert.equal(await pantryRows.count(), 0);
  assert.ok(await appendBox.isVisible());
  await page.getByLabel("Filter pantry table").fill("");
  await pasteIntoBlank(
    "Food Item\tQuantity\tCalories\nVEGGIES\nPasted kale\t1 cup\t33",
  );
  assert.match(await dialog().innerText(), /1 added/);
  const kaleCalories = page.getByLabel("Calories in Pasted kale", {
    exact: true,
  });
  await kaleCalories.fill("35");
  await kaleCalories.press("Enter");
  assert.equal(
    await page.getByLabel("Category of Pasted kale").inputValue(),
    "Vegetables",
  );
  page.once("dialog", (d) => d.accept());
  await button("Delete Pasted kale").click();
  assert.equal(await page.getByLabel("Calories in Pasted kale").count(), 0);
  await button("Add row").click();
  assert.equal(
    await page.getByLabel("Category of New food").inputValue(),
    "Needs category",
  );
  async function renameRow(before, after) {
    const cell = page.getByLabel(`Name of ${before}`, { exact: true });
    await cell.fill(after);
    await cell.press("Tab");
  }
  await renameRow("New food", "Fresh asparagus");
  assert.equal(
    await page.getByLabel("Category of Fresh asparagus").inputValue(),
    "Vegetables",
  );
  await renameRow("Fresh asparagus", "Something unfamiliar");
  const uncategorized = page.getByLabel("Category of Something unfamiliar");
  assert.equal(await uncategorized.inputValue(), "Needs category");
  await uncategorized.selectOption("Nuts & Seeds");
  await renameRow("Something unfamiliar", "Special pear");
  assert.equal(
    await page.getByLabel("Category of Special pear").inputValue(),
    "Nuts & Seeds",
  );
  page.once("dialog", (d) => d.accept());
  await button("Delete Special pear").click();
  await button("Close dialog").click();
  await button("Add new food").click();
  for (const [width, height] of [
    [360, 780],
    [1280, 860],
  ]) {
    await page.setViewportSize({ width, height });
    await dialog().evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished)),
    );
    const frame = () =>
      dialog().evaluate((el) => [
        el.offsetLeft,
        el.offsetTop,
        el.offsetWidth,
        el.offsetHeight,
      ]);
    const initialFrame = await frame();
    assert.ok(initialFrame[3] >= height * 0.85 && initialFrame[3] <= height);
    for (const mode of ["Whole dish", "From ingredients", "Food"]) {
      await dialog().getByRole("button", { name: mode, exact: true }).click();
      assert.deepEqual(await frame(), initialFrame);
      if (mode === "From ingredients")
        assert.ok(
          await dialog()
            .locator("form")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        );
    }
    await button("Save food").scrollIntoViewIfNeeded();
    assert.ok(
      await dialog().evaluate(
        (el) => el.scrollTop === 0 && el.scrollWidth <= el.clientWidth + 1,
      ),
    );
  }
  await page.getByLabel("Food name", { exact: true }).fill("Kitchen test oats");
  assert.equal(
    await dialog().getByLabel("Category", { exact: true }).inputValue(),
    "Grains & Bread",
  );
  await page.getByLabel("Protein (g)", { exact: true }).fill("5");
  await button("Save food").click();
  await page.getByLabel("Search recipe book").fill("Kitchen test oats");
  await button("Add Kitchen test oats").click();
  assert.equal(await page.locator(".pill.custom").count(), 1);
  await page.getByLabel("Search recipe book").fill("");
  await button("Dishes").click();
  await button("Write a dish").click();
  const plateBeforeRecipe = await page.locator(".pill").count();
  await page.getByLabel("Dish name").fill("Breakfast plate");
  assert.ok(await button("Save dish").isDisabled());
  const findIngredient = dialog().getByLabel("Find an ingredient");
  await findIngredient.fill("no such ingredient");
  await dialog().getByText("No matching foods.", { exact: false }).waitFor();
  await findIngredient.fill("eggs");
  await findIngredient.press("Tab");
  assert.ok(
    await button("Add ingredient: Eggs").evaluate(
      (el) => el === document.activeElement,
    ),
  );
  await page.keyboard.press("Enter");
  assert.ok(await button("Already added: Eggs").isDisabled());
  const eggAmount = dialog().getByLabel("Amount of Eggs (large)");
  await eggAmount.fill("0");
  assert.ok(await button("Save dish").isDisabled());
  await eggAmount.fill("1.5");
  await findIngredient.fill("White Onion");
  await button("Add ingredient: White Onion").click();
  const onionAmount = dialog().getByLabel("Amount of White Onion (chopped)");
  assert.equal(await onionAmount.inputValue(), "0.25");
  await button("Increase amount of White Onion").click();
  assert.equal(await onionAmount.inputValue(), "0.375");
  await onionAmount.press("ArrowUp");
  assert.equal(await onionAmount.inputValue(), "0.5");
  await onionAmount.press("ArrowDown");
  await button("Decrease amount of White Onion").click();
  assert.equal(await onionAmount.inputValue(), "0.25");
  await onionAmount.press("ArrowDown");
  assert.equal(await onionAmount.inputValue(), "0.125");
  assert.ok(await button("Decrease amount of White Onion").isDisabled());
  await onionAmount.fill("0.2");
  await onionAmount.press("ArrowUp");
  assert.equal(await onionAmount.inputValue(), "0.325");
  assert.ok(await button("Save dish").isEnabled());
  await button("Remove ingredient: White Onion").click();
  await findIngredient.fill("Kirkland Yogurt");
  await button("Add ingredient: Kirkland Yogurt").click();
  await button("Remove ingredient: Kirkland Yogurt").click();
  assert.ok(await button("Add ingredient: Kirkland Yogurt").isEnabled());
  await button("Whole dish").click();
  await button("From ingredients").click();
  assert.equal(
    await page.getByLabel("Dish name").inputValue(),
    "Breakfast plate",
  );
  assert.equal(
    await dialog().getByLabel("Amount of Eggs (large)").inputValue(),
    "1.5",
  );
  await button("Save dish").click();
  assert.equal(await page.locator(".pill").count(), plateBeforeRecipe);
  await button("Edit Breakfast plate").click();
  assert.equal(await eggAmount.inputValue(), "1.5");
  await eggAmount.press("ArrowUp");
  assert.equal(await eggAmount.inputValue(), "2.5");
  await button("Save dish").click();
  assert.equal(await page.locator(".pill").count(), plateBeforeRecipe);
  await button("Pantry table").click();
  await dialog().getByLabel("Select Eggs", { exact: true }).check();
  await button("Copy").click();
  assert.match(await readClipboard(), /^Eggs\t2 large\t/);
  assert.ok(
    await button("Delete selected").isDisabled(),
    "Recipe ingredients can be copied but never bulk-deleted.",
  );
  await button("Close dialog").click();
  const bookSearch = page.getByLabel("Search recipe book");
  for (const tab of ["Recents", "Favorites", "Category", "Dishes"]) {
    await button(tab).click();
    await bookSearch.fill(" Bre ");
    await button("Add Oatnut Bread").waitFor();
    await page.getByRole("button", { name: /＋ Breakfast plate/ }).waitFor();
    await button("Clear search").click();
    assert.equal(await button(tab).getAttribute("aria-pressed"), "true");
  }
  await page.getByRole("button", { name: /＋ Breakfast plate/ }).click();
  assert.equal(await page.locator(".pill.dish").count(), 1);
  assert.equal(
    await page
      .locator(".pill.dish")
      .getByLabel("Change quantity of Eggs")
      .innerText(),
    "2.5 large",
  );
  await button("Dishes").click();
  await button("Write a dish").click();
  await button("Whole dish").click();
  await page.getByLabel("Dish name").fill("Tomato Cucumber Sandwich");
  await page.getByLabel("Calories (kcal)", { exact: true }).fill("320");
  await button("Save dish").click();
  await button("Add Tomato Cucumber Sandwich").click();
  assert.equal(await page.locator(".pill.dish").count(), 2);
  await button("Category").click();
  assert.equal(await dishGroup.locator("summary").textContent(), `Dishes${initialDishCount + 2}`);
  await dishGroup.locator("summary").click();
  await dishGroup.getByRole("button", { name: /＋ Breakfast plate/ }).waitFor();
  await dishGroup.getByLabel("Add another Tomato Cucumber Sandwich").waitFor();
  await dishGroup.locator("summary").click();
  await page.setViewportSize({ width: 360, height: 780 });
  await page.locator(".jar").nth(2).click();
  await guideButton.click();
  await diveButton.click();
  await sources().fill(lentilQuery);
  await dialog().locator(".source-list button").first().click();
  assert.match(await portion().innerText(), /about 316 g of this food/);
  assert.ok(
    await dialog()
      .locator(".card-body")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  );
  await button("Close dialog").click();
  await checkBookSize();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.equal(
    await page
      .locator(".shelfrail")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
    true,
  );
  assert.equal(
    await page
      .locator(".material")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  await button("More jars").click();
  assert.ok(
    (await page.locator(".shelfrail").evaluate((el) => el.scrollLeft)) > 0,
  );
  await button("Category").click();
  const groups = page.locator(".list details");
  assert.equal(await page.locator(".list details[open]").count(), 0);
  await button("Open all").click();
  assert.equal(
    await page.locator(".list details[open]").count(),
    await groups.count(),
  );
  await button("Close all").click();
  assert.equal(await page.locator(".list details[open]").count(), 0);
  await groups.first().locator("summary").click();
  assert.equal(await page.locator(".list details[open]").count(), 1);
  await page.getByLabel("Search recipe book").fill("Blueberries");
  await button("Add Blueberries").click();
  await button("View nutrition for Blueberries").click();
  assert.match(await dialog().innerText(), /10 kcal/);
  await page.keyboard.press("Escape");
  assert.equal(await dialog().count(), 0);
  await button("My goals").click();
  await dialog().locator("summary").filter({ hasText: "Added sugar" }).click();
  await button("Set custom target").filter({ visible: true }).click();
  await dialog()
    .getByLabel("Goal type")
    .filter({ visible: true })
    .selectOption("maximum");
  await dialog()
    .getByLabel("Amount / lower bound (g)", { exact: true })
    .filter({ visible: true })
    .fill("20");
  await button("Save goals").click();
  await page.getByRole("button", { name: /^Added sugar:/ }).click();
  await guideButton.click();
  await diveButton.click();
  await sources().fill("sugar white granulated");
  await dialog().locator(".source-list button").first().click();
  assert.match(
    await portion().innerText(),
    /Equivalent to your daily maximum: about 20 g/,
  );
  assert.match(await portion().innerText(), /not an amount to aim for/);
  assert.match(await portion().innerText(), /food code 91101010/);
  await button("Close dialog").click();
  assert.deepEqual(errors, []);
  const touch = await browser.newContext({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  const phone = await touch.newPage();
  await phone.goto(page.url());
  await phone.getByRole("button", { name: "Pantry table", exact: true }).tap();
  await touch.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(phone.url()).origin,
  });
  await phone.getByLabel("Select A2 Whole Milk", { exact: true }).tap();
  await phone.getByRole("button", { name: "Copy", exact: true }).tap();
  assert.equal(
    await phone.evaluate(() => navigator.clipboard.readText()),
    fullMilk,
  );
  await phone.getByRole("button", { name: "Select cells to copy" }).tap();
  const touchRows = phone.getByRole("grid").locator("tbody tr");
  await touchRows.nth(0).getByRole("gridcell").first().tap();
  await touchRows.nth(1).getByRole("gridcell").nth(1).tap();
  assert.equal(
    await phone.getByRole("gridcell", { selected: true }).count(),
    4,
  );
  // Exercise manual copy when a browser or embedded preview denies clipboard access.
  await phone.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", { value: undefined }),
  );
  await phone.getByRole("button", { name: "Copy selection" }).tap();
  const fallback = phone.getByRole("textbox", {
    name: "Selected cells to copy manually",
  });
  assert.equal(
    await fallback.inputValue(),
    "Eggs\t2 large\nA2 Whole Milk\t1/2 cup",
  );
  assert.ok(
    await fallback.evaluate(
      (el) => el.selectionStart === 0 && el.selectionEnd === el.value.length,
    ),
  );
  await phone.getByRole("button", { name: "Select full rows" }).tap();
  await phone.getByRole("button", { name: "Copy selection" }).tap();
  const fullRows = (await fallback.inputValue()).split("\n");
  assert.equal(fullRows.length, 2);
  assert.equal(fullRows[0].split("\t").length, 16);
  assert.equal(fullRows[1], fullMilk);
  await touch.close();
  console.log(
    "Desktop and 360px mobile browser checks passed: search, log, portions, portion stepper, nutrient card carousel, open/close all categories, duplicates, history, goals, persistence, calendar, sound preferences, pantry table copy/paste/edit/delete, food creation, dishes, reduced motion and keyboard dismissal.",
  );
} finally {
  await browser.close();
}
