import type {
  BrandBrief,
  Constraint,
  CreativeDirection,
  DiscoveryQuestion,
  LogoConcept,
  Project,
} from "@/types";

/**
 * Shared prompt building blocks.
 *
 * Prompts are composed from structured project data — never from ad-hoc string
 * concatenation scattered through components.
 */

export const STUDIO_PERSONA = `You are the senior identity designer and brand strategist inside SIGIL, a professional brand identity studio.

You have twenty years of experience designing marks for companies ranging from startups to global institutions. You think like a designer at Pentagram or Chermayeff & Geismar: concept first, form second, decoration never.

Principles you always work by:
- A logo is a strategic asset, not decoration. Every formal choice must be defensible.
- Simplicity is earned through reduction, not achieved by being plain.
- A mark must survive being reproduced at 16 pixels, embroidered, engraved, and faxed.
- Distinctiveness beats beauty. A memorable mark that is slightly awkward outperforms a beautiful generic one.
- Industry cliches (swooshes, globes, handshakes, lightbulbs, neural-network nodes, circuit boards, gradient hexagons) are failures of imagination.
- Honest critique serves the client better than flattery.

You never declare a winner. The human designer makes every creative decision. Your role is to widen the option space, articulate trade-offs clearly, and execute the human's direction precisely.

Write in clear, specific, professional language. No marketing fluff, no hedging, no emoji.`;

export const JSON_DISCIPLINE = `Return only data that conforms to the provided schema. Every field must be populated with substantive, specific content — never placeholders, never "N/A", never restatements of the field name.`;

/* ------------------------------------------------------------------ */
/* Serializers                                                         */
/* ------------------------------------------------------------------ */

const bullet = (items: string[] | undefined, empty = "(none specified)"): string =>
  items && items.length ? items.map((i) => `- ${i}`).join("\n") : empty;

export function serializeDiscovery(questions: DiscoveryQuestion[], notes: string): string {
  const answered = questions.filter((q) => q.answer && q.answer.trim() && !q.skipped);
  const skipped = questions.filter((q) => q.skipped);

  const lines = answered.map(
    (q) => `[${q.key}] ${q.question}\n    → ${q.answer!.trim()}`,
  );

  let out = lines.length ? lines.join("\n\n") : "(no answers yet)";
  if (skipped.length) {
    out += `\n\nDeliberately skipped by the designer (do not re-ask):\n${skipped
      .map((q) => `- [${q.key}] ${q.question}`)
      .join("\n")}`;
  }
  if (notes.trim()) {
    out += `\n\nAdditional context volunteered by the designer:\n${notes.trim()}`;
  }
  return out;
}

export function serializeBrief(brief: BrandBrief): string {
  return `## Company
Name: ${brief.company.name}
Industry: ${brief.company.industry}
Description: ${brief.company.description}
${brief.company.tagline ? `Tagline: ${brief.company.tagline}` : ""}

## Audience
Primary: ${brief.audience.primary}
Secondary: ${brief.audience.secondary}
Context of encounter: ${brief.audience.context}

## Positioning
Represents: ${brief.positioning.represents}
Differentiates: ${brief.positioning.differentiates}
Competitors: ${brief.positioning.competitors.join(", ") || "(none named)"}
Competitive visual landscape: ${brief.positioning.competitiveLandscape}

## Brand personality
${bullet(brief.personality)}

## Desired perception
Feel: ${brief.desiredPerception.feel}
Attributes:
${bullet(brief.desiredPerception.attributes)}
Must NOT feel:
${bullet(brief.desiredPerception.avoidFeeling)}

## Visual language
Characteristics:
${bullet(brief.visualLanguage.characteristics)}
Form language: ${brief.visualLanguage.formLanguage}
Colour direction: ${brief.visualLanguage.colorDirection}
Typography direction: ${brief.visualLanguage.typographyDirection}

## Requirements
Practical:
${bullet(brief.requirements.practical)}
Must retain:
${bullet(brief.requirements.mustRetain, "(nothing must be retained)")}
Lockups needed:
${bullet(brief.requirements.lockupNeeds)}

## Avoid
Cliches:
${bullet(brief.avoid.cliches)}
Competitor similarity:
${bullet(brief.avoid.competitorSimilarities)}
Styles:
${bullet(brief.avoid.styles)}

## Usage contexts
${bullet(brief.usage)}

## Strategic summary
${brief.strategicSummary}`;
}

