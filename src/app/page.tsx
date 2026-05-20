import { Hero } from "@/components/sections/Hero";
import { TrustBar } from "@/components/sections/TrustBar";
import { Specializations } from "@/components/sections/Specializations";
import { Solver } from "@/components/sections/Solver";
import { Vault } from "@/components/sections/Vault";
import { Toolkit } from "@/components/sections/Toolkit";
import { Workflow } from "@/components/sections/Workflow";
import { Community } from "@/components/sections/Community";
import { Stats } from "@/components/sections/Stats";
import { Pricing } from "@/components/sections/Pricing";
import { Testimonials } from "@/components/sections/Testimonials";
import { FAQ } from "@/components/sections/FAQ";
import { CTA } from "@/components/sections/CTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Stats />
      <Specializations />
      <Solver />
      <Workflow />
      <Vault />
      <Toolkit />
      <Community />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
