export function toArray(v: any, defaultV?: string[]): string[] {
    if (v && !Array.isArray(v)) {
        if (typeof v === 'string') {
            return [v];
        }
        throw `field must provide either a string or an array of strings`;
    }
    return v || defaultV || [];
}