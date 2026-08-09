import { redirect } from "next/navigation";

// This route was replaced by /make and /install in Phase 5.
export default function InstallationsRedirect() {
  redirect("/install");
}
