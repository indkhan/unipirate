"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"
import { Badge, cx, Icon, type IconName } from "@/components/ui"
import { useProfile } from "@/components/profile-provider"
import { useSavedCourses } from "@/components/use-saved-courses"
import { data } from "@/lib/data"
import { mockSavedCourses } from "@/lib/dashboard-fixtures"
import {
  getAdmissionRoute,
  getUpcomingCourses,
  getProfileCompleteness,
  type ItemStatus,
} from "@/lib/dashboard"
import type { SavedCourse } from "@/lib/saved-courses"

export function Dashboard() {
  const { profile } = useProfile()
  const { courses: savedCourses, loaded } = useSavedCourses()

  const hasProfile = Boolean(profile.country || profile.qualification)
  const profileCompleteness = getProfileCompleteness(profile)
  const admissionRoute = getAdmissionRoute(profile, data.recognitionRules)
  const usesMockCourses = loaded && savedCourses.length === 0
  const courses = savedCourses.length ? savedCourses : mockSavedCourses
  const upcomingCourses = getUpcomingCourses(courses)
  const readyToApply = courses.filter((course) => course.readiness >= 80).length
  const missingItems = courses.reduce((total, course) => total + course.missingItems.length, 0)

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-6 py-8 md:px-10 md:py-10">
        <Welcome
          hasProfile={hasProfile}
          country={profile.country}
          language={profile.prefLanguage}
          route={admissionRoute.status}
        />

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Saved courses" value={courses.length} icon="bookmark" />
          <StatCard label="Ready to apply" value={readyToApply} icon="check" tone="emerald" />
          <StatCard label="Missing items" value={missingItems} icon="info" tone="amber" />
          <StatCard label="Upcoming deadlines" value={upcomingCourses.length} icon="calendar" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <AdmissionRouteCard route={admissionRoute} />
            <SavedCourses courses={courses} isMock={usesMockCourses} />
            <UpcomingDeadlines courses={upcomingCourses} />
          </div>

          <aside className="space-y-6">
            <ProfileCompleteness
              percentage={profileCompleteness.percentage}
              missingFields={profileCompleteness.missingFields}
            />
            <ApplicationChecklist
              profileComplete={profileCompleteness.percentage === 100}
              hasLanguageCertificate={Boolean(profile.languageCert)}
              hasLanguageScore={Boolean(profile.languageScore)}
              hasCourses={savedCourses.length > 0}
            />
          </aside>
        </div>
      </main>
    </div>
  )
}

function Welcome({
  hasProfile,
  country,
  language,
  route,
}: {
  hasProfile: boolean
  country: string
  language: string
  route: string
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-ink-40">
            Application dashboard
          </div>
          <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.02em] text-ink-90 md:text-[46px]">
            {hasProfile ? "Welcome back." : "Build your application plan."}
          </h1>
          <p className="mt-3 max-w-[680px] text-[14px] leading-[1.6] text-ink-60">
            {hasProfile
              ? "Track your admission route, course readiness, missing documents, and the deadlines that need attention."
              : "Complete your profile to receive a tailored admission route and application checklist."}
          </p>
        </div>
        {!hasProfile && <TextLink href="/profile">Complete your profile</TextLink>}
      </div>

      {hasProfile && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          <Badge tone="neutral">
            <Icon name="pin" size={11} /> {country || "Country missing"}
          </Badge>
          <Badge tone="neutral">
            <Icon name="globe" size={11} /> {language === "Any" ? "Any language" : language}
          </Badge>
          <Badge tone="navy">
            <Icon name="gauge" size={11} /> {route}
          </Badge>
        </div>
      )}
    </section>
  )
}

function StatCard({
  label,
  value,
  icon,
  tone = "navy",
}: {
  label: string
  value: number
  icon: IconName
  tone?: "navy" | "emerald" | "amber"
}) {
  const tones = {
    navy: "bg-navy/8 text-navy",
    emerald: "bg-[oklch(0.96_0.04_150)] text-[oklch(0.38_0.1_150)]",
    amber: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.42_0.12_70)]",
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4 md:p-5">
      <div className={cx("mb-5 inline-flex size-8 items-center justify-center rounded-md", tones[tone])}>
        <Icon name={icon} size={15} />
      </div>
      <div className="font-display text-[30px] leading-none text-ink-90">{value}</div>
      <div className="mt-1 text-[12px] text-ink-50">{label}</div>
    </div>
  )
}

