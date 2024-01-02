"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeOrganization = exports.addOrganization = exports.getOrganizations = exports.clearStore = void 0;
const store_1 = __importDefault(require("../modules/store"));
const store = (0, store_1.default)();
/* Clear Store */
const clearStore = () => store.clear();
exports.clearStore = clearStore;
/* Organizations */
const getOrganizations = () => store.get('organizations');
exports.getOrganizations = getOrganizations;
const addOrganization = (organization) => {
    if (store.store.organizations.some(org => org.name === organization.name || org.serverUrl === organization.serverUrl)) {
        throw new Error('Organization with that name or serverUrl exists!');
    }
    store.set('organizations', [organization, ...store.store.organizations]);
};
exports.addOrganization = addOrganization;
const removeOrganization = (serverUrl) => store.set('organizations', store.store.organizations.filter(o => o.serverUrl !== serverUrl));
exports.removeOrganization = removeOrganization;
