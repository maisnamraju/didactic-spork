interface TokenData {
  accessToken: string;
  expiresAt: number;
}

class TokenStore {
  private tokenData: TokenData | null = null;

  setTokens({ accessToken, expiresIn }: { accessToken: string; expiresIn: number }): void {
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

    return Date.now() >= this.tokenData.expiresAt;
  }

  clearTokens(): void {
    this.tokenData = null;
  }
}

export const tokenStore = new TokenStore();
