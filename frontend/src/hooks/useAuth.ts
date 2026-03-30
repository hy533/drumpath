export function useAuth() {
  const token = localStorage.getItem('drumpath_token');
  const userId = localStorage.getItem('drumpath_userId');
  const onboarded = localStorage.getItem('drumpath_onboarded') === 'true';

  const login = (token: string, userId: string, onboarded: boolean) => {
    localStorage.setItem('drumpath_token', token);
    localStorage.setItem('drumpath_userId', userId);
    localStorage.setItem('drumpath_onboarded', String(onboarded));
  };

  const setOnboarded = () => {
    localStorage.setItem('drumpath_onboarded', 'true');
  };

  const logout = () => {
    localStorage.removeItem('drumpath_token');
    localStorage.removeItem('drumpath_userId');
    localStorage.removeItem('drumpath_onboarded');
  };

  return { token, userId, onboarded, login, logout, setOnboarded, isAuthenticated: !!token };
}
