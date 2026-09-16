/**
 * SIGIL — core domain model.
 *
 * Everything the application knows about a branding engagement lives inside a
 * `Project`. The design history is append-only: concepts are never deleted by
 * the system, only re-statused. This is what makes "go backwards" safe.
 */

/* ------------------------------------------------------------------ */
/* Workflow stages                                                     */
/* ------------------------------------------------------------------ */

export const STAGE_IDS = [
  "discovery",
  "brief",
  "directions",
  "exploration",
  "selection",
  "refinement",
  "finalists",
  "client-review",
  "finalization",
  "delivery",
] as const;

export type StageId = (typeof STAGE_IDS)[number];

export type StageState =
  | "locked" // prerequisites not met
  | "available" // can be started
  | "in_progress" // work happening
  | "awaiting_review" // AI produced output, human decision needed
  | "complete";

export interface StageMeta {
  id: StageId;
  index: number;
  label: string;
  shortLabel: string;
  purpose: string;
  /** What the human is expected to decide here. */
  decision: string;
  requires: StageId[];
}

/* ------------------------------------------------------------------ */
/* Discovery                                                           */
/* ------------------------------------------------------------------ */

export type DiscoveryAnswerKind = "short" | "long" | "list" | "choice" | "scale";

export interface DiscoveryQuestion {
  id: string;
  /** Stable semantic key so the AI never re-asks something it already knows. */
  key: string;
  question: string;
  /** Shown to the user as "why am I being asked this". */
  why: string;
  kind: DiscoveryAnswerKind;
  options?: string[];
  placeholder?: string;
  required: boolean;
  /** Order in which the question was surfaced. */
  order: number;
  answer?: string;
  skipped?: boolean;
  answeredAt?: string;
  /** True when the question came from the initial seed set rather than the AI. */
  seeded?: boolean;
}

export interface DiscoverySession {
  status: "not_started" | "in_progress" | "sufficient" | "complete";
  questions: DiscoveryQuestion[];
  /** AI's rolling estimate of total questions needed. */
  estimatedTotal: number;
  /** AI's reason for stopping, shown to the user. */
  sufficiencyReason?: string;
  /** Free-form extra context the user volunteered. */
  additionalNotes: string;
  lastAnalyzedAt?: string;
}

export interface DiscoveryAnalysis {
  sufficient: boolean;
  reason: string;
  estimatedRemaining: number;
  gaps: string[];
  nextQuestions: Array<{
    key: string;
    question: string;
    why: string;
    kind: DiscoveryAnswerKind;
    options?: string[];
    placeholder?: string;
    required: boolean;
  }>;
}

/* ------------------------------------------------------------------ */
/* Brand brief                                                         */
/* ------------------------------------------------------------------ */

export interface BrandBrief {
  company: {
    name: string;
    industry: string;
    description: string;
    tagline?: string;
  };
  audience: {
    primary: string;
    secondary: string;
    context: string;
  };
  positioning: {
    represents: string;
    differentiates: string;
    competitors: string[];
    competitiveLandscape: string;
  };
  personality: string[];
  desiredPerception: {
    feel: string;
    attributes: string[];
    avoidFeeling: string[];
  };
  visualLanguage: {
    characteristics: string[];
    formLanguage: string;
    colorDirection: string;
    typographyDirection: string;
  };
  requirements: {
    practical: string[];
    mustRetain: string[];
    lockupNeeds: string[];
  };
  avoid: {
    cliches: string[];
    competitorSimilarities: string[];
    styles: string[];
  };
  usage: string[];
  strategicSummary: string;
}

export type BrandBriefSection = keyof BrandBrief;

/* ------------------------------------------------------------------ */
/* Creative directions                                                 */
/* ------------------------------------------------------------------ */

export type DirectionStatus = "new" | "approved" | "rejected";

