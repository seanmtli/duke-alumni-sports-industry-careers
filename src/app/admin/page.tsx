'use client';

import { useState, useEffect } from 'react';
import type { Alumni, Submission, ContactRequest, OrgCategory, SportsFunction, SeniorityLevel, School, DukeDegree } from '@/types/alumni';
import {
  ORG_CATEGORIES, ORG_CATEGORY_LABELS,
  SPORTS_FUNCTIONS, SPORTS_FUNCTION_LABELS,
  SENIORITY_LEVELS, SCHOOLS,
} from '@/lib/constants';
import initialData from '@/data/alumni.json';

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'duke2025';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const EMPTY_FORM: Omit<Alumni, 'id' | 'added_date' | 'last_verified'> = {
  name: '',
  grad_year: new Date().getFullYear(),
  school: 'Trinity',
  degree: '',
  major: '',
  current_company: '',
  current_title: '',
  company_type: 'Other',
  sub_industries: [],
  org_category: null,
  sports_functions: [],
  seniority_level: 'Mid',
  linkedin_url: '',
  location: '',
  headshot_url: null,
  sports_league_affiliation: null,
};

type DegreeInput = { school: School; grad_year: number; degree: string; major: string };

function degreesFromAlumni(a?: Alumni): DegreeInput[] {
  const currentYear = new Date().getFullYear();
  if (a?.all_degrees?.length) {
    return a.all_degrees.map((d) => ({
      school: (SCHOOLS.includes(d.school as School) ? d.school : 'Other') as School,
      grad_year: d.grad_year ?? currentYear,
      degree: d.degree ?? '',
      major: d.major ?? '',
    }));
  }
  return [{
    school: a?.school ?? 'Trinity',
    grad_year: a?.grad_year ?? currentYear,
    degree: a?.degree ?? '',
    major: a?.major ?? '',
  }];
}

function AlumniForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Alumni;
  onSave: (a: Alumni) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const [degrees, setDegrees] = useState<DegreeInput[]>(() => degreesFromAlumni(initial));
  const today = new Date().toISOString().split('T')[0];

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleSportsFunction(fn: SportsFunction) {
    set(
      'sports_functions',
      (form.sports_functions ?? []).includes(fn)
        ? (form.sports_functions ?? []).filter((f) => f !== fn)
        : [...(form.sports_functions ?? []), fn]
    );
  }

  function setDegree<K extends keyof DegreeInput>(index: number, key: K, value: DegreeInput[K]) {
    setDegrees((ds) => ds.map((d, i) => (i === index ? { ...d, [key]: value } : d)));
  }

  function addDegree() {
    setDegrees((ds) => [...ds, { school: 'Trinity', grad_year: new Date().getFullYear(), degree: '', major: '' }]);
  }

  function removeDegree(index: number) {
    setDegrees((ds) => ds.filter((_, i) => i !== index));
  }

  function handleSave() {
    const primary = degrees[0];
    const all_degrees: DukeDegree[] = degrees.map((d) => ({
      school: d.school,
      degree: d.degree || null,
      grad_year: Number.isInteger(d.grad_year) ? d.grad_year : null,
      major: d.major || null,
    }));
    const record: Alumni = {
      ...(form as Omit<Alumni, 'id' | 'added_date' | 'last_verified'>),
      // Primary degree stays flat for the id, card, and legacy consumers.
      grad_year: primary.grad_year,
      school: primary.school,
      degree: primary.degree,
      major: primary.major,
      all_degrees,
      id: initial?.id ?? `${slugify(form.name)}-${primary.grad_year}`,
      added_date: initial?.added_date ?? today,
      last_verified: today,
    };
    onSave(record);
  }

  const inputCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#003087]';
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name *</label>
          <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Current Title *</label>
          <input className={inputCls} value={form.current_title} onChange={(e) => set('current_title', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Current Company *</label>
          <input className={inputCls} value={form.current_company} onChange={(e) => set('current_company', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Industry</label>
          <select className={inputCls} value={form.org_category ?? ''} onChange={(e) => set('org_category', (e.target.value || null) as OrgCategory | null)}>
            <option value="">Select…</option>
            {ORG_CATEGORIES.map((c) => <option key={c} value={c}>{ORG_CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Seniority</label>
          <select className={inputCls} value={form.seniority_level} onChange={(e) => set('seniority_level', e.target.value as SeniorityLevel)}>
            {SENIORITY_LEVELS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input className={inputCls} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="New York, NY" />
        </div>
        <div>
          <label className={labelCls}>LinkedIn URL</label>
          <input type="url" className={inputCls} value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>League Affiliation</label>
          <input className={inputCls} value={form.sports_league_affiliation ?? ''} onChange={(e) => set('sports_league_affiliation', e.target.value || null)} placeholder="NBA, NFL, MLS…" />
        </div>
      </div>

      {/* Duke degrees — supports multiple (e.g. undergrad + MBA) */}
      <div>
        <label className={labelCls}>Duke Degree(s) *</label>
        <div className="space-y-3 mt-1">
          {degrees.map((deg, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 relative">
              {degrees.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDegree(i)}
                  className="absolute top-2 right-2 text-xs text-gray-400 hover:text-red-500"
                  aria-label="Remove degree"
                >
                  Remove
                </button>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>School</label>
                  <select className={inputCls} value={deg.school} onChange={(e) => setDegree(i, 'school', e.target.value as School)}>
                    {SCHOOLS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Grad Year{i === 0 ? ' *' : ''}</label>
                  <input type="number" className={inputCls} value={deg.grad_year} onChange={(e) => setDegree(i, 'grad_year', Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>Degree</label>
                  <input className={inputCls} value={deg.degree} onChange={(e) => setDegree(i, 'degree', e.target.value)} placeholder="AB, BS, MBA…" />
                </div>
                <div>
                  <label className={labelCls}>Major</label>
                  <input className={inputCls} value={deg.major} onChange={(e) => setDegree(i, 'major', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addDegree} className="mt-2 text-xs font-semibold text-[#003087] hover:underline">
          + Add another Duke degree
        </button>
      </div>

      <div>
        <label className={labelCls}>Sports Function</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {SPORTS_FUNCTIONS.map((fn) => {
            const selected = (form.sports_functions ?? []).includes(fn);
            return (
              <button
                key={fn}
                type="button"
                onClick={() => toggleSportsFunction(fn)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selected
                    ? 'bg-[#003087] text-white border-[#003087]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#003087]'
                }`}
              >
                {SPORTS_FUNCTION_LABELS[fn]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!form.name || !form.current_company || !form.current_title}
          className="bg-[#003087] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#1a4db5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {initial ? 'Save Changes' : 'Add Alumni'}
        </button>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState(false);
  const [records, setRecords] = useState<Alumni[]>(initialData.alumni as Alumni[]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuthed = localStorage.getItem('admin_authed') === ADMIN_PW;
      setAuthed(isAuthed);
      if (isAuthed) { fetchSubmissions(); void fetchContactRequests(); }
    }
  }, []);

  async function fetchSubmissions() {
    try {
      const res = await fetch('/api/submissions', {
        headers: { 'x-admin-password': ADMIN_PW },
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions ?? []);
      }
    } catch {
      // silently ignore; submissions section just stays empty
    }
  }

  async function fetchContactRequests() {
    try {
      const res = await fetch('/api/contact-requests', {
        headers: { 'x-admin-password': ADMIN_PW },
      });
      if (res.ok) {
        const data = await res.json();
        setContactRequests(data.requests ?? []);
      }
    } catch {
      // silently ignore
    }
  }

  async function dismissContactRequest(id: string) {
    await fetch(`/api/contact-requests?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': ADMIN_PW },
    });
    setContactRequests((prev) => prev.filter((r) => r.request_id !== id));
  }

  async function dismissSubmission(id: string) {
    await fetch(`/api/submissions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': ADMIN_PW },
    });
    setSubmissions((prev) => prev.filter((s) => s.submission_id !== id));
  }

  async function approveSubmission(sub: Submission) {
    const today = new Date().toISOString().split('T')[0];
    const record: Alumni = {
      id: `${slugify(sub.name)}-${sub.grad_year}`,
      name: sub.name,
      grad_year: sub.grad_year,
      school: sub.school,
      degree: sub.degree,
      major: sub.major,
      current_company: sub.current_company,
      current_title: sub.current_title,
      company_type: 'Other',
      sub_industries: [],
      org_category: sub.org_category,
      sports_functions: sub.sports_functions,
      all_degrees: sub.all_degrees,
      seniority_level: sub.seniority_level,
      linkedin_url: sub.linkedin_url,
      location: sub.location,
      headshot_url: null,
      sports_league_affiliation: null,
      bio: sub.bio || undefined,
      reach_out_for: sub.reach_out_for.length > 0 ? sub.reach_out_for : undefined,
      added_date: today,
      last_verified: today,
    };
    upsert(record);
    await dismissSubmission(sub.submission_id);
  }

  function login() {
    if (password === ADMIN_PW) {
      localStorage.setItem('admin_authed', ADMIN_PW);
      setAuthed(true);
      fetchSubmissions();
      void fetchContactRequests();
    } else {
      setPwError(true);
    }
  }

  function upsert(record: Alumni) {
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === record.id);
      return idx >= 0
        ? prev.map((r) => (r.id === record.id ? record : r))
        : [record, ...prev];
    });
    setEditingId(null);
    setShowAdd(false);
  }

  function remove(id: string) {
    if (confirm('Remove this alumni record?')) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
  }

  function exportJSON() {
    const blob = new Blob(
      [JSON.stringify({ alumni: records, meta: { last_updated: new Date().toISOString().split('T')[0], total_count: records.length } }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alumni.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm">
          <h1 className="font-bold text-lg text-gray-900 mb-1">Admin Access</h1>
          <p className="text-sm text-gray-500 mb-5">Enter the admin password to continue.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPwError(false); }}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="Password"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-1 focus:ring-[#003087]"
          />
          {pwError && <p className="text-xs text-red-500 mb-3">Incorrect password.</p>}
          <button
            onClick={login}
            className="w-full bg-[#003087] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#1a4db5] mt-3 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500 mt-0.5">{records.length} records in memory</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); }}
            className="bg-[#003087] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1a4db5] transition-colors"
          >
            + Add Alumni
          </button>
          <button
            onClick={exportJSON}
            className="border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Export JSON
          </button>
        </div>
      </div>

      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-6">
        Changes are in memory only. Click <strong>Export JSON</strong>, then replace <code>src/data/alumni.json</code> and redeploy.
      </p>

      {submissions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-gray-800">Pending Submissions</h2>
            <span className="text-xs font-semibold bg-[#003087] text-white rounded-full px-2 py-0.5">
              {submissions.length}
            </span>
          </div>
          <div className="space-y-2">
            {submissions.map((sub) => (
              <div
                key={sub.submission_id}
                className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{sub.name}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {sub.current_title} · {sub.current_company} · {sub.school} &apos;{String(sub.grad_year).slice(-2)}
                    </p>
                    <a
                      href={sub.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#003087] hover:underline truncate block mt-0.5"
                    >
                      {sub.linkedin_url}
                    </a>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 mt-0.5">
                    <button
                      onClick={() => approveSubmission(sub)}
                      className="text-xs font-semibold text-white bg-[#003087] hover:bg-[#1a4db5] px-3 py-1.5 rounded-md transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => dismissSubmission(sub.submission_id)}
                      className="text-xs text-red-500 hover:underline px-2 py-1.5"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {contactRequests.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-gray-800">Contact Requests</h2>
            <span className="text-xs font-semibold bg-amber-500 text-white rounded-full px-2 py-0.5">
              {contactRequests.length}
            </span>
          </div>
          <div className="space-y-2">
            {contactRequests.map((req) => (
              <div
                key={req.request_id}
                className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900">{req.name}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        req.type === 'removal'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {req.type === 'removal' ? 'Removal' : 'Contact'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{req.email}</p>
                    {req.linkedin_url && (
                      <a
                        href={req.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#003087] hover:underline truncate block mt-0.5"
                      >
                        {req.linkedin_url}
                      </a>
                    )}
                    {req.message && (
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{req.message}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(req.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => dismissContactRequest(req.request_id)}
                    className="text-xs text-gray-400 hover:text-gray-700 hover:underline flex-shrink-0 mt-0.5"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Add New Alumni</h2>
          <AlumniForm onSave={upsert} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      <div className="space-y-2">
        {records.map((r) =>
          editingId === r.id ? (
            <div key={r.id} className="mb-4">
              <AlumniForm initial={r} onSave={upsert} onCancel={() => setEditingId(null)} />
            </div>
          ) : (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {r.current_title} · {r.current_company} · {r.school} &apos;{String(r.grad_year).slice(-2)}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { setEditingId(r.id); setShowAdd(false); }} className="text-xs text-[#003087] hover:underline">Edit</button>
                <button onClick={() => remove(r.id)} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
