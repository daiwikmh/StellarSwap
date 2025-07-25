/**
 * Contains highest bits of address (>UINT_160_MAX) if address is bigger than UINT_160_MAX
 *
 * @see SolanaAddress.splitToParts
 */
export declare class AddressComplement {
    inner: bigint;
    static ZERO: AddressComplement;
    constructor(inner: bigint);
    asHex(): string;
    isZero(): boolean;
}
