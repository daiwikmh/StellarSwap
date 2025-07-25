import { isHexBytes } from '@1inch/byte-utils';
import assert from 'assert';
import { Buffer } from 'buffer';
export function bufferFromHex(hex, bytesSize = -1) {
    assert(isHexBytes(hex));
    assert(bytesSize === -1 || hex.slice(2).length / 2 <= bytesSize, 'cannot extend buffer');
    if (bytesSize === -1) {
        return Buffer.from(hex.slice(2), 'hex');
    }
    return Buffer.from(hex.slice(2).padStart(bytesSize * 2, '0'), 'hex');
}
export function bufferToHex(buf) {
    return '0x' + Buffer.from(buf).toString('hex');
}
//# sourceMappingURL=bytes.js.map