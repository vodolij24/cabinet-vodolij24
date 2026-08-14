declare module "xlsx" {
  export function read(
    data: Buffer | Uint8Array | string,
    opts?: { type?: string }
  ): {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  export const utils: {
    sheet_to_json: <T>(
      sheet: unknown,
      opts?: { header?: number | string[]; raw?: boolean; defval?: unknown }
    ) => T[];
  };
}
