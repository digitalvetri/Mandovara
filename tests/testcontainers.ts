// Helper for DB-backed tests using a real Postgres 16 container.
// Kernel and module tests import this instead of mocking Prisma.

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

export interface StartedPg {
  container: StartedPostgreSqlContainer;
  url: string;
  stop(): Promise<void>;
}

export async function startPostgres(): Promise<StartedPg> {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("mandovara_test")
    .withUsername("mandovara")
    .withPassword("mandovara")
    .start();

  return {
    container,
    url: container.getConnectionUri(),
    stop: async () => {
      await container.stop();
    },
  };
}
