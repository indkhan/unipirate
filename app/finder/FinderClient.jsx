'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { Button, Badge, Icon, IconButton, Chip, Toggle, Stepper, cx } from '@/components/ui';
import { loadProfile } from '@/lib/profile';
import TrackButton from '@/components/TrackButton';

export default function FinderClient({ universities, courses }) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState('');
  const [semester, setSemester] = useState('Any');
  const [language, setLanguage] = useState('Any');
  const [ncFreeOnly, setNcFreeOnly] = useState(false);
  const [selectedUni, setSelectedUni] = useState(universities[0]?.id);
  const [openCourse, setOpenCourse] = useState(null);
  const [mobileView, setMobileView] = useState('unis');

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    if (p?.prefLanguage && p.prefLanguage !== 'Any') {
      setLanguage(p.prefLanguage);
    }
  }, []);

  // Derived filtering — memoized so it only recomputes when the data or a
  // filter changes (matters once the catalog is DB-backed and larger).
  const { filteredCourses, countsByUni, universitiesWithMatches } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (c) => {
      if (q) {
        const hay = (c.name + ' ' + (c.keywords || []).join(' ') + ' ' + (c.summary || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (semester !== 'Any') {
        if (semester === 'Winter' && !/winter|both/i.test(c.semester)) return false;
        if (semester === 'Summer' && !/summer|both/i.test(c.semester)) return false;
      }
      if (language !== 'Any') {
        if (language === 'German' && !/german/i.test(c.language)) return false;
        if (language === 'English' && !/english/i.test(c.language)) return false;
        if (language === 'Mixed' && !/mixed/i.test(c.language)) return false;
      }
      if (ncFreeOnly && !c.ncFree) return false;
      return true;
    };
    const filtered = courses.filter(matches);
    const counts = {};
    filtered.forEach((c) => {
      counts[c.universityId] = (counts[c.universityId] || 0) + 1;
    });
    return {
      filteredCourses: filtered,
      countsByUni: counts,
      universitiesWithMatches: universities.filter((u) => (counts[u.id] || 0) > 0),
    };
  }, [courses, universities, query, semester, language, ncFreeOnly]);

  // Keep the selected uni valid as filters change.
  useEffect(() => {
    if (universitiesWithMatches.length && !universitiesWithMatches.find((u) => u.id === selectedUni)) {
      setSelectedUni(universitiesWithMatches[0].id);
    }
  }, [universitiesWithMatches, selectedUni]);

  const coursesForSelected = useMemo(
    () => filteredCourses.filter((c) => c.universityId === selectedUni),
    [filteredCourses, selectedUni]
  );
  const selectedUniObj = universities.find((u) => u.id === selectedUni);
  const totalCourses = filteredCourses.length;
  const totalUnis = universitiesWithMatches.length;

  const clearFilters = () => {
    setQuery('');
    setSemester('Any');
    setLanguage('Any');
    setNcFreeOnly(false);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <TopNav />

      <div className="border-b border-line bg-paper">
        <div className="max-w-[1500px] mx-auto px-6 md:px-10 py-5">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-[11.5px] uppercase tracking-[0.18em] text-ink-40 mb-1">
                Course finder · Bachelor&apos;s
              </div>
              <h1
                className="text-[28px] md:text-[34px] text-ink-90 leading-tight"
                style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.015em' }}
              >
                {totalCourses} programs across {totalUnis} universities.
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {profile?.country && (
                <button
                  onClick={() => router.push('/onboarding')}
                  className="hidden lg:inline-flex items-center gap-2 h-9 px-3 rounded-md border border-line bg-paper hover:border-navy/40 text-[12px] text-ink-70"
                >
                  <Icon name="user" size={13} />
                  <span>{profile.country}</span>
                  <span className="text-ink-40">·</span>
                  <span>{profile.languageCert}</span>
                  <Icon name="sliders" size={12} className="text-ink-40" />
                </button>
              )}
              <Stepper steps={['Profile', 'Recognition', 'Courses']} current={2} />
            </div>
          </div>
        </div>
      </div>

      <FilterBar
        query={query}
        setQuery={setQuery}
        semester={semester}
        setSemester={setSemester}
        language={language}
        setLanguage={setLanguage}
        ncFreeOnly={ncFreeOnly}
        setNcFreeOnly={setNcFreeOnly}
        onClear={clearFilters}
      />

      <div className="md:hidden px-6 py-3 border-b border-line bg-paper flex gap-2">
        <Chip active={mobileView === 'unis'} onClick={() => setMobileView('unis')}>
          Universities ({totalUnis})
        </Chip>
        <Chip active={mobileView === 'courses'} onClick={() => setMobileView('courses')}>
          Courses ({coursesForSelected.length})
        </Chip>
      </div>

      <div className="flex-1 max-w-[1500px] mx-auto w-full px-0 md:px-10 md:py-6">
        <div className="md:grid md:grid-cols-12 md:gap-6">
          <aside
            className={cx(
              'md:col-span-4 lg:col-span-4 xl:col-span-3',
              mobileView === 'unis' ? 'block' : 'hidden md:block'
            )}
          >
            <UniList
              universities={universitiesWithMatches}
              counts={countsByUni}
              selectedId={selectedUni}
              onSelect={(id) => {
                setSelectedUni(id);
                setMobileView('courses');
              }}
              empty={totalCourses === 0}
            />
          </aside>

          <section
            className={cx(
              'md:col-span-8 lg:col-span-8 xl:col-span-9 md:pr-0',
              mobileView === 'courses' ? 'block' : 'hidden md:block'
            )}
          >
            {totalCourses === 0 ? (
              <EmptyState onClear={clearFilters} />
            ) : selectedUniObj ? (
              <CoursesPanel
                university={selectedUniObj}
                courses={coursesForSelected}
                onOpen={(c) => setOpenCourse(c)}
              />
            ) : null}
          </section>
        </div>
      </div>

      {openCourse && (
        <CourseDetailDrawer
          course={openCourse}
          university={universities.find((u) => u.id === openCourse.universityId)}
          profile={profile}
          onClose={() => setOpenCourse(null)}
        />
      )}
    </div>
  );
}

