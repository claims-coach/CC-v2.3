"use client";

import { useState, useEffect } from "react";

interface ConsensusResult {
  consensus_id: string;
  claim_id: string;
  problem_type: string;
  vehicle: string;
  insurer_offer: number;
  final_confidence: number;
  agreement_level: string;
  confidence_band: string;
  final_recommendation: string;
  assigned_agent: string;
  status: string;
  requires_human_review: boolean;
  created_at: number;
}

interface CalibrationData {
  total_predictions: number;
  accuracy: number;
  mean_calibration_error: number;
  recommendations: string[];
}

interface ModelPerformance {
  grok?: { accuracy: number; avg_confidence: number };
  mistral?: { accuracy: number; avg_confidence: number };
  llama?: { accuracy: number; avg_confidence: number };
}

export default function ConsensusDashboard() {
  const [results, setResults] = useState<ConsensusResult[]>([]);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [modelPerf, setModelPerf] = useState<ModelPerformance | null>(null);
  const [pendingReviews, setPendingReviews] = useState<ConsensusResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolveOutcome, setResolveOutcome] = useState("");
  const [resolveSuccess, setResolveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load mock data for demo
    const mockResults: ConsensusResult[] = [
      {
        consensus_id: "con-001",
        claim_id: "000421_26-AUTO-DV_Smith_GEICO",
        problem_type: "dv_dispute",
        vehicle: "2019 Honda Accord",
        insurer_offer: 6000,
        final_confidence: 0.82,
        agreement_level: "unanimous",
        confidence_band: "high",
        final_recommendation: "Demand appraisal",
        assigned_agent: "Chris (Negotiator)",
        status: "pending",
        requires_human_review: false,
        created_at: Date.now() - 3600000,
      },
      {
        consensus_id: "con-002",
        claim_id: "000422_26-AUTO-ACV_Johnson_StateFarm",
        problem_type: "acv_analysis",
        vehicle: "2018 Toyota Camry",
        insurer_offer: 14000,
        final_confidence: 0.75,
        agreement_level: "majority",
        confidence_band: "medium",
        final_recommendation: "Build valuation report with market comps",
        assigned_agent: "Watson (Research)",
        status: "completed",
        requires_human_review: false,
        created_at: Date.now() - 7200000,
      },
    ];

    const mockCalibration: CalibrationData = {
      total_predictions: 2,
      accuracy: 100,
      mean_calibration_error: 0.05,
      recommendations: [
        "Excellent accuracy! Continue current strategy.",
        "Consider lowering threshold to 0.65 for more aggressive decision-making.",
      ],
    };

    const mockModelPerf: ModelPerformance = {
      grok: { accuracy: 85, avg_confidence: 0.83 },
      mistral: { accuracy: 82, avg_confidence: 0.8 },
      llama: { accuracy: 88, avg_confidence: 0.85 },
    };

    const mockPending = mockResults.filter((r) => r.requires_human_review);

    setResults(mockResults);
    setCalibration(mockCalibration);
    setModelPerf(mockModelPerf);
    setPendingReviews(mockPending);
    setLoading(false);
  }, []);

  const handleResolve = async () => {
    if (!selectedId) return;
    console.log("Resolving:", { selectedId, resolveOutcome, resolveSuccess });
    setSelectedId(null);
    setResolveOutcome("");
    setResolveSuccess(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return "bg-green-100 text-green-900";
    if (confidence >= 0.7) return "bg-blue-100 text-blue-900";
    if (confidence >= 0.5) return "bg-yellow-100 text-yellow-900";
    return "bg-red-100 text-red-900";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <h1 className="text-4xl font-bold mb-2">Consensus Engine</h1>
      <p className="text-slate-600 mb-8">
        Multi-AI reasoning: Grok + Mistral + Llama consensus decisions
      </p>

      {/* Calibration Report */}
      {calibration && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">
              OVERALL ACCURACY
            </h3>
            <p className="text-3xl font-bold text-slate-900">
              {calibration.total_predictions === 0
                ? "—"
                : `${calibration.accuracy}%`}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {calibration.total_predictions} predictions resolved
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">
              CALIBRATION ERROR
            </h3>
            <p className="text-3xl font-bold text-slate-900">
              {calibration.total_predictions === 0
                ? "—"
                : calibration.mean_calibration_error}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Lower is better (target: &lt;0.1)
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">
              PENDING REVIEWS
            </h3>
            <p className="text-3xl font-bold text-slate-900">
              {pendingReviews?.length || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Require human decision
            </p>
          </div>
        </div>
      )}

      {/* Model Performance */}
      {modelPerf && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 mb-8">
          <h2 className="text-xl font-bold mb-4">Model Performance (30d)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["grok", "mistral", "llama"].map((model) => (
              <div key={model} className="p-4 bg-slate-50 rounded border border-slate-200">
                <h3 className="font-semibold capitalize mb-2">{model}</h3>
                <p>
                  <span className="text-sm text-slate-600">Accuracy: </span>
                  <span className="font-bold">
                    {modelPerf[model as keyof typeof modelPerf]?.accuracy || 0}%
                  </span>
                </p>
                <p>
                  <span className="text-sm text-slate-600">Avg Confidence: </span>
                  <span className="font-bold">
                    {modelPerf[model as keyof typeof modelPerf]?.avg_confidence || 0}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Reviews */}
      {pendingReviews && pendingReviews.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-red-200 mb-8 bg-red-50">
          <h2 className="text-xl font-bold mb-4 text-red-900">
            ⚠️ Pending Human Reviews
          </h2>
          <div className="space-y-3">
            {pendingReviews.map((result) => (
              <div
                key={result.consensus_id}
                className="p-4 bg-white rounded border border-red-200 cursor-pointer hover:bg-red-50"
                onClick={() => setSelectedId(result.consensus_id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{result.vehicle}</p>
                    <p className="text-sm text-slate-600">
                      Claim: {result.claim_id}
                    </p>
                    <p className="text-sm text-slate-600">
                      Question: {result.final_recommendation}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-sm font-semibold ${getConfidenceColor(
                      result.final_confidence
                    )}`}
                  >
                    {(result.final_confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      {selectedId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4">Resolve Consensus</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  What actually happened?
                </label>
                <textarea
                  value={resolveOutcome}
                  onChange={(e) => setResolveOutcome(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                  rows={3}
                  placeholder="E.g., 'Won appraisal with $8K increase'"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={resolveSuccess}
                    onChange={(e) => setResolveSuccess(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-semibold">
                    Consensus recommendation was correct
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleResolve}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700"
                >
                  Save Outcome
                </button>
                <button
                  onClick={() => setSelectedId(null)}
                  className="flex-1 bg-slate-200 text-slate-900 px-4 py-2 rounded font-semibold hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Consensus Results */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-bold mb-4">Recent Decisions</h2>
        {results.length === 0 ? (
          <p className="text-slate-600">No consensus results yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-700">
                    Claim
                  </th>
                  <th className="text-left p-3 font-semibold text-slate-700">
                    Type
                  </th>
                  <th className="text-left p-3 font-semibold text-slate-700">
                    Confidence
                  </th>
                  <th className="text-left p-3 font-semibold text-slate-700">
                    Agreement
                  </th>
                  <th className="text-left p-3 font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="text-left p-3 font-semibold text-slate-700">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.consensus_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-semibold">{result.claim_id}</td>
                    <td className="p-3 text-slate-600">
                      {result.problem_type.replace(/_/g, " ")}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded text-xs font-semibold ${getConfidenceColor(
                          result.final_confidence
                        )}`}
                      >
                        {(result.final_confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 capitalize">
                      {result.agreement_level}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          result.status === "completed"
                            ? "bg-green-100 text-green-900"
                            : result.status === "escalated"
                            ? "bg-red-100 text-red-900"
                            : "bg-yellow-100 text-yellow-900"
                        }`}
                      >
                        {result.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 text-xs">
                      {formatDate(result.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
