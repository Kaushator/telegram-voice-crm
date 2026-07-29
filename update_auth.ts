import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const regex = /const handleAuthMe = \(req: Request, res: Response\) => \{[\s\S]*?isDevFallback: true\s*\}\);\s*\};/;
const match = code.match(regex);
if (match) {
  const newAuthMe = `const handleAuthMe = (req: Request, res: Response) => {
  const initData =
    (req.headers['x-telegram-init-data'] as string) ||
    (req.body?.initData as string) ||
    (req.query?.initData as string);

  const chiefTgId = process.env.CHIEF_TELEGRAM_ID || '1001';

  if (initData) {
    const result = validateTelegramInitData(initData);
    if (result.valid && result.user) {
      const telegramId = String(result.user.id);
      
      const db = getDb();
      let dbUser = db.users.find(u => u.telegram_id === telegramId);
      
      if (!dbUser) {
        let role = telegramId === chiefTgId ? 'chief' : 'assistant';
        if (telegramId === '1000') role = 'admin';
        dbUser = {
          id: 'usr-' + telegramId,
          telegram_id: telegramId,
          role: role as any,
          created_at: new Date().toISOString(),
          first_name: result.user.first_name,
          username: result.user.username
        };
        db.users.push(dbUser);
        saveDb();
      } else {
        // Update name if changed
        if (result.user.first_name && dbUser.first_name !== result.user.first_name) {
          dbUser.first_name = result.user.first_name;
          saveDb();
        }
      }

      if (dbUser.role === 'kicked') {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const payload = {
        userId: dbUser.id,
        telegramId,
        role: dbUser.role,
        displayName: dbUser.first_name || 'Пользователь'
      };
      const token = generateJwtToken(payload);

      return res.json({
        success: true,
        user: {
          id: result.user.id,
          telegramId,
          first_name: dbUser.first_name,
          username: dbUser.username
        },
        role: dbUser.role,
        token
      });
    } else {
        return res.status(401).json({ success: false, error: 'Invalid init data' });
    }
  }

  // Fallback for dev / browser preview
  return res.json({
    success: true,
    user: { id: 1000, telegramId: '1000', first_name: 'Admin', username: 'admin' },
    role: 'admin',
    token: generateJwtToken({ userId: 'usr-admin', telegramId: '1000', role: 'admin', displayName: 'Admin' }),
    isDevFallback: true
  });
};`;
  code = code.replace(match[0], newAuthMe);
  fs.writeFileSync('server.ts', code);
}