export interface CreativeDirection {
  id: string;
  /** Display index, 1-based, stable for the life of the project. */
  number: number;
  name: string;
  /** One-line description. */
  summary: string;
  /** The core idea in a sentence or two. */
  concept: string;
  /** The underlying visual principle driving the form. */
  visualPrinciple: string;
  /** Why this fits this specific brand. */
  rationale: string;
  visualKeywords: string[];
  symbolConcepts: string[];
  typography: string;
  colorApproach: string;
  strengths: string[];
  risks: string[];
  differentiation: string;
  status: DirectionStatus;
  favorite: boolean;
  comments: Comment[];
  editedByUser: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Logo concepts                                                       */
/* ------------------------------------------------------------------ */

export type ConceptStatus =
  | "new"
  | "favorite"
  | "shortlisted"
  | "finalist"
  | "approved"
  | "rejected"
  | "archived";

export const CONCEPT_STATUSES: ConceptStatus[] = [
  "new",
  "favorite",
  "shortlisted",
  "finalist",
  "approved",
  "rejected",
  "archived",
];

export type LockupKind =
  | "primary"
  | "symbol"
  | "wordmark"
  | "horizontal"
  | "stacked"
  | "monochrome"
  | "reversed"
  | "small"
  | "favicon"
  | "secondary";

export interface GenerationMeta {
  model: string;
  aspectRatio: string;
  temperature?: number;
  /** The full prompt that produced the image. Never shown to clients. */
  prompt: string;
  /** Structured inputs the prompt engine used, for reproducibility. */
  inputs: Record<string, unknown>;
  generatedAt: string;
  durationMs?: number;
  attempt: number;
}

export interface ConceptAsset {
  kind: LockupKind;
  assetId: string;
  mimeType: string;
  meta: GenerationMeta;
  /** Set when the asset is a re-render rather than the original generation. */
  derivedFrom?: string;
}

export interface ConceptCritique {
  distinctiveness: CritiqueScore;
  memorability: CritiqueScore;
  scalability: CritiqueScore;
  legibility: CritiqueScore;
  symbolism: CritiqueScore;
  typography: CritiqueScore;
  balance: CritiqueScore;
  simplicity: CritiqueScore;
  reproduction: CritiqueScore;
  smallSize: CritiqueScore;
  blackAndWhite: CritiqueScore;
  summary: string;
  strengths: string[];
  concerns: string[];
  technicalProblems: string[];
  brandConfusionRisk: string;
  genericnessRisk: string;
  briefAlignment: string;
  /** Explicitly NOT a winner pick — observations only. */
  observations: string[];
  createdAt: string;
  model: string;
}

export interface CritiqueScore {
  /** 1-10. Presented as an observation, never as a ranking. */
  score: number;
  note: string;
}

export interface QualityCheckItem {
  question: string;
  verdict: "pass" | "caution" | "fail";
  note: string;
}

export interface QualityCheck {
  items: QualityCheckItem[];
  overallNote: string;
  createdAt: string;
  model: string;
}

export interface Comment {
  id: string;
  author: "designer" | "client" | "ai";
  authorName?: string;
  body: string;
  createdAt: string;
}

export interface LogoConcept {
  id: string;
  /** Human-facing code, e.g. "2A" or "2A.1". */
  code: string;
  name: string;
  directionId: string;
  description: string;
  /** Design rationale written by the AI. */
  rationale: string;
  /** The conceptual objective this concept was asked to explore. */
  objective: string;

  assets: ConceptAsset[];
  /** Asset id of the image the UI should show by default. */
  primaryAssetId?: string;

  parentConceptId?: string;
  iterationNumber: number;
  /** Root-to-here chain of concept ids, inclusive. */
  lineage: string[];

  status: ConceptStatus;
  rating: number; // 0 = unrated, 1-5
  comments: Comment[];
  critique?: ConceptCritique;
  qualityCheck?: QualityCheck;

  /** Designer-authored notes, never shown to the client. */
  notes: string;
  /** Whether this concept is included in the client presentation. */
  clientVisible: boolean;

  /** Typography treatment recorded separately — AI text is not trusted. */
  typography: TypographyTreatment;

