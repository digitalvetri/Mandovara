// Copy pattern (BUILD-SPEC §6.7):
// "You do not have access to Payroll. Ask Rohit Vaid to grant Payroll: View."
// Name who to ask AND the exact permission required.

interface PermissionDeniedProps {
  module: string;
  permission: string;
  approver?: string;
}

export function PermissionDenied({
  module,
  permission,
  approver = "your administrator",
}: PermissionDeniedProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="text-[16px] font-medium text-paper">
        You do not have access to {module}.
      </div>
      <p className="mt-2 max-w-[440px] text-[13px] text-paper-dim">
        Ask {approver} to grant <span className="font-medium text-paper">{module}: {permission}</span>.
      </p>
    </div>
  );
}
