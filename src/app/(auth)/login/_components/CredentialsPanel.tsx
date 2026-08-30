export const DEFAULT_PASSWORD = "Mandovara@2026";

// The single administrator account. This helper renders only outside
// production (SHOW_CREDS_HELPER in LoginTabs), and it used to list nine
// seeded demo logins — eight of which the 2026-08-30 data wipe removed,
// so it was offering accounts that no longer exist.
const SEEDED_USERS = [
  { role: "Administrator", email: "mandovara22@gmail.com" },
] as const;

export function CredentialsPanel({ onSelect }: { onSelect: (email: string) => void }) {
  return (
    <div
      className="mb-2 rounded-[10px] overflow-hidden border"
      style={{ borderColor: "#C8E8E4", background: "#F0FBF9" }}
    >
      <div className="px-3 py-2 border-b" style={{ borderColor: "#C8E8E4" }}>
        <div className="text-[10.5px] font-semibold" style={{ color: "#1B8A7E" }}>
          Local dev account · password:{" "}
          <span className="font-mono tracking-wide">{DEFAULT_PASSWORD}</span>
        </div>
      </div>
      <div className="max-h-[180px] overflow-y-auto">
        {SEEDED_USERS.map(({ role, email }) => (
          <button
            key={email}
            type="button"
            onClick={() => onSelect(email)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#D8F5F0] transition-colors border-b last:border-0 text-left"
            style={{ borderColor: "#DDF0EC" }}
          >
            <span className="text-[11px] font-medium" style={{ color: "#0F2A28" }}>{role}</span>
            <span className="text-[10.5px] font-mono" style={{ color: "#5A7A78" }}>{email}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
