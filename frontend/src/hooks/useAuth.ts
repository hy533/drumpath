export function useAuth() {
  const token = localStorage.getItem('drumpath_token');
  const userId = localStorage.getItem('drumpath_userId');

  const login = (token: string, userId: string) => {
    localStorage.setItem('drumpath_token', token);
    localStorage.setItem('drumpath_userId', userId);
  };

  const logout = () => {
    localStorage.removeItem('drumpath_token');
    localStorage.removeItem('drumpath_userId');
  };

  return { token, userId, login, logout, isAuthenticated: !!token };
}
