import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../api/client';
import { Card, CardHeader, Stat, Spinner, Alert, EmptyState } from '../ui/Card';
import { Select } from '../ui/Field';
import { useTheme } from '../context/ThemeContext';

const TYPE_COLORS = {
  theft: '#f59e0b',
  assault: '#ef4444',
  vandalism: '#a855f7',
  traffic: '#0ea5e9',
  domestic: '#ec4899',
  drugs: '#14b8a6',
  other: '#64748b',
};

const STATUS_COLORS = {
  pending: '#f59e0b',
  verified: '#10b981',
  fake: '#ef4444',
  resolved: '#3b82f6',
};

export function Analytics() {
  const { theme } = useTheme();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    api
      .get(`/api/analytics/summary?days=${days}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const axisTick = {
    fontSize: 11,
    fill: theme === 'dark' ? '#94a3b8' : '#475569',
  };
  const tooltipStyle = {
    borderRadius: 12,
    fontSize: 12,
    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
    color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
  };

  if (error) return <Alert>{error}</Alert>;
  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const hasReports = data.totalReports > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Incident volume, category mix and response backlog.
          </p>
        </div>
        <div className="w-44">
          <Select
            label="Time range"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </Select>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total reports" value={data.totalReports} />
        <Stat
          label="Awaiting review"
          value={data.pendingReports}
          tone={data.pendingReports > 0 ? 'warn' : undefined}
        />
        <Stat
          label="Active SOS"
          value={data.activeAlerts}
          tone={data.activeAlerts > 0 ? 'danger' : undefined}
          hint={`${data.totalAlerts} all time`}
        />
        <Stat
          label="Weapon detections"
          value={data.weaponEvents}
          hint="From live CCTV analysis"
        />
      </div>

      {!hasReports ? (
        <EmptyState title="No report data yet">
          Charts appear once citizens start submitting incidents. Sign in as a
          citizen and file a test report to see this fill in.
        </EmptyState>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Reports over time"
              subtitle={`Daily submissions over the last ${data.days} days`}
            />
            <div className="h-72 px-2 pb-5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.reportsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                  <XAxis dataKey="date" tick={axisTick} tickLine={false} />
                  <YAxis tick={axisTick} allowDecimals={false} width={32} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Reports"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Reports by type" subtitle="All time" />
              <div className="h-72 px-2 pb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byType} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} horizontal={false} />
                    <XAxis type="number" tick={axisTick} allowDecimals={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="crimeType"
                      tick={axisTick}
                      width={78}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fillOpacity: 0.06 }} />
                    <Bar dataKey="count" name="Reports" radius={[0, 6, 6, 0]}>
                      {data.byType.map((entry) => (
                        <Cell
                          key={entry.crimeType}
                          fill={TYPE_COLORS[entry.crimeType] || TYPE_COLORS.other}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Verification status" subtitle="Where reports end up" />
              <div className="h-72 px-2 pb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.byStatus}
                      dataKey="count"
                      nameKey="status"
                      innerRadius="52%"
                      outerRadius="78%"
                      paddingAngle={3}
                    >
                      {data.byStatus.map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={STATUS_COLORS[entry.status] || '#64748b'}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(v) => (
                        <span style={{ fontSize: 12, color: axisTick.fill }}>{v}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {data.topLocations.length > 0 && (
            <Card>
              <CardHeader
                title="Most reported locations"
                subtitle="Addresses attached to incident reports"
              />
              <ul className="space-y-2 px-5 pb-5">
                {data.topLocations.map((loc) => (
                  <li
                    key={loc.address}
                    className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {loc.address}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
                      {loc.count}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
