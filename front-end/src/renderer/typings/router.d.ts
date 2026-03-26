export * from 'vue-router';

declare module 'vue-router' {
  interface Router {
    appMenuItem: string | undefined;
    previousPath: string;
    previousTab: string;
  }
}
