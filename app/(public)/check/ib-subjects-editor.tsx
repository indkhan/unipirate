"use client";
import styles from './check.module.css';
import { IB_GRADES, IB_SUBJECTS, type IbSubjectAnswer } from './steps';
import { ibEntry, IB_SOURCE } from '@/lib/engine/ib';
export function IbSubjectsEditor({subjects,onChange}:{subjects:IbSubjectAnswer[];onChange:(s:IbSubjectAnswer[])=>void}) {
 const patch=(i:number,changes:Partial<IbSubjectAnswer>)=>onChange(subjects.map((s,j)=>i===j?{...s,...changes}:s));
 return <div className={styles.options}>
 <p>Copy subjects and levels from your official IB record and two-year reports. Different languages may use the same course type. Choose Cannot confirm for missing evidence. <a href={IB_SOURCE} target="_blank" rel="noreferrer">KMK recognition agreement</a></p>
 {subjects.map((s,i)=>{const entry=ibEntry(s.subjectId);const language=entry?.kind==='language'||entry?.course==='ab_initio';return <fieldset key={i} className={styles.reviewCard}>
 <legend>IB subject {i+1}</legend>
 <label>Course <select className={styles.select} aria-label={'IB subject '+(i+1)+' course'} value={s.subjectId} onChange={e=>patch(i,{subjectId:e.target.value,name:undefined,language:undefined,continuedForeign:undefined,continuity:undefined,independence:undefined})}>
 {IB_SUBJECTS.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
 {s.subjectId==='other'&&<label>Exact reported subject name <input className={styles.input} maxLength={200} value={s.name??''} onChange={e=>patch(i,{name:e.target.value})}/></label>}
 <label>Level <select className={styles.select} aria-label={'IB subject '+(i+1)+' level'} value={s.level} onChange={e=>patch(i,{level:e.target.value as IbSubjectAnswer['level'],continuity:undefined})}><option value="unknown">Cannot confirm</option><option>HL</option><option>SL</option></select></label>
 <label>Grade <select className={styles.select} aria-label={'IB subject '+(i+1)+' grade'} value={s.grade} onChange={e=>patch(i,{grade:e.target.value as IbSubjectAnswer['grade']})}><option value="unknown">Cannot confirm</option>{IB_GRADES.map(g=><option key={g}>{g}</option>)}</select></label>
 {language&&<><label>Language identity (or unknown) <input className={styles.input} aria-label={'IB subject '+(i+1)+' language'} maxLength={100} value={s.language??''} onChange={e=>patch(i,{language:e.target.value,continuedForeign:undefined})}/></label>
 <label>Was this a continued foreign language for you? <select className={styles.select} aria-label={'IB subject '+(i+1)+' continued foreign language'} value={s.continuedForeign??''} onChange={e=>patch(i,{continuedForeign:e.target.value as IbSubjectAnswer['continuedForeign']})}><option value="" disabled>Select context</option><option value="yes">Yes, continued foreign language</option><option value="no">No</option><option value="unknown">Cannot confirm</option></select></label></>}
 <label>Same subject at this level throughout the two-year Diploma Programme? <select className={styles.select} aria-label={'IB subject '+(i+1)+' continuity'} value={s.continuity??''} onChange={e=>patch(i,{continuity:e.target.value as IbSubjectAnswer['continuity']})}><option value="" disabled>Select continuity</option><option value="two_years">Yes, continuously for two years</option><option value="not_two_years">No</option><option value="unknown">Cannot confirm</option></select></label>
 <label>Independent of the other five examination subjects? <select className={styles.select} aria-label={'IB subject '+(i+1)+' independence'} value={s.independence??''} onChange={e=>patch(i,{independence:e.target.value as IbSubjectAnswer['independence']})}><option value="" disabled>Select independence</option><option value="independent">Yes</option><option value="dependent">No, overlapping/dependent</option><option value="unknown">Cannot confirm</option></select></label>
 <button type="button" className={styles.removeBtn} aria-label={'Remove IB subject '+(i+1)} onClick={()=>onChange(subjects.filter((_,j)=>j!==i))}>Remove subject</button>
 </fieldset>})}
 <button type="button" className={styles.addBtn} disabled={subjects.length>=20} onClick={()=>onChange([...subjects,{subjectId:'other',level:'unknown',grade:'unknown'}])}>+ Add subject</button>
 </div>;
}
