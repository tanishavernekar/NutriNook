export const bookTabs = ["Recents", "Dishes", "Category", "Favorites"] as const;
type BookTab = (typeof bookTabs)[number];

const marks = {
  Recents: (
    <>
      <path
        fill="var(--blush)"
        d="M17.8 10.4c0 4.3-3.2 7.6-7.7 7.5-4.3 0-7.8-3.1-7.6-7.6.1-4.2 3.2-7.3 7.6-7.4 4.3-.1 7.7 3.1 7.7 7.5Z"
      />
      <path d="m10.1 6.1-.2 4.3 3.4 1.5M6 16.6l-.9 1.5m9.2-1.7.9 1.3" />
    </>
  ),
  Dishes: (
    <>
      <path
        fill="var(--periwinkle)"
        d="M2.1 9.5q7.4 1 15.8-.2-.5 6.7-7.5 7.3-7.2.2-8.3-7.1Z"
      />
      <path d="m7.1 17.5 6-.1M7.6 7c1.2-1.8-1.2-2 .1-4m4.1 3.9c1.1-1.5-.7-1.8.1-3" />
    </>
  ),
  Category: (
    <>
      <path
        fill="var(--periwinkle)"
        d="m3.7 7-.3-2.8 4.9-.7 1.3 1.3 6.1-.8.8 8.8-12 1Z"
      />
      <path fill="var(--lavender)" d="m2.1 7.9 6-.3 1.2 1.2 8.1-.5.3 8.1-15.1.8Z" />
      <path d="m5.3 12.5 5.9-.3" />
    </>
  ),
};

function InkIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function FavoriteHeart({ filled }: { filled: boolean }) {
  return (
    <InkIcon>
      <path
        fill={filled ? "var(--blush)" : "none"}
        d="M9.9 17.1C7.7 15.6 2 11.6 2.2 7.5c.2-4.8 5.2-5.6 7.6-1.6 2.7-4.7 8.1-3.4 8 1.1 0 3.6-4.1 7.2-7.9 10.1Z"
      />
      {filled && <path d="M4.6 7.4q.1-1.7 1.5-1.8" stroke="var(--paper)" />}
    </InkIcon>
  );
}

export function BookTabIcon({ tab }: { tab: BookTab }) {
  return tab === "Favorites" ? (
    <FavoriteHeart filled />
  ) : (
    <InkIcon>{marks[tab]}</InkIcon>
  );
}
import type { ReactNode } from "react";
