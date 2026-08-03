import { LoginTabs } from "./_components/LoginTabs";

export const dynamic = "force-static";

export default function LoginPage() {
  return (
    <div className="min-h-screen grid grid-cols-2">
      {/* Left panel — brand + selling copy on dark ground */}
      <aside className="bg-sidebar text-sidebar-text px-16 py-14 flex flex-col justify-between">
        <div>
          <div className="font-display text-[22px] tracking-[0.18em] font-semibold leading-none">
            MANDOVARA
          </div>
          <div className="mt-2 text-[9.5px] tracking-[0.28em] text-sidebar-dim uppercase">
            Studio Console
          </div>
        </div>

        <div className="max-w-[420px]">
          <div className="font-display text-[34px] leading-[1.15] text-sidebar-text">
            One console for
            <span className="text-accent"> leads, orders, projects and payroll.</span>
          </div>
          <p className="mt-4 text-[13px] text-sidebar-dim leading-relaxed">
            Built for the storekeeper on a ₹9,000 Android, the accounts clerk
            on a keyboard, and the site engineer on dusty hands. Not built
            for a demo.
          </p>
        </div>

        <div className="text-[11px] text-sidebar-dim">
          Version 0.1.0 · Mandovara Business Solutions · Coimbatore
        </div>
      </aside>

      {/* Right panel — sign-in card */}
      <div className="flex items-center justify-center px-8">
        <div className="w-full max-w-[380px]">
          <div className="mb-6">
            <div className="font-display text-[26px] font-semibold text-text">Sign in</div>
            <div className="mt-1 text-[12.5px] text-text-dim">
              Choose how you want to sign in today.
            </div>
          </div>
          <LoginTabs />
        </div>
      </div>
    </div>
  );
}
