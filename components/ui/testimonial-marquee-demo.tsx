"use client";

import {
  TestimonialMarquee,
  type Testimonial,
} from "@/components/ui/testimonial-marquee";
import { reviews } from "@/src/data/reviews";

const testimonials: Testimonial[] = reviews;

export default function TestimonialMarqueeDemo() {
  return (
    <div className="w-full py-10">
      <TestimonialMarquee items={testimonials} speed={30} />
    </div>
  );
}
