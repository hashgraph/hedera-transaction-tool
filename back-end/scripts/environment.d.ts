declare global {
  namespace NodeJS {
    interface ProcessEnv {
      POSTGRES_HOST: string;
      POSTGRES_PORT: string;
      POSTGRES_DATABASE: string;
      POSTGRES_USERNAME: string;
      POSTGRES_PASSWORD: string;
    }
  }
}

export {};
