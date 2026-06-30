"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useProfile } from "@/components/profile-provider"
import {
  data,
  type ActionLink,
  type RecognitionRule,
  type RecognitionStatus,
} from "@/lib/data"
import type { Profile } from "@/lib/profile"
import { SiteHeader } from "@/components/site-header"
import { Badge, type BadgeTone, Button, Icon, type IconName, StatusBadge, Stepper } from "@/components/ui"

function matchRecognition(profile: Profile, rules: RecognitionRule[]) {
    if (!profile.country || !profile.qualification) return null;
    // Exact match on country + qualification
    let rule = rules.find(
      (r) => r.country === profile.country && r.qualificationType === profile.qualification
    );
    if (rule) return rule;
    // Fallback: country-any
    rule = rules.find((r) => r.country === profile.country && r.qualificationType === "Any");
    if (rule) return rule;
    // Fallback: generic unclear
    return rules.find((r) => r.country === "Other / Not listed") || null;
  }
  
  export function RecognitionResult() {
    const router = useRouter()
    const { profile } = useProfile()
    const rule = matchRecognition(profile, data.recognitionRules)
  
    if (!rule) {
      return (
        <div className="min-h-screen bg-paper">
          <SiteHeader />
          <main className="max-w-[920px] mx-auto px-6 py-16 text-center text-ink-60">
            Please complete your profile first.
            <div className="mt-4">
              <Button onClick={() => router.push("/profile")}>Go to profile</Button>
            </div>
          </main>
        </div>
      );
    }
  
    const tone: BadgeTone =
      rule.status === "H+"
        ? "emerald"
        : rule.status === "H"
        ? "amber"
        : rule.status === "H-"
        ? "coral"
        : "slate";
  
    const statusTitle = (
      {
        "H+": "Direct access",
        H: "Conditional recognition",
        "H-": "Not sufficient on its own",
        UNCLEAR: "Manual check recommended",
      } satisfies Record<RecognitionStatus, string>
    )[rule.status]
  
    return (
      <div className="min-h-screen bg-paper">
        <SiteHeader />
        <main className="max-w-[1040px] mx-auto px-6 md:px-10 pt-10 pb-24">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
            <div>
              <Button variant="ghost" size="sm" onClick={() => router.push("/profile")} icon={<Icon name="arrowLeft" size={14} />}>
                Edit profile
              </Button>
              <h1
                className="font-display text-[40px] md:text-[48px] text-ink-90 leading-[1.05] tracking-[-0.02em] mt-3"
              >
                Your recognition result.
              </h1>
            </div>
            <Stepper steps={["Profile", "Recognition", "Courses"]} current={1} />
          </div>
  
          {/* Summary card */}
          <div className="rounded-xl border border-line bg-white overflow-hidden">
            <div className="p-6 md:p-8 grid md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-8">
                <div className="flex items-center gap-3 mb-4">
                  <Badge tone={tone}>{statusTitle}</Badge>
                  <Badge tone="neutral">
                    <Icon name="globe" size={11} /> {profile.country}
                  </Badge>
                  <Badge tone="neutral">
                    <Icon name="book" size={11} /> {truncate(profile.qualification, 40)}
                  </Badge>
                </div>
                <div
                  className="font-display text-[30px] md:text-[36px] text-ink-90 leading-[1.1] tracking-[-0.015em]"
                >
                  {rule.headline}
                </div>
                <p className="mt-4 text-[14.5px] leading-[1.65] text-ink-70 max-w-[640px]">
                  {rule.explanation}
                </p>
              </div>
              <div className="md:col-span-4 flex md:justify-end">
                <div className="inline-flex flex-col items-center gap-3 p-5 rounded-lg border border-line bg-paper min-w-[180px]">
                  <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-40">Status code</div>
                  <StatusBadge status={rule.status} size="lg" />
                  <div className="text-[11.5px] text-ink-50 text-center leading-snug max-w-[160px]">
                    Curated from anabin-style rules · MVP dataset
                  </div>
                </div>
              </div>
            </div>
          </div>
  
          {/* Two-column blocks */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <InfoCard
              kicker="01"
              title="What this means"
              body={
                rule.status === "H+"
                  ? "You have direct university entrance qualification for bachelor's programs in Germany (subject to program-level admission)."
                  : rule.status === "H"
                  ? "You have conditional access — most programs will require an extra step like a Studienkolleg or a specific score threshold."
                  : rule.status === "H-"
                  ? "Your qualification on its own does not grant direct access. Plan for a Studienkolleg or an additional year of study."
                  : "Your combination isn't in our curated dataset. That doesn't rule you out — it means you should verify directly with anabin or uni-assist."
              }
            />
            <InfoCard
              kicker="02"
              title="Recommended actions"
              body={<ActionList links={rule.actionLinks} />}
            />
          </div>
  
          {/* Next steps */}
          <div className="rounded-xl border border-line bg-white p-6 md:p-8 mt-4">
            <div className="flex items-baseline gap-4 mb-5">
              <span
                className="text-[12px] uppercase tracking-[0.18em] text-ink-40"
                style={{ fontFeatureSettings: "'tnum'" }}
              >
                03
              </span>
              <div
                className="font-display text-[22px] text-ink-90"
              >
                Next steps
              </div>
            </div>
            <ol className="space-y-3">
              {rule.nextSteps.map((s, i) => (
                <li key={i} className="flex gap-4 items-start">
                  <span
                    className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-line bg-paper inline-flex items-center justify-center text-[11px] text-ink-60"
                    style={{ fontFeatureSettings: "'tnum'" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[14px] text-ink-80 leading-[1.6]">{s}</span>
                </li>
              ))}
            </ol>
          </div>
  
          <div className="mt-8 flex items-center justify-between flex-wrap gap-3">
            <div className="text-[12px] text-ink-50 max-w-[520px] leading-snug">
              This is an MVP recommendation based on curated rules. Always verify with the official anabin
              database and your target university before applying.
            </div>
            <Button size="lg" onClick={() => router.push("/courses")} icon={<Icon name="arrowRight" size={16} />}>
              Continue to course finder
            </Button>
          </div>
        </main>
      </div>
    );
  }
  
  function InfoCard({
    kicker,
    title,
    body,
  }: {
    kicker: string
    title: string
    body: ReactNode
  }) {
    return (
      <div className="rounded-xl border border-line bg-white p-6 md:p-8 h-full">
        <div className="flex items-baseline gap-4 mb-4">
          <span
            className="text-[12px] uppercase tracking-[0.18em] text-ink-40"
            style={{ fontFeatureSettings: "'tnum'" }}
          >
            {kicker}
          </span>
          <div className="font-display text-[22px] text-ink-90">
            {title}
          </div>
        </div>
        <div className="text-[14px] text-ink-70 leading-[1.65]">{body}</div>
      </div>
    );
  }
  
  function ActionList({ links }: { links: ActionLink[] }) {
    const kindIcon: Record<ActionLink["kind"], IconName> = {
      aps: "check",
      kolleg: "book",
      apply: "external",
      manual: "info",
    };
    const kindLabel: Record<ActionLink["kind"], string> = {
      aps: "APS info",
      kolleg: "Studienkolleg",
      apply: "Application portal",
      manual: "Manual check",
    };
    return (
      <div className="space-y-2">
        {links.map((l, i) => (
          <a
            key={i}
            href={l.href}
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper px-4 py-3 hover:border-navy/40 hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="h-7 w-7 rounded-md bg-navy/8 text-navy inline-flex items-center justify-center">
                <Icon name={kindIcon[l.kind]} size={14} />
              </span>
              <div>
                <div className="text-[13.5px] text-ink-90 font-medium">{l.label}</div>
                <div className="text-[11.5px] text-ink-50">{kindLabel[l.kind]}</div>
              </div>
            </div>
            <Icon name="external" size={14} className="text-ink-50" />
          </a>
        ))}
      </div>
    );
  }
  
  function truncate(s: string, n: number) {
    if (!s) return "";
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
  
  
