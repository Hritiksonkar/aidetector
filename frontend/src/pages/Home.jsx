import Hero from '../components/Hero.jsx';
import AnalyticsSection from '../components/home/AnalyticsSection.jsx';
import HowItWorks from '../components/home/HowItWorks.jsx';

export default function Home() {
    const container = 'mx-auto w-full max-w-7xl px-4';

    return (
        <div className="pb-12">
            <div className={container}>
                <div className="pt-8">
                    <Hero />
                    <AnalyticsSection />
                    <HowItWorks />
                </div>
            </div>
        </div>
    );
}
