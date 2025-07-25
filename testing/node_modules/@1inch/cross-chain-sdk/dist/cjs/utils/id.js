"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.id = id;
const byte_utils_1 = require("@1inch/byte-utils");
function id() {
    return Math.floor(Math.random() * Number(byte_utils_1.UINT_32_MAX));
}
//# sourceMappingURL=id.js.map