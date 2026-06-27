import { Global, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Connexion DB **runtime** (lot 1.1). Le lot 0.3 a posé le schéma + les
 * migrations ; l'`auth-account` est le **premier** module à écrire en base à
 * l'exécution, il fallait donc une connexion injectable. Module transverse et
 * volontairement minimal (pas de repository générique — Architecture §6/§7) :
 * il expose une instance Drizzle typée sur tout le schéma. C'est l'`api` qui
 * possède la DB (Architecture §1/§3).
 */

/** Jeton d'injection de l'instance Drizzle. */
export const DRIZZLE = Symbol('DRIZZLE');

/** Type de l'instance Drizzle (typée sur l'ensemble du schéma socle + auth). */
export type Database = NodePgDatabase<typeof schema>;

const DEV_DATABASE_URL = 'postgresql://hpt:hpt@localhost:5432/hpt';

@Injectable()
class DatabasePool implements OnModuleDestroy {
  readonly pool: Pool;
  readonly db: Database;

  constructor() {
    // En prod, `DATABASE_URL` vient du Secret Manager (Stack §3.5) ; repli dev
    // ergonomique aligné sur `drizzle.config.ts` (lot 0.3). Le pool se connecte
    // paresseusement : aucune connexion n'est ouverte tant qu'on ne requête pas.
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL ?? DEV_DATABASE_URL });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    DatabasePool,
    {
      provide: DRIZZLE,
      useFactory: (connection: DatabasePool) => connection.db,
      inject: [DatabasePool],
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
