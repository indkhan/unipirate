"use client"

import { useRouter } from "next/navigation"
import { useProfile } from "@/components/profile-provider"
import { SiteHeader } from "@/components/site-header"
import { data, hasDataset } from "@/lib/data"
import { blankProfile, type Profile } from "@/lib/profile"
import {
  Badge,
  Button,
  Chip,
  Compass,
  Field,
  Icon,
  type IconName,
  Segmented,
  Select,
  Stepper,
  TextInput,
  StatusBadge,
} from "@/components/ui"

export function Landing() {
    const router = useRouter()
    const { setProfile } = useProfile()

    const startProfile = () => {
      setProfile(blankProfile)
      router.push("/profile")
    }

    return (
      <div className="min-h-screen bg-paper">
        <SiteHeader />
        <main className="max-w-[1200px] mx-auto px-6 md:px-10 pt-10 md:pt-16 pb-24">
          {/* Hero */}
          <div className="grid md:grid-cols-12 gap-10 items-start">
            <div className="md:col-span-7">
              <Badge tone="navy" className="mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-navy mr-1" />
                {hasDataset
                  ? `MVP · curated data for ${data.universities.length} German universities`
                  : "UI shell · dataset not configured"}
              </Badge>
              <h1
                className="font-display text-ink-90 leading-[1.02] tracking-[-0.02em] text-[52px] md:text-[72px]"
              >
                Chart your course to a
                <br />
                <span className="italic text-navy">German bachelor's.</span>
              </h1>
              <p className="mt-6 text-[17px] leading-[1.55] text-ink-70 max-w-[560px]">
                Check if your qualification is recognised in Germany and explore curated bachelor's programs —
                with plain-English next steps for APS, Studienkolleg, and uni-assist.
              </p>
  
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={startProfile} icon={<Icon name="arrowRight" size={16} />}>
                  Start your profile
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => router.push("/recognition")}
                  disabled={!hasDataset}
                >
                  {hasDataset ? "Explore demo data" : "Demo data unavailable"}
                </Button>
              </div>
  
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-ink-50">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="check" size={13} /> No sign-up
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="check" size={13} /> Manually curated
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="check" size={13} /> anabin-style logic
                </span>
              </div>
            </div>
  
            {/* Right — preview card */}
            <div className="md:col-span-5 md:mt-4">
              <PreviewCard />
            </div>
          </div>
  
          {/* 3-step explainer */}
          <section className="mt-24 md:mt-32">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="text-[11.5px] uppercase tracking-[0.18em] text-ink-40 mb-2">How it works</div>
                <h2
                  className="font-display text-[32px] md:text-[38px] text-ink-90 leading-tight tracking-[-0.01em]"
                >
                  Three steps, one afternoon.
                </h2>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {([
                {
                  n: "01",
                  t: "Add your background",
                  d: "Country, qualification, grade, language tests. Five minutes, no account.",
                  icon: "user",
                },
                {
                  n: "02",
                  t: "Check recognition",
                  d: "We map your profile to anabin-style rules — H+, H, H−, or flag it for manual review.",
                  icon: "gauge",
                },
                {
                  n: "03",
                  t: "Browse bachelor's courses",
                  d: "Filter by language, semester and NC. Open a course for full admission details.",
                  icon: "layers",
                },
              ] as Array<{ n: string; t: string; d: string; icon: IconName }>).map((s) => (
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
                    className="font-display text-[22px] text-ink-90 mb-2 leading-tight tracking-[-0.01em]"
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
            background:
              "linear-gradient(145deg, oklch(0.95 0.02 85 / 0.7), oklch(0.98 0.005 85 / 0.2))",
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
                  className="font-display text-[22px] text-ink-90 leading-tight tracking-[-0.01em]"
                >
                  Direct university access
                </div>
                <div className="text-[12.5px] text-ink-60 mt-1">IB Diploma · 38 points · Germany</div>
              </div>
              <StatusBadge status="H+" size="lg" />
            </div>
  
            <div className="mt-5 pt-5 border-t border-line grid grid-cols-3 gap-3">
              {[
                { l: "APS", v: "Not required" },
                { l: "Kolleg", v: "Not required" },
                { l: "Portal", v: "uni-assist" },
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
          <span>Typed recognition data</span>
          <span>No affiliation with anabin, APS, or uni-assist</span>
        </div>
      </footer>
    );
  }
  
  // =================== ONBOARDING ===================
  
  export function Onboarding() {
    const router = useRouter()
    const { profile, setProfile } = useProfile()
    const {
      countries,
      qualificationsByCountry,
      gradingScales,
      languageCertificates,
    } = data
  
    const update = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch })
    const country = profile.country;
    const availableQuals = country ? qualificationsByCountry[country] || [] : [];
  
    const canSubmit =
      profile.country && profile.qualification && profile.grade !== "" && profile.gradingScale && profile.languageCert;
  
    return (
      <div className="min-h-screen bg-paper">
        <SiteHeader />
        <main className="max-w-[920px] mx-auto px-6 md:px-10 pt-10 pb-24">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
            <div>
              <Button variant="ghost" size="sm" onClick={() => router.push("/")} icon={<Icon name="arrowLeft" size={14} />}>
                Back
              </Button>
              <h1
                className="font-display text-[40px] md:text-[48px] text-ink-90 leading-[1.05] tracking-[-0.02em] mt-3"
              >
                Tell us about your background.
              </h1>
              <p className="text-ink-60 mt-2 max-w-[560px] text-[14.5px] leading-[1.55]">
                We use this to match against a curated set of anabin-style rules. Nothing is stored on a server.
              </p>
            </div>
            <Stepper steps={["Profile", "Recognition", "Courses"]} current={0} />
          </div>
  
          <div className="rounded-xl border border-line bg-white p-6 md:p-8">
            {!hasDataset && (
              <div className="mb-7 rounded-lg border border-navy/15 bg-navy/[0.035] px-4 py-3 text-[13px] text-ink-70">
                The admissions dataset is not configured yet. The form is shown as a UI preview.
              </div>
            )}
            {/* Section 1 */}
            <SectionHeader n="01" title="Education" subtitle="Where and what you studied." />
            <div className="grid md:grid-cols-2 gap-5">
              <Field label="Country of education" required hint="Where you earned your most recent qualification.">
                <Select
                  value={profile.country}
                  onChange={(v) => update({ country: v, qualification: "" })}
                  options={countries}
                  placeholder="Select a country"
                />
              </Field>
              <Field
                label="Qualification type"
                required
                hint={country ? "Pick the closest match." : "Select a country first."}
              >
                <Select
                  value={profile.qualification}
                  onChange={(v) => update({ qualification: v })}
                  options={availableQuals}
                  placeholder={country ? "Select a qualification" : "—"}
                />
              </Field>
              <Field label="Grade / percentage" required hint="Your overall result, as a number.">
                <TextInput
                  type="number"
                  value={profile.grade}
                  onChange={(v) => update({ grade: v })}
                  placeholder="e.g. 78"
                  suffix={inferSuffix(profile.gradingScale)}
                />
              </Field>
              <Field label="Grading scale" required hint="Matches your result to a German equivalent.">
                <Select
                  value={profile.gradingScale}
                  onChange={(v) => update({ gradingScale: v })}
                  options={gradingScales}
                  placeholder="Select scale"
                />
              </Field>
            </div>
  
            <Divider />
  
            {/* Section 2 */}
            <SectionHeader n="02" title="Language" subtitle="Which tests have you taken, or plan to?" />
            <div className="grid md:grid-cols-2 gap-5">
              <Field label="Primary language certificate" required>
                <div className="flex flex-wrap gap-2">
                  {languageCertificates.map((c) => (
                    <Chip
                      key={c}
                      active={profile.languageCert === c}
                      onClick={() => update({ languageCert: c })}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field
                label="Score"
                hint={scoreHint(profile.languageCert)}
                optional={profile.languageCert === "None / planning to take"}
              >
                <TextInput
                  value={profile.languageScore}
                  onChange={(v) => update({ languageScore: v })}
                  placeholder={scorePlaceholder(profile.languageCert)}
                />
              </Field>
            </div>
  
            <Divider />
  
            {/* Section 3 */}
            <SectionHeader n="03" title="Target" subtitle="What you're applying for." />
            <div className="grid md:grid-cols-2 gap-5">
              <Field label="Target degree level" hint="MVP supports bachelor's only.">
                <Segmented
                  value="Bachelor's"
                  onChange={() => {}}
                  options={["Bachelor's", { value: "ms", label: "Master's (soon)" }]}
                />
              </Field>
              <Field label="Preferred instruction language" hint="We'll emphasize matching programs later.">
                <Segmented
                  value={profile.prefLanguage || "Any"}
                  onChange={(v) => update({ prefLanguage: v as Profile["prefLanguage"] })}
                  options={["Any", "German", "English"]}
                />
              </Field>
            </div>
  
            <div className="flex items-center justify-between pt-8 mt-2 border-t border-line">
              <div className="text-[12px] text-ink-50 leading-snug max-w-[360px]">
                Tip: you can come back and adjust your profile anytime — recognition updates live.
              </div>
              <Button
                size="lg"
                onClick={() => router.push("/recognition")}
                disabled={!canSubmit}
                icon={<Icon name="arrowRight" size={16} />}
              >
                Check recognition
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  function SectionHeader({
    n,
    title,
    subtitle,
  }: {
    n: string
    title: string
    subtitle: string
  }) {
    return (
      <div className="flex items-baseline gap-4 mb-5">
        <span
          className="text-[12px] uppercase tracking-[0.18em] text-ink-40"
          style={{ fontFeatureSettings: "'tnum'" }}
        >
          {n}
        </span>
        <div>
          <div
            className="font-display text-[20px] text-ink-90 leading-tight"
          >
            {title}
          </div>
          <div className="text-[12.5px] text-ink-50">{subtitle}</div>
        </div>
      </div>
    );
  }
  
  function Divider() {
    return <div className="my-8 border-t border-line" />;
  }
  
  function inferSuffix(scale: string) {
    if (!scale) return "";
    if (scale.startsWith("Percentage")) return "%";
    if (scale.startsWith("CGPA out of 10")) return "/ 10";
    if (scale.startsWith("CGPA out of 4")) return "/ 4";
    if (scale.startsWith("German")) return "/ 6.0";
    if (scale.startsWith("IB")) return "/ 45";
    return "";
  }
  
  function scoreHint(cert: string) {
    if (!cert) return null;
    return (
      {
        IELTS: "Overall band, e.g. 6.5",
        "TOEFL (iBT)": "Total score, e.g. 95",
        TestDaF: "Per section, e.g. 4×4",
        DSH: "Level, e.g. DSH-2",
        "None / planning to take": "You can still continue.",
      }[cert] || null
    );
  }
  
  function scorePlaceholder(cert: string) {
    return (
      {
        IELTS: "6.5",
        "TOEFL (iBT)": "95",
        TestDaF: "4×4",
        DSH: "DSH-2",
        "None / planning to take": "—",
      }[cert] || "Score"
    );
  }
  
  
