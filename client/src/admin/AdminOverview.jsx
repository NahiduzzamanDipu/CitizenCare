import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api } from '../api/client';
import { Card, CardHeader, Stat, Spinner, Alert, Badge } from '../ui/Card';
import { Button } from '../ui/Field';

export function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/admin/overview')
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          System overview
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Everything running on this CitizenCare deployment.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Registered users"
          value={data.users.total}
          hint={`${data.users.new30d} joined in 30 days`}
        />
        <Stat
          label="Pending reports"
          value={data.reports.pending}
          tone={data.reports.pending > 0 ? 'warn' : undefined}
          hint={`${data.reports.total} reports all time`}
        />
        <Stat
          label="Active SOS"
          value={data.alerts.active}
          tone={data.alerts.active > 0 ? 'danger' : undefined}
          hint={`${data.alerts.total} alerts all time`}
        />
        <Stat
          label="Weapon detections (24h)"
          value={data.cctv.weaponEvents24h}
          tone={data.cctv.weaponEvents24h > 0 ? 'danger' : undefined}
          hint={`${data.cctv.weaponEvents} all time`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title="New accounts"
            subtitle="Registrations over the last 30 days"
          />
          <div className="h-64 px-2 pb-5">
            {data.signupsOverTime.length === 0 ? (
              <p className="px-3 text-sm text-slate-500">No signups in this window.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.signupsOverTime}>
                  <defs>
                    <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={30} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid rgb(203 213 225)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#signupFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Accounts by role" />
            <dl className="space-y-3 px-5 pb-5 text-sm">
              <Row label="Citizens" value={data.users.citizens} tone="brand" />
              <Row label="Police officers" value={data.users.officers} tone="green" />
              <Row label="Administrators" value={data.users.admins} tone="violet" />
              <Row label="Deactivated" value={data.users.inactive} tone="red" />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Police stations" />
            <div className="px-5 pb-5">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong className="font-display text-2xl text-slate-900 dark:text-white">
                  {data.stations.active}
                </strong>{' '}
                active of {data.stations.total}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Officers can only register with a station&rsquo;s code.
              </p>
              <Link to="/admin/stations">
                <Button variant="ghost" className="mt-3 w-full">
                  Manage stations &amp; codes
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Report queue"
          subtitle="Verification status across all submissions"
          right={
            <Link to="/admin/reports">
              <Button variant="ghost">Open queue</Button>
            </Link>
          }
        />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-4">
          <Stat label="Pending" value={data.reports.pending} tone="warn" />
          <Stat label="Verified" value={data.reports.verified} />
          <Stat label="Resolved" value={data.reports.resolved} />
          <Stat label="Marked fake" value={data.reports.fake} />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd>
        <Badge tone={tone}>{value}</Badge>
      </dd>
    </div>
  );
}
