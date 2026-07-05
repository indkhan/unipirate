import { getCountries, getQualifications } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";

import { CheckFlow } from "./check-flow";

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
  const [countries, qualifications] = await Promise.all([
    getCountries(db),
    getQualifications(db),
  ]);
  const requestedCountry = (await searchParams).country;
  const certificateCountry = countries.some(
    (country) => country.code === requestedCountry && country.code !== "de",
  )
    ? requestedCountry
    : undefined;
  const boards = qualifications
    .filter((q) => q.level === "school" && q.country_code !== null)
    .map((q) => ({ countryCode: q.country_code as string, label: q.board_or_type }));

  return (
    <CheckFlow
      countries={countries.map((c) => ({ code: c.code, name: c.name }))}
      boards={boards}
      initialAnswers={certificateCountry ? { certificateCountry } : undefined}
    />
  );
}
