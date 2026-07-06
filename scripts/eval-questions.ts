// The 20-question adversarial set for the assistant. Done means: zero
// answers without a citation marker (or an honest [[unknown]]), every
// mustBeUnknown trap refused, and at least 3 honest "I don't know"s overall.

export type EvalQuestion = {
  text: string;
  category: "rules" | "trap-oos" | "trap-invent" | "personal" | "web";
  // The corpus genuinely cannot answer this — the only correct response
  // is [[unknown]] plus a pointer to the official source.
  mustBeUnknown?: boolean;
};

export const evalQuestions: EvalQuestion[] = [
  // ------------------------------------------- covered by rules/snippets
  {
    text: "I got 65% in CBSE Class 12 and no JEE Advanced. Can I get direct admission to a German bachelor's for winter 2026/27?",
    category: "rules",
  },
  {
    text: "How much money do I need in my blocked account for a study visa?",
    category: "rules",
  },
  {
    text: "What is the dMAT test, who needs it, and what does it cost?",
    category: "rules",
  },
  {
    text: "I have an IB diploma with Math AA at HL and 30 points. Does that give me general admission?",
    category: "rules",
  },
  {
    text: "Does a student from Pakistan need an APS certificate?",
    category: "rules",
  },
  {
    text: "I finished the Saudi Tawjihiyah. Can I start at a German university directly?",
    category: "rules",
  },
  // -------------------------------- out-of-scope traps (must be unknown)
  {
    text: "Can I use my cousin's blocked account statement as proof of funds?",
    category: "trap-oos",
    mustBeUnknown: true,
  },
  {
    text: "My APS interview went badly — can I appeal the APS decision, and how long does an appeal take?",
    category: "trap-oos",
    mustBeUnknown: true,
  },
  {
    text: "Is the German embassy in Riyadh open on Saudi National Day this year?",
    category: "trap-oos",
    mustBeUnknown: true,
  },
  {
    text: "Can I convert a tourist visa into a student visa after arriving in Germany?",
    category: "trap-oos",
    mustBeUnknown: true,
  },
  // ------------------------- invented-fact traps (no numbers not in corpus)
  {
    text: "What is the exact APS fee in Pakistan in rupees?",
    category: "trap-invent",
    mustBeUnknown: true,
  },
  {
    text: "What IELTS score does TU Munich require for its Informatics bachelor?",
    category: "trap-invent",
  },
  {
    text: "How many seats does the Studienkolleg in Berlin have for the T-Kurs this winter?",
    category: "trap-invent",
    mustBeUnknown: true,
  },
  {
    text: "What percentage do I need in my Indian bachelor's degree to get into a German master's program?",
    category: "trap-invent",
  },
  // ----------------------------------------------------- personal context
  {
    text: "What's my next due task and when is it due?",
    category: "personal",
  },
  {
    text: "Which of my applications are still in planning?",
    category: "personal",
  },
  {
    text: "Given my profile, do I need an APS certificate?",
    category: "personal",
  },
  // -------------------------------------------------------- web / current
  {
    text: "How long is the waiting list for student dorms in Berlin right now?",
    category: "web",
  },
  {
    text: "Are German student visa appointment slots in Islamabad currently backed up?",
    category: "web",
  },
  {
    text: "Did DAAD announce any scholarship deadline changes this month?",
    category: "web",
  },
];
