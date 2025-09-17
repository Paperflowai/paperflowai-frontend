export const ENV = process.env.NEXT_PUBLIC_ENV ?? 'dev';
export const isProd = ENV === 'prod';
