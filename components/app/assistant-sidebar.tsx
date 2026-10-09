"use client";

// Ask — strict-RAG chat in a slide-over, ported from
// design/Assistant.dc.html. Every factual claim renders its citation:
// VerifiedStamp for [[rule:slug]], amber chip + link for [[web:url]],
// the dashed "Not in our verified rules" block for [[unknown]].

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskReceiptSchema } from "@/lib/tasks/manual";

import { reportAssistantAnswer } from "@/app/(app)/dashboard/actions";
import { parseMarkers, stripMarkers, type Citation } from "@/lib/ai/markers";

import { responseRuleSources } from "./assistant-sources";

import { VerifiedStamp } from "./verified-stamp";
import styles from "./assistant-sidebar.module.css";

const DAILY_QUOTA = 20;

const SUGGESTIONS = [
  "What's my next step right now?",
  "Do I need an APS certificate?",
  "When should I open my blocked account?",
];

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
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
}: {
  message: UIMessage;
  question: string;
}) {
  const [reported, setReported] = useState(false);
  const sources = responseRuleSources(message.parts);
  const text = messageText(message);
  const { citations, unknown } = parseMarkers(text);
  const ruleCitations = citations.filter((c) => c.type === "rule");
  const webCitations = citations.filter((c) => c.type === "web");
  const receipts=message.parts.flatMap(part=>{
    const value=part as unknown as {type:string;state?:string;output?:unknown;data?:unknown};
    if(value.type!=="data-task-receipt" && !(value.type==="tool-create_task"&&value.state==="output-available"))return [];
    const receipt=TaskReceiptSchema.safeParse(value.type==="data-task-receipt"?value.data:value.output);
    return receipt.success?[receipt.data]:[];
  });

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
        {receipts.map((receipt,index)=>receipt.status==="failed"?<p key={index} role="alert">{receipt.error}</p>:<div key={receipt.task.id} role="status">
          <strong>{receipt.status==="created"?"Task saved":"Task already saved"}</strong>
          <p>{receipt.task.title}</p>
          {receipt.task.due_date?<p>Personal reminder: {receipt.task.due_date}</p>:null}
          <a href="/dashboard">View your task</a>
        </div>)}
        <span className={styles.botText}>{stripMarkers(text)}</span>

        {ruleCitations.map((citation: Citation) => {
          const source = sources.get(citation.ref);
          if (!source) return (
            <div key={citation.ref} className={styles.unknownBlock}>
              <span className={styles.unknownLabel}>Rule source unavailable — {citation.ref}</span>
            </div>
          );
          return (
            <div key={citation.ref}>
              {source.status === "verified" && source.last_verified_at ? (
                <VerifiedStamp source={sourceHost(source.source_url)}
                  date={source.last_verified_at} href={source.source_url} />
              ) : (
                <>
                  <span className={styles.webChip}>Rule verification unavailable</span>
                  <a className={styles.webLink} href={source.source_url} target="_blank" rel="noreferrer">
                    {sourceHost(source.source_url)}
                  </a>
                  {source.last_verified_at ? <span>{source.last_verified_at}</span> : null}
                </>
              )}
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
  const router=useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [startingUsed] = useState(initialUsed);
  const { messages, sendMessage, regenerate, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant/chat" }),
    onFinish:()=>router.refresh(),
  });

  const used =
    Math.max(initialUsed,startingUsed + messages.filter((message) => message.role === "user").length);
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
                  Ask about your route, or add a personal task: Add task &quot;Collect transcripts&quot; for your exact course name. A personal reminder is not an official deadline.
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

            {error?<button type="button" onClick={()=>void regenerate()}>Retry last request</button>:null}
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
