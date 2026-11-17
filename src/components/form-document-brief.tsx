import type { ReactNode } from "react";
import { NO_FILL_IN_PLACES_MESSAGE } from "@/lib/forms/form-errors";
import type { FormDocumentBrief } from "@/lib/forms/document-brief-schema";

const KIND_LABEL: Record<FormDocumentBrief["documentKind"], string> = {
  tender: "Tender",
  rfp: "Request for proposal (RFP)",
  rfq: "Request for quotation (RFQ)",
  application: "Application",
  form: "Form",
  other: "Document",
};

function BriefSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-white/8 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-200/70">
        {title}
      </h3>
      <div className="mt-2 text-[15px] leading-relaxed text-slate-200">
        {children}
      </div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-amber-200/50">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function FormDocumentBriefPanel({
  brief,
  fileName,
  questionCount,
}: {
  brief: FormDocumentBrief | null;
  fileName: string;
  questionCount: number;
}) {
  const kind = KIND_LABEL[brief?.documentKind ?? "other"];
  const title = brief?.title ?? fileName;
  const summary = brief?.summary ?? "Omera has this file ready.";

  return (
    <article className="mx-auto w-full max-w-2xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-200/80">
        {kind}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-1 truncate text-xs text-slate-500">{fileName}</p>

      <div
        className="mt-5 max-h-[min(72vh,38rem)] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        tabIndex={0}
        aria-label="Document briefing"
      >
        <div className="space-y-0">
          {brief?.whatWasRead.note ? (
            <BriefSection title="What Omera read">
              <p>{brief.whatWasRead.note}</p>
            </BriefSection>
          ) : null}

          <BriefSection title="What this is about">
            <div className="whitespace-pre-wrap">{summary}</div>
          </BriefSection>

          {brief?.sections.length ? (
            <BriefSection title="Outline">
              <ol className="list-decimal space-y-1.5 pl-5 marker:text-amber-200/50">
                {brief.sections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </BriefSection>
          ) : null}

          {brief?.keyFacts.length ? (
            <BriefSection title="Key facts">
              <BulletList items={brief.keyFacts} />
            </BriefSection>
          ) : null}

          {brief?.parties.length ? (
            <BriefSection title="Parties">
              <ul className="space-y-2">
                {brief.parties.map((party) => (
                  <li key={`${party.role}-${party.name}`}>
                    <span className="text-xs uppercase tracking-wider text-slate-500">
                      {party.role}
                    </span>
                    <p className="text-slate-100">{party.name}</p>
                  </li>
                ))}
              </ul>
            </BriefSection>
          ) : null}

          {brief?.eligibility ? (
            <BriefSection title="Who this is for">
              <p>{brief.eligibility}</p>
            </BriefSection>
          ) : null}

          {brief?.deadlines.length ? (
            <BriefSection title="Dates">
              <BulletList items={brief.deadlines} />
            </BriefSection>
          ) : null}

          {brief?.requiredAttachments.length ? (
            <BriefSection title="Attachments to gather">
              <BulletList items={brief.requiredAttachments} />
            </BriefSection>
          ) : null}

          {brief?.actionsNow.length ? (
            <BriefSection title="What you must do now">
              <BulletList items={brief.actionsNow} />
            </BriefSection>
          ) : null}

          {brief?.implications.length ? (
            <BriefSection title="If you skip this">
              <BulletList items={brief.implications} />
            </BriefSection>
          ) : null}

          {brief?.fillableSections.length ? (
            <BriefSection title="Forms Omera will ask about">
              <p className="text-slate-300">
                {brief.fillableSections.join(" · ")}
              </p>
            </BriefSection>
          ) : null}

          <BriefSection title={questionCount ? "Fill-in questions" : "No questions to complete"}>
            <p className="text-slate-400">
              {questionCount
                ? `${questionCount} fill-in question${questionCount === 1 ? "" : "s"} found. Narrative pages are skipped.`
                : NO_FILL_IN_PLACES_MESSAGE}
            </p>
          </BriefSection>
        </div>
      </div>
    </article>
  );
}
