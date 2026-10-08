import { redirect } from "next/navigation";

// The roster directory is now unified into the People page.
export default function RosterPage() {
  redirect("/people");
}
