import fs from 'fs';

// 1. Remove UserManagement from SystemAiAdminControl.tsx
let sysFile = fs.readFileSync('src/components/SystemAiAdminControl.tsx', 'utf-8');
sysFile = sysFile.replace("import { UserManagement } from './UserManagement';\n", "");
sysFile = sysFile.replace("      <UserManagement />\n      \n", "");
fs.writeFileSync('src/components/SystemAiAdminControl.tsx', sysFile);

// 2. Add SystemAiAdminControl to AdminLogsDashboard.tsx after UserManagement
let adminFile = fs.readFileSync('src/components/AdminLogsDashboard.tsx', 'utf-8');
if (!adminFile.includes("SystemAiAdminControl")) {
  adminFile = adminFile.replace(
    "import { UserManagement } from './UserManagement';",
    "import { UserManagement } from './UserManagement';\nimport { SystemAiAdminControl } from './SystemAiAdminControl';"
  );
  
  adminFile = adminFile.replace(
    "      {/* User Management Section */}\n      <UserManagement />",
    "      {/* User Management Section */}\n      <UserManagement />\n\n      {/* System AI Admin Control */}\n      <SystemAiAdminControl />"
  );
  fs.writeFileSync('src/components/AdminLogsDashboard.tsx', adminFile);
}
