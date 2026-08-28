// Documents is not built yet.
//
// Hidden from the sidebar and disabled here on 2026-08-29 (owner):
// "Completely hide the navigation link until the feature is fully built
// ... ensuring users do not land on an unfinished placeholder page."
//
// A redirect rather than a 404: someone with an old bookmark or a link
// in a chat should land somewhere useful, not on an error. Restore the
// page and the Sidebar entry together when the module is real.

import { redirect } from "next/navigation";

export default function DocumentsPage(): never {
  redirect("/");
}
