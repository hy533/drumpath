import { useState, useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import ReactMarkdown, { Components } from 'react-markdown';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

// ── quiz types ───────────────────────────────────────────────────────────────

interface QuizOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  question: string;
  options: QuizOption[];
}

// ── content parsing ──────────────────────────────────────────────────────────

const QUIZ_MARKER = '<!-- quiz: multiple-choice -->';
const QUIZ_HEADING = '## Quiz';

/**
 * Splits raw markdown into prose content (everything before "## Quiz") and
 * quiz text (lines after the quiz marker). Returns quizText=null if no marker.
 */
function splitContent(raw: string): { content: string; quizText: string | null } {
  const markerIdx = raw.indexOf(QUIZ_MARKER);
  if (markerIdx === -1) return { content: raw, quizText: null };

  const headingIdx = raw.indexOf(QUIZ_HEADING);
  const splitIdx = headingIdx !== -1 && headingIdx < markerIdx ? headingIdx : markerIdx;

  return {
    content: raw.slice(0, splitIdx).trim(),
    quizText: raw.slice(markerIdx + QUIZ_MARKER.length).trim(),
  };
}

/**
 * Parses Q:/A:/B:/C:/D: lines into structured questions.
 * The correct option is identified by a trailing ✓.
 */
function parseQuiz(quizText: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  let current: QuizQuestion | null = null;

  for (const line of quizText.split('\n')) {
    const qMatch = line.match(/^Q:\s+(.+)/);
    const optMatch = line.match(/^([A-D]):\s+(.+?)(\s*✓)?$/);

    if (qMatch) {
      if (current) questions.push(current);
      current = { question: qMatch[1].trim(), options: [] };
    } else if (optMatch && current) {
      current.options.push({
        label: optMatch[1],
        text: optMatch[2].trim(),
        isCorrect: !!optMatch[3],
      });
    }
  }

  if (current) questions.push(current);
  return questions;
}

// ── react-markdown custom components ─────────────────────────────────────────

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-100 mb-4 mt-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-semibold text-gray-100 mt-6 mb-3">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-semibold text-gray-200 mt-4 mb-2">{children}</h3>,
  p: ({ children }) => <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1 text-gray-300">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1 text-gray-300">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="text-gray-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-gray-400 italic">{children}</em>,
  img: ({ src, alt }) => (
    <figure className="my-4">
      <img src={src ?? ''} alt={alt ?? ''} className="rounded-lg max-w-full" />
      {alt && <figcaption className="text-xs text-gray-500 mt-1 italic">{alt}</figcaption>}
    </figure>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-orange-500 pl-4 my-3 text-gray-400 italic">
      {children}
    </blockquote>
  ),
};

// ── quiz component ────────────────────────────────────────────────────────────

function QuizSection({ slug, questions }: { slug: string; questions: QuizQuestion[] }) {
  const storageKey = `drumpath:concept:completed:${slug}`;
  const [selected, setSelected] = useState<(string | null)[]>(questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [completed, setCompleted] = useState(() => localStorage.getItem(storageKey) === 'true');

  const allAnswered = selected.every(s => s !== null);
  const score = questions.filter((q, i) =>
    q.options.find(o => o.label === selected[i])?.isCorrect
  ).length;

  const handleSubmit = () => {
    setSubmitted(true);
    if (score === questions.length) {
      localStorage.setItem(storageKey, 'true');
      setCompleted(true);
    }
  };

  const handleRetry = () => {
    setSelected(questions.map(() => null));
    setSubmitted(false);
  };

  if (completed && !submitted) {
    return (
      <div className="mt-8 p-4 bg-green-900/30 border border-green-700 rounded-xl">
        <p className="text-green-300 font-semibold">✓ Quiz completed — you got every question right.</p>
        <button
          onClick={() => { setCompleted(false); handleRetry(); }}
          className="mt-2 text-sm text-gray-400 underline hover:text-gray-200"
        >
          Retake quiz
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <h2 className="text-xl font-bold text-gray-100">Quiz</h2>
      {questions.map((q, qi) => (
        <div key={qi} className="space-y-3">
          <p className="font-medium text-gray-200">{q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt) => {
              const isSelected = selected[qi] === opt.label;
              let cls = 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700';
              if (submitted) {
                if (opt.isCorrect) cls = 'border-green-600 bg-green-900/40 text-green-300';
                else if (isSelected) cls = 'border-red-600 bg-red-900/40 text-red-300';
                else cls = 'border-gray-700 bg-gray-800 text-gray-500';
              } else if (isSelected) {
                cls = 'border-orange-500 bg-orange-900/20 text-orange-300';
              }
              return (
                <button
                  key={opt.label}
                  disabled={submitted}
                  onClick={() => {
                    const next = [...selected];
                    next[qi] = opt.label;
                    setSelected(next);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg border transition-colors disabled:cursor-default ${cls}`}
                >
                  <span className="font-bold mr-2">{opt.label}.</span>
                  {opt.text}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!submitted && (
        <button
          disabled={!allAnswered}
          onClick={handleSubmit}
          className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
        >
          Submit Answers
        </button>
      )}

      {submitted && (
        <div className={`p-4 rounded-xl border ${
          score === questions.length
            ? 'bg-green-900/30 border-green-700'
            : 'bg-orange-900/30 border-orange-700'
        }`}>
          <p className={`font-semibold ${score === questions.length ? 'text-green-300' : 'text-orange-300'}`}>
            {score}/{questions.length} correct
            {score === questions.length ? ' — Perfect! Quiz complete ✓' : ' — Review the highlighted answers below.'}
          </p>
          {score < questions.length && (
            <button
              onClick={handleRetry}
              className="mt-2 text-sm text-gray-400 underline hover:text-gray-200"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ConceptPage() {
  const { isAuthenticated } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const [rawContent, setRawContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    apiFetch<{ content: string }>(`/concepts/${slug}`)
      .then(data => setRawContent(data.content))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load concept'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const { content: markdownContent, quizText } = splitContent(rawContent);
  const questions = quizText ? parseQuiz(quizText) : [];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <Link to="/skills" className="inline-block text-sm text-gray-400 hover:text-gray-200 mb-4">
          ← Back to Skills
        </Link>

        {loading && <div className="text-center py-16 text-gray-500">Loading…</div>}

        {error && (
          <div className="p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <ReactMarkdown components={mdComponents}>{markdownContent}</ReactMarkdown>
            {questions.length > 0 && (
              <QuizSection slug={slug!} questions={questions} />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
