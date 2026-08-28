import type { Metadata } from "next";

import { WorkView } from "@/features/work/WorkView";
import { getSiteSettings, getWorkIndex } from "@/lib/content";
import { clientTags, clientYearSpan, formatYearRange } from "@/lib/content/model";

export const metadata: Metadata = {
  title: "Work",
  description: "Selected client work — filter by discipline and year.",
  alternates: { canonical: "/work" },
};

export default async function WorkPage() {
  const [settings, clients] = await Promise.all([getSiteSettings(), getWorkIndex()]);

  return (
    <>
      <WorkView
        clients={clients}
        bounds={{ start: settings.workStartYear, end: settings.workEndYear }}
      />
      {/* Server-rendered client index for crawlers and assistive tech. */}
      <ul className="visually-hidden">
        {clients.map((client) => (
          <li key={client.id}>
            {client.caseStudy ? (
              <a href={`/work/${client.caseStudy.slug}`}>
                {client.name} — {client.caseStudy.title}
              </a>
            ) : (
              <span>
                {client.name} ({formatYearRange(clientYearSpan(client))},{" "}
                {clientTags(client).join(", ")})
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
