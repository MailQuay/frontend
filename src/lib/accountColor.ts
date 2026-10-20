const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

export function accountColorValue(color: string | undefined): string {
  if (color && HEX_COLOR.test(color)) return color;
  return 'var(--muted-foreground)';
}
