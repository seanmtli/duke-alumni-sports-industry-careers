'use client';

import { useState } from 'react';
import type { CompanyType, SeniorityLevel, School } from '@/types/alumni';
import { COMPANY_TYPES, SENIORITY_LEVELS, SCHOOLS, REACH_OUT_FOR_OPTIONS } from '@/lib/constants';

const INITIAL_FORM = {
  name: '',
  grad_year: new Date().getFullYear(),
  school: 'Trinity' as School,
  degree: '',
  major: '',
  current_title: '',
  current_company: '',
  company_type: 'Startup' as CompanyType,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          grad_year: form.grad_year,
          school: form.school,
          degree: form.degree,
          major: form.major,
          current_title: form.current_title,
          current_company: form.current_company,
          company_type: form.company_type,
          seniority_level: form.seniority_level,
          linkedin_url: form.linkedin_url,
          location: form.location,
          bio: form.bio,
          reach_out_for: form.reach_out_for,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Submission failed. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch {
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
            <label className={labelCls}>Grad Year *</label>
            <input
              type="number"
              className={inputCls}
              value={form.grad_year}
              onChange={(e) => set('grad_year', Number(e.target.value))}
              min={1838}
              max={new Date().getFullYear() + 5}
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

        {/* Optional profile fields */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>School</label>
            <select className={inputCls} value={form.school} onChange={(e) => set('school', e.target.value as School)}>
              {SCHOOLS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Degree</label>
            <input
              className={inputCls}
              value={form.degree}
              onChange={(e) => set('degree', e.target.value)}
              placeholder="AB, BS, MBA…"
              maxLength={100}
            />
          </div>
          <div>
            <label className={labelCls}>Major</label>
            <input
              className={inputCls}
              value={form.major}
              onChange={(e) => set('major', e.target.value)}
              placeholder="Computer Science"
              maxLength={100}
            />
          </div>
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
            <label className={labelCls}>Company Type</label>
            <select
              className={inputCls}
              value={form.company_type}
              onChange={(e) => set('company_type', e.target.value as CompanyType)}
            >
              {COMPANY_TYPES.map((t) => <option key={t}>{t}</option>)}
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
