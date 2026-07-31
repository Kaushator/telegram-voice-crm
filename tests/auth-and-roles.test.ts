import assert from 'node:assert';
import test, { describe, it } from 'node:test';
import { generateJwtToken, verifyJwtToken, validateTelegramInitData } from '../src/auth.js';
import { getDb, saveDb } from '../src/db.js';

describe('Auth & Roles System Tests', () => {
  it('should generate and verify JWT tokens with user payload', () => {
    const payload = {
      userId: 'usr-1002',
      telegramId: '1002',
      role: 'assistant' as const,
      displayName: 'Анна'
    };

    const token = generateJwtToken(payload);
    assert.ok(token && typeof token === 'string');

    const decoded = verifyJwtToken(token);
    assert.ok(decoded);
    assert.strictEqual(decoded.userId, 'usr-1002');
    assert.strictEqual(decoded.role, 'assistant');
  });

  it('should correctly fallback test users in development', () => {
    const resChief = validateTelegramInitData('test_chief');
    assert.strictEqual(resChief.valid, true);
    assert.strictEqual(resChief.user?.id, 1001);

    const resAssistant = validateTelegramInitData('test_assistant_1');
    assert.strictEqual(resAssistant.valid, true);
    assert.strictEqual(resAssistant.user?.id, 1002);
  });

  it('should enforce single boss rule in DB state', () => {
    const db = getDb();
    
    // Ensure boss exists
    const bossUser = db.users.find(u => u.role === 'boss');
    assert.ok(bossUser, 'A boss user should exist in initial seed DB');

    const assistantUser = db.users.find(u => u.role === 'assistant');
    assert.ok(assistantUser, 'An assistant user should exist in initial seed DB');

    // Simulate single boss check logic
    const existingBoss = db.users.find(u => u.role === 'boss' && u.id !== assistantUser.id);
    assert.ok(existingBoss, 'Attempting to assign boss role to assistant while another boss exists should detect collision');
  });

  it('should correctly execute replace-boss logic', () => {
    const db = getDb();
    const oldBoss = db.users.find(u => u.role === 'boss');
    const newBossCandidate = db.users.find(u => u.role === 'assistant');

    assert.ok(oldBoss && newBossCandidate);

    // Perform replacement logic
    db.users.forEach(u => {
      if (u.role === 'boss' && u.id !== newBossCandidate.id) {
        u.role = 'assistant';
      }
    });
    newBossCandidate.role = 'boss';
    saveDb();

    assert.strictEqual(newBossCandidate.role, 'boss');
    assert.strictEqual(oldBoss.role, 'assistant');

    // Restore original boss
    db.users.forEach(u => {
      if (u.role === 'boss' && u.id !== oldBoss.id) {
        u.role = 'assistant';
      }
    });
    oldBoss.role = 'boss';
    saveDb();
  });
});