  batchId?: string;
  generation: number;
  createdAt: string;
  updatedAt: string;
  /** Present when generation failed and the concept is a placeholder. */
  error?: string;
}

/** Image models frequently mangle text; we track wordmark trust explicitly. */
export interface TypographyTreatment {
  /** The exact, authoritative company name as typed by the human. */
  exactCompanyName: string;
  /** Whether the text inside the generated image is trustworthy. */
  renderedTextVerified: boolean;
  /** Human note, e.g. "logo says NEXORRA — needs rebuild". */
  issueNote?: string;
  fontRecommendations: FontRecommendation[];
  /** Asset id for a separately reconstructed wordmark, if built. */
  reconstructedWordmarkAssetId?: string;
}

export interface FontRecommendation {
  family: string;
  category: string;
  weight: string;
  why: string;
  pairing?: string;
  source?: string;
}

/* ------------------------------------------------------------------ */
/* Feedback memory                                                     */
/* ------------------------------------------------------------------ */

export type ConstraintPolarity = "positive" | "negative";

export interface Constraint {
  id: string;
  polarity: ConstraintPolarity;
  text: string;
  source: "designer" | "client" | "ai" | "rejection";
  /** Where it came from, e.g. "Rejected direction 3" or "Client feedback". */
  origin: string;
  active: boolean;
  createdAt: string;
}

export interface FeedbackMemory {
  constraints: Constraint[];
}

/* ------------------------------------------------------------------ */
/* Iteration                                                           */
/* ------------------------------------------------------------------ */

export interface IterationInstruction {
  /** What must be preserved from the parent. */
  preserve: string[];
  /** What must change. */
  change: string[];
  /** What must be removed entirely. */
  remove: string[];
  /** Directions to explore. */
  explore: string[];
  /** One-line summary of the intent, shown in the UI. */
  intent: string;
  /** New constraints to add to feedback memory. */
  newConstraints: Array<{ polarity: ConstraintPolarity; text: string }>;
}

/* ------------------------------------------------------------------ */
/* Client review                                                       */
/* ------------------------------------------------------------------ */

export type ClientDecision = "pending" | "approved" | "changes_requested";

export interface ClientFeedbackEntry {
  id: string;
  conceptId?: string;
  decision: ClientDecision;
  body: string;
  submittedAt: string;
  /** Gemini's structured reading of the raw feedback. */
  interpretation?: FeedbackInterpretation;
  interpretationStatus: "none" | "pending_review" | "approved" | "edited";
  processedAt?: string;
}

export interface FeedbackInterpretation {
  positive: string[];
  negative: string[];
  requestedChanges: string[];
  ambiguities: string[];
  suggestedActions: string[];
  sentiment: "positive" | "mixed" | "negative";
  summary: string;
}

export interface ClientReviewSession {
  /** Share token used by the client presentation route. */
  shareToken: string;
  published: boolean;
  publishedAt?: string;
  presentationTitle: string;
  presentationIntro: string;
  /** Concept ids, in presentation order. */
  conceptOrder: string[];
  feedback: ClientFeedbackEntry[];
  round: number;
}

/* ------------------------------------------------------------------ */
/* Approvals                                                           */
/* ------------------------------------------------------------------ */

export interface ApprovalRecord {
  approved: boolean;
  conceptId?: string;
  at?: string;
  by?: string;
  note?: string;
}

export interface Approvals {
  designer: ApprovalRecord;
  client: ApprovalRecord;
  final: ApprovalRecord;
}

/* ------------------------------------------------------------------ */
/* Finalization + brand kit                                            */
/* ------------------------------------------------------------------ */

export interface FinalizationPlan {
  colorStrategy: "retain_existing" | "new_palette" | "hybrid";
  existingColors: string[];
  needsTypographyPairing: boolean;
  needsSpacingRules: boolean;
  needsMinimumSize: boolean;
  needsUsageGuidelines: boolean;
  additionalNotes: string;
  confirmedAt?: string;
}

export interface ColorSwatch {
  name: string;
  hex: string;
  role: string;
  usage: string;
  contrastNote?: string;
}

export interface BrandKit {
  conceptId: string;
  palette: ColorSwatch[];
  typography: {
    primary: FontRecommendation;
    secondary: FontRecommendation;
    notes: string;
  };
  clearSpace: string;
  minimumSize: string;
  usageRules: string[];
  dos: string[];
  donts: string[];
  personality: string[];
  rationale: string;
  /** Explicit honesty about what is raster vs vector. */
  assetDisclosure: string;
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export type TimelineKind =
  | "stage"
  | "ai"
  | "decision"
  | "generation"
  | "client"
  | "system";

export interface TimelineEvent {
  id: string;
  at: string;
  kind: TimelineKind;
  stage?: StageId;
  title: string;
  detail?: string;
  /** Ids of things this event touched, for recovery. */
  refs?: string[];
}

/* ------------------------------------------------------------------ */
/* Generation jobs (batch runner)                                      */
/* ------------------------------------------------------------------ */

export type JobItemStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export interface JobItem {
  id: string;
  label: string;
  status: JobItemStatus;
  attempts: number;
  error?: string;
  conceptId?: string;
  /** Opaque payload the runner needs to (re)execute this item. */
  payload: Record<string, unknown>;
}

export type JobStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "completed_with_errors"
  | "cancelled";

export interface GenerationJob {
  id: string;
  projectId: string;
  kind: "exploration" | "iteration" | "finalist_lockups" | "delivery_assets";
  title: string;
  status: JobStatus;
  items: JobItem[];
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  /** Additional context needed to resume after a page refresh. */
  context: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Project                                                             */
/* ------------------------------------------------------------------ */

export type ProjectStatus = "active" | "archived" | "finalized";

export interface ClientInfo {
  contactName: string;
  company: string;
  email: string;
  notes: string;
}

export interface Project {
  id: string;
  companyName: string;
  industry: string;
  description: string;
  status: ProjectStatus;
  /** The stage the user is currently working in. */
  stage: StageId;
  stageStates: Record<StageId, StageState>;

