"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = __importDefault(require("./theme"));
const configuration_1 = __importDefault(require("./configuration"));
const keyPairs_1 = __importDefault(require("./keyPairs"));
const utils_1 = __importDefault(require("./utils"));
function default_1(app) {
    (0, theme_1.default)();
    (0, configuration_1.default)();
    (0, utils_1.default)();
    (0, keyPairs_1.default)(app);
}
exports.default = default_1;
