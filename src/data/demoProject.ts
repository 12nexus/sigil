import type { BrandBrief, CreativeDirection, Project } from "@/types";
import { createProject } from "@/workflows/projectFactory";
import { makeConstraint } from "@/workflows/mutations";
import { newId } from "@/utils/id";
import { computeStageStates } from "@/workflows/stages";

/**
 * The sample project.
 *
 * It is seeded up to "directions approved" rather than all the way to finished
 * artwork: every image in SIGIL is genuinely generated, so fabricating concept
 * images here would misrepresent what the product does. Opening the demo and
 * pressing Generate runs the real pipeline from a realistic starting point.
 *
 * Nothing else in the application depends on this file.
 */

const DISCOVERY_ANSWERS: Record<string, string> = {
  company_name: "Nexora",
  what_it_does:
    "Nexora is an AI consulting firm that embeds small senior teams inside mid-market manufacturers and logistics operators to put machine learning into day-to-day operations — demand forecasting, predictive maintenance, quality inspection. They do implementation, not slide decks.",
  target_audience:
    "COOs, plant directors and heads of supply chain at $50M–$500M industrial companies. Buyers are operators in their 40s and 50s who have been pitched AI many times and are sceptical. The technical evaluators are internal engineering leads.",
  desired_feeling:
    "That these people are serious engineers who will actually show up on the factory floor. Competent, precise, unhurried. Not a startup, not a Big Four consultancy.",
  personality_words: "precise, grounded, rigorous, quietly confident, engineered",
  competitors:
    "Palantir, Accenture Industry X, Scale AI, plus regional systems integrators and boutique data-science shops",
  admired_brands:
    "Stripe for its restraint, Deutsche Bahn's identity system for its rigour, and Braun's product graphics. Nothing that looks like a consumer app.",
  avoid_styles:
    "Neural network node diagrams, glowing brains, circuit board traces, blue-to-purple gradients, hexagon tech badges, anything that looks like a crypto startup or a generic SaaS logo.",
  usage_contexts:
    "Website, proposal documents and PDFs, LinkedIn, conference booth panels, embroidered polo shirts for on-site teams, hard hat stickers, favicon, and a Slack app icon.",
  existing_equity:
    "Nothing fixed. There is an incumbent logo — a blue hexagon with a swoosh — that everyone including the founders dislikes. No colour equity worth keeping.",
  premium_vs_approachable:
    "Premium and technical rather than approachable. It should feel closer to a precision instrument manufacturer than to a consultancy.",
  wordmark_or_symbol:
    "They need a symbol that stands alone, because it has to work embroidered and as a hard hat sticker where a wordmark would be illegible.",
  naming_note:
    "The name is a coinage from 'nexus' and 'aurora'. There is no story to illustrate literally — the founders explicitly do not want a mark that tries to draw a nexus.",
};

