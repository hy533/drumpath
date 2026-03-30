import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface Skill {
  id: string;
  name: string;
  category: string;
  level: string;
  description: string;
}

const RATING_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Never tried',
  2: 'Getting there',
  3: 'Comfortable',
};

export default function OnboardingPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [ratings, setRatings] = useState<Record<string, 1 | 2 | 3>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { setOnboarded, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    apiFetch<{ skills: Skill[] }>('/skills/available')
      .then(({ skills }) => {
        setSkills(skills);
        const defaults: Record<string, 1 | 2 | 3> = {};
        skills.forEach((s) => (defaults[s.id] = 1));
        setRatings(defaults);
      })
      .catch(() => setError('Could not load skills. Please refresh.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const ratingsList = Object.entries(ratings).map(([skillId, rating]) => ({
        skillId,
        rating,
      }));
      await apiFetch('/skills/onboard', {
        method: 'POST',
        body: JSON.stringify({ ratings: ratingsList }),
      });
      setOnboarded();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  // Group skills by category
  const byCategory = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    (acc[skill.category] ??= []).push(skill);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading assessment…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-orange-400 mb-2">Welcome to Drumpath</h1>
          <p className="text-gray-400">
            Rate your comfort with each skill so we can build a practice plan that fits you.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {Object.entries(byCategory).map(([category, categorySkills]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-widest mb-3">
                {category}
              </h2>
              <div className="space-y-3">
                {categorySkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-100">{skill.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{skill.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {([1, 2, 3] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() =>
                            setRatings((prev) => ({ ...prev, [skill.id]: r }))
                          }
                          className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                            ratings[skill.id] === r
                              ? 'bg-orange-500 border-orange-500 text-white font-semibold'
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-orange-500'
                          }`}
                        >
                          {RATING_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {skills.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-6">No skills to assess yet. You're all set!</p>
            <button
              onClick={() => { setOnboarded(); navigate('/'); }}
              className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
            >
              Start Practicing
            </button>
          </div>
        )}

        {skills.length > 0 && (
          <div className="mt-10 text-center">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-10 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-lg"
            >
              {submitting ? 'Saving…' : 'Start Practicing →'}
            </button>
            <p className="text-xs text-gray-500 mt-3">
              You can always retake this from your profile settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
