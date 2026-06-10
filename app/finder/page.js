import { getFinderData } from '@/lib/repo/server';
import FinderClient from './FinderClient';

// Server component: fetches universities + courses (Supabase, static fallback)
// and hands them to the interactive client. Works logged-out.
export default async function FinderPage() {
  const { universities, courses } = await getFinderData();
  return <FinderClient universities={universities} courses={courses} />;
}
