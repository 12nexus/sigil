/**
 * Google `responseSchema` definitions (OpenAPI subset).
 *
 * Every AI call that feeds structured data into the domain model uses one of
 * these, so the application never has to parse free-form prose.
 */

type S = Record<string, unknown>;

const str = (description?: string): S => ({ type: "STRING", ...(description ? { description } : {}) });
const strArray = (description?: string): S => ({
  type: "ARRAY",
  items: { type: "STRING" },
  ...(description ? { description } : {}),
});
const obj = (properties: Record<string, S>, required?: string[]): S => ({
  type: "OBJECT",
  properties,
  required: required ?? Object.keys(properties),
  propertyOrdering: Object.keys(properties),
});

/* ---------------------------- Discovery ---------------------------- */

export const discoveryAnalysisSchema: S = obj({
  sufficient: {
    type: "BOOLEAN",
    description: "True only when there is enough information to write a complete brand brief.",
  },
  reason: str("One sentence explaining the sufficiency judgement, addressed to the designer."),
  estimatedRemaining: {
    type: "INTEGER",
    description: "Best estimate of how many more questions are needed. 0 when sufficient.",
  },
  gaps: strArray("Specific information still missing. Empty when sufficient."),
  nextQuestions: {
    type: "ARRAY",
    description: "The next 1-3 questions to ask. Empty when sufficient.",
    items: obj({
      key: str("Stable snake_case semantic key, e.g. target_audience."),
      question: str("The question, addressed to the designer in second person."),
      why: str("One short sentence: why this matters for the logo."),
      kind: { type: "STRING", enum: ["short", "long", "list", "choice", "scale"] },
      options: strArray("Only for kind=choice or kind=scale."),
      placeholder: str("A short example answer."),
      required: { type: "BOOLEAN" },
    }, ["key", "question", "why", "kind", "required"]),
  },
});

/* --------------------------- Brand brief --------------------------- */

export const brandBriefSchema: S = obj({
  company: obj({
    name: str(),
    industry: str(),
    description: str("2-3 sentences."),
    tagline: str("Optional short positioning line. Empty string if none."),
  }),
  audience: obj({
    primary: str(),
    secondary: str(),
    context: str("Where and how the audience encounters the brand."),
  }),
  positioning: obj({
    represents: str("What the company stands for."),
    differentiates: str("What sets it apart."),
    competitors: strArray(),
    competitiveLandscape: str("How competitors look visually, and the gap available."),
  }),
  personality: strArray("5-8 single-word or short-phrase attributes."),
  desiredPerception: obj({
    feel: str("How the brand should feel in one or two sentences."),
    attributes: strArray(),
    avoidFeeling: strArray(),
  }),
  visualLanguage: obj({
    characteristics: strArray("Potential visual characteristics, 5-8 items."),
    formLanguage: str("Geometry, weight, angularity, proportion."),
    colorDirection: str(),
    typographyDirection: str(),
  }),
  requirements: obj({
    practical: strArray("Practical constraints the mark must satisfy."),
    mustRetain: strArray("Existing equity that must be preserved. May be empty."),
    lockupNeeds: strArray("Required lockups, e.g. horizontal, stacked, symbol-only."),
  }),
  avoid: obj({
    cliches: strArray("Visual cliches specific to this industry."),
    competitorSimilarities: strArray(),
    styles: strArray(),
  }),
  usage: strArray("Concrete usage contexts: website, app icon, favicon, print, signage, etc."),
  strategicSummary: str("A concise paragraph: what this logo must accomplish."),
});

/* ------------------------ Creative directions ---------------------- */

export const creativeDirectionsSchema: S = obj({
  directions: {
    type: "ARRAY",
    items: obj({
      name: str("Evocative 2-4 word name for the territory."),
      summary: str("One line."),
      concept: str("The core idea, 2-3 sentences."),
      visualPrinciple: str("The underlying formal principle driving the design."),
      rationale: str("Why this fits this specific brand."),
      visualKeywords: strArray("5-7 keywords."),
      symbolConcepts: strArray("3-5 concrete symbol ideas to explore."),
      typography: str("Typographic direction."),
      colorApproach: str(),
      strengths: strArray("2-4 items."),
      risks: strArray("2-4 honest risks."),
      differentiation: str("How this avoids looking like the named competitors."),
    }),
  },
  approachNote: str("One paragraph for the designer explaining how these territories were chosen and how they differ from each other."),
});

/* ------------------------- Concept planning ------------------------ */

export const conceptPlansSchema: S = obj({
  concepts: {
    type: "ARRAY",
    items: obj({
      name: str("Short evocative concept name, 2-4 words."),
      objective: str("The single conceptual idea this concept tests. Must be distinct from every sibling."),
      description: str("What the mark looks like, described concretely: forms, structure, composition."),
      rationale: str("Why this could work for the brand."),
      /** Fed verbatim into the image prompt engine. */
      formDescription: str("A precise visual description of the mark for an image model: geometry, construction, proportion, negative space. No brand strategy language."),
      symbolIdea: str("The symbol's central idea in one line."),
      typographyNote: str("How the wordmark should be set, if present."),
      colorNote: str("Colour treatment for this concept."),
    }),
  },
});

/* ---------------------------- Critique ----------------------------- */

const critiqueScore = (label: string): S =>
  obj({
    score: { type: "INTEGER", description: `1-10 observation of ${label}. Not a ranking.` },
    note: str("One or two sentences of specific, actionable observation."),
  });

