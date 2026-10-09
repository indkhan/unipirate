import {requireUser} from "@/lib/auth/session";
import {listTaskProposals,listApplicationsWithCourses,countTodayAssistantQuestions} from "@/lib/db/queries";
import {AuthenticatedTopbar} from "@/components/app/authenticated-topbar";
import {SuggestionNotifications} from "@/components/app/suggestion-notifications";
import styles from "../dashboard/dashboard.module.css";
import pageStyles from "./suggestions.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Suggestions — UniPirate"};
export default async function SuggestionsPage(){
  const {db,user}=await requireUser();
  const [proposals,applications,used]=await Promise.all([listTaskProposals(db,user.id),listApplicationsWithCourses(db,user.id),countTodayAssistantQuestions(db,user.id)]);
  const names=Object.fromEntries(applications.map(a=>[a.id,a.courses?.name??"Course"]));
  return <div className={styles.shell}><div className={styles.container}><header className={styles.header}>
    <AuthenticatedTopbar email={user.email??null} initialAssistantUsed={used} hideSuggestionPopup/>
    <h1 className={pageStyles.title}>Suggestions</h1><p className={pageStyles.intro}>Review what helps your application. Nothing becomes a task until you approve it.</p>
  </header><main><SuggestionNotifications full initialProposals={proposals} initialNames={names}/></main></div></div>;
}
