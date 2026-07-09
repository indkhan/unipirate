"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { CalendarEvent } from "@/lib/tasks/view";

import { formatDate } from "./format";
import styles from "./dashboard.module.css";

export function Calendar({
  events,
  todayIso,
}: {
  events: CalendarEvent[];
  todayIso: string;
}) {
  const [todayYear, todayMonth, todayDay] = todayIso.split("-").map(Number);
  const [visibleMonth, setVisibleMonth] = useState(
    () => `${todayYear}-${String(todayMonth).padStart(2, "0")}`,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [year, month] = visibleMonth.split("-").map(Number);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const dayEvents = map.get(event.dueDate) ?? [];
      dayEvents.push(event);
      map.set(event.dueDate, dayEvents);
    }
    return map;
  }, [events]);
  const selectedEvents = selectedDate
    ? eventsByDay.get(selectedDate) ?? []
    : events.filter((event) => event.dueDate.startsWith(monthPrefix));
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: mondayOffset + daysInMonth }, (_, index) => {
      const day = index - mondayOffset + 1;
      const date =
        day > 0 ? `${monthPrefix}-${String(day).padStart(2, "0")}` : null;
      return {
        day: day > 0 ? day : null,
        date,
        today:
          day === todayDay && year === todayYear && month === todayMonth,
        hasEvent: date ? eventsByDay.has(date) : false,
        selected: date !== null && date === selectedDate,
      };
    });
  }, [eventsByDay, month, monthPrefix, selectedDate, todayDay, todayMonth, todayYear, year]);

  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  function shiftMonth(delta: number) {
    const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
    const nextMonth = `${shifted.getUTCFullYear()}-${String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    setVisibleMonth(nextMonth);
    setSelectedDate(null);
  }

  return (
    <section className={styles.calendarPanel}>
      <div className={styles.calendarHead}>
        <h2 className={styles.calendarTitle}>{monthLabel}</h2>
        <div className={styles.calendarNav}>
          <button
            className={styles.calendarNavButton}
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            className={styles.calendarNavButton}
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div className={styles.weekdays}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.calGrid}>
        {cells.map((cell, index) => (
          <button
            key={`${cell.day ?? "blank"}-${index}`}
            className={`${styles.calCell} ${cell.today ? styles.calToday : ""} ${
              cell.selected ? styles.calSelected : ""
            }`}
            type="button"
            disabled={!cell.date}
            onClick={() => setSelectedDate(cell.date)}
          >
            <span>{cell.day ?? ""}</span>
            {cell.hasEvent ? <span className={styles.calDot} aria-hidden /> : null}
          </button>
        ))}
      </div>
      <div className={styles.eventList}>
        {selectedEvents.length === 0 ? (
          <span className={styles.noEvents}>
            {selectedDate ? "No tasks on this day." : "No dated tasks this month."}
          </span>
        ) : (
          selectedEvents.map((event) => (
            <div key={event.key} className={styles.eventRow}>
              <span>{event.title}</span>
              <span>{event.verbatimDue ?? formatDate(event.dueDate)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
