import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";

export default async function AdminPage() {
  await requireAdmin();
  redirect("/admin/people");
}
