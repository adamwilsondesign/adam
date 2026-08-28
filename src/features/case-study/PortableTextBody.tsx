import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "next-sanity";

import styles from "./PortableTextBody.module.css";

const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p className={styles.paragraph}>{children}</p>,
  },
  marks: {
    link: ({ children, value }) => (
      <a
        className={styles.link}
        href={(value as { href?: string })?.href}
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    ),
  },
};

type PortableTextBodyProps = {
  value: PortableTextBlock[] | null;
  /** Plain-text fallback when no rich body exists yet. */
  fallback?: string;
};

/** Restrained Portable Text rendering: paragraphs, emphasis and links. */
export function PortableTextBody({ value, fallback }: PortableTextBodyProps) {
  if (!value || value.length === 0) {
    return fallback ? <p className={styles.paragraph}>{fallback}</p> : null;
  }
  return <PortableText value={value} components={components} />;
}
