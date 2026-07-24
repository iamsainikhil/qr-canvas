const stripWrappingQuotes = (value: string) => {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

export const getEnvValue = (value: string | undefined) => {
  if (!value) return '';

  return stripWrappingQuotes(value);
};

export const getBooleanEnv = (value: string | undefined) => getEnvValue(value).toLowerCase() === 'true';

export const getMultilineEnv = (value: string | undefined) => getEnvValue(value).replace(/\\n/g, '\n');