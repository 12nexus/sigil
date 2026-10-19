import { MOCKUP_SURFACES } from "@/prompts/mockups";
import type { ConceptMockup, LogoConcept } from "@/types";

/** A mockup made from artwork the concept has since replaced. */
export function isStale(concept: LogoConcept, mockup: ConceptMockup): boolean {
  return Boolean(mockup.derivedFrom && mockup.derivedFrom !== concept.primaryAssetId);
}

/**
 * The mockups that show the concept as it is now, in board order. These are what the client
 * sees: a mockup of older artwork would show them a logo they are not being asked to approve.
 */
export function currentMockups(concept: LogoConcept): ConceptMockup[] {
  return MOCKUP_SURFACES.flatMap((s) => {
    const mockup = concept.mockups?.find((m) => m.surface === s.id);
    return mockup && !isStale(concept, mockup) ? [mockup] : [];
  });
}
