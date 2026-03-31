import { useState } from 'react';
import { Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';
import { Feeling } from '../types';
import { PlannedExercise } from './PracticePage';

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(YOUTUBE_RE);
  return m ? m[1] : null;
}

interface LocationState {
  plan?: PlannedExercise[];
}

interface SessionLog {
  exerciseId: string;
  bpmReached: number | null;
  feeling: Feeling;
  minutesSpent: number;
  submitted: boolean;
}

interface EndSessionResponse {
  totalMinutes: number;
}

const FEELINGS: Feeling[] = ['Rough', 'OK', 'Good', 'Nailed it'];

const feelingColors: Record<Feeling, string> = {
  Rough: 'border-red-600 bg-red-900/30 text-red-300',
  OK: 'border-yellow-600 bg-yellow-900/30 text-yellow-300',
  Good: 'border-green-600 bg-green-900/30 text-green-300',
  'Nailed it': 'border-orange-500 bg-orange-900/30 text-orange-300',
};

export default function SessionPage() {
  const { isAuthenticated } = useAuth();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as LocationState | null;
  const plan: PlannedExercise[] = state?.plan ?? [];

  const [logs, setLogs] = useState<SessionLog[]>(
    plan.map((item) => ({
      exerciseId: item.exercise.id,
      bpmReached: item.suggestedBpm,
      feeling: 'OK',
      minutesSpent: item.exercise.estimatedMinutes,
      submitted: false,
    }))
  );
  const [ending, setEnding] = useState(false);
  const [done, setDone] = useState(false);
  const [totalMinutes, setTotalMinutes] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const updateLog = (idx: number, patch: Partial<SessionLog>) => {
    setLogs((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const handleLogExercise = async (idx: number) => {
    const log = logs[idx];
    try {
      await apiFetch(`/sessions/${id}/exercises`, {
        method: 'POST',
        body: JSON.stringify({
          exerciseId: log.exerciseId,
          bpmReached: log.bpmReached,
          feeling: log.feeling,
          minutesSpent: log.minutesSpent,
        }),
      });
      updateLog(idx, { submitted: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log exercise');
    }
  };

  const handleEndSession = async () => {
    setEnding(true);
    setError('');
    try {
      const result = await apiFetch<EndSessionResponse>(`/sessions/${id}/end`, {
        method: 'POST',
      });
      setTotalMinutes(result.totalMinutes);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session');
      setEnding(false);
    }
  };

  if (done) {
    return (
      <Layout>
        <div className="text-center py-20 space-y-4">
          <div className="text-5xl">🥁</div>
          <h1 className="text-3xl font-bold text-orange-400">Session Complete!</h1>
          <p className="text-gray-300 text-lg">
            Total practice time:{' '}
            <span className="font-semibold text-white">{totalMinutes ?? '—'} minutes</span>
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Active Session</h1>
            <p className="text-gray-400 mt-1">Log each exercise as you complete it.</p>
          </div>
          <button
            onClick={handleEndSession}
            disabled={ending}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {ending ? 'Ending…' : 'End Session'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {plan.length === 0 && (
          <div className="text-center py-12 text-gray-500">No exercises in this session.</div>
        )}

        <div className="space-y-4">
          {plan.map((item, idx) => {
            const exercise = item.exercise;
            const log = logs[idx];
            return (
              <div
                key={exercise.id}
                className={`bg-gray-900 border rounded-xl p-5 space-y-4 transition-colors ${
                  log.submitted ? 'border-green-700/50 opacity-75' : 'border-gray-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-100">{exercise.name}</h3>
                    {exercise.description && (
                      <p className="text-sm text-gray-400 mt-0.5">{exercise.description}</p>
                    )}
                    {(() => {
                      const ytId = getYouTubeId(exercise.videoUrl);
                      return ytId ? (
                        <div className="mt-3 aspect-video rounded-lg overflow-hidden">
                          <iframe
                            src={`https://www.youtube.com/embed/${ytId}`}
                            title={`How to: ${exercise.name}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full border-0"
                          />
                        </div>
                      ) : null;
                    })()}
                  </div>
                  {log.submitted && (
                    <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full shrink-0">
                      Logged ✓
                    </span>
                  )}
                </div>

                {!log.submitted && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {item.suggestedBpm !== null && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">BPM Reached</label>
                        <input
                          type="number"
                          value={log.bpmReached ?? ''}
                          onChange={(e) =>
                            updateLog(idx, {
                              bpmReached: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="e.g. 80"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Minutes Spent</label>
                      <input
                        type="number"
                        value={log.minutesSpent}
                        onChange={(e) =>
                          updateLog(idx, { minutesSpent: Number(e.target.value) })
                        }
                        min={1}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="sm:col-span-3 lg:col-span-1">
                      <label className="block text-xs text-gray-400 mb-1">Feeling</label>
                      <div className="flex flex-wrap gap-2">
                        {FEELINGS.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => updateLog(idx, { feeling: f })}
                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                              log.feeling === f
                                ? feelingColors[f]
                                : 'border-gray-700 text-gray-500 hover:border-gray-500'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {!log.submitted && (
                  <button
                    onClick={() => handleLogExercise(idx)}
                    className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm rounded-lg transition-colors"
                  >
                    Log Exercise
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
