import {
  previewArtwork,
  resetArtwork,
  sceneSheetSize,
  themeFile,
  useArtworkTheme,
} from "./theme";

import { appearances, type Appearance } from "./model";

export function ArtworkSettings({
  appearance,
  choose,
}: {
  appearance: Appearance;
  choose: (value: Appearance) => void;
}) {
  const theme = useArtworkTheme();
  return (
    <details>
      <summary>Artwork themes</summary>
      <fieldset className="appearance-picker">
        <legend>Kitchen theme</legend>
        <div>
          {(Object.keys(appearances) as Appearance[]).map((id) => (
            <button
              key={id}
              type="button"
              data-preset={id}
              aria-pressed={appearance === id && theme.name === "Original"}
              onClick={() => {
                resetArtwork();
                choose(id);
              }}
            >
              <span className="appearance-swatches" aria-hidden="true" />
              {appearances[id]}
            </button>
          ))}
        </div>
      </fieldset>
      <h3>Custom spritesheets</h3>
      <p>
        <a
          href={themeFile("template-scene-v1.png")}
          download="nutrinook-shelf-and-scenery-v1.png"
        >
          Download the shelf &amp; scenery PNG
        </a>{" "}
        ({sceneSheetSize} px). Paint just the jars, greenery, cabinet, wall, and
        wainscot. Everything else uses the original artwork.
      </p>
      <label>
        Preview a theme PNG
        <input
          type="file"
          accept="image/png,.png"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void previewArtwork(file);
          }}
        />
      </label>
      <p>
        Preview files stay in this tab. Choose a kitchen theme to end the
        preview.
      </p>
      <p role="status">
        {theme.busy
          ? "Preparing artwork…"
          : `Active artwork: ${theme.name === "Original" ? appearances[appearance] : theme.name}`}
      </p>
      {theme.error && <p role="alert">{theme.error}</p>}
      <button
        type="button"
        onClick={resetArtwork}
        disabled={!theme.busy && !theme.error && theme.name === "Original"}
      >
        Reset custom artwork
      </button>
    </details>
  );
}
