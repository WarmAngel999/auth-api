const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Использование: npm run create-admin -- <email> <пароль>');
    process.exit(1);
  }
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    console.error('Пароль: не короче 8 символов и не длиннее 72 байт');
    process.exit(1);
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      `INSERT INTO users (email, "passwordHash", role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin'
       RETURNING id, email, role`,
      [email.trim().toLowerCase(), hash],
    );
    console.log('Администратор готов:', rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
