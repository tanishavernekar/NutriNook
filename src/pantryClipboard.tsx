import { useState, type ClipboardEvent } from "react";

export function usePantryClipboard() {
  const [manual, setManual] = useState<string | null>(null);
  const [message, say] = useState("");
  function reset() {
    setManual(null);
    say("");
  }
  function native(e: ClipboardEvent, text: string, result: string) {
    e.preventDefault();
    e.clipboardData.setData("text/plain", text);
    say(result);
  }
  async function write(text: string, result: string) {
    try {
      await navigator.clipboard.writeText(text);
      setManual(null);
      say(result);
    } catch {
      setManual(text);
      say("Clipboard access was blocked. Copy the selected text below.");
    }
  }
  const fallback =
    manual === null ? null : (
      <textarea
        aria-label="Selected cells to copy manually"
        readOnly
        value={manual}
        ref={(el) => {
          if (el) {
            el.focus();
            el.select();
          }
        }}
      />
    );
  return { message, reset, native, write, fallback };
}
