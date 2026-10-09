import { LandingPage } from "@/components/landing/landing-page";
import { OmeraPreloaderGate } from "@/components/omera-preloader";

export default function Home() {
  return (
    <OmeraPreloaderGate>
      <LandingPage />
    </OmeraPreloaderGate>
  );
}
