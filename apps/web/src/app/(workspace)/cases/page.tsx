import { CasesPage } from "@/features/cases";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <CasesPage initialQuery={q || ""} />;
}
