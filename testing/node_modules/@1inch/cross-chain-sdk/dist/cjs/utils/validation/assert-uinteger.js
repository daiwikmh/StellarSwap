"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertUInteger = assertUInteger;
const byte_utils_1 = require("@1inch/byte-utils");
function assertUInteger(val, max = byte_utils_1.UINT_32_MAX) {
    if (typeof val === 'number' && !Number.isInteger(val)) {
        throw new Error(`Expected ${val} to be an integer`);
    }
    if (val < 0) {
        throw new Error(`Expected ${val} to be >= 0`);
    }
    if (val > max) {
        throw new Error(`Expected ${val} to be <= ${max}`);
    }
}
//# sourceMappingURL=assert-uinteger.js.map