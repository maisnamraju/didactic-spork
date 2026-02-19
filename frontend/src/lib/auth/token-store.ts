interface TokenData {
  accessToken: string;
  expiresAt: number;
}

export class TokenStore {
  private tokenData: TokenData | null = null;

  setTokens({ accessToken, expiresIn }: { accessToken: string; expiresIn: number }): void {
    if (!accessToken || accessToken.trim().length === 0) {
      throw new Error("Access token cannot be empty");
    }

    if (expiresIn <= 0) {
      throw new Error("expiresIn must be positive");
    }

    const expiresAt = Date.now() + expiresIn * 1000;
    this.tokenData = { accessToken, expiresAt };
  }

  getAccessToken(): string | null {
    if (!this.tokenData) {
      return null;
    }

    // Return null if token is expired
    if (this.isTokenExpired()) {
      this.clearTokens();
      return null;
    }

    return this.tokenData.accessToken;
  }

  isTokenExpired(): boolean {
    if (!this.tokenData) {
      return true;
    }

    const BUFFER_MS = 5000; // 5 second safety buffer
    return Date.now() >= (this.tokenData.expiresAt - BUFFER_MS);
  }

  clearTokens(): void {
    this.tokenData = null;
  }
}

export const tokenStore = new TokenStore();
