import { getProductRepository } from "@/lib/catalog";
import { CategoryCards } from "@/components/sections/CategoryCards";
import { ContactSection } from "@/components/sections/ContactSection";
import { DeliverySection } from "@/components/sections/DeliverySection";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { Hero } from "@/components/sections/Hero";
import { LocationSection } from "@/components/sections/LocationSection";
import { SocialSection } from "@/components/sections/SocialSection";
import { WhySection } from "@/components/sections/WhySection";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export default async function HomePage() {
  const repo = getProductRepository();
  const [featured, categories] = await Promise.all([repo.featured(8), repo.categories()]);
  return (
    <>
      {/* Hero animates its own entrance (above-the-fold, no scroll-reveal needed). Everything below reveals
          once as it scrolls into view – section-level only, per the brief ("not everything should move"). */}
      <Hero />
      {/* Products first – a fashion retailer opens with the collection, not a menu of departments. */}
      <AnimatedSection>
        <FeaturedProducts products={featured} />
      </AnimatedSection>
      <AnimatedSection>
        <CategoryCards categories={categories} />
      </AnimatedSection>
      <AnimatedSection>
        <WhySection />
      </AnimatedSection>
      <AnimatedSection>
        <DeliverySection />
      </AnimatedSection>
      <AnimatedSection>
        <LocationSection />
      </AnimatedSection>
      <AnimatedSection>
        <SocialSection />
      </AnimatedSection>
      <AnimatedSection>
        <ContactSection />
      </AnimatedSection>
    </>
  );
}
