"use client";

// Ask — strict-RAG chat in a slide-over, ported from
// design/Assistant.dc.html. Every factual claim renders its citation:
// VerifiedStamp for [[rule:slug]], amber chip + link for [[web:url]],
// the dashed "Not in our verified rules" block for [[unknown]].

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState } from "react";

import { reportAssistantAnswer } from "@/app/(app)/dashboard/actions";
import { parseMarkers, stripMarkers, type Citation } from "@/lib/ai/markers";

import { VerifiedStamp } from "./verified-stamp";
import styles from "./assistant-sidebar.module.css";

const DAILY_QUOTA = 20;

const SUGGESTIONS = [
  "What's my next step right now?",
  "Do I need an APS certificate?",
  "When should I open my blocked account?",
];

type RuleSource = { source_url: string | null; last_verified_at: string | null };

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/** source_url/date for cited rule slugs, from every search_rules output in the
 * conversation — the model may cite a chunk retrieved a few turns earlier. */
function ruleSources(messages: UIMessage[]): Map<string, RuleSource> {
  const sources = new Map<string, RuleSource>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-search_rules" || !("output" in part)) continue;
      const output = part.output;
      if (!Array.isArray(output)) continue;
      for (const row of output as Array<Record<string, unknown>>) {
        if (typeof row.slug !== "string") continue;
        sources.set(row.slug, {
          source_url: typeof row.source_url === "string" ? row.source_url : null,
          last_verified_at:
            typeof row.last_verified_at === "string" ? row.last_verified_at : null,
        });
      }
    }
  }
  return sources;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function BotMessage({
  message,
  question,
  sources,
}: {
  message: UIMessage;
  question: string;
  sources: Map<string, RuleSource>;
}) {
  const [reported, setReported] = useState(false);
  const text = messageText(message);
  const { citations, unknown } = parseMarkers(text);
  const ruleCitations = citations.filter((c) => c.type === "rule");
  const webCitations = citations.filter((c) => c.type === "web");

  async function report() {
    try {
      await reportAssistantAnswer({ question, answer: text, citations });
      setReported(true);
    } catch {
      // leave the button active so the user can retry
    }
  }

  return (
    <div className={styles.botGroup}>
      <div className={styles.botBubble}>
        <span className={styles.botText}>{stripMarkers(text)}</span>

        {ruleCitations.map((citation: Citation) => {
          const source = sources.get(citation.ref);
          return (
            <div key={citation.ref}>
              <VerifiedStamp
                source={
                  source?.source_url
                    ? sourceHost(source.source_url)
                    : citation.ref
                }
                date={formatDate(source?.last_verified_at ?? null)}
                href={source?.source_url}
              />
            </div>
          );
        })}

        {webCitations.length > 0 ? (
          <>
            <span className={styles.webChip}>
              <span className={styles.webChipDot} aria-hidden />
              Unverified — double-check
            </span>
            {webCitations.map((citation) => (
              <a
                key={citation.ref}
                className={styles.webLink}
                href={citation.ref}
                target="_blank"
                rel="noreferrer"
              >
                {sourceHost(citation.ref)}
              </a>
            ))}
          </>
        ) : null}

        {unknown ? (
          <div className={styles.unknownBlock}>
            <span className={styles.unknownLabel}>Not in our verified rules</span>
          </div>
        ) : null}
      </div>
      <button className={styles.report} type="button" onClick={report} disabled={reported}>
        {reported ? "Reported — thank you" : "Report this answer"}
      </button>
    </div>
  );
}

export function AssistantSidebar({ initialUsed }: { initialUsed: number }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant/chat" }),
  });

  const sources = ruleSources(messages);
  const used =
    initialUsed + messages.filter((message) => message.role === "user").length;
  const quotaReached = used >= DAILY_QUOTA;
  const busy = status === "submitted" || status === "streaming";

  function ask(text: string) {
    const question = text.trim();
    if (!question || busy || quotaReached) return;
    setDraft("");
    void sendMessage({ text: question });
  }

  /** The user question a bot message answers — the closest one before it. */
  function questionFor(index: number): string {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messageText(messages[i]);
    }
    return "";
  }

  if (!open) {
    return (
      <button className={styles.trigger} type="button" onClick={() => setOpen(true)}>
        Ask
      </button>
    );
  }

  return (
    <>
      <button className={styles.trigger} type="button" onClick={() => setOpen(true)}>
        Ask
      </button>
      <div className={styles.overlay} onClick={() => setOpen(false)}>
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Ask"
          onClick={(event) => event.stopPropagation()}
        >
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <button
                className={styles.close}
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ‹
              </button>
              <div className={styles.titleBlock}>
                <span className={styles.title}>Ask</span>
                <span className={styles.subtitle}>Answers only with sources</span>
              </div>
            </div>
            <span className={styles.quota} title="Daily question quota">
              {Math.min(used, DAILY_QUOTA)}/{DAILY_QUOTA} today
            </span>
          </header>

          <main className={styles.messages}>
            {messages.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyDot} aria-hidden />
                <p className={styles.emptyText}>
                  Ask about your route. Every answer cites an official source —
                  and when we can&apos;t confirm something, we say so.
                </p>
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      className={styles.suggestion}
                      type="button"
                      onClick={() => ask(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message, index) =>
              message.role === "user" ? (
                <div key={message.id} className={styles.userBubble}>
                  {messageText(message)}
                </div>
              ) : (
                <BotMessage
                  key={message.id}
                  message={message}
                  question={questionFor(index)}
                  sources={sources}
                />
              ),
            )}

            {error ? (
              <p className={styles.error}>
                {quotaReached
                  ? "You've used all questions for today — come back tomorrow."
                  : "Something went wrong — try again."}
              </p>
            ) : null}
          </main>

          <footer className={styles.composer}>
            <input
              className={styles.input}
              placeholder={
                quotaReached
                  ? "20/20 — come back tomorrow"
                  : "Ask about your route…"
              }
              value={draft}
              disabled={quotaReached}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") ask(draft);
              }}
            />
            <button
              className={styles.send}
              type="button"
              disabled={busy || quotaReached || !draft.trim()}
              onClick={() => ask(draft)}
            >
              Send
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}
