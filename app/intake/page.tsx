'use client';

import { useState } from 'react';

export default function IntakePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    clientName: 'Kimberly Carter',
    clientPhone: '(206) 555-0147',
    clientEmail: 'kimberly.carter@email.com',
    year: 2021,
    make: 'Toyota',
    model: 'RAV4',
    mileage: 42500,
    vin: '2T1Z1RFF4JC123456',
    insurerEstimate: 18500,
    ghlContactId: 'ghl_kimberly_carter',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'year' || name === 'mileage' || name === 'insurerEstimate'
        ? parseInt(value, 10)
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Step 1: Create case
      const caseResponse = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const caseData = await caseResponse.json();
      
      if (!caseData.success) {
        setResult(caseData);
        return;
      }

      // Step 2: Auto-run comps research
      const compsResponse = await fetch('/api/research-comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: formData.vin,
          year: formData.year,
          make: formData.make,
          model: formData.model,
          mileage: formData.mileage,
          location: 'Washington, USA',
        }),
      });

      const compsData = await compsResponse.json();

      setResult({
        success: true,
        case: caseData,
        comps: compsData.bundle,
      });

      if (caseData.success) {
        // Reset form
        setFormData({
          clientName: '',
          clientPhone: '',
          clientEmail: '',
          year: new Date().getFullYear(),
          make: '',
          model: '',
          mileage: 50000,
          vin: '',
          insurerEstimate: 0,
          ghlContactId: '',
        });
      }
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Quick Case Intake</h1>
      <p style={{ color: '#666', fontSize: '14px' }}>
        Create a case and auto-run valuation (comps + KBB)
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label>Client Name *</label>
          <input
            type="text"
            name="clientName"
            value={formData.clientName}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label>Phone</label>
          <input
            type="tel"
            name="clientPhone"
            value={formData.clientPhone}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label>Email</label>
          <input
            type="email"
            name="clientEmail"
            value={formData.clientEmail}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div>
            <label>Year *</label>
            <input
              type="number"
              name="year"
              value={formData.year}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label>Make *</label>
            <input
              type="text"
              name="make"
              value={formData.make}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label>Model *</label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div>
          <label>VIN</label>
          <input
            type="text"
            name="vin"
            value={formData.vin}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label>Mileage</label>
            <input
              type="number"
              name="mileage"
              value={formData.mileage}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label>Insurer Estimate ($)</label>
            <input
              type="number"
              name="insurerEstimate"
              value={formData.insurerEstimate}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#147EFA',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          {loading ? 'Creating case & running valuation...' : 'Create Case & Auto-Valuate'}
        </button>
      </form>

      {result && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            borderRadius: '6px',
            backgroundColor: result.error ? '#fee' : '#efe',
            color: result.error ? '#c33' : '#3c3',
            fontSize: '13px',
            fontFamily: 'monospace',
          }}
        >
          {result.error ? (
            <>
              <strong>❌ Error:</strong> {result.error}
            </>
          ) : (
            <>
              <strong>✅ Case Created:</strong> {result.case?.masterId}
              <br />
              <strong>Status:</strong> Intake → Running Comps
              <br />
              <br />
              {result.comps && (
                <>
                  <strong>📊 Comps Research:</strong>
                  <br />
                  Found: {result.comps.totalFound} listings
                  <br />
                  Validated: {result.comps.validatedCount} with working links
                  <br />
                  Avg Price: ${result.comps.averagePrice?.toLocaleString() || 'N/A'}
                  <br />
                  Range: ${result.comps.minPrice?.toLocaleString()} - ${result.comps.maxPrice?.toLocaleString()}
                  <br />
                  <br />
                  <strong>Comps Details:</strong>
                  <pre style={{ fontSize: '11px', overflow: 'auto', maxHeight: '300px' }}>
                    {JSON.stringify(result.comps.comps, null, 2)}
                  </pre>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
