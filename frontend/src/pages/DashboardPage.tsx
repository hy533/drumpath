import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';
import { SkillWithMastery } from '../types';

export default function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const [skillCount, setSkillCount] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ skills: SkillWithMastery[] }>('/skills')
      .then((data) => setSkillCount(data.skills.length))
      .catch(() => setSkillCount(0));
  }, []);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">
            Welcome to <span className="text-orange-400">Drumpath</span>
          </h1>
          <p className="text-gray-400 mt-2">Track your progress and build your drumming skills.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">Available Skills</p>
            <p className="text-4xl font-bold text-orange-400">
              {skillCount === null ? '—' : skillCount}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center gap-2">
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">Status</p>
              <p className="text-lg font-semibold text-green-400">Active</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/skills"
            className="group bg-gray-900 border border-gray-800 hover:border-orange-500/50 rounded-xl p-6 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100 group-hover:text-orange-400 transition-colors">
                  Skill Graph
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  View your mastery across all skills and track progress.
                </p>
              </div>
              <span className="text-2xl text-orange-400 opacity-70 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </div>
          </Link>
          <Link
            to="/practice"
            className="group bg-gray-900 border border-gray-800 hover:border-orange-500/50 rounded-xl p-6 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100 group-hover:text-orange-400 transition-colors">
                  Practice
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Generate a practice plan and start a session.
                </p>
              </div>
              <span className="text-2xl text-orange-400 opacity-70 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </div>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