export function serializeDirection(d: CreativeDirection): string {
  return `Direction ${d.number} — ${d.name}
Summary: ${d.summary}
Core concept: ${d.concept}
Visual principle: ${d.visualPrinciple}
Why it fits: ${d.rationale}
Visual keywords: ${d.visualKeywords.join(", ")}
Symbol concepts to explore: ${d.symbolConcepts.join("; ")}
Typography: ${d.typography}
Colour: ${d.colorApproach}
Differentiation: ${d.differentiation}
Known risks: ${d.risks.join("; ")}`;
}

/**
 * Feedback memory is the mechanism that stops the AI repeating rejected ideas.
 * It is injected into every downstream generation prompt.
 */
export function serializeConstraints(constraints: Constraint[]): string {
  const active = constraints.filter((c) => c.active);
  const positive = active.filter((c) => c.polarity === "positive");
  const negative = active.filter((c) => c.polarity === "negative");

  if (!active.length) return "";

  const blocks: string[] = ["## Accumulated design constraints"];
  if (positive.length) {
    blocks.push(
      `These qualities have been explicitly endorsed. Preserve and build on them:\n${positive
        .map((c) => `- ${c.text}  (source: ${c.origin})`)
        .join("\n")}`,
    );
  }
  if (negative.length) {
    blocks.push(
      `These have been explicitly rejected. They are hard constraints — violating any of them makes the output unusable:\n${negative
        .map((c) => `- ${c.text}  (source: ${c.origin})`)
        .join("\n")}`,
    );
  }
  return blocks.join("\n\n");
}

/** Rejected directions teach the AI what territory to stay out of. */
export function serializeRejections(project: Project): string {
  const rejectedDirections = project.directions.filter((d) => d.status === "rejected");
  const rejectedConcepts = project.concepts.filter((c) => c.status === "rejected");

  const parts: string[] = [];
  if (rejectedDirections.length) {
    parts.push(
      `Creative territories the designer rejected. Do not return to them:\n${rejectedDirections
        .map((d) => {
          const why = d.comments.map((c) => c.body).join(" ");
          return `- ${d.name}: ${d.summary}${why ? ` — designer's reason: ${why}` : ""}`;
        })
        .join("\n")}`,
    );
  }
  if (rejectedConcepts.length) {
    const sample = rejectedConcepts.slice(-12);
    parts.push(
      `Specific concepts the designer rejected:\n${sample
        .map((c) => {
          const why = c.comments.map((x) => x.body).join(" ") || c.notes;
          return `- ${c.code} ${c.name}: ${c.objective}${why ? ` — reason: ${why}` : ""}`;
        })
        .join("\n")}`,
    );
  }
  if (!parts.length) return "";
  return `## Rejected territory\n${parts.join("\n\n")}`;
}

/** What the designer has endorsed so far, so exploration compounds. */
export function serializeEndorsements(project: Project): string {
  const liked = project.concepts.filter(
    (c) =>
      c.status === "favorite" ||
      c.status === "shortlisted" ||
      c.status === "finalist" ||
      c.rating >= 4,
  );
  if (!liked.length) return "";
  return `## Concepts the designer responded well to\n${liked
    .slice(-10)
    .map((c) => {
      const notes = [c.notes, ...c.comments.map((x) => x.body)].filter(Boolean).join(" ");
      return `- ${c.code} ${c.name} (${c.status}${c.rating ? `, rated ${c.rating}/5` : ""}): ${c.objective}${notes ? ` — designer's note: ${notes}` : ""}`;
    })
    .join("\n")}`;
}

export function conceptSummary(c: LogoConcept): string {
  return `${c.code} — ${c.name}
Objective: ${c.objective}
Description: ${c.description}
Rationale: ${c.rationale}`;
}

/** Compose sections, dropping empties, with consistent spacing. */
export function compose(...sections: Array<string | false | null | undefined>): string {
  return sections.filter((s): s is string => Boolean(s && String(s).trim())).join("\n\n");
}
