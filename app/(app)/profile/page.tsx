import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UserMenu } from "@/components/app/user-menu";
import { isAdminRole } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/queries";

import { ProfileReview } from "@/app/(public)/check/profile-review";
import { AnswersSchema } from "@/app/(public)/check/steps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile — UniPirate",
};

export default async function ProfilePage() {
  const { db, user } = await requireUser("/profile");

  const profile = await getProfile(db, user.id);
  const answers = AnswersSchema.safeParse(profile?.answers);
  if (!answers.success) redirect("/check");

  return (
    <ProfileReview
      initialAnswers={answers.data}
      userMenu={
        <UserMenu
          email={user.email ?? null}
          isAdmin={isAdminRole(user.app_metadata)}
        />
      }
    />
  );
}
