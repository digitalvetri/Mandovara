import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { ChangePasswordForm } from "./_components/ChangePasswordForm";
import { MandovaraLogo } from "../login/_components/MandovaraLogo";

export const dynamic = "force-dynamic";

// Change-password page: reachable both as a forced first-login step
// (mustChangePassword flag set) and as a self-service rotate for any
// signed-in user. No cookie → back to /login.
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ forced?: string }>;
}) {
  const jar = await cookies();
  const uid = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!uid) redirect("/login");

  const params = await searchParams;
  const forced = params.forced === "1";

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#F0F8F7" }}>
      <div className="w-full max-w-[440px]">
        <div className="mb-8">
          <MandovaraLogo />
        </div>

        <div className="rounded-[14px] bg-white border p-7" style={{ borderColor: "#DDF0EC" }}>
          <h1
            className="text-[24px] font-semibold leading-tight tracking-[-0.015em]"
            style={{ color: "#0F2A28", fontFamily: "'Fraunces', Georgia, serif" }}
          >
            {forced ? "Set a new password" : "Change your password"}
          </h1>
          <p className="mt-2 text-[13px]" style={{ color: "#5A7A78" }}>
            {forced
              ? "Your account is using a temporary password. Please pick one only you know before continuing."
              : "You'll be signed out and asked to log in again with the new password."}
          </p>

          <div className="mt-6">
            <ChangePasswordForm forced={forced} />
          </div>
        </div>
      </div>
    </div>
  );
}
