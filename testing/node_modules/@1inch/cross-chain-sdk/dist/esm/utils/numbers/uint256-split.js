import { UINT_64_MAX } from '@1inch/byte-utils';
/**
 * Split uint256 to four u64 integers as little endian
 */
export function uint256split(value) {
    const res = [0n, 0n, 0n, 0n];
    for (let i = 0; i < 4; i++) {
        res[i] = value & UINT_64_MAX;
        value >>= 64n;
    }
    return res;
}
//# sourceMappingURL=uint256-split.js.map