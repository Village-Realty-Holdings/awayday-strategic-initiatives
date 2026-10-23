import { notFound } from "next/navigation";
import { Comparisons } from "./comparisons";

// Before/after gallery for the shadcn migration. Development only: a
// production build (every Worker bundle) 404s here.
export default function ComparisonPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Comparisons />;
}
