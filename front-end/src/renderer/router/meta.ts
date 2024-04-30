import { RouteRecordRaw } from 'vue-router';

const withoutAuthRoutes = [
  'login',
  'styleGuide',
  // 'settingsGeneral',
  // 'settingsWorkGroups',
  'help',
  'forgotPassword',
];

const onlyAdminRoutes = ['signUpUser'];

export function attachMeta(routes: RouteRecordRaw[]) {
  routes.forEach(route => {
    // Without Auth routes, attach withoutAuth meta
    setMetaIf(route, withoutAuthRoutes, 'withoutAuth', true);

    // Only Admin routes, attach onlyAdmin meta
    setMetaIf(route, onlyAdminRoutes, 'onlyAdmin', true);
  });
}

function setMetaIf(route: RouteRecordRaw, matchers: string[], metaName: string, metaValue: any) {
  if (route.name && matchers.includes(route.name.toString())) {
    if (route.meta) {
      route.meta[metaName] = metaValue;
    } else {
      route.meta = {
        [metaName]: metaValue,
      };
    }
  }

  if (route.children) {
    route.children.forEach(subRoute => setMetaIf(subRoute, matchers, metaName, metaValue));
  }
}