function AdmissionRouteCard({
  route,
}: {
  route: ReturnType<typeof getAdmissionRoute>
}) {
  const tone =
    route.status === "Direct admission likely"
      ? "emerald"
      : route.status === "Profile incomplete" || route.status === "Unclear"
        ? "slate"
        : "amber"

  return (
    <Section title="Admission route" action={<TextLink href="/recognition">View recognition</TextLink>}>
      <div className="rounded-lg border border-line bg-paper p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={tone}>{route.status}</Badge>
          <TextLink href="/profile">Edit profile</TextLink>
        </div>
        <p className="mt-4 text-[14px] leading-[1.65] text-ink-70">{route.explanation}</p>
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-ink-40">Next steps</div>
          <ol className="space-y-2.5">
            {route.nextSteps.slice(0, 3).map((step, index) => (
              <li key={step} className="flex gap-3 text-[13px] leading-[1.5] text-ink-70">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-line bg-white text-[10px] text-ink-50">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  )
}

function SavedCourses({ courses, isMock }: { courses: SavedCourse[]; isMock: boolean }) {
  return (
    <Section
      title="Saved courses"
      action={
        <div className="flex items-center gap-3">
          {isMock && <Badge tone="neutral">Preview data</Badge>}
          <TextLink href="/courses">Browse courses</TextLink>
        </div>
      }
    >
      {courses.length ? (
        <div className="space-y-3">
          {courses.map((course) => (
            <SavedCourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No saved courses yet."
          body="Browse programs and save the ones you want to prepare an application for."
          href="/courses"
          linkLabel="Explore courses"
        />
      )}
    </Section>
  )
}

function SavedCourseCard({ course }: { course: SavedCourse }) {
  return (
    <article className="rounded-lg border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-[22px] leading-tight text-ink-90">{course.name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-50">
            <span>{course.university}</span>
            <span>·</span>
            <span>{course.city}</span>
          </div>
        </div>
        <Badge tone={course.readiness >= 80 ? "emerald" : course.readiness >= 60 ? "amber" : "slate"}>
          {course.status}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-line py-4 text-[12px] sm:grid-cols-3">
        <Fact label="Language" value={course.language} />
        <Fact label="Semester" value={course.semester} />
        <Fact label="Deadline" value={formatDate(course.deadline)} />
        <Fact label="Application" value={course.applicationRoute} />
        <Fact label="Admission" value={course.admissionType} />
        <Fact label="Readiness" value={`${course.readiness}%`} />
      </dl>

      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-20">
          <div className="h-full rounded-full bg-navy" style={{ width: `${course.readiness}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {course.missingItems.length ? (
            course.missingItems.map((item) => (
              <Badge key={item} tone="amber">
                Missing · {item}
              </Badge>
            ))
          ) : (
            <Badge tone="emerald">No missing items</Badge>
          )}
        </div>
      </div>
    </article>
  )
}

function UpcomingDeadlines({ courses }: { courses: SavedCourse[] }) {
  return (
    <Section title="Upcoming deadlines">
      {courses.length ? (
        <div className="divide-y divide-line rounded-lg border border-line bg-paper">
          {courses.map((course) => (
            <div key={course.id} className="grid gap-3 p-4 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center">
              <div>
                <div className="font-display text-[18px] text-ink-90">{formatDate(course.deadline, false)}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-40">
                  {new Date(`${course.deadline}T00:00:00Z`).getUTCFullYear()}
                </div>
              </div>
              <div>
                <div className="text-[13px] font-medium text-ink-85">{course.name}</div>
                <div className="mt-0.5 text-[11.5px] text-ink-50">{course.university}</div>
              </div>
              <Badge tone={course.missingItems.length ? "amber" : "emerald"}>
                {course.missingItems.length
                  ? `${course.missingItems.length} missing`
                  : "Ready"}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No upcoming deadlines."
          body="Saved courses with future application deadlines will appear here."
          href="/courses"
          linkLabel="Browse courses"
        />
      )}
    </Section>
  )
}

function ProfileCompleteness({
  percentage,
  missingFields,
}: {
  percentage: number
  missingFields: string[]
}) {
  return (
    <Section title="Profile completeness" action={<TextLink href="/profile">Edit</TextLink>}>
      <div className="rounded-lg border border-line bg-paper p-5">
        <div className="flex items-end justify-between">
          <div className="font-display text-[34px] leading-none text-ink-90">{percentage}%</div>
          <span className="text-[11px] text-ink-50">
            {missingFields.length ? `${missingFields.length} fields missing` : "Complete"}
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-20">
          <div className="h-full rounded-full bg-navy" style={{ width: `${percentage}%` }} />
        </div>
        {missingFields.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[10.5px] uppercase tracking-[0.14em] text-ink-40">
              Still needed
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingFields.map((field) => (
                <Badge key={field} tone="neutral">
                  {field}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

function ApplicationChecklist({
  profileComplete,
  hasLanguageCertificate,
  hasLanguageScore,
  hasCourses,
}: {
  profileComplete: boolean
  hasLanguageCertificate: boolean
  hasLanguageScore: boolean
  hasCourses: boolean
}) {
  const groups: Array<{ title: string; items: Array<{ label: string; status: ItemStatus }> }> = [
    {
      title: "Profile",
      items: [
        { label: "Academic profile", status: profileComplete ? "done" : "missing" },
        { label: "Recognition route", status: profileComplete ? "unclear" : "missing" },
      ],
    },
    {
      title: "Language",
      items: [
        { label: "Language certificate", status: hasLanguageCertificate ? "done" : "missing" },
        {
          label: "Certificate score",
          status: !hasLanguageCertificate ? "not_required" : hasLanguageScore ? "done" : "missing",
        },
      ],
    },
    {
      title: "Documents",
      items: [
        { label: "Certified transcripts", status: "unclear" },
        { label: "APS verification", status: "unclear" },
        { label: "Passport copy", status: "unclear" },
      ],
    },
    {
      title: "Course-specific",
      items: [
        { label: "Saved course", status: hasCourses ? "done" : "missing" },
        { label: "Program requirements", status: hasCourses ? "unclear" : "not_required" },
      ],
    },
  ]

  return (
    <Section title="Application checklist">
      <div className="space-y-5 rounded-lg border border-line bg-paper p-5">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="mb-2 text-[10.5px] uppercase tracking-[0.15em] text-ink-40">
              {group.title}
            </div>
            <div className="space-y-2">
              {group.items.map((item) => (
                <ChecklistItem key={item.label} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function ChecklistItem({ label, status }: { label: string; status: ItemStatus }) {
  const labels: Record<ItemStatus, string> = {
    done: "Done",
    missing: "Missing",
    unclear: "Unclear",
    not_required: "Not required",
  }
  const styles: Record<ItemStatus, string> = {
    done: "bg-[oklch(0.58_0.14_150)] text-white",
    missing: "bg-[oklch(0.72_0.14_75)] text-[oklch(0.22_0.05_75)]",
    unclear: "bg-ink-30 text-ink-80",
    not_required: "border border-line bg-white text-ink-40",
  }

  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <span className="text-ink-70">{label}</span>
      <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-medium", styles[status])}>
        {labels[status]}
      </span>
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 md:p-6">
      <div className="mb-5 flex min-h-8 items-center justify-between gap-4">
        <h2 className="font-display text-[24px] text-ink-90">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.13em] text-ink-40">{label}</dt>
      <dd className="mt-1 leading-snug text-ink-70">{value}</dd>
    </div>
  )
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[12px] font-medium text-navy hover:underline">
      {children} <Icon name="arrowRight" size={11} />
    </Link>
  )
}

function EmptyState({
  title,
  body,
  href,
  linkLabel,
}: {
  title: string
  body: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-paper p-8 text-center">
      <div className="font-display text-[21px] text-ink-90">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-[1.55] text-ink-50">{body}</p>
      <div className="mt-4">
        <TextLink href={href}>{linkLabel}</TextLink>
      </div>
    </div>
  )
}

function formatDate(date: string, includeYear = true) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}
