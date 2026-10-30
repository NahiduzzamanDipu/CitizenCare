import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Spinner, Alert, EmptyState } from '../ui/Card';
import { Button, TextInput, Select } from '../ui/Field';

const ROLE_TONE = { admin: 'violet', police: 'green', citizen: 'brand' };
const PAGE_SIZE = 20;

export function AdminUsers() {
  const { user: me } = useAuth();
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(
        `/api/admin/users${qs({ page, limit: PAGE_SIZE, role, status, q: appliedSearch })}`
      );
      setData(res);
    } catch (e) {
      setError(e.message);
      setData({ items: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, role, status, appliedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setAppliedSearch(search.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function mutate(id, patch, description) {
    setError('');
    setNotice('');
    try {
      await api.patch(`/api/admin/users/${id}`, patch);
      setNotice(description);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(u) {
    if (
      !window.confirm(
        `Permanently delete ${u.email}? Their reports stay in the system but the account and its notifications are removed.`
      )
    ) {
      return;
    }
    setError('');
    try {
      await api.delete(`/api/admin/users/${u._id}`);
      setNotice(`Deleted ${u.email}.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Users
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {data.total} account{data.total === 1 ? '' : 's'}. Promote, suspend or
            remove any of them.
          </p>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="green">{notice}</Alert>}

      <Card>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <TextInput
            label="Search"
            placeholder="Name, email or badge…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Role"
            value={role}
            onChange={(e) => {
              setPage(1);
              setRole(e.target.value);
            }}
          >
            <option value="">All roles</option>
            <option value="citizen">Citizen</option>
            <option value="police">Police</option>
            <option value="admin">Admin</option>
          </Select>
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState title="No users match these filters">
          Try clearing the search or switching the role filter.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                <tr>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Station</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr
                    key={u._id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {u.name}
                        {u._id === me?.id && (
                          <span className="ml-2 text-xs text-slate-400">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      {u.badgeId && (
                        <p className="text-xs text-slate-400">Badge {u.badgeId}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {u.station?.name || '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={u.isActive ? 'green' : 'red'}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          className="px-2.5 py-1.5 text-xs"
                          onClick={() => setEditing(u)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={u.isActive ? 'ghost' : 'success'}
                          className="px-2.5 py-1.5 text-xs"
                          disabled={u._id === me?.id}
                          onClick={() =>
                            mutate(
                              u._id,
                              { isActive: !u.isActive },
                              `${u.email} ${u.isActive ? 'deactivated' : 'reactivated'}.`
                            )
                          }
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="danger"
                          className="px-2.5 py-1.5 text-xs"
                          disabled={u._id === me?.id}
                          onClick={() => remove(u)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {editing && (
        <EditUserDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setNotice(msg);
            load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function EditUserDialog({ user, onClose, onSaved, onError }) {
  const [stations, setStations] = useState([]);
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    role: user.role,
    badgeId: user.badgeId || '',
    stationId: user.station?._id || '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/api/stations')
      .then((list) => setStations(Array.isArray(list) ? list : []))
      .catch(() => setStations([]));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/api/admin/users/${user._id}`, {
        name: form.name,
        phone: form.phone,
        role: form.role,
        badgeId: form.role === 'police' ? form.badgeId : '',
        stationId: form.role === 'police' ? form.stationId || null : null,
      });
      if (newPassword) {
        await api.post(`/api/admin/users/${user._id}/reset-password`, {
          newPassword,
        });
      }
      onSaved(`Saved changes to ${user.email}.`);
    } catch (e) {
      onError(e.message);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          Edit {user.email}
        </h2>

        <div className="mt-5 space-y-4">
          <TextInput label="Name" value={form.name} onChange={set('name')} />
          <TextInput label="Phone" value={form.phone} onChange={set('phone')} />
          <Select
            label="Role"
            value={form.role}
            onChange={set('role')}
            hint="Promoting to police lets this account see all reports, SOS alerts and camera feeds."
          >
            <option value="citizen">Citizen</option>
            <option value="police">Police</option>
            <option value="admin">Admin</option>
          </Select>

          {form.role === 'police' && (
            <>
              <TextInput
                label="Badge / service number"
                value={form.badgeId}
                onChange={set('badgeId')}
              />
              <Select label="Station" value={form.stationId} onChange={set('stationId')}>
                <option value="">Unassigned</option>
                {stations.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </>
          )}

          <TextInput
            label="Set a new password (optional)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="Leave blank to keep the current password. Minimum 8 characters."
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            loading={saving}
            disabled={newPassword.length > 0 && newPassword.length < 8}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
