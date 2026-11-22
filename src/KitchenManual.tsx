import goals from "./manual-images/goals-tool.webp";
import target from "./manual-images/set-target.webp";
import serving from "./manual-images/serve-food.webp";
import portion from "./manual-images/plate-portion.webp";
import jars from "./manual-images/nutrient-jars.webp";
import write from "./manual-images/write-dish.webp";
import modes from "./manual-images/dish-modes.webp";
import ingredient from "./manual-images/ingredient.webp";
import day from "./manual-images/choose-day.webp";
import pantry from "./manual-images/pantry.webp";
import settings from "./manual-images/settings-tool.webp";
import backup from "./manual-images/backup.webp";

const chapters = [
  { title: "Set your table", stamps: [
    { src: goals, alt: "Scales icon beside the Undo arrow.", caption: "Open My goals to edit your profile." },
    { src: target, alt: "Set custom target inside an expanded nutrient.", caption: "Pick a nutrient, set your target, then save." },
  ] },
  { title: "Serve a plate", stamps: [
    { src: serving, alt: "Milk in the recipe book with portion, plus and heart controls.", caption: "Search a food. Pick a portion. Tap + to serve." },
    { src: portion, alt: "Plate entry with separate remove, food name and quantity buttons.", caption: "Tap the quantity to adjust, or × to remove." },
    { src: jars, alt: "Labeled nutrient jars on the shelf after adding milk.", caption: "Tap a jar to see which foods filled it." },
  ] },
  { title: "Write a recipe", stamps: [
    { src: write, alt: "Write a dish and Add new food in the recipe book.", caption: "Open Dishes → Write a dish." },
    { src: modes, alt: "The recipe editor’s three choices, with From ingredients selected.", caption: "Have a label? Choose Whole dish. Cooking? Choose From ingredients." },
    { src: ingredient, alt: "An ingredient with minus, quantity and plus controls.", caption: "Add ingredients, adjust amounts, name your dish and save." },
  ] },
  { title: "Keep your kitchen", stamps: [
    { src: day, alt: "The hanging calendar to the left of the plate.", caption: "Tap the calendar to log a different day." },
    { src: pantry, alt: "A selected pantry row with Copy, Clear and Delete selected actions.", caption: "In Pantry table, check a row to copy it." },
    { src: settings, alt: "The sliders icon for Kitchen settings.", caption: "Open Kitchen settings for themes, sound and motion." },
    { src: backup, alt: "Download JSON backup and Restore JSON in Kitchen settings.", caption: "Back up this browser’s journal. Restoring replaces it." },
  ] },
];

export function KitchenManual() {
  return (
    <article className="manual-page" aria-label="Kitchen instruction book">
      {chapters.map(({ title, stamps }, i) => (
        <section className="manual-chapter" key={title}>
          <h3><span className="manual-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span> {title}</h3>
          <div className="manual-gallery">
            {stamps.map(({ src, alt, caption }) => (
              <figure key={src}>
                <span className="manual-mount"><span className="manual-stamp"><img src={src} alt={alt} /></span></span>
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
