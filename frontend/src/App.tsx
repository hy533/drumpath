import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import SkillGraphPage from './pages/SkillGraphPage';
import PracticePage from './pages/PracticePage';
import SessionPage from './pages/SessionPage';
import OnboardingPage from './pages/OnboardingPage';
import ConceptPage from './pages/ConceptPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/skills" element={<SkillGraphPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/session/:id" element={<SessionPage />} />
        <Route path="/concept/:slug" element={<ConceptPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