const DEMO_BRIEF: BrandBrief = {
  company: {
    name: "Nexora",
    industry: "AI consulting for industrial operations",
    description:
      "Nexora embeds small senior teams inside mid-market manufacturers and logistics operators to put machine learning into daily operations. The work is implementation — forecasting, predictive maintenance, and automated quality inspection running in production — rather than strategy advice.",
    tagline: "AI that reaches the factory floor",
  },
  audience: {
    primary:
      "COOs, plant directors and supply chain leaders at $50M–$500M industrial companies, typically 40–60, operations-first, and sceptical after several failed AI pilots.",
    secondary:
      "Internal engineering and data leads who technically evaluate Nexora and who must live with what gets built.",
    context:
      "Encountered in proposal PDFs, on LinkedIn, at industry conferences, and physically on-site — embroidered on team polos and stuck to hard hats.",
  },
  positioning: {
    represents:
      "Engineering seriousness applied to AI. Nexora stands for work that survives contact with a real production line.",
    differentiates:
      "Unlike the large consultancies it sells implementation rather than transformation programmes, and unlike the AI platform companies it works inside the client's existing operation rather than replacing it.",
    competitors: ["Palantir", "Accenture Industry X", "Scale AI", "Regional systems integrators"],
    competitiveLandscape:
      "The category is visually saturated with blue-to-violet gradients, node-and-edge network diagrams, and abstract hexagons. Palantir is a notable exception with a stark monolithic wordmark. The open territory is industrial precision: mechanical, monochrome, drawn as though it came from an engineering drawing rather than a design tool.",
  },
  personality: [
    "precise",
    "grounded",
    "rigorous",
    "quietly confident",
    "engineered",
    "durable",
    "unshowy",
  ],
  desiredPerception: {
    feel: "Like the mark of a precision instrument manufacturer — something machined rather than styled. The viewer should register competence before they register design.",
    attributes: ["credible", "technical", "considered", "permanent"],
    avoidFeeling: ["startup-y", "playful", "futuristic", "corporate-generic", "salesy"],
  },
  visualLanguage: {
    characteristics: [
      "orthogonal or clearly-derived geometry",
      "consistent stroke weight suggesting machined parts",
      "high contrast, no soft edges",
      "modular construction from a visible underlying grid",
      "restraint — fewer elements than expected",
      "legible at hard-hat-sticker scale",
    ],
    formLanguage:
      "Constructed rather than drawn. Forms should look like they were derived from a grid or a set of rules. Right angles and single-slope diagonals rather than arbitrary curves.",
    colorDirection:
      "Predominantly monochrome — ink on white — with at most one restrained accent. Avoid blue entirely, since it is the category default. A warm metallic or a deep industrial red would separate Nexora from every named competitor.",
    typographyDirection:
      "A grotesque or neo-grotesque with a technical character — even weights, tight but not cramped spacing, unfussy terminals. Avoid geometric sans faces that read as startup-default.",
  },
  requirements: {
    practical: [
      "Symbol must be legible standalone at 16px and when embroidered",
      "Must reproduce in single-colour on stickers and printed documents",
      "Must survive being applied to a curved hard hat surface",
      "Needs a favicon and a square Slack app icon",
    ],
    mustRetain: [],
    lockupNeeds: ["horizontal", "stacked", "symbol-only", "monochrome", "reversed"],
  },
  avoid: {
    cliches: [
      "neural network node-and-edge diagrams",
      "glowing brains or synapses",
      "circuit board traces",
      "hexagon tech badges",
      "abstract swooshes and orbits",
      "literal factory or gear imagery",
      "the letter N drawn as a network graph",
    ],
    competitorSimilarities: [
      "blue-to-violet gradients of the kind used across the AI category",
      "the monolithic all-caps wordmark associated with Palantir",
      "isometric cube constructions used by systems integrators",
    ],
    styles: [
      "rounded friendly geometry",
      "gradients of any kind",
      "3D rendering, bevels or shadows",
      "handwritten or script elements",
      "anything that reads as consumer software",
    ],
  },
  usage: [
    "Website and favicon",
    "Proposal documents and PDFs",
    "LinkedIn and social profiles",
    "Conference booth panels",
    "Embroidered polo shirts",
    "Hard hat stickers",
    "Slack app icon",
    "Presentation templates",
  ],
  strategicSummary:
    "The mark has to buy Nexora credibility with an audience that has already been disappointed by AI vendors. It should look engineered rather than designed, and it should be so far from the blue-gradient-network visual default of the category that it reads as belonging to a different industry — closer to a precision tools manufacturer than to a consultancy. Its hardest constraint is physical: it must stay legible embroidered on a polo and stuck to a hard hat, which rules out detail, gradients, and anything that depends on colour to be understood.",
};

const DIRECTION_SEEDS: Array<
  Omit<CreativeDirection, "id" | "createdAt" | "comments"> & { note?: string }
