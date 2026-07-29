"use client";

import { SubjectRowsEditor } from "./subject-rows-editor";
import { IB_GRADES, IB_LEVELS, IB_SUBJECTS, type IbSubjectAnswer } from "./steps";

export function IbSubjectsEditor({
  subjects,
  onChange,
}: {
  subjects: IbSubjectAnswer[];
  onChange: (subjects: IbSubjectAnswer[]) => void;
}) {
  return (
    <SubjectRowsEditor
      subjects={subjects}
      onChange={onChange}
      catalog={IB_SUBJECTS}
      levels={IB_LEVELS}
      grades={IB_GRADES}
      gradeLabel={(grade) => `Grade ${grade}`}
      addLabel="a subject"
    />
  );
}
