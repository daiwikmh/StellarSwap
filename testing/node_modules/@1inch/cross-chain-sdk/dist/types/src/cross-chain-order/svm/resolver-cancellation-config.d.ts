export declare class ResolverCancellationConfig {
    readonly maxCancellationPremium: bigint;
    readonly cancellationAuctionDuration: number;
    static BASE_1E3: bigint;
    static readonly ZERO: ResolverCancellationConfig;
    static readonly ALMOST_ZERO: ResolverCancellationConfig;
    constructor(maxCancellationPremium: bigint, cancellationAuctionDuration: number);
    static disableResolverCancellation(): ResolverCancellationConfig;
    toJSON(): {
        maxCancellationPremium: string;
        cancellationAuctionDuration: number;
    };
    isZero(): boolean;
}
