import type { Result } from "@/lib/engine/evaluate";

export type DashboardRouteStation = {
  label: "Eligibility" | "APS" | "Applications" | "Visa";
  active: boolean;
};

export function dashboardRouteStations({
  hasApplications,
  hasProfile,
  result,
}: {
  hasApplications: boolean;
  hasProfile: boolean;
  result: Result | null;
}): DashboardRouteStation[] {
  const stations: DashboardRouteStation[] = [
    { label: "Eligibility", active: hasProfile },
  ];

  if (result?.aps === "required") {
    stations.push({ label: "APS", active: false });
  }

  stations.push(
    { label: "Applications", active: hasApplications },
    { label: "Visa", active: false },
  );

  return stations;
}
