// Spec types used by the entity generator.
// A ModuleSpec describes everything the generator needs to produce
// schema.ts, queries.ts and actions.ts for a module.

export interface FieldSpec {
  /** camelCase field name — used in Zod schema and Prisma data object */
  name: string;
  /** Raw Zod expression, e.g. "z.string().min(1).max(60)" */
  zod: string;
  /** If true, appends .optional() */
  optional?: boolean;
  /** If true, appends .nullable() */
  nullable?: boolean;
  /** JS literal for .default(), e.g. "30" or "[]" or '"FREE"' */
  defaultValue?: string;
}

export interface EntitySpec {
  /** PascalCase model name, e.g. "Vendor" */
  name: string;
  /** Prisma client key, e.g. "vendor" — should match prisma.vendor */
  dbName: string;
  fields: FieldSpec[];
  /** Permission key for create actions */
  createPermission: string;
  /** Permission key for update actions */
  updatePermission: string;
  /** Permission key for delete actions (omit if no delete) */
  deletePermission?: string;
  /** Path to revalidate after mutations */
  revalidatePath: string;
  /** Fields to include in the list query's orderBy (first field is default) */
  orderByField?: string;
}

export interface ModuleSpec {
  /** module directory name, e.g. "purchase" */
  moduleName: string;
  entities: EntitySpec[];
}
