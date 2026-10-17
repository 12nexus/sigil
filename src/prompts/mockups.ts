import type { MockupSurface } from "@/types";

/**
 * Mockup boards.
 *
 * A logo is judged on a white canvas but lives on paper, ceramic, glass and
 * walls. Each surface below is photographed with the concept's own artwork as
 * the reference image, so the board answers "what does this mark look like
 * out in the world" before anyone commits to it.
 */

export interface MockupSurfaceMeta {
  id: MockupSurface;
  label: string;
  /** What the scene shows, written for the image model. */
  scene: string;
  /**
   * How the mark is applied. Tone-on-tone treatments may drop colour; every
   * other surface keeps the logo's colours exactly.
   */
  treatment: "full_colour" | "tone_on_tone";
}

export const MOCKUP_SURFACES: MockupSurfaceMeta[] = [
  {
    id: "emboss",
    label: "Embossed paper",
    scene:
      "A close, slightly angled view of thick textured grey card stock. The logo is blind-embossed into the paper as raised white relief, with soft raking light from the top left so the edges of the relief catch highlights and cast fine shadows.",
    treatment: "tone_on_tone",
  },
  {
    id: "print",
    label: "Printed paper",
    scene:
      "A close, slightly angled view of textured light-grey recycled paper. The logo is printed on it in its original colours with a subtle letterpress impression, soft natural daylight.",
    treatment: "full_colour",
  },
  {
    id: "business_cards",
    label: "Business cards",
    scene:
      "Two white business cards on a deep navy surface, one lying flat and one tilted on top of it, photographed from above at an angle. The upper card's front shows the logo centred. The lower card shows the logo small in a corner beside a few short lines of tiny, unreadable placeholder contact text. Soft studio light, realistic paper thickness and shadows.",
    treatment: "full_colour",
  },
  {
    id: "mug",
    label: "Coffee mug",
    scene:
      "A glossy white ceramic coffee mug standing on a reflective blue-grey surface against a soft gradient background. The logo is printed on the side of the mug facing the camera, following the curve of the ceramic, with gentle reflections.",
    treatment: "full_colour",
  },
  {
    id: "office_wall",
    label: "Office wall sign",
    scene:
      "A minimalist executive office with a dark charcoal wall. The logo is mounted on the wall as dimensional 3D lettering with a slight satin finish, lit from above so it casts soft shadows on the wall. Below it, a white desk with a black desk lamp, a closed laptop and a black leather office chair.",
    treatment: "full_colour",
  },
  {
    id: "building",
    label: "Building signage",
    scene:
      "The upper corner of a modern office building with glass curtain walls and charcoal cladding, photographed from street level looking up on a bright day. The logo is mounted high on the cladding as large dimensional channel-letter signage.",
    treatment: "full_colour",
  },
  {
    id: "glass_wall",
    label: "Glass partition",
    scene:
      "A modern meeting room seen through a glass partition, with cool blue-toned lighting and an out-of-focus conference table behind. The logo is applied to the glass at eye level as crisp vinyl, its colours intact, with faint reflections across the glass.",
    treatment: "full_colour",
  },
  {
    id: "stationery",
    label: "Stationery set",
    scene:
      "A flat-lay stationery set on a light grey surface, photographed from above at a slight angle: a letterhead sheet with the logo in its top corner, a DL envelope with the logo on its flap, a white business card and a dark business card, each carrying the logo. Any body text is tiny, blurred placeholder lines that cannot be read.",
    treatment: "full_colour",
  },
];

export const MOCKUP_SURFACE_BY_ID: Record<MockupSurface, MockupSurfaceMeta> = Object.fromEntries(
  MOCKUP_SURFACES.map((s) => [s.id, s]),
) as Record<MockupSurface, MockupSurfaceMeta>;

/** Mockups are scenes, not marks: landscape suits every surface above. */
export const MOCKUP_ASPECT_RATIO = "4:3";

export function buildMockupPrompt(surface: MockupSurface, exactCompanyName: string): string {
  const meta = MOCKUP_SURFACE_BY_ID[surface];
  const colour =
    meta.treatment === "tone_on_tone"
      ? "On this surface the logo is rendered tone-on-tone, so its colours may be dropped, but every shape, proportion and letter must still match the reference exactly."
      : "Keep the logo's colours exactly as they are in the reference.";

  return [
    "The attached image is a finished logo. Produce a photorealistic brand mockup photograph that shows this exact logo applied to a real surface.",
    "",
    `Scene: ${meta.scene}`,
    "",
    "Logo fidelity — this matters more than anything else:",
    "- Reproduce the logo exactly as supplied: identical shapes, proportions, spacing and arrangement. Do not redraw, restyle, simplify or \"improve\" it.",
    `- Any text in the logo must read exactly "${exactCompanyName}", letter for letter, as it appears in the reference.`,
    `- ${colour}`,
    "- Apply only the mark itself. The reference image's background must not appear as a box, sticker or panel around the logo.",
    "- The logo sits on the material naturally: it follows the surface's curvature and perspective and takes the lighting, texture and finish of the material (relief, ink, vinyl, metal).",
    "",
    "Do not add any other logos, brand names, captions, watermarks or readable text. Commercial product photography, realistic materials and lighting, sharp focus on the logo.",
  ].join("\n");
}
