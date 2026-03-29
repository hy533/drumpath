import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';
import { SkillWithMastery, SkillCategory, SkillLevel } from '../types';

const categoryColors: Record<SkillCategory, string> = {
  Technique: 'bg-blue-500/20 text-blue-300',
  Rudiment: 'bg-purple-500/20 text-purple-300',
  Groove: 'bg-green-500/20 text-green-300',
  Coordination: 'bg-yellow-500/20 text-yellow-300',
  Theory: 'bg-pink-500/20 text-pink-300',
};

const levelColors: Record<SkillLevel, string> = {
  Beginner: 'bg-gray-700 text-gray-300',
  Intermediate: 'bg-orange-900/50 text-orange-300',
  Advanced: 'bg-red-900/50 text-red-300',
  Professional: 'bg-yellow-900/50 text-yellow-300',
};

function masteryColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-orange-500';
  if (score >= 25) return 'bg-yellow-500';
  return 'bg-gray-600';
}

export default function SkillGraphPage() {
  const { isAuthenticated } = useAuth();
  const [skills, setSkills] = useState<SkillWithMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ skills: SkillWithMastery[] }>('/skills')
      .then((data) => setSkills(data.skills))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load skills'))
      .finally(() => setLoading(false));
  }, []);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Skill Graph</h1>
          <p className="text-gray-400 mt-1">Your mastery across all drumming skills.</p>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-500">Loading skills…</div>
        )}
        {error && (
          <div className="p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-100">{skill.name}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${levelColors[skill.level]}`}
                  >
                    {skill.level}
                  </span>
                </div>
                <span
                  className={`inline-block text-xs px-2 py-0.5 rounded-full ${categoryColors[skill.category]}`}
                >
                  {skill.category}
                </span>
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Mastery</span>
                    <span>{Math.round(skill.masteryScore)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${masteryColor(skill.masteryScore)}`}
                      style={{ width: `${Math.min(skill.masteryScore, 100)}%` }}
                    />
                  </div>
                </div>
                {skill.lastPracticedAt && (
                  <p className="text-xs text-gray-500">
                    Last practiced:{' '}
                    {new Date(skill.lastPracticedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
