/**
 * Integration tests for the authorisation model — the part of the system where
 * a regression is most costly. Requires a reachable MongoDB (see CI, or run
 * locally with MONGODB_URI pointing at a scratch database).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.JWT_SECRET ||= 'test-secret-value-at-least-32-characters-long';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/citizen_care_test';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

const { User } = await import('../src/models/User.js');
const { PoliceStation } = await import('../src/models/PoliceStation.js');
const { signToken } = await import('../src/utils/jwt.js');

const unique = () => Math.random().toString(36).slice(2, 10);

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

after(async () => {
  // Only remove what these tests created.
  await User.deleteMany({ email: /@test\.citizencare\.local$/ });
  await PoliceStation.deleteMany({ name: /^Test Station/ });
  await mongoose.disconnect();
});

describe('password hashing', () => {
  test('hashes are bcrypt and verify correctly', async () => {
    const hash = await User.hashPassword('correct horse battery');
    assert.match(hash, /^\$2[aby]\$12\$/, 'uses bcrypt with cost 12');
    assert.notEqual(hash, 'correct horse battery');

    const user = new User({
      name: 'Hash Test',
      email: `hash-${unique()}@test.citizencare.local`,
      passwordHash: hash,
    });
    assert.equal(await user.comparePassword('correct horse battery'), true);
    assert.equal(await user.comparePassword('wrong password'), false);
  });

  test('toJSON never exposes the hash', async () => {
    const user = new User({
      name: 'Leak Test',
      email: `leak-${unique()}@test.citizencare.local`,
      passwordHash: await User.hashPassword('password123'),
    });
    assert.equal(user.toJSON().passwordHash, undefined);
  });
});

describe('roles', () => {
  test('new accounts default to citizen', async () => {
    const user = await User.create({
      name: 'Default Role',
      email: `default-${unique()}@test.citizencare.local`,
      passwordHash: await User.hashPassword('password123'),
    });
    assert.equal(user.role, 'citizen');
  });

  test('an unknown role is rejected by the schema', async () => {
    const user = new User({
      name: 'Bad Role',
      email: `bad-${unique()}@test.citizencare.local`,
      passwordHash: 'x',
      role: 'superuser',
    });
    await assert.rejects(() => user.validate(), /role/);
  });

  test('a token carries the role it was signed with', async () => {
    const user = await User.create({
      name: 'Token Test',
      email: `token-${unique()}@test.citizencare.local`,
      passwordHash: await User.hashPassword('password123'),
      role: 'police',
    });
    const jwt = (await import('jsonwebtoken')).default;
    const payload = jwt.verify(signToken(user), process.env.JWT_SECRET);
    assert.equal(payload.role, 'police');
    assert.equal(payload.sub, user._id.toString());
  });
});

describe('police stations', () => {
  test('the registration code is excluded from ordinary queries', async () => {
    const name = `Test Station ${unique()}`;
    await PoliceStation.create({ name, code: `TS-${unique().toUpperCase()}` });

    const withoutCode = await PoliceStation.findOne({ name }).lean();
    assert.equal(withoutCode.code, undefined, 'code must be select:false');

    const withCode = await PoliceStation.findOne({ name }).select('+code').lean();
    assert.ok(withCode.code, 'code is readable when explicitly selected');
  });

  test('codes are stored uppercase so lookups are case-insensitive', async () => {
    const name = `Test Station ${unique()}`;
    const code = `ts-${unique()}`;
    await PoliceStation.create({ name, code });

    const found = await PoliceStation.findOne({
      code: code.toUpperCase(),
    }).select('+code');
    assert.ok(found, 'a lowercase code at signup matches the stored record');
    assert.equal(found.code, code.toUpperCase());
  });

  test('two stations cannot share a code', async () => {
    const code = `TS-${unique().toUpperCase()}`;
    await PoliceStation.create({ name: `Test Station ${unique()}`, code });
    await assert.rejects(
      () => PoliceStation.create({ name: `Test Station ${unique()}`, code }),
      (err) => err.code === 11000
    );
  });
});

describe('accounts', () => {
  test('emails are unique and normalised to lowercase', async () => {
    const email = `Dup-${unique()}@Test.CitizenCare.Local`;
    const created = await User.create({
      name: 'First',
      email,
      passwordHash: await User.hashPassword('password123'),
    });
    assert.equal(created.email, email.toLowerCase());

    await assert.rejects(
      () =>
        User.create({
          name: 'Second',
          email: email.toUpperCase(),
          passwordHash: 'x',
        }),
      (err) => err.code === 11000
    );
  });

  test('accounts are active by default', async () => {
    const user = await User.create({
      name: 'Active',
      email: `active-${unique()}@test.citizencare.local`,
      passwordHash: await User.hashPassword('password123'),
    });
    assert.equal(user.isActive, true);
  });
});
