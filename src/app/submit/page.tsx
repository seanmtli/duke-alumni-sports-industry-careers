'use client';

import { useState } from 'react';
import type { OrgCategory, SeniorityLevel, School, SportsFunction } from '@/types/alumni';
import {
  ORG_CATEGORIES, ORG_CATEGORY_LABELS,
  SPORTS_FUNCTIONS, SPORTS_FUNCTION_LABELS,
  SENIORITY_LEVELS, SCHOOLS, REACH_OUT_FOR_OPTIONS,
} from '@/lib/constants';
import { captureClientEvent, posthogIdentityHeaders } from '@/lib/posthog-client';

type DegreeInput = {
  school: School;
  grad_year: number;
  degree: string;
  major: string;
};

function emptyDegree(): DegreeInput {
  return { school: 'Trinity', grad_year: new Date().getFullYear(), degree: '', major: '' };
}

const INITIAL_FORM = {
  name: '',
  degrees: [emptyDegree()] as DegreeInput[],
  current_title: '',
  current_company: '',
  org_category: '' as OrgCategory | '',
  sports_functions: [] as SportsFunction[],
  seniority_level: 'Mid' as SeniorityLevel,
  linkedin_url: '',
  location: '',
  bio: '',
  reach_out_for: [] as string[],
};

const inputCls =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#003087]';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

function isValidLinkedIn(url: string): boolean {
  return url.startsWith('https://linkedin.com/') || url.startsWith('https://www.linkedin.com/');
}