> = [
  {
    number: 1,
    name: "Machined Monogram",
    summary: "An N constructed from a single repeated machined unit.",
    concept:
      "The letter N is built from one module — a chamfered parallelogram — repeated and rotated on a strict grid. The letterform emerges from the system rather than being drawn, so the mark reads as manufactured to a tolerance.",
    visualPrinciple:
      "One unit, one grid, one rule. Every edge in the mark is either orthogonal or on the same single slope.",
    rationale:
      "Speaks directly to engineering rigour without depicting engineering. The modular construction gives Nexora a system it can extend into iconography later.",
    visualKeywords: ["modular", "chamfered", "orthogonal", "tooled", "systematic", "compact"],
    symbolConcepts: [
      "N formed by three shearing vertical bars with cut corners",
      "N whose diagonal is the negative gap between two solid blocks",
      "N built from a repeated L-shaped tile rotated 180 degrees",
    ],
    typography:
      "A neo-grotesque at medium weight, tightly tracked, with the wordmark's stroke weight matched to the symbol's module width.",
    colorApproach: "Ink on white. Optional single accent in a deep industrial red.",
    strengths: [
      "Exceptional small-size and embroidery performance",
      "Gives the brand an extensible construction system",
      "Immediately signals precision without illustrating it",
    ],
    risks: [
      "Modular monograms are common in industrial branding and can read as generic if the module is not distinctive",
      "Risks feeling cold with no warmth anywhere in the system",
    ],
    differentiation:
      "None of Palantir, Accenture Industry X or Scale AI uses a constructed monogram; the category defaults to abstract network symbols.",
    status: "approved",
    favorite: true,
    editedByUser: false,
  },
  {
    number: 2,
    name: "Tolerance Mark",
    summary: "A mark built from engineering-drawing notation.",
    concept:
      "Borrows the visual language of technical drawings — datum symbols, tolerance callouts, section marks — and abstracts one into an identity. The mark looks like a notation that already existed rather than a logo that was designed.",
    visualPrinciple:
      "Notation, not illustration. Thin consistent rules, a single filled element, and the asymmetry of real drafting symbols.",
    rationale:
      "Nexora's audience reads engineering drawings daily. A mark drawn in their own notation earns immediate insider credibility that no amount of AI imagery could.",
    visualKeywords: ["datum", "drafting", "hairline", "annotated", "precise", "asymmetric"],
    symbolConcepts: [
      "A datum triangle and bar abstracted into an N",
      "A section-cut arrow pair forming a closed symbol",
      "A tolerance bracket enclosing a solid square",
    ],
    typography:
      "Technical grotesque with slightly condensed proportions, echoing the lettering on dimensioned drawings.",
    colorApproach: "Pure black on white, with a red accent used the way it is used on markups.",
    strengths: [
      "Highly distinctive in the AI category",
      "Deep credibility with the technical evaluators",
      "Extends naturally into document and proposal design",
    ],
    risks: [
      "Hairline drafting rules will not survive embroidery or small sizes without a heavier variant",
      "Could read as an engineering firm rather than an AI firm",
    ],
    differentiation:
      "Completely orthogonal to the network-diagram convention every named competitor works within.",
    status: "approved",
    favorite: false,
    editedByUser: false,
  },
  {
    number: 3,
    name: "Signal Through Noise",
    summary: "A dense field resolving into a single clear form.",
    concept:
      "A block of repeated marks, irregular at one edge and resolving into perfect order at the other. It depicts what Nexora actually does — taking messy operational data and making it legible — without drawing data.",
    visualPrinciple: "Gradient of order. Same element, varying only in alignment.",
    rationale:
      "The most honest metaphor available for the work, and it stays abstract enough to avoid the data-visualisation cliche.",
    visualKeywords: ["resolution", "field", "repetition", "alignment", "emergence"],
    symbolConcepts: [
      "A grid of bars, scattered at the left and aligned at the right",
      "Concentric arcs that lose then regain their spacing",
      "A square of dots collapsing into a single solid line",
    ],
    typography: "Clean neo-grotesque, set quietly so the symbol carries the idea.",
    colorApproach: "Monochrome, with the resolved portion optionally carrying the accent.",
    strengths: ["Genuinely meaningful", "Memorable and ownable", "Animates naturally"],
    risks: [
      "Detail-dependent — likely to fail at 16px and in embroidery, which is a hard requirement",
      "Sits adjacent to data-visualisation imagery the brief warns against",
    ],
    differentiation: "Distinct in execution, though the underlying metaphor is used in the category.",
    status: "rejected",
    favorite: false,
    editedByUser: false,
    note: "Beautiful idea but it dies on a hard hat sticker. The whole point is the detail, and the detail is what we cannot have.",
  },
  {
    number: 4,
    name: "The Instrument",
    summary: "A mark modelled on precision instrument branding.",
    concept:
      "Takes its cues from the marks stamped on calipers, gauges and machine tools: a compact, enclosed, slightly heavy symbol that reads as a maker's stamp rather than a logo.",
    visualPrinciple:
      "Containment and weight. A bounded form with a heavy consistent stroke, designed to be stamped or engraved.",
    rationale:
      "Directly delivers the 'precision instrument manufacturer' feeling the brief names as the target, and the stamped-mark construction is inherently durable at every size.",
    visualKeywords: ["stamped", "enclosed", "weighted", "engraved", "compact", "durable"],
    symbolConcepts: [
      "An N inside a chamfered square, cut as a single stamp",
      "A circular maker's mark with an N formed in negative space",
      "A hexagonal bolt-head silhouette with an orthogonal N knocked out",
    ],
    typography: "Industrial grotesque, medium-to-bold, generously spaced beneath the stamp.",
    colorApproach: "Single colour by construction. Works stamped, engraved, or embroidered.",
    strengths: [
      "Outstanding physical reproduction — the hardest constraint in the brief",
      "Reads as permanent and manufactured",
      "Works as a Slack icon and favicon with no modification",
    ],
    risks: [
      "Enclosed marks can feel conservative or heritage-heavy",
      "Hexagon variants must be handled carefully given the brief's explicit prohibition",
    ],
    differentiation:
      "No AI competitor uses a stamped maker's mark; the convention belongs to manufacturing.",
    status: "approved",
    favorite: true,
    editedByUser: false,
  },
  {
    number: 5,
    name: "Aurora Interval",
    summary: "A wordmark-led system with one modified letterform.",
    concept:
      "No symbol at first. The identity lives in the wordmark, where a single letter carries a precise, deliberate modification — a cut, a shortened stroke, a shifted counter — that becomes the ownable asset and can later be extracted as a standalone mark.",
    visualPrinciple: "Minimum intervention. One change, executed exactly, and nothing else.",
    rationale:
      "The most restrained option available, and restraint is what the brief asks for. It also sidesteps the symbol-cliche problem entirely.",
    visualKeywords: ["wordmark", "intervention", "cut", "restraint", "typographic"],
    symbolConcepts: [
      "The X of Nexora cut from two chamfered blocks",
      "The O replaced by a precisely bored aperture",
      "The N's diagonal shortened to leave a deliberate gap",
    ],
    typography: "The identity is the typography — a custom-modified neo-grotesque.",
    colorApproach: "Ink on white. Colour plays no role in the idea.",
    strengths: [
      "Extremely hard to look generic",
      "Ages well",
      "Scales perfectly in digital contexts",
    ],
    risks: [
      "Fails the standalone-symbol requirement until a mark is extracted",
      "Embroidery and hard hat stickers need a symbol the wordmark alone cannot provide",
    ],
    differentiation: "Closest to Palantir's approach, which the brief flags as territory to avoid.",
    status: "rejected",
    favorite: false,
    editedByUser: false,
    note: "They explicitly need a standalone symbol for embroidery. This cannot satisfy the requirement.",
  },
  {
    number: 6,
    name: "Load Path",
    summary: "Structural forces made into a symbol.",
    concept:
      "Draws on structural engineering diagrams — how load travels through a frame — reduced to a small set of weighted strokes where thickness indicates force. Abstract, but derived from a real engineering principle.",
    visualPrinciple: "Weighted strokes on a rigid frame; thickness carries meaning.",
    rationale:
      "Communicates structural rigour and gives the designer a rule for why each stroke is the weight it is.",
    visualKeywords: ["structural", "weighted", "frame", "force", "braced"],
    symbolConcepts: [
      "An N as a braced frame with a thickened diagonal",
      "A truss triangle with one member emphasised",
      "Three verticals of graduated weight under a single beam",
    ],
    typography: "Grotesque with a slightly mechanical character.",
    colorApproach: "Monochrome; weight does the work colour normally would.",
    strengths: ["Meaningful construction rule", "Distinctive", "Strong at medium sizes"],
    risks: [
      "Variable stroke weights are the first thing to fail in embroidery",
      "Risks reading as a construction or civil engineering firm",
    ],
    differentiation: "Unused in the AI category.",
    status: "new",
    favorite: false,
    editedByUser: false,
  },
  {
    number: 7,
    name: "Registered Mark",
    summary: "Two forms in exact alignment.",
    concept:
      "Two simple geometric elements locked into precise registration, the way printing plates or machined parts align. The idea is fit — Nexora slotting exactly into an existing operation rather than replacing it.",
    visualPrinciple: "Two parts, one precise join. The join is the mark.",
    rationale:
      "Expresses the firm's actual positioning — embedding into what already exists — and does so with the minimum possible number of elements.",
    visualKeywords: ["registration", "interlock", "join", "alignment", "pair"],
    symbolConcepts: [
      "Two chamfered blocks meeting on a single diagonal to imply an N",
      "A square with a precisely offset square removed and re-seated",
      "Interlocking brackets forming a closed unit",
    ],
    typography: "Even-weight grotesque, letterspaced to echo the symbol's join.",
    colorApproach: "Ink plus one accent to distinguish the two parts where useful.",
    strengths: [
      "Very simple silhouette",
      "Directly on-strategy",
      "Excellent physical reproduction",
    ],
    risks: [
      "Interlocking shapes are common in B2B identity",
      "Could read as a merger or partnership mark",
    ],
    differentiation: "Execution must be sharp to avoid generic interlock territory.",
    status: "approved",
    favorite: false,
    editedByUser: false,
  },
  {
    number: 8,
    name: "Null Aperture",
    summary: "A precisely bored opening in a solid form.",
    concept:
      "A solid, heavy geometric form with a single opening cut through it with evident precision. The mark is about what has been removed — the aperture is the identity, the solid is the context.",
    visualPrinciple: "Subtraction. One cut, perfectly placed, in an otherwise plain solid.",
    rationale:
      "Maximum weight and simplicity, which is exactly what embroidery and small sizes reward, while the negative space keeps it from being a plain block.",
    visualKeywords: ["aperture", "bore", "solid", "negative space", "cut", "heavy"],
    symbolConcepts: [
      "A solid square with an N-shaped slot milled through it",
      "A heavy ring with one flat machined onto its edge",
      "A block with a chamfered rectangular aperture off-centre",
    ],
    typography: "Heavy grotesque to match the symbol's mass, widely tracked.",
    colorApproach: "Single solid colour; the aperture carries the background through.",
    strengths: [
      "Best-in-class silhouette and small-size performance",
      "Very hard to look generic when the cut is specific",
      "Works reversed without modification",
    ],
    risks: [
      "Heavy solid marks can feel blunt or aggressive",
      "The aperture must be unmistakably deliberate or it reads as a mistake",
    ],
    differentiation: "Unlike anything in the competitive set, which is uniformly light and linear.",
    status: "new",
    favorite: false,
    editedByUser: false,
  },
];

