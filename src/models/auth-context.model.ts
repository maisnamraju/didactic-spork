export interface AuthUser {
  id: string;
  email: string;
  name: string;
  public_id: number | null;
}

export interface AuthContext {
  user: AuthUser;
}
