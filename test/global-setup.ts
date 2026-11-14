import 'dotenv/config';
import './setup-env';
import dataSource from '../src/data-source';

export default async function globalSetup() {
  await dataSource.initialize();
  try {
    if (dataSource.options.database !== 'auth_test') {
      throw new Error('globalSetup: разрешена только база auth_test');
    }
    await dataSource.dropDatabase();
    const applied = await dataSource.runMigrations();
    if (applied.length === 0) {
      throw new Error(
        'globalSetup: не применено ни одной миграции, проверь пути migrations в data-source.ts',
      );
    }
    console.log('Применены миграции:', applied.map((m) => m.name).join(', '));
  } finally {
    await dataSource.destroy();
  }
}
