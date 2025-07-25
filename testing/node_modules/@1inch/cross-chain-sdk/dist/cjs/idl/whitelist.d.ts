import { WritableDeep } from 'type-fest';
declare const _IDL: {
    readonly address: "CShaLBTQn6xbwq9behWTZuDuYY7APeWvXchsHkTw3DcZ";
    readonly metadata: {
        readonly name: "whitelist";
        readonly version: "0.1.0";
        readonly spec: "0.1.0";
        readonly description: "Created with Anchor";
    };
    readonly docs: readonly ["Program for managing whitelisted users for the Fusion Swap"];
    readonly instructions: readonly [{
        readonly name: "deregister";
        readonly docs: readonly ["Removes a user from the whitelist"];
        readonly discriminator: readonly [161, 178, 39, 189, 231, 224, 13, 187];
        readonly accounts: readonly [{
            readonly name: "authority";
            readonly writable: true;
            readonly signer: true;
        }, {
            readonly name: "whitelistState";
            readonly pda: {
                readonly seeds: readonly [{
                    readonly kind: "const";
                    readonly value: readonly [119, 104, 105, 116, 101, 108, 105, 115, 116, 95, 115, 116, 97, 116, 101];
                }];
            };
        }, {
            readonly name: "resolverAccess";
            readonly writable: true;
            readonly pda: {
                readonly seeds: readonly [{
                    readonly kind: "const";
                    readonly value: readonly [114, 101, 115, 111, 108, 118, 101, 114, 95, 97, 99, 99, 101, 115, 115];
                }, {
                    readonly kind: "arg";
                    readonly path: "user";
                }];
            };
        }, {
            readonly name: "systemProgram";
            readonly address: "11111111111111111111111111111111";
        }];
        readonly args: readonly [{
            readonly name: "user";
            readonly type: "pubkey";
        }];
    }, {
        readonly name: "initialize";
        readonly docs: readonly ["Initializes the whitelist with the authority"];
        readonly discriminator: readonly [175, 175, 109, 31, 13, 152, 155, 237];
        readonly accounts: readonly [{
            readonly name: "authority";
            readonly writable: true;
            readonly signer: true;
        }, {
            readonly name: "whitelistState";
            readonly writable: true;
            readonly pda: {
                readonly seeds: readonly [{
                    readonly kind: "const";
                    readonly value: readonly [119, 104, 105, 116, 101, 108, 105, 115, 116, 95, 115, 116, 97, 116, 101];
                }];
            };
        }, {
            readonly name: "systemProgram";
            readonly address: "11111111111111111111111111111111";
        }];
        readonly args: readonly [];
    }, {
        readonly name: "register";
        readonly docs: readonly ["Registers a new user to the whitelist"];
        readonly discriminator: readonly [211, 124, 67, 15, 211, 194, 178, 240];
        readonly accounts: readonly [{
            readonly name: "authority";
            readonly writable: true;
            readonly signer: true;
        }, {
            readonly name: "whitelistState";
            readonly pda: {
                readonly seeds: readonly [{
                    readonly kind: "const";
                    readonly value: readonly [119, 104, 105, 116, 101, 108, 105, 115, 116, 95, 115, 116, 97, 116, 101];
                }];
            };
        }, {
            readonly name: "resolverAccess";
            readonly writable: true;
            readonly pda: {
                readonly seeds: readonly [{
                    readonly kind: "const";
                    readonly value: readonly [114, 101, 115, 111, 108, 118, 101, 114, 95, 97, 99, 99, 101, 115, 115];
                }, {
                    readonly kind: "arg";
                    readonly path: "user";
                }];
            };
        }, {
            readonly name: "systemProgram";
            readonly address: "11111111111111111111111111111111";
        }];
        readonly args: readonly [{
            readonly name: "user";
            readonly type: "pubkey";
        }];
    }, {
        readonly name: "setAuthority";
        readonly docs: readonly ["Sets the new whitelist authority"];
        readonly discriminator: readonly [133, 250, 37, 21, 110, 163, 26, 121];
        readonly accounts: readonly [{
            readonly name: "currentAuthority";
            readonly writable: true;
            readonly signer: true;
        }, {
            readonly name: "whitelistState";
            readonly writable: true;
            readonly pda: {
                readonly seeds: readonly [{
                    readonly kind: "const";
                    readonly value: readonly [119, 104, 105, 116, 101, 108, 105, 115, 116, 95, 115, 116, 97, 116, 101];
                }];
            };
        }];
        readonly args: readonly [{
            readonly name: "newAuthority";
            readonly type: "pubkey";
        }];
    }];
    readonly accounts: readonly [{
        readonly name: "resolverAccess";
        readonly discriminator: readonly [32, 2, 74, 248, 174, 108, 70, 156];
    }, {
        readonly name: "whitelistState";
        readonly discriminator: readonly [246, 118, 44, 60, 71, 37, 201, 55];
    }];
    readonly errors: readonly [{
        readonly code: 6000;
        readonly name: "unauthorized";
        readonly msg: "Unauthorized";
    }];
    readonly types: readonly [{
        readonly name: "resolverAccess";
        readonly type: {
            readonly kind: "struct";
            readonly fields: readonly [{
                readonly name: "bump";
                readonly type: "u8";
            }];
        };
    }, {
        readonly name: "whitelistState";
        readonly type: {
            readonly kind: "struct";
            readonly fields: readonly [{
                readonly name: "authority";
                readonly type: "pubkey";
            }];
        };
    }];
};
export declare const IDL: WritableDeep<typeof _IDL>;
export {};
