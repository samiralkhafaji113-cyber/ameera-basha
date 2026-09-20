import { getProductRepository } from "@/lib/catalog";
import { CategoryCards } from "@/components/sections/CategoryCards";
import { ContactSection } from "@/components/sections/ContactSection";
import { DeliverySection } from "@/components/sections/DeliverySection";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { Hero } from "@/components/sections/Hero";
import { LocationSection } from "@/components/sections/LocationSection";
import { SocialSection } from "@/components/sections/SocialSection";
import { WhySection } from "@/components/sections/WhySection";

export default async function HomePage() {
  const repo = getProductRepository();
  const [featured, categories] = await Promise.all([repo.featured(8), repo.categories()]);
  return (
    <>
      <Hero />
      <CategoryCards categories={categories} />
      <FeaturedProducts products={featured} />
      <WhySection />
      <DeliverySection />
      <LocationSection />
      <SocialSection />
      <ContactSection />
    </>
  );
}
