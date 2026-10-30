/**
 * Seeds the accounts and station needed to sign in for the first time.
 *
 * Safe to re-run: existing records are reported, never overwritten. Override
 * any value with the SEED_* environment variables listed in .env.example.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { PoliceStation } from '../models/PoliceStation.js';

const config = {
  adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@citizencare.local',
  adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin12345!',
  policeEmail: process.env.SEED_POLICE_EMAIL || 'police@citizencare.local',
  policePassword: process.env.SEED_POLICE_PASSWORD || 'Police12345!',
  citizenEmail: process.env.SEED_CITIZEN_EMAIL || 'citizen@citizencare.local',
  citizenPassword: process.env.SEED_CITIZEN_PASSWORD || 'Citizen12345!',
  stationName: process.env.SEED_STATION_NAME || 'Central Police Station',
  stationCode: (process.env.SEED_STATION_CODE || 'PS-CENTRAL01').toUpperCase(),
  stationDistrict: process.env.SEED_STATION_DISTRICT || 'Dhaka',
};

async function ensureStation() {
  const existing = await PoliceStation.findOne({ name: config.stationName }).select(
    '+code'
  );
  if (existing) {
    console.log(`  station exists: ${existing.name} (code ${existing.code})`);
    return existing;
  }
  const station = await PoliceStation.create({
    name: config.stationName,
    code: config.stationCode,
    district: config.stationDistrict,
    address: 'Ramna, Dhaka 1000',
    phone: '999',
    location: { lat: 23.8103, lng: 90.4125 },
  });
  console.log(`  created station: ${station.name} (code ${config.stationCode})`);
  return station;
}

async function ensureUser({ email, password, name, role, station, badgeId }) {
  const existing = await User.findOne({ email });
  if (existing) {
    // Backfill a station posting on an account created before stations existed.
    if (role === 'police' && station && !existing.station) {
      existing.station = station;
      if (badgeId && !existing.badgeId) existing.badgeId = badgeId;
      await existing.save();
      console.log(`  ${role} exists: ${email} (linked to station)`);
    } else {
      console.log(`  ${role} exists: ${email}`);
    }
    return existing;
  }
  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    role,
    station: station || null,
    badgeId: badgeId || '',
  });
  console.log(`  created ${role}: ${email}`);
  return user;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Copy server/.env.example to server/.env.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Seeding CitizenCare…\n');

  const station = await ensureStation();

  await ensureUser({
    email: config.adminEmail,
    password: config.adminPassword,
    name: 'System Administrator',
    role: 'admin',
  });
  await ensureUser({
    email: config.policeEmail,
    password: config.policePassword,
    name: 'Officer Demo',
    role: 'police',
    station: station._id,
    badgeId: 'BD-0001',
  });
  await ensureUser({
    email: config.citizenEmail,
    password: config.citizenPassword,
    name: 'Demo Citizen',
    role: 'citizen',
  });

  const stationWithCode = await PoliceStation.findById(station._id).select('+code');

  console.log('\n─────────────────────────────────────────────');
  console.log(' Sign-in credentials (change before deploying)');
  console.log('─────────────────────────────────────────────');
  console.log(` Admin    ${config.adminEmail} / ${config.adminPassword}`);
  console.log(` Police   ${config.policeEmail} / ${config.policePassword}`);
  console.log(` Citizen  ${config.citizenEmail} / ${config.citizenPassword}`);
  console.log('');
  console.log(` Police registration code: ${stationWithCode.code}`);
  console.log(' New officers enter that code at /register (Police tab).');
  console.log('─────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
