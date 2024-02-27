import type {RouteRecordRaw} from 'vue-router';

const withoutAuthRoutes = [
  'welcome',
  'login',
  'styleGuide',
  'settingsGeneral',
  'settingsWorkGroups',
  'help',
  'setupOrganization',
  'forgotPassword',
];

export function attachMeta(routes: RouteRecordRaw[]) {
  // Without Auth routes, attach withoutAuth meta
  routes.forEach(route => {
    setMetaIf(route, withoutAuthRoutes, 'withoutAuth', true);
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
