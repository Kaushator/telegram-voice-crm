import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `  const db = getDb();
  let dbUser = db.users.find(u => u.telegram_id === telegramId);`;
const replacementStr = `  const db = getDb();
  let dbUser = db.users.find(u => u.telegram_id === telegramId);
  if (dbUser && dbUser.role === 'kicked') {
    return res.status(403).json({ error: 'ACCESS_DENIED', message: 'Access denied' });
  }`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('server.ts', code);
