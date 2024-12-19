import type { RouteRecordRaw } from 'vue-router';

const withoutAuthRoutes = [
  'login',
  'styleGuide',
  'migrate',
  'index',
  // 'settingsGeneral',
  // 'settingsWorkGroups',
];

const onlyAdminRoutes = ['signUpUser'];
const onlyOrganizationRoute = ['settingsNotifications', 'contactList'];

export function attachMeta(routes: RouteRecordRaw[]) {
  routes.forEach(route => {
    // Without Auth routes, attach withoutAuth meta
    setMetaIf(route, withoutAuthRoutes, 'withoutAuth', true);

    // Only Admin routes, attach onlyAdmin meta
    setMetaIf(route, onlyAdminRoutes, 'onlyAdmin', true);

    // Only Organization routes, attach onlyOrganization meta
    setMetaIf(route, onlyOrganizationRoute, 'onlyOrganization', true);
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
