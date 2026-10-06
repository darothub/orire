/**
 * orire — landing testimonials (social proof).
 *
 * Short, specific quotes that mirror the product's real promise: re-branding a
 * CV, tailoring to a role, comparing assistants and trusting the deterministic
 * score. Kept as pure data so the copy is reviewable in one place and testable
 * in the node env with no DOM. Names are illustrative personas, not real
 * individuals.
 */

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** Uppercase first initial, used for the avatar chip. */
  initial: string;
}

const PEOPLE: Omit<Testimonial, "initial">[] = [
  {
    quote:
      "I uploaded a messy five-page PDF and had an elegant, one-page CV in minutes. Two interviews that same week.",
    name: "Amara N.",
    role: "Product Designer",
  },
  {
    quote:
      "Running two assistants side by side and letting the judge pick was the moment it clicked. I could see why one draft was stronger.",
    name: "Daniel K.",
    role: "Backend Engineer",
  },
  {
    quote:
      "The deterministic score kept me honest — I watched it climb as I tightened each bullet against the job description.",
    name: "Priya R.",
    role: "Data Analyst",
  },
  {
    quote:
      "No star bars, no clipart — finally a template that looks like I actually belong at the companies I'm applying to.",
    name: "Tomiwa A.",
    role: "Marketing Lead",
  },
];

/** Build the testimonials with a derived avatar initial. */
export function testimonials(): Testimonial[] {
  return PEOPLE.map((p) => ({
    ...p,
    initial: p.name.trim().charAt(0).toUpperCase(),
  }));
}
