import type { IconName } from "@/lib/data";

const paths: Record<IconName, string> = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6z",
  stack: "M4 7h16M6 3h12M4 11h16v9H4z",
  live: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10",
  game: "M6 9h12a3 3 0 0 1 3 3v3a3 3 0 0 1-5 2l-1-1H9l-1 1a3 3 0 0 1-5-2v-3a3 3 0 0 1 3-3zM8 11v4M6 13h4",
  spark: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
  heart: "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z",
  down: "M12 4v11m-5-4l5 5 5-5M5 20h14",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-3 0-4-4-1-4s1 4 1 4zm0 0c3 0 4-4 1-4s-1 4-1 4z",
  mail: "M3 6h18v12H3zM3 7l9 7 9-7",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-4-4",
  play: "M8 5v14l11-7z",
  user: "M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  like: "M7 11v9H4v-9h3zM7 11l4-8c1.7 0 2.7 1.2 2.3 2.8L12.8 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7",
  flag: "M5 21V4M5 4h12l-2.5 4L17 12H5",
  up: "M6 15l6-6 6 6",
  chevdown: "M6 9l6 6 6-6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
};

export default function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
