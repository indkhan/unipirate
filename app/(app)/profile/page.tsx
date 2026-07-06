import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UserMenu } from "@/components/app/user-menu";
import { getCountries, getProfile, getQualifications } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";

import { ProfileReview } from "@/app/(public)/check/profile-review";
import { AnswersSchema } from "@/app/(public)/check/steps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile — UniPirate",
};

export default async function ProfilePage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const [countries, qualifications, profile] = await Promise.all([
    getCountries(db),
    getQualifications(db),
    getProfile(db, user.id),
  ]);
  const answers = AnswersSchema.safeParse(profile?.answers);
  if (!answers.success) redirect("/check");

  const boards = qualifications
    .filter((q) => q.level === "school" && q.country_code !== null)
    .map((q) => ({ countryCode: q.country_code as string, label: q.board_or_type }));

  return (
    <ProfileReview
      countries={countries.map((c) => ({ code: c.code, name: c.name }))}
      boards={boards}
      initialAnswers={answers.data}
      userMenu={
        <UserMenu
          email={user.email ?? null}
          isAdmin={user.app_metadata?.role === "admin"}
        />
      }
    />
  );
}
