import postgres from 'postgres';
import crypto from 'crypto';

const DB_URL = 'postgresql://neondb_owner:npg_zhXcb6DV9RTj@ep-bold-darkness-acbc7b9t-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = postgres(DB_URL, { ssl: 'require', max: 1 });

// Aplicar migration
console.log('📦 Aplicando migration...');
try {
  await sql`ALTER TABLE "users" ADD COLUMN "passwordHash" text`;
  console.log('✓ Coluna passwordHash adicionada');
} catch (e) {
  if (e.message.includes('already exists')) {
    console.log('⚠ Coluna passwordHash já existe, pulando...');
  } else {
    console.error('Erro na migration:', e.message);
  }
}

// Criar hash da senha admin123
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'remote-manager-salt').digest('hex');
}

const adminPassword = 'admin123';
const passwordHash = hashPassword(adminPassword);

// Inserir ou atualizar usuário admin
console.log('\n👤 Criando usuário admin...');
try {
  await sql`
    INSERT INTO users ("openId", "name", "email", "loginMethod", "role", "passwordHash", "lastSignedIn")
    VALUES ('local-admin', 'Robson Silva', 'admin@local', 'local', 'admin', ${passwordHash}, NOW())
    ON CONFLICT ("openId") DO UPDATE SET
      "name" = 'Robson Silva',
      "email" = 'admin@local',
      "role" = 'admin',
      "passwordHash" = ${passwordHash},
      "updatedAt" = NOW()
  `;
  console.log('✓ Usuário admin criado/atualizado com sucesso!');
} catch (e) {
  console.error('Erro ao criar admin:', e.message);
}

await sql.end();

console.log('\n✅ Pronto! Credenciais de acesso:');
console.log('   Usuário: admin');
console.log('   Senha:   admin123');
console.log('\n⚠️  IMPORTANTE: Troque a senha após o primeiro login!');
console.log('\n💡 Acesse: http://localhost:3000/login');
