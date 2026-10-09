import { UserMenu } from "@/components/app/user-menu";
import { isAdminRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/db/server";

import { CheckFlow } from "./check-flow";
import { checkerEntry } from "./entry";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Check your path — UniPirate",
};

export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; degree?: string }>;
}) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const params = await searchParams;
  const initialAnswers = checkerEntry(params);

  const userMenu = user ? (
    <UserMenu
      email={user.email ?? null}
      isAdmin={isAdminRole(user.app_metadata)}
    />
  ) : undefined;

  return (
    <CheckFlow
      initialAnswers={initialAnswers}
      entryDegree={initialAnswers.targetDegree}
      userMenu={userMenu}
    />
  );
}
