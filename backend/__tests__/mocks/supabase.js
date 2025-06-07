// Mock de Supabase para tests
const mockSupabase = {
  from: jest.fn(),
  auth: {
    getUser: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn()
  },
  storage: {
    from: jest.fn()
  }
};

// Función helper para resetear todos los mocks
const resetMocks = () => {
  mockSupabase.from.mockReset();
  mockSupabase.auth.getUser.mockReset();
  mockSupabase.auth.signInWithPassword.mockReset();
  mockSupabase.auth.signOut.mockReset();
  mockSupabase.storage.from.mockReset();
};

module.exports = {
  mockSupabase,
  resetMocks
}; 