  client: ClientInfo;

  discovery: DiscoverySession;
  brief?: BrandBrief;
  briefApprovedAt?: string;
  briefEditedByUser: boolean;

  directions: CreativeDirection[];
  directionsGeneratedAt?: string;

  concepts: LogoConcept[];

  feedbackMemory: FeedbackMemory;

  /** Concept ids promoted to finalists, in order. */
  finalistIds: string[];

  clientReview: ClientReviewSession;
  approvals: Approvals;

  finalization?: FinalizationPlan;
  brandKit?: BrandKit;

  timeline: TimelineEvent[];

  /** Per-project overrides of global generation settings. */
  generationSettings: Partial<GenerationSettings>;

  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/** Lightweight row for the dashboard — avoids loading every concept blob. */
export interface ProjectSummary {
  id: string;
  companyName: string;
  industry: string;
  status: ProjectStatus;
  stage: StageId;
  conceptCount: number;
  finalistCount: number;
  directionCount: number;
  approvedDirectionCount: number;
  progress: number; // 0..1
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  coverAssetId?: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface GenerationSettings {
  textModel: string;
  reasoningModel: string;
  imageModel: string;
  finalistImageModel: string;
  /** How many image requests run concurrently. */
  batchConcurrency: number;
  maxRetries: number;
  defaultDirectionCount: number;
  defaultConceptsPerDirection: number;
  defaultIterationCount: number;
  aspectRatio: string;
}

export interface AppSettings extends GenerationSettings {
  /** Optional user-supplied key, stored locally. Server env key is preferred. */
  apiKeyOverride: string;
  useServerKey: boolean;
  reduceMotion: boolean;
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export interface GeminiErrorShape {
  code: GeminiErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
  retryAfterMs?: number;
}

export type GeminiErrorCode =
  | "MISSING_KEY"
  | "INVALID_KEY"
  | "RATE_LIMIT"
  | "QUOTA"
  | "TIMEOUT"
  | "NETWORK"
  | "INVALID_MODEL"
  | "SAFETY_BLOCK"
  | "NO_IMAGE"
  | "INVALID_OUTPUT"
  | "SERVER_ERROR"
  | "CANCELLED"
  | "UNKNOWN";
