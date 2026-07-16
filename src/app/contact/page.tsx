'use client';

import { useState } from 'react';
import { captureClientEvent, posthogIdentityHeaders } from '@/lib/posthog-client';

type RequestType = 'removal' | 'contact';

interface FormState {
  name: string;
  email: string;
  type: RequestType;
  linkedin_url: string;
  message: string;
}

const EMPTY: FormState = {
  name: '',
  email: '',
  type: 'removal',
  linkedin_url: '',
  message: '',
};

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...posthogIdentityHeaders() },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok) {
        captureClientEvent('contact_request_submitted', { type: form.type });
        setStatus('success');
        setForm(EMPTY);
      } else {
        captureClientEvent('contact_request_failed', {
          type: form.type,
          error: data.error ?? 'unknown',
        });
        setStatus('error');
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      captureClientEvent('contact_request_failed', { type: form.type, error: 'network' });
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  }

  const inputCls =
    'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#003087]';
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Contact / Request Removal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Need to update or remove your profile, or just want to reach us? Use this form.
        </p>
      </div>

      {status === 'success' ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="font-semibold text-green-800 mb-1">Request received</p>
          <p className="text-sm text-green-700">
            We&apos;ll follow up at the email you provided. Please allow up to 14 business days for removal or a response.
          </p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-4 text-sm text-[#003087] hover:underline"
          >
            Submit another request
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          {/* Request type toggle */}
          <div>
            <p className={labelCls}>I want to</p>
            <div className="flex gap-2">
              {(['removal', 'contact'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('type', t)}
                  className={`flex-1 text-sm font-medium py-2 rounded-lg border transition-colors ${
                    form.type === t
                      ? 'bg-[#003087] text-white border-[#003087]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#003087]'
                  }`}
                >
                  {t === 'removal' ? 'Remove my profile' : 'Get in touch'}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className={labelCls}>Your name *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Jane Smith"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}>Email *</label>
            <input
              type="email"
              className={inputCls}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="jane@example.com"
              required
            />
          </div>

          {/* LinkedIn URL — shown for removal */}
          {form.type === 'removal' && (
            <div>
              <label className={labelCls}>Your LinkedIn or profile URL *</label>
              <input
                type="url"
                className={inputCls}
                value={form.linkedin_url}
                onChange={(e) => set('linkedin_url', e.target.value)}
                placeholder="https://linkedin.com/in/yourname"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Helps us identify your record in the directory.
              </p>
            </div>
          )}

          {/* Message */}
          <div>
            <label className={labelCls}>
              {form.type === 'removal' ? 'Anything else (optional)' : 'Message *'}
            </label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={4}
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              placeholder={
                form.type === 'removal'
                  ? 'e.g. Please also update my title…'
                  : 'What would you like to say?'
              }
              required={form.type === 'contact'}
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full bg-[#003087] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#1a4db5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'submitting' ? 'Sending…' : 'Send Request'}
          </button>
        </form>
      )}
    </div>
  );
}
