import { UserMenu } from "@/components/app/user-menu";
import { isAdminRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/db/server";

import { CheckFlow } from "./check-flow";
import { COUNTRIES, type PartialAnswers } from "./steps";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Check your path — UniPirate",
};

export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const params = await searchParams;
  const requestedCountry = params.country;
  const certificateCountry = COUNTRIES.some(
    (country) => country.code === requestedCountry,
  )
    ? requestedCountry
    : undefined;
  const initialAnswers: PartialAnswers = {
    ...(certificateCountry ? { certificateCountry } : {}),
  };
  const initialStepIndex = certificateCountry ? 1 : 0;

  const userMenu = user ? (
    <UserMenu
      email={user.email ?? null}
      isAdmin={isAdminRole(user.app_metadata)}
    />
  ) : undefined;

  return (
    <CheckFlow
      initialAnswers={initialAnswers}
      initialStepIndex={initialStepIndex}
      userMenu={userMenu}
    />
  );
}
