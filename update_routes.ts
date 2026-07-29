import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const adminRoutes = `
app.get('/api/admin/users', (req, res) => {
  const db = getDb();
  res.json({ success: true, users: db.users });
});

app.post('/api/admin/set-role', express.json(), (req, res) => {
  const { userId, role } = req.body;
  const db = getDb();
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.role = role;
    saveDb();
    res.json({ success: true, user });
  } else {
    res.status(404).json({ success: false, error: 'User not found' });
  }
});

app.post('/api/admin/kick', express.json(), (req, res) => {
  const { userId } = req.body;
  const db = getDb();
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.role = 'kicked' as any;
    saveDb();
    res.json({ success: true, user });
  } else {
    res.status(404).json({ success: false, error: 'User not found' });
  }
});
`;

code = code.replace("app.get('/api/auth/me', handleAuthMe);", adminRoutes + "\napp.get('/api/auth/me', handleAuthMe);");
fs.writeFileSync('server.ts', code);
