declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ACCTOKEN_API_KEY?: string;
    ACCTOKEN_MODEL?: string;
    ACCTOKEN_BASE_URL?: string;
  }
}