export const conceptCritiqueSchema: S = obj({
  distinctiveness: critiqueScore("distinctiveness"),
  memorability: critiqueScore("memorability"),
  scalability: critiqueScore("scalability"),
  legibility: critiqueScore("legibility"),
  symbolism: critiqueScore("symbolism"),
  typography: critiqueScore("typography"),
  balance: critiqueScore("balance"),
  simplicity: critiqueScore("simplicity"),
  reproduction: critiqueScore("reproduction across media"),
  smallSize: critiqueScore("performance at 16px"),
  blackAndWhite: critiqueScore("performance in pure black and white"),
  summary: str("A short paragraph of analysis. Never declare a winner."),
  strengths: strArray(),
  concerns: strArray(),
  technicalProblems: strArray("Concrete production problems, e.g. thin strokes, trapped counters. May be empty."),
  brandConfusionRisk: str("Any resemblance to an existing well-known mark."),
  genericnessRisk: str("How close this sits to generic stock-logo territory."),
  briefAlignment: str("How well it serves the approved brand brief."),
  observations: strArray("3-5 neutral observations to help the human decide."),
});

/* -------------------------- Quality check -------------------------- */

export const qualityCheckSchema: S = obj({
  items: {
    type: "ARRAY",
    items: obj({
      question: str("The checklist question being answered."),
      verdict: { type: "STRING", enum: ["pass", "caution", "fail"] },
      note: str("Specific reasoning."),
    }),
  },
  overallNote: str("A short paragraph. Analysis only — do not pick a winner."),
});

/* ---------------------------- Iteration ---------------------------- */

export const iterationInstructionSchema: S = obj({
  intent: str("One line summarising what this round of iteration is trying to achieve."),
  preserve: strArray("Aspects of the parent concept that must be kept."),
  change: strArray("Aspects that must change."),
  remove: strArray("Elements to remove entirely. May be empty."),
  explore: strArray("Distinct variations to explore — one per requested variation."),
  newConstraints: {
    type: "ARRAY",
    description: "Durable constraints to remember for all future generations.",
    items: obj({
      polarity: { type: "STRING", enum: ["positive", "negative"] },
      text: str("Short imperative, e.g. 'No gradients' or 'Keep sharp geometric corners'."),
    }),
  },
});

/* ------------------------ Client feedback -------------------------- */

export const feedbackInterpretationSchema: S = obj({
  sentiment: { type: "STRING", enum: ["positive", "mixed", "negative"] },
  summary: str("One or two sentences restating what the client actually wants."),
  positive: strArray("What the client liked and must be preserved."),
  negative: strArray("What the client disliked and must be avoided."),
  requestedChanges: strArray("Concrete design changes to make."),
  ambiguities: strArray("Anything genuinely unclear that the designer should confirm. May be empty."),
  suggestedActions: strArray("Recommended next steps for the designer."),
});

/* ------------------------- Typography ------------------------------ */

export const fontRecommendationsSchema: S = obj({
  fonts: {
    type: "ARRAY",
    items: obj({
      family: str("A real, obtainable typeface family name."),
      category: str("e.g. geometric sans, grotesque, transitional serif."),
      weight: str("Recommended weight(s) for the wordmark."),
      why: str("Why it suits this mark and brand."),
      pairing: str("A complementary text face."),
      source: str("Where to obtain it, e.g. Google Fonts, Adobe Fonts, commercial foundry."),
    }, ["family", "category", "weight", "why"]),
  },
  wordmarkNotes: str("Letterspacing, case, and optical adjustment guidance for setting the exact company name."),
});

/* -------------------------- Finalization --------------------------- */

export const finalizationInstructionsSchema: S = obj({
  lockups: {
    type: "ARRAY",
    description: "One entry per required lockup.",
    items: obj({
      kind: {
        type: "STRING",
        enum: ["primary", "secondary", "symbol", "wordmark", "horizontal", "stacked", "monochrome", "reversed", "small", "favicon"],
      },
      instruction: str("A precise image-generation instruction for producing this lockup while keeping the approved mark unchanged."),
      purpose: str("What this lockup is for."),
    }),
  },
  consistencyNote: str("What must stay identical across every lockup."),
});

export const brandKitSchema: S = obj({
  palette: {
    type: "ARRAY",
    items: obj({
      name: str(),
      hex: str("A #RRGGBB value."),
      role: str("e.g. Primary, Accent, Ink, Surface."),
      usage: str("Where and how to use it."),
      contrastNote: str("Accessibility note, e.g. AA on white."),
    }, ["name", "hex", "role", "usage"]),
  },
  typography: obj({
    primary: obj({
      family: str(), category: str(), weight: str(), why: str(),
      pairing: str(), source: str(),
    }, ["family", "category", "weight", "why"]),
    secondary: obj({
      family: str(), category: str(), weight: str(), why: str(),
      pairing: str(), source: str(),
    }, ["family", "category", "weight", "why"]),
    notes: str(),
  }),
  clearSpace: str("A rule expressed relative to the mark, e.g. 'equal to the height of the symbol's counter'."),
  minimumSize: str("Concrete minimum sizes for digital and print."),
  usageRules: strArray("6-10 rules."),
  dos: strArray("4-6 items."),
  donts: strArray("4-6 items."),
  personality: strArray(),
  rationale: str("A paragraph explaining the finished identity."),
});
