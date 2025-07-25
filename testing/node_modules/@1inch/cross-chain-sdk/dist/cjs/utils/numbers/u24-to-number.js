"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.u24ToNumber = u24ToNumber;
function u24ToNumber(val) {
    const bytes = val[0];
    return (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
}
//# sourceMappingURL=u24-to-number.js.map