export function buildDemoProject(): Project {
  const project = createProject({
    companyName: "Nexora",
    industry: "AI consulting for industrial operations",
    description: DISCOVERY_ANSWERS.what_it_does,
    client: {
      contactName: "Dana Okafor",
      company: "Nexora",
      email: "dana@nexora.example",
      notes: "Co-founder. Decisive, dislikes being shown more than four options.",
    },
  });

  const now = new Date();
  const at = (minutesAgo: number) =>
    new Date(now.getTime() - minutesAgo * 60_000).toISOString();

  /* Discovery — fully answered, including questions the AI would have added. */
  const extraKeys = [
    ["admired_brands", "Are there brands whose visual identity you admire?", "Reference points tell us what 'good' means to this client."],
    ["avoid_styles", "Are there visual styles you definitely want to avoid?", "Explicit prohibitions are the most useful input a brief can have."],
    ["usage_contexts", "Where will the logo be used?", "Physical reproduction constraints govern how much detail is survivable."],
    ["existing_equity", "Is there existing colour or typography that must be retained?", "Existing equity either constrains us or frees us entirely."],
    ["premium_vs_approachable", "Should this feel more premium or more approachable?", "This sets the weight, spacing and restraint of the whole system."],
    ["wordmark_or_symbol", "Does the mark need to work as a symbol on its own?", "A standalone symbol requirement rules out wordmark-only directions."],
    ["naming_note", "Does the name itself carry a meaning we should reflect?", "Coined names sometimes invite a literal mark — worth knowing if that is unwanted."],
  ] as const;

  const questions = [
    ...project.discovery.questions.map((q, i) => ({
      ...q,
      answer: DISCOVERY_ANSWERS[q.key] ?? q.answer,
      answeredAt: at(120 - i * 3),
    })),
    ...extraKeys.map(([key, question, why], i) => ({
      id: newId("q"),
      key,
      question,
      why,
      kind: "long" as const,
      required: false,
      order: project.discovery.questions.length + i,
      answer: DISCOVERY_ANSWERS[key],
      answeredAt: at(100 - i * 4),
    })),
  ];

  const constraints = [
    makeConstraint("negative", "No blue-to-violet gradients", "designer", "Discovery"),
    makeConstraint("negative", "No neural network node diagrams or circuit traces", "designer", "Discovery"),
    makeConstraint("negative", "No hexagon tech badges", "designer", "Discovery"),
    makeConstraint("positive", "Monochrome-first — the mark must work in one colour", "designer", "Discovery"),
    makeConstraint("positive", "Orthogonal or single-slope geometry, machined feeling", "designer", "Brand brief"),
    makeConstraint(
      "negative",
      'Avoid the "Signal Through Noise" territory: a dense field resolving into a single clear form',
      "rejection",
      "Rejected direction 3",
    ),
    makeConstraint(
      "negative",
      'Avoid the "Aurora Interval" territory: a wordmark-led system with one modified letterform',
      "rejection",
      "Rejected direction 5",
    ),
  ];

  const directions: CreativeDirection[] = DIRECTION_SEEDS.map((seed, i) => {
    const { note, ...rest } = seed;
    return {
      ...rest,
      id: newId("dir"),
      createdAt: at(60 - i),
      comments: note
        ? [
            {
              id: newId("cmt"),
              author: "designer" as const,
              body: note,
              createdAt: at(40),
            },
          ]
        : [],
    };
  });

  const demo: Project = {
    ...project,
    isDemo: true,
    createdAt: at(150),
    updatedAt: at(30),
    stage: "exploration",
    discovery: {
      status: "complete",
      questions,
      estimatedTotal: questions.length,
      sufficiencyReason:
        "The positioning, the audience's scepticism, the physical reproduction constraints and an unusually clear set of prohibitions are all established. That is enough to write a brief worth designing against.",
      additionalNotes:
        "Founders have seen and rejected two previous logo attempts from other agencies. Both were blue and both used a network motif.",
      lastAnalyzedAt: at(105),
    },
    brief: DEMO_BRIEF,
    briefApprovedAt: at(90),
    briefEditedByUser: true,
    directions,
    directionsGeneratedAt: at(62),
    feedbackMemory: { constraints },
    timeline: [
      { id: newId("evt"), at: at(150), kind: "system", title: "Project created", detail: "Nexora — AI consulting for industrial operations" },
      { id: newId("evt"), at: at(148), kind: "stage", stage: "discovery", title: "Discovery started" },
      { id: newId("evt"), at: at(105), kind: "ai", stage: "discovery", title: "Discovery complete", detail: `${questions.length} questions answered. Gemini judged the information sufficient to write a brief.` },
      { id: newId("evt"), at: at(98), kind: "ai", stage: "brief", title: "Brand brief generated", detail: "Synthesised from the full discovery interview." },
      { id: newId("evt"), at: at(93), kind: "decision", stage: "brief", title: "Brief edited", detail: "Colour direction tightened to rule out blue entirely." },
      { id: newId("evt"), at: at(90), kind: "decision", stage: "brief", title: "Brand brief approved" },
      { id: newId("evt"), at: at(62), kind: "ai", stage: "directions", title: "8 creative directions generated", detail: "Eight distinct creative territories developed from the approved brief." },
      { id: newId("evt"), at: at(40), kind: "decision", stage: "directions", title: "Directions 1, 2, 4 and 7 approved", detail: "Directions 3 and 5 rejected — both fail the standalone-symbol and embroidery requirements." },
    ],
  };

  return { ...demo, stageStates: computeStageStates(demo) };
}
