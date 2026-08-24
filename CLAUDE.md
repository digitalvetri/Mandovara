# Mandovara Interior OS — Claude Code Instructions

## Project

Mandovara is a measure-to-install Interior OS for interior décor and furnishing.

The detailed product and implementation specification is stored at:

`docs/Mandovara-Master-Spec.md`

Read that file when working on a feature covered by the specification.

## Critical Rules

1. Work phase by phase according to the Master Specification.
2. Inspect the existing implementation before making changes.
3. Do not invent APIs, database models, routes, or business rules.
4. Reuse existing components, APIs, server actions, and utilities where possible.
5. Do not modify unrelated modules.
6. Never reset the database unless the user explicitly asks for it.
7. Use Prisma migrations for schema changes. Never use `prisma db push`.
8. Money must use the existing BigInt/paise approach. Never introduce floating-point money calculations.
9. Measurement and material calculations must remain pure functions in `/lib/calc` and must have tests.
10. Made-to-measure quotation lines require the appropriate measurement data according to the Master Specification.
11. RBAC must be enforced server-side, not only through UI visibility.
12. WhatsApp automation must follow the existing AutomationLog/idempotency requirements.
13. Preserve existing quotation, client, project, inventory, measurement, invoicing, WhatsApp, and authentication functionality.
14. Do not create duplicate database tables or duplicate business systems.
15. Do not use mock data when real application data already exists.

## UI/UX Rules

- Follow the existing Mandovara design system.
- Keep interfaces simple and understandable.
- Prefer clear labels over technical terminology.
- Maintain consistent typography, spacing, buttons, cards, and status indicators.
- Preserve the existing sidebar and top navigation unless explicitly asked to change them.
- Make pages responsive.
- Avoid unnecessary navigation away from the current workflow.
- Do not remove existing functionality merely to simplify the UI.

## Database Safety

Before changing the schema:

1. Inspect the existing Prisma schema.
2. Identify existing models and relationships.
3. Make the smallest necessary change.
4. Create a proper migration.
5. Never run `prisma migrate reset --force` unless explicitly instructed by the user.

## Implementation Process

Before coding:

1. Understand the user's requested change.
2. Inspect the relevant routes, components, APIs, database models, and existing workflows.
3. Identify reusable existing functionality.
4. Explain the implementation approach briefly.
5. Then implement only the requested scope.

After coding:

1. Run relevant lint/type checks.
2. Run relevant tests.
3. Verify the affected workflow.
4. Fix errors introduced by the change.
5. Report exactly what was changed and what was verified.

## Master Specification

For detailed business rules, workflows, routes, calculations, product families, data models, testing requirements, and phase-specific requirements, read:

`docs/Mandovara-Master-Spec.md`

The Master Specification is the detailed source of truth for Mandovara-specific requirements. These instructions define the day-to-day safety and development rules for Claude Code.
