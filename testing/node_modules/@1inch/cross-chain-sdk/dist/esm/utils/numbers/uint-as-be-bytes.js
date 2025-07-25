/**
 * Convert u64 bigint to big endian bytes
 */
export function uintAsBeBytes(value, size) {
    const bytesCount = size / 8;
    return Buffer.from(value.toString(16).padStart(bytesCount * 2, '0'), 'hex');
}
//# sourceMappingURL=uint-as-be-bytes.js.map