// src/client/App.tsx
import React, { useState } from 'react';

export const App: React.FC = () => {
  const [firstNamePolish, setFirstNamePolish] = useState('');
  const [firstNameEnglish, setFirstNameEnglish] = useState('');
  const [email, setEmail] = useState('');
  const [memberId, setMemberId] = useState('');
  const [certificate, setCertificate] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('firstNamePolish', firstNamePolish);
      formData.append('firstNameEnglish', firstNameEnglish);
      formData.append('email', email);
      formData.append('memberId', memberId);
      if (certificate) {
        formData.append('certificate', certificate);
      }

      const res = await fetch('/api/onboard', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Failed to submit onboarding.');
        return;
      }

      setStatus('success');
      setMessage('Onboarding email sent successfully.');

      // Optional: reset form
      setFirstNamePolish('');
      setFirstNameEnglish('');
      setEmail('');
      setMemberId('');
      setCertificate(null);
      const certificateInput = document.getElementById('certificate-input') as HTMLInputElement | null;
      if (certificateInput) {
        certificateInput.value = '';
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('Unexpected error submitting onboarding.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        padding: '1.5rem',
        color: '#e5e7eb',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#020617',
          borderRadius: 16,
          padding: '1.75rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          border: '1px solid rgba(148,163,184,0.25)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
          New member onboarding
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: '#9ca3af',
            marginBottom: '1.25rem',
          }}
        >
          Fill in the member details and optionally attach their certificate PDF.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
          <div>
            <label
              htmlFor="firstNamePolish"
              style={{ fontSize: '0.8rem', color: '#9ca3af' }}
            >
              First name (Polish)
            </label>
            <input
              id="firstNamePolish"
              type="text"
              required
              value={firstNamePolish}
              onChange={(e) => setFirstNamePolish(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="firstNameEnglish"
              style={{ fontSize: '0.8rem', color: '#9ca3af' }}
            >
              First name (English)
            </label>
            <input
              id="firstNameEnglish"
              type="text"
              required
              value={firstNameEnglish}
              onChange={(e) => setFirstNameEnglish(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="email" style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              Recipient email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="memberId"
              style={{ fontSize: '0.8rem', color: '#9ca3af' }}
            >
              Member ID
            </label>
            <input
              id="memberId"
              type="text"
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="certificate-input"
              style={{ fontSize: '0.8rem', color: '#9ca3af' }}
            >
              Certificate PDF (optional)
            </label>
            <input
              id="certificate-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setCertificate(e.target.files?.[0] ?? null)}
              style={{
                marginTop: '0.25rem',
                fontSize: '0.8rem',
                color: '#e5e7eb',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              marginTop: '0.5rem',
              borderRadius: 999,
              border: 'none',
              padding: '0.6rem 1rem',
              background:
                status === 'loading'
                  ? '#4b5563'
                  : 'linear-gradient(135deg,#6366f1,#ec4899)',
              color: '#f9fafb',
              fontWeight: 500,
              fontSize: '0.9rem',
              cursor: status === 'loading' ? 'default' : 'pointer',
              transition: 'transform 0.1s ease, box-shadow 0.1s ease',
              boxShadow:
                status === 'loading'
                  ? 'none'
                  : '0 10px 20px rgba(59,130,246,0.35)',
            }}
          >
            {status === 'loading' ? 'Sending…' : 'Send onboarding email'}
          </button>
        </form>

        {status !== 'idle' && (
          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.8rem',
              color:
                status === 'success'
                  ? '#4ade80'
                  : status === 'error'
                  ? '#f97373'
                  : '#9ca3af',
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '0.25rem',
  padding: '0.5rem 0.6rem',
  borderRadius: 999,
  border: '1px solid rgba(148,163,184,0.45)',
  background: '#020617',
  color: '#e5e7eb',
  fontSize: '0.85rem',
  outline: 'none',
};

export default App;