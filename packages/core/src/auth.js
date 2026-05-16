/**
 * Bearer token from Veritas portal flow (documented SDK path).
 */
export class PortalTokenAuthProvider {
    token;
    constructor(token) {
        this.token = token;
    }
    getToken() {
        return Promise.resolve(this.token);
    }
}
//# sourceMappingURL=auth.js.map