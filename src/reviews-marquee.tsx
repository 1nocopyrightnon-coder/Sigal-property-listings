import { createRoot } from "react-dom/client";
import {
  TestimonialMarquee,
  type TestimonialMarqueeProps,
} from "@/components/ui/testimonial-marquee";
import { reviews } from "@/src/data/reviews";
import "./index.css";

const VARIANTS: TestimonialMarqueeProps["variant"][] = [
  "default",
  "stacked",
  "dual",
  "flush",
  "flush-dual",
];

function mount() {
  document.querySelectorAll("[data-reviews-marquee]").forEach((node) => {
    const el = node as HTMLElement;
    if (el.dataset.mounted === "true") return;
    el.dataset.mounted = "true";
    const raw = el.getAttribute("data-variant") || "default";
    const variant = VARIANTS.includes(raw as TestimonialMarqueeProps["variant"])
      ? (raw as TestimonialMarqueeProps["variant"])
      : "default";
    createRoot(el).render(
      <TestimonialMarquee items={reviews} speed={167} variant={variant} />,
    );
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
