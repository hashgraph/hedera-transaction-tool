export * from 'vue-router';

declare module 'vue-router' {
  interface Router {
    previousPath: string;
    previousTab: string;
  }
}
