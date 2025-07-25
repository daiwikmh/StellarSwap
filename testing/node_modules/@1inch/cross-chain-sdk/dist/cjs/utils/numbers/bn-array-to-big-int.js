"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bnArrayToBigInt = bnArrayToBigInt;
function bnArrayToBigInt(arr) {
    const hex = '0x' +
        arr
            .reverse()
            .map((bn) => bn.toString(16).padStart(16, '0'))
            .join('');
    return BigInt(hex);
}
//# sourceMappingURL=bn-array-to-big-int.js.map