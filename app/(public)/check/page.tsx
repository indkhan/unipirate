import { UserMenu } from "@/components/app/user-menu";
import { getCountries, getQualifications } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";

import { CheckFlow } from "./check-flow";
import type { PartialAnswers } from "./steps";

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
  const [countries, qualifications] = await Promise.all([
    getCountries(db),
    getQualifications(db),
  ]);
  const params = await searchParams;
  const requestedCountry = params.country;
  const certificateCountry = countries.some(
    (country) => country.code === requestedCountry && country.code !== "de",
  )
    ? requestedCountry
    : undefined;
  const boards = qualifications
    .filter((q) => q.level === "school" && q.country_code !== null)
    .map((q) => ({ countryCode: q.country_code as string, label: q.board_or_type }));
  const initialAnswers: PartialAnswers = {
    ...(certificateCountry ? { certificateCountry } : {}),
  };

  const countryOptions = countries.map((c) => ({ code: c.code, name: c.name }));
  const userMenu = user ? (
    <UserMenu
      email={user.email ?? null}
      isAdmin={user.app_metadata?.role === "admin"}
    />
  ) : undefined;

  return (
    <CheckFlow
      countries={countryOptions}
      boards={boards}
      initialAnswers={initialAnswers}
      userMenu={userMenu}
    />
  );
}