export default function SubmitPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [linkedInError, setLinkedInError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleReachOutFor(option: string) {
    set(
      'reach_out_for',
      form.reach_out_for.includes(option)
        ? form.reach_out_for.filter((o) => o !== option)
        : [...form.reach_out_for, option]
    );
  }

  function toggleSportsFunction(fn: SportsFunction) {
    set(
      'sports_functions',
      form.sports_functions.includes(fn)
        ? form.sports_functions.filter((f) => f !== fn)
        : [...form.sports_functions, fn]
    );
  }

  function setDegree<K extends keyof DegreeInput>(index: number, key: K, value: DegreeInput[K]) {
    set(
      'degrees',
      form.degrees.map((d, i) => (i === index ? { ...d, [key]: value } : d))
    );
  }

  function addDegree() {
    set('degrees', [...form.degrees, emptyDegree()]);
  }

  function removeDegree(index: number) {
    set('degrees', form.degrees.filter((_, i) => i !== index));
  }

  function validateLinkedIn() {
    if (!form.linkedin_url) {
      setLinkedInError('LinkedIn URL is required');
      return false;
    }
    if (!isValidLinkedIn(form.linkedin_url)) {
      setLinkedInError('Must be a https://linkedin.com/in/… URL');
      return false;
    }
    setLinkedInError('');
    return true;
  }

  const canSubmit =
    form.name.trim() &&
    form.current_title.trim() &&
    form.current_company.trim() &&
    Number.isInteger(form.degrees[0]?.grad_year) &&
    form.linkedin_url &&
    isValidLinkedIn(form.linkedin_url);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateLinkedIn()) return;
    setSubmitError('');
    setLoading(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...posthogIdentityHeaders() },
        body: JSON.stringify({
          name: form.name,
          // Primary degree stays flat for existing consumers.
          grad_year: form.degrees[0].grad_year,
          school: form.degrees[0].school,
          degree: form.degrees[0].degree,
          major: form.degrees[0].major,
          all_degrees: form.degrees.map((d) => ({
            school: d.school,
            degree: d.degree || null,
            grad_year: Number.isInteger(d.grad_year) ? d.grad_year : null,
            major: d.major || null,
          })),
          current_title: form.current_title,
          current_company: form.current_company,
          org_category: form.org_category || null,
          sports_functions: form.sports_functions,
          seniority_level: form.seniority_level,
          linkedin_url: form.linkedin_url,
          location: form.location,
          bio: form.bio,
          reach_out_for: form.reach_out_for,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        captureClientEvent('alumni_submission_failed', {
          status: res.status,
          error: typeof data.error === 'string' ? data.error : 'unknown',
        });
        setSubmitError(data.error ?? 'Submission failed. Please try again.');
      } else {
        captureClientEvent('alumni_submission_succeeded', {
          school: form.degrees[0].school,
          org_category: form.org_category || null,
          sports_function_count: form.sports_functions.length,
        });
        setSuccess(true);
      }
    } catch {
      captureClientEvent('alumni_submission_failed', { error: 'network' });
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Submission received!</h1>
        <p className="text-gray-500 text-sm">
          Thank you for submitting your information. An admin will review your entry and add it to the directory shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Join the Directory</h1>
        <p className="text-sm text-gray-500 mt-1">
          Submit your information to be added to the Duke Sports Alumni Directory. All submissions are reviewed before being published.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        {/* Required fields */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Full Name *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Jane Smith"
              maxLength={100}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Current Title *</label>
            <input
              className={inputCls}
              value={form.current_title}
              onChange={(e) => set('current_title', e.target.value)}
              placeholder="Product Manager"
              maxLength={150}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Current Company *</label>
            <input
              className={inputCls}
              value={form.current_company}
              onChange={(e) => set('current_company', e.target.value)}
              placeholder="Acme Sports Inc."
              maxLength={150}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>LinkedIn URL *</label>
            <input
              type="url"
              className={`${inputCls} ${linkedInError ? 'border-red-400 focus:ring-red-400' : ''}`}
              value={form.linkedin_url}
              onChange={(e) => {
                set('linkedin_url', e.target.value);
                if (linkedInError) setLinkedInError('');
              }}
              onBlur={validateLinkedIn}
              placeholder="https://linkedin.com/in/your-profile"
              maxLength={300}
              required
            />
            {linkedInError && <p className="text-xs text-red-500 mt-1">{linkedInError}</p>}
          </div>
        </div>

        {/* Duke degrees — supports multiple (e.g. undergrad + MBA) */}
        <div>
          <label className={labelCls}>Duke Degree(s) *</label>
          <div className="space-y-3 mt-1">
            {form.degrees.map((deg, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 relative">
                {form.degrees.length > 1 && (
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
                    <select
                      className={inputCls}
                      value={deg.school}
                      onChange={(e) => setDegree(i, 'school', e.target.value as School)}
                    >
                      {SCHOOLS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Grad Year{i === 0 ? ' *' : ''}</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={deg.grad_year}
                      onChange={(e) => setDegree(i, 'grad_year', Number(e.target.value))}
                      min={1838}
                      max={new Date().getFullYear() + 5}
                      required={i === 0}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Degree</label>
                    <input
                      className={inputCls}
                      value={deg.degree}
                      onChange={(e) => setDegree(i, 'degree', e.target.value)}
                      placeholder="AB, BS, MBA…"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Major</label>
                    <input
                      className={inputCls}
                      value={deg.major}
                      onChange={(e) => setDegree(i, 'major', e.target.value)}
                      placeholder="Computer Science"
                      maxLength={100}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addDegree}
            className="mt-2 text-xs font-semibold text-[#003087] hover:underline"
          >
            + Add another Duke degree
          </button>
        </div>

        {/* Other optional fields */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Location</label>
            <input
              className={inputCls}
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="New York, NY"
              maxLength={100}
            />
          </div>
          <div>
            <label className={labelCls}>Industry</label>
            <select
              className={inputCls}
              value={form.org_category}
              onChange={(e) => set('org_category', e.target.value as OrgCategory | '')}
            >
              <option value="">Select…</option>
              {ORG_CATEGORIES.map((c) => (
                <option key={c} value={c}>{ORG_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Seniority</label>
            <select
              className={inputCls}
              value={form.seniority_level}
              onChange={(e) => set('seniority_level', e.target.value as SeniorityLevel)}
            >
              {SENIORITY_LEVELS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Sports function — one or more, mirrors the directory filter */}
        <div>
          <label className={labelCls}>Sports Function</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {SPORTS_FUNCTIONS.map((fn) => {
              const selected = form.sports_functions.includes(fn);
              return (
                <button
                  key={fn}
                  type="button"
                  onClick={() => toggleSportsFunction(fn)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
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

        {/* Bio */}
        <div>
          <label className={labelCls}>Bio</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
            placeholder="Tell current Duke students a bit about your career path and work in the sports industry…"
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{form.bio.length}/500</p>
        </div>

        {/* What can students reach out to you for */}
        <div>
          <label className={labelCls}>What can current Duke students reach out to you for?</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {REACH_OUT_FOR_OPTIONS.map((option) => {
              const selected = form.reach_out_for.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleReachOutFor(option)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selected
                      ? 'bg-[#003087] text-white border-[#003087]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#003087]'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="bg-[#003087] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#1a4db5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
