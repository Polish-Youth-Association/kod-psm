import { useState } from 'react';

export function App() {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const submit = async () => {
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('Sent!');
    } catch (err) {
      console.error(err);
      setStatus('Failed');
    }
  };

  return (
    <div style={{ padding: 32, fontFamily: 'system-ui' }}>
      <h1>Member Onboarding (demo)</h1>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type something to log"
        style={{ padding: 8, minWidth: 300 }}
      />
      <button onClick={submit} style={{ marginLeft: 8, padding: '8px 16px' }}>
        Send
      </button>
      {status && <p>Status: {status}</p>}
    </div>
  );
}