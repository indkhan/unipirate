"use client";

import { SubjectRowsEditor } from "./subject-rows-editor";
import { GCE_GRADES, GCE_SUBJECTS, type GceSubjectAnswer } from "./steps";

const GCE_LEVELS = [
  { value: "AL", label: "A-Level" },
  { value: "AS", label: "AS" },
] as const;

export function GceSubjectsEditor({
  subjects,
  onChange,
}: {
  subjects: GceSubjectAnswer[];
  onChange: (subjects: GceSubjectAnswer[]) => void;
}) {
  return (
    <SubjectRowsEditor
      subjects={subjects}
      onChange={onChange}
      catalog={GCE_SUBJECTS}
      levels={GCE_LEVELS}
      grades={GCE_GRADES}
      noun="subject"
    />
  );
}
