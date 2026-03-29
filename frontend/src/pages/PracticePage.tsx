import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';
import { Exercise, ExerciseWithSkills } from '../types';

export interface PlannedExercise {
  exercise: ExerciseWithSkills;
  suggestedBpm: number | null;
}

interface PlanResponse {
  plan: PlannedExercise[];
}

interface SessionResponse {
  sessionId: string;
}

export default function PracticePage() {
  const { isAuthenticated } = useAuth();
  const [plan, setPlan] = useState<PlannedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<PlanResponse>('/plan/generate', {
      method: 'POST',
      body: JSON.stringify({ targetMinutes: 30 }),
    })
      .then((data) => setPlan(data.plan))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to generate plan'))
      .finally(() => setLoading(false));
  }, []);

  const handleStartSession = async () => {
    setStarting(true);
    setError('');
    try {
      const session = await apiFetch<SessionResponse>('/sessions', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      navigate(`/session/${session.sessionId}`, { state: { plan } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStarting(false);
    }
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const totalMinutes = plan.reduce((sum, item) => sum + item.exercise.estimatedMinutes, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Practice Plan</h1>
            <p className="text-gray-400 mt-1">30-minute session · {plan.length} exercises</p>
          </div>
          {plan.length > 0 && (
            <button
              onClick={handleStartSession}
              disabled={starting}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              {starting ? 'Starting…' : 'Start Session'}
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {loading && <div className="text-center py-16 text-gray-500">Generating plan…</div>}

        {!loading && !error && plan.length === 0 && (
          <div className="text-center py-16 text-gray-500">No exercises in plan.</div>
        )}

        {!loading && plan.length > 0 && (
          <>
            <div className="space-y-3">
              {plan.map((item, idx) => (
                <div
                  key={item.exercise.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-4"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-100">{item.exercise.name}</h3>
                    {item.exercise.description && (
                      <p className="text-sm text-gray-400 mt-0.5">{item.exercise.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {item.suggestedBpm !== null && (
                        <span className="text-xs text-orange-300 bg-orange-900/30 px-2 py-0.5 rounded-full">
                          Start at: {item.suggestedBpm} BPM
                        </span>
                      )}
                      <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                        ~{item.exercise.estimatedMinutes} min
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <span className="text-gray-400 text-sm">Total estimated time</span>
              <span className="text-orange-400 font-semibold">{totalMinutes} minutes</span>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
