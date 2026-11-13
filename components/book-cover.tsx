import Image from "next/image";

// Cover image for a book. Uses the real cover when the database has one,
// otherwise draws a simple placeholder cover (title + author) so every tile still has an image.

// Calm cover colors. The ISBN picks one, so a book always gets the same color
const PALETTE = [
  ["#1f3a5f", "#f4e9d8"],
  ["#5b2a3c", "#f7e7ce"],
  ["#2f4f3a", "#efe6d2"],
  ["#6b3e26", "#f6ead7"],
  ["#3d2f5b", "#ece4f7"],
  ["#7a5c1e", "#fbf3df"],
  ["#264653", "#e9f1ef"],
  ["#8c3b2f", "#fbeee6"],
];

function colorsFor(isbn: string) {
  let hash = 0;
  for (const ch of isbn) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

// Breaks a title into short lines so it fits the cover (svg text doesn't wrap by itself)
function wrap(text: string, max = 14, maxLines = 4) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, "…");
  }
  return lines;
}

type Props = {
  title: string;
  author: string;
  isbn: string;
  coverImageUrl?: string | null;
  eager?: boolean;
  sizes?: string;
};

export function BookCover({ title, author, isbn, coverImageUrl, eager = false, sizes }: Props) {
  if (coverImageUrl) {
    return (
      <Image
        src={coverImageUrl}
        alt={`Cover of ${title}`}
        fill
        loading={eager ? "eager" : "lazy"}
        sizes={sizes ?? "(min-width: 1024px) 180px, (min-width: 768px) 25vw, 50vw"}
        className="object-cover"
      />
    );
  }

  const [bg, ink] = colorsFor(isbn);
  const lines = wrap(title);
  return (
    <svg viewBox="0 0 200 300" role="img" aria-label={`Cover of ${title} by ${author}`} className="absolute inset-0 h-full w-full">
      <rect width="200" height="300" fill={bg} />
      <rect x="12" y="12" width="176" height="276" fill="none" stroke={ink} strokeOpacity="0.5" />
      {lines.map((l, i) => (
        <text key={i} x="100" y={92 + i * 26} textAnchor="middle" fontFamily="Georgia, serif" fontSize="21" fontWeight="700" fill={ink}>
          {l}
        </text>
      ))}
      <line x1="70" x2="130" y1={110 + lines.length * 26} y2={110 + lines.length * 26} stroke={ink} strokeOpacity="0.6" />
      <text x="100" y="262" textAnchor="middle" fontFamily="Georgia, serif" fontSize="14" fill={ink} fillOpacity="0.9">
        {author}
      </text>
    </svg>
  );
}
