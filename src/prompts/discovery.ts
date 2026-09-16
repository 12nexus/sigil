import type { DiscoveryQuestion, Project } from "@/types";
import { JSON_DISCIPLINE, STUDIO_PERSONA, compose, serializeDiscovery } from "./shared";

/**
 * The discovery interview is adaptive: a small seed set opens the conversation,
 * then Gemini decides what else it actually needs based on what it has heard.
 */

export const SEED_QUESTIONS: Array<
  Omit<DiscoveryQuestion, "id" | "order" | "answer" | "answeredAt">
> = [
  {
    key: "company_name",
    question: "What is the company called?",
    why: "The exact spelling drives every wordmark and lockup we produce.",
    kind: "short",
    placeholder: "Nexora",
    required: true,
    seeded: true,
  },
  {
    key: "what_it_does",
    question: "What does the company actually do?",
    why: "The mark has to stand for something specific, not a category.",
    kind: "long",
    placeholder: "We help mid-market manufacturers deploy AI into operations…",
    required: true,
    seeded: true,
  },
  {
    key: "target_audience",
    question: "Who is the audience, and who decides to buy?",
    why: "A mark aimed at CFOs looks different to one aimed at developers.",
    kind: "long",
    placeholder: "COOs and plant directors at $50M–$500M manufacturers",
    required: true,
    seeded: true,
  },
  {
    key: "desired_feeling",
    question: "What should someone feel in the first second they see this brand?",
    why: "This sets the emotional target the form language has to hit.",
    kind: "long",
    placeholder: "That these people are serious, precise, and already ahead",
    required: true,
    seeded: true,
  },
  {
    key: "personality_words",
    question: "Give me 3–5 words that describe the desired personality.",
    why: "These become the attributes we design and critique against.",
    kind: "list",
    placeholder: "precise, confident, human, unflashy",
    required: true,
    seeded: true,
  },
  {
    key: "competitors",
    question: "Who are the main competitors?",
    why: "We need to know what to deliberately not look like.",
    kind: "list",
    placeholder: "Palantir, Scale AI, local consultancies",
    required: false,
    seeded: true,
  },
];

export function buildDiscoveryAnalysisPrompt(project: Project): string {
  const { discovery } = project;
  const askedKeys = discovery.questions.map((q) => q.key);

  return compose(
    `# Task
You are conducting a discovery interview with a professional designer about their client. Decide whether you now know enough to write a complete, defensible brand brief — and if not, what to ask next.`,

    `## Answers so far
${serializeDiscovery(discovery.questions, discovery.additionalNotes)}`,

    `## Keys already asked (never re-ask these)
${askedKeys.join(", ") || "(none)"}`,

    `## How to decide
You have enough when you can confidently answer all of:
1. What the company does and who it serves.
2. What it should feel like, and what it must not feel like.
3. What the competitive visual landscape looks like and where the gap is.
4. Practical constraints: where the logo gets used, any existing equity to retain.
5. Aesthetic guardrails: styles to pursue and styles to avoid.

Ask about things that will genuinely change the design. Do not ask filler questions to pad the interview, and do not ask for information you can reasonably infer from what you already have. A short, sharp interview is better than a thorough boring one.

Ask at most 3 questions at a time — ideally 1 or 2. Questions must be specific to this company, not generic template questions. Reference what the designer already told you where it makes the question sharper.

Typical interviews run 8–14 questions total. Stop as soon as you genuinely have enough.`,

    JSON_DISCIPLINE,
  );
}

export const DISCOVERY_SYSTEM = STUDIO_PERSONA;