function FilterBar({ query, setQuery, semester, setSemester, language, setLanguage, ncFreeOnly, setNcFreeOnly, onClear }) {
  return (
    <div className="border-b border-line bg-white/60 sticky top-16 z-20 backdrop-blur">
      <div className="max-w-[1500px] mx-auto px-6 md:px-10 py-3.5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Icon name="search" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 'Computer Science', 'Business', 'Aerospace'…"
            className="w-full h-11 pl-10 pr-4 rounded-md border border-line bg-paper text-[14px] text-ink-90 outline-none hover:border-ink-30 focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Badge tone="navy">Bachelor&apos;s</Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill label="Semester" value={semester} onChange={setSemester} options={['Any', 'Winter', 'Summer']} />
          <FilterPill label="Language" value={language} onChange={setLanguage} options={['Any', 'German', 'English', 'Mixed']} />
          <div className="px-3 h-9 rounded-md border border-line bg-paper inline-flex items-center">
            <Toggle value={ncFreeOnly} onChange={setNcFreeOnly} label="NC-free only" />
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function FilterPill({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'h-9 px-3 rounded-md border text-[12.5px] inline-flex items-center gap-2 transition-colors',
          value !== 'Any'
            ? 'border-navy/40 bg-navy/5 text-navy'
            : 'border-line bg-paper text-ink-70 hover:border-ink-30'
        )}
      >
        <span className="text-ink-50 text-[11.5px]">{label}</span>
        <span className="font-medium">{value}</span>
        <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-44 rounded-md border border-line bg-white shadow-lg p-1">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => { onChange(o); setOpen(false); }}
              className={cx(
                'w-full text-left px-3 py-2 rounded-[4px] text-[13px]',
                o === value ? 'bg-navy/8 text-navy' : 'text-ink-80 hover:bg-ink-5'
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UniList({ universities, counts, selectedId, onSelect, empty }) {
  return (
    <div className="md:sticky md:top-[148px]">
      <div className="px-6 md:px-0 py-4 md:py-0">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-40 mb-3 hidden md:block">
          Universities · {universities.length}
        </div>
        {empty ? (
          <div className="text-[13px] text-ink-50 p-6 border border-line border-dashed rounded-md">
            No universities match your filters.
          </div>
        ) : (
          <ul className="space-y-2 md:max-h-[calc(100vh-220px)] md:overflow-auto md:pr-1">
            {universities.map((u) => {
              const active = u.id === selectedId;
              const count = counts[u.id] || 0;
              return (
                <li key={u.id}>
                  <button
                    onClick={() => onSelect(u.id)}
                    className={cx(
                      'w-full text-left rounded-lg border p-4 transition-colors',
                      active
                        ? 'border-navy bg-white shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_6px_16px_-10px_oklch(0.3_0.05_255/0.25)]'
                        : 'border-line bg-white/60 hover:bg-white hover:border-navy/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] text-ink-90 font-medium leading-tight">{u.short}</div>
                        <div className="text-[11.5px] text-ink-50 mt-0.5 flex items-center gap-1">
                          <Icon name="pin" size={11} />
                          {u.city}
                        </div>
                      </div>
                      <span
                        className={cx(
                          'inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full text-[11px] font-medium',
                          active ? 'bg-navy text-paper' : 'bg-ink-5 text-ink-60'
                        )}
                      >
                        {count}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Badge tone="neutral" className="!text-[10.5px]">
                        {u.portalType.includes('uni-assist') ? 'uni-assist' : 'direct'}
                      </Badge>
                      <Badge tone="neutral" className="!text-[10.5px]">
                        {u.semesterContribution.replace(' / semester', '/sem')}
                      </Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CoursesPanel({ university, courses, onOpen }) {
  return (
    <div className="px-6 md:px-0 py-4 md:py-0">
      <div className="mb-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div
              className="text-[26px] md:text-[30px] text-ink-90 leading-tight"
              style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.015em' }}
            >
              {university.name}
            </div>
            <div className="text-[12.5px] text-ink-55 mt-1 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 text-ink-60">
                <Icon name="pin" size={11} /> {university.city}, {university.state}
              </span>
              <span className="inline-flex items-center gap-1 text-ink-60">
                <Icon name="external" size={11} /> {university.portalType}
              </span>
              <span className="inline-flex items-center gap-1 text-ink-60">
                <Icon name="calendar" size={11} /> {university.generalDeadlines}
              </span>
            </div>
          </div>
          <Badge tone="navy">{courses.length} matching</Badge>
        </div>
        <p className="text-[13.5px] text-ink-60 mt-3 max-w-[680px] leading-[1.55]">{university.blurb}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} onOpen={() => onOpen(c)} />
        ))}
      </div>
    </div>
  );
}

function CourseCard({ course, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-lg border border-line bg-white p-5 hover:border-navy/40 hover:shadow-[0_4px_14px_-8px_oklch(0.3_0.05_255/0.2)] transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="text-[18px] text-ink-90 leading-snug"
          style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}
        >
          {course.name}
        </div>
        <Icon name="chevronRight" size={16} className="text-ink-40 group-hover:text-navy transition-colors mt-1" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="navy">{course.degree}</Badge>
        <Badge tone="neutral">
          <Icon name="globe" size={11} /> {course.language}
        </Badge>
        <Badge tone="neutral">
          <Icon name="calendar" size={11} /> {course.semester}
        </Badge>
        {course.ncFree ? (
          <Badge tone="emerald">NC-free</Badge>
        ) : (
          <Badge tone="amber">NC {course.ncValue ? `· ${course.ncValue}` : ''}</Badge>
        )}
      </div>
      <p className="mt-3 text-[13px] text-ink-60 leading-[1.55] line-clamp-2">{course.summary}</p>
      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
        <div className="text-[11.5px] text-ink-50 inline-flex items-center gap-1.5">
          <Icon name="calendar" size={11} /> Deadline · {course.applicationDeadline}
        </div>
        <span className="text-[12px] text-navy font-medium inline-flex items-center gap-1">
          View details <Icon name="arrowRight" size={11} />
        </span>
      </div>
    </button>
  );
}

function EmptyState({ onClear }) {
  return (
    <div className="px-6 md:px-0 py-10 md:py-16">
      <div className="mx-auto max-w-[460px] text-center">
        <div className="mx-auto h-12 w-12 rounded-full border border-line bg-paper inline-flex items-center justify-center text-ink-40">
          <Icon name="search" size={20} />
        </div>
        <div
          className="mt-4 text-[22px] text-ink-90"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          No matches with these filters.
        </div>
        <p className="text-[13.5px] text-ink-60 mt-2">
          Try broadening the language, removing the NC-free toggle, or clearing the search.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button onClick={onClear}>Clear filters</Button>
          <a
            href="/request"
            className="text-[13px] text-navy font-medium hover:underline inline-flex items-center gap-1"
          >
            Request a university <Icon name="arrowRight" size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

function CourseDetailDrawer({ course, university, profile, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-ink-90/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className="w-full md:w-[720px] lg:w-[840px] bg-paper h-full overflow-auto shadow-[-10px_0_40px_-10px_oklch(0.2_0.05_255/0.2)]"
        style={{ animation: 'slide-in 200ms ease-out' }}>
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-line px-7 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge tone="navy">{course.degree}</Badge>
            <div className="text-[12.5px] text-ink-60">{university.short}</div>
          </div>
          <div className="flex items-center gap-2">
            <TrackButton course={course} university={university} profile={profile} />
            <IconButton aria-label="Close" onClick={onClose}>
              <Icon name="close" size={15} />
            </IconButton>
          </div>
        </div>

        <div className="px-7 pt-7 pb-10">
          <div className="text-[11.5px] uppercase tracking-[0.18em] text-ink-40 mb-2">
            {university.name} · {university.city}
          </div>
          <h2
            className="text-[38px] md:text-[44px] text-ink-90 leading-[1.05]"
            style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
          >
            {course.name}
          </h2>
          <p className="mt-3 text-[15px] text-ink-70 leading-[1.6] max-w-[620px]">{course.summary}</p>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Fact label="Degree" value={course.degree} />
            <Fact label="Language" value={course.language} />
            <Fact label="Semester" value={course.semester} />
            <Fact
              label="NC"
              value={course.ncFree ? 'NC-free' : course.ncValue || 'Restricted'}
              tone={course.ncFree ? 'emerald' : 'amber'}
            />
          </div>

          <DetailSection title="Admission requirements">{course.admissionRequirements}</DetailSection>
          <DetailSection title="Language requirements">{course.languageRequirements}</DetailSection>
          <DetailSection title="Course structure">{course.courseStructure}</DetailSection>
          <DetailSection title="How to apply">{course.howToApply}</DetailSection>

          <div className="mt-8 rounded-xl border border-line bg-white p-6">
            <div className="text-[11.5px] uppercase tracking-[0.18em] text-ink-40 mb-4">About the university</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Portal" value={university.portalType} />
              <Stat label="Deadlines" value={university.generalDeadlines} />
              <Stat label="Semester fee" value={university.semesterContribution} />
              <Stat label="Location" value={`${university.city}, ${university.state}`} />
            </div>
            <p className="text-[13px] text-ink-60 mt-4 leading-[1.6]">{university.blurb}</p>
          </div>

          <div className="mt-6 rounded-xl border border-navy/15 bg-navy/[0.035] p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11.5px] uppercase tracking-[0.18em] text-navy/70 mb-1">Application deadline</div>
              <div
                className="text-[24px] text-ink-90 leading-tight"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                {course.applicationDeadline}
              </div>
              <div className="text-[12.5px] text-ink-60 mt-1">Applies via {university.portalType}</div>
            </div>
            <Button size="lg" icon={<Icon name="external" size={14} />}>
              Open application
            </Button>
          </div>

          <div className="mt-8 text-[11.5px] text-ink-50 leading-snug">
            Information is curated for this MVP. Always double-check dates, tests, and fees on the
            university&apos;s official page before applying.
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Fact({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="text-[10.5px] uppercase tracking-[0.15em] text-ink-40 mb-1.5">{label}</div>
      <div className="text-[14px] text-ink-90 leading-tight">{value}</div>
      {tone === 'emerald' && <div className="mt-2"><Badge tone="emerald">Open admission</Badge></div>}
      {tone === 'amber' && <div className="mt-2"><Badge tone="amber">Restricted</Badge></div>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.15em] text-ink-40">{label}</div>
      <div className="text-[13px] text-ink-85 mt-1 leading-snug">{value}</div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <section className="mt-8">
      <h3
        className="text-[19px] text-ink-90 mb-2"
        style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}
      >
        {title}
      </h3>
      <p className="text-[14px] text-ink-70 leading-[1.7]">{children}</p>
    </section>
  );
}
