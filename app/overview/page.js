'use client';

import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { Button, Badge, Icon, StatusBadge, Compass, cx } from '@/components/ui';
import { saveProfile, BLANK_PROFILE, DEMO_PROFILE } from '@/lib/profile';

export default function OverviewPage() {
  const router = useRouter();

  function handleStart() {
    saveProfile(BLANK_PROFILE);
    router.push('/onboarding');
  }

  function handleDemo() {
    saveProfile(DEMO_PROFILE);
    router.push('/result');
  }

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[1200px] mx-auto px-6 md:px-10 pt-10 md:pt-16 pb-24">
        {/* Hero */}
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-7">
            <Badge tone="navy" className="mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-navy mr-1" />
              MVP · curated data for 10 German universities
            </Badge>
            <h1
              className="text-ink-90 leading-[1.02] text-[52px] md:text-[72px]"
              style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
            >
              Chart your course to a
              <br />
              <span className="italic text-navy">German bachelor&apos;s.</span>
            </h1>
            <p className="mt-6 text-[17px] leading-[1.55] text-ink-70 max-w-[560px]">
              Check if your qualification is recognised in Germany and explore curated bachelor&apos;s programs —
              with plain-English next steps for APS, Studienkolleg, and uni-assist.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={handleStart} icon={<Icon name="arrowRight" size={16} />}>
                Start your profile
              </Button>
              <Button size="lg" variant="secondary" onClick={handleDemo}>
                Explore demo data
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-ink-50">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="check" size={13} /> Up-to-date
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="check" size={13} /> Manually curated
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="check" size={13} /> anabin-style logic
              </span>
            </div>
          </div>

          <div className="md:col-span-5 md:mt-4">
            <PreviewCard />
          </div>
        </div>

        {/* How it works */}
        <section className="mt-24 md:mt-32">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-[11.5px] uppercase tracking-[0.18em] text-ink-40 mb-2">How it works</div>
              <h2
                className="text-[32px] md:text-[38px] text-ink-90 leading-tight"
                style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}
              >
                Three steps, one afternoon.
              </h2>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                n: '01',
                t: 'Add your background',
                d: 'Country, qualification, grade, language tests. Five minutes, no account.',
                icon: 'user',
              },
              {
                n: '02',
                t: 'Check recognition',
                d: 'We map your profile to anabin-style rules — H+, H, H−, or flag it for manual review.',
                icon: 'gauge',
              },
              {
                n: '03',
                t: "Browse bachelor's courses",
                d: 'Filter by language, semester and NC. Open a course for full admission details.',
                icon: 'layers',
              },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-lg border border-line bg-white p-6 hover:border-navy/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-6">
                  <div
                    className="text-[11px] uppercase tracking-[0.18em] text-ink-40"
                    style={{ fontFeatureSettings: "'tnum'" }}
                  >
                    {s.n}
                  </div>
                  <div className="text-navy/70">
                    <Icon name={s.icon} size={18} />
                  </div>
                </div>
                <div
                  className="text-[22px] text-ink-90 mb-2 leading-tight"
                  style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}
                >
                  {s.t}
                </div>
                <div className="text-[13.5px] text-ink-60 leading-[1.55]">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

function PreviewCard() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-3 rounded-xl"
        style={{
          background: 'linear-gradient(145deg, oklch(0.95 0.02 85 / 0.7), oklch(0.98 0.005 85 / 0.2))',
        }}
      />
      <div className="relative rounded-xl border border-line bg-white shadow-[0_20px_40px_-20px_oklch(0.3_0.05_255/0.15)] overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.14_25)]" />
            <span className="h-2 w-2 rounded-full bg-[oklch(0.82_0.12_80)]" />
            <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.12_150)]" />
          </div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-40">Recognition</div>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-ink-40 mb-2">Result</div>
              <div
                className="text-[22px] text-ink-90 leading-tight"
                style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}
              >
                Direct university access
              </div>
              <div className="text-[12.5px] text-ink-60 mt-1">IB Diploma · 38 points · Germany</div>
            </div>
            <StatusBadge status="H+" size="lg" />
          </div>

          <div className="mt-5 pt-5 border-t border-line grid grid-cols-3 gap-3">
            {[
              { l: 'APS', v: 'Not required' },
              { l: 'Kolleg', v: 'Not required' },
              { l: 'Portal', v: 'uni-assist' },
            ].map((x) => (
              <div key={x.l}>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-40">{x.l}</div>
                <div className="text-[12.5px] text-ink-80 mt-1">{x.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3.5 bg-ink-5/50 border-t border-line flex items-center justify-between">
          <div className="text-[12px] text-ink-60">14 matching courses across 7 universities</div>
          <Icon name="arrowRight" size={14} className="text-ink-50" />
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-24 pt-8 border-t border-line flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-50">
      <div className="flex items-center gap-2">
        <Compass size={14} />
        <span>UniPirate · frontend MVP</span>
      </div>
      <div className="flex items-center gap-5">
        <span>Curated recognition data</span>
        <span>No affiliation with anabin, APS, or uni-assist</span>
      </div>
    </footer>
  );
}
