import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const unbanRoute = `
app.post('/api/admin/unban', express.json(), (req, res) => {
  const { userId } = req.body;
  const db = getDb();
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.role = 'pending' as any;
    saveDb();
    res.json({ success: true, user });
  } else {
    res.status(404).json({ success: false, error: 'User not found' });
  }
});
`;

code = code.replace("app.post('/api/admin/kick', express.json(), (req, res) => {", unbanRoute + "\napp.post('/api/admin/kick', express.json(), (req, res) => {");
fs.writeFileSync('server.ts', code);
