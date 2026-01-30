export function hasDirectiveCall(code: string): boolean {
  return /directive\s*\(/.test(code);
}

export function hasStylesImport(code: string, importPath: string): boolean {
  const escaped = importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\s+.*from\\s+['"]${escaped}['"]`).test(code);
}

function findMatchingBrace(code: string, openIndex: number): number {
  let depth = 0;

  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === "{") {
      depth++;
    } else if (code[i] === "}") {
      depth--;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

export function hasStylesAssign(code: string): boolean {
  const assignPattern = /assign\s*:\s*\{/g;
  let match;

  while ((match = assignPattern.exec(code)) !== null) {
    const openBrace = code.indexOf("{", match.index + match[0].indexOf("{"));
    const closeBrace = findMatchingBrace(code, openBrace);

    if (closeBrace === -1) {
      continue;
    }

    const assignBody = code.slice(openBrace, closeBrace + 1);

    if (/\$styles\b/.test(assignBody)) {
      return true;
    }
  }

  return false;
}

function findDirectiveArgs(
  code: string,
  startIndex: number,
): {
  end: number;
  hasOptions: boolean;
  optionsStart: number;
  optionsEnd: number;
} | null {
  let i = startIndex;

  while (i < code.length && code[i] !== "(") {
    i++;
  }

  if (i >= code.length) {
    return null;
  }

  const parenOpen = i;
  let depth = 1;
  let commaCount = 0;
  let lastCommaIndex = -1;
  let optionsStart = -1;
  let optionsEnd = -1;
  i++;

  while (i < code.length && depth > 0) {
    if (code[i] === "(" || code[i] === "{" || code[i] === "[") {
      if (
        code[i] === "{" &&
        depth === 1 &&
        commaCount >= 2 &&
        optionsStart === -1
      ) {
        optionsStart = i;
      }

      depth++;
    } else if (code[i] === ")" || code[i] === "}" || code[i] === "]") {
      if (code[i] === "}" && optionsStart !== -1 && optionsEnd === -1) {
        const tempDepth = countDepthAt(code, optionsStart, i);

        if (tempDepth === 0) {
          optionsEnd = i;
        }
      }

      depth--;
    } else if (code[i] === "," && depth === 1) {
      commaCount++;
      lastCommaIndex = i;
    }

    i++;
  }

  if (depth !== 0) {
    return null;
  }

  const parenClose = i - 1;
  const hasOptions = optionsStart !== -1 && optionsEnd !== -1;

  return {
    end: parenClose,
    hasOptions,
    optionsStart,
    optionsEnd,
  };
}

function countDepthAt(code: string, from: number, to: number): number {
  let depth = 0;

  for (let i = from; i <= to; i++) {
    if (code[i] === "{") {
      depth++;
    } else if (code[i] === "}") {
      depth--;
    }
  }

  return depth;
}

function injectIntoAssign(optionsBody: string): string {
  const assignMatch = optionsBody.match(/assign\s*:\s*\{/);

  if (!assignMatch || assignMatch.index === undefined) {
    const closingBrace = optionsBody.lastIndexOf("}");

    if (closingBrace <= 0) {
      return optionsBody;
    }

    const before = optionsBody.slice(0, closingBrace).trimEnd();
    const needsComma = before.length > 1 && !before.endsWith(",");
    return before + (needsComma ? ", " : " ") + "assign: { $styles } }";
  }

  const braceStart = optionsBody.indexOf(
    "{",
    assignMatch.index + assignMatch[0].indexOf("{"),
  );
  const braceEnd = findMatchingBrace(optionsBody, braceStart);

  if (braceEnd === -1) {
    return optionsBody;
  }

  const inner = optionsBody.slice(braceStart + 1, braceEnd).trim();
  const needsComma = inner.length > 0 && !inner.endsWith(",");
  const newInner = inner + (needsComma ? ", " : "") + "$styles";

  return (
    optionsBody.slice(0, braceStart + 1) +
    " " +
    newInner +
    " " +
    optionsBody.slice(braceEnd)
  );
}

function findAllDirectives(code: string): number[] {
  const indices: number[] = [];
  const pattern = /directive\s*\(/g;
  let match;

  while ((match = pattern.exec(code)) !== null) {
    indices.push(match.index);
  }

  return indices;
}

function hasStylesInDirective(code: string, startIndex: number): boolean {
  const args = findDirectiveArgs(code, startIndex);

  if (!args || !args.hasOptions) {
    return false;
  }

  const optionsBody = code.slice(args.optionsStart, args.optionsEnd + 1);
  const assignMatch = optionsBody.match(/assign\s*:\s*\{/);

  if (!assignMatch || assignMatch.index === undefined) {
    return false;
  }

  const braceStart = optionsBody.indexOf(
    "{",
    assignMatch.index + assignMatch[0].indexOf("{"),
  );
  const braceEnd = findMatchingBrace(optionsBody, braceStart);

  if (braceEnd === -1) {
    return false;
  }

  return /\$styles\b/.test(optionsBody.slice(braceStart, braceEnd + 1));
}

export function transformDirective(code: string, importPath: string): string {
  let result = code;

  if (!hasStylesImport(code, importPath)) {
    const lastImportMatch = code.match(/^import\s+.*$/gm);

    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const idx = code.lastIndexOf(lastImport) + lastImport.length;
      result =
        code.slice(0, idx) +
        `\nimport * as $styles from '${importPath}'` +
        code.slice(idx);
    } else {
      result = `import * as $styles from '${importPath}'\n` + code;
    }
  }

  const indices = findAllDirectives(result).reverse();

  for (const startIndex of indices) {
    if (hasStylesInDirective(result, startIndex)) {
      continue;
    }

    const args = findDirectiveArgs(result, startIndex);

    if (!args) {
      continue;
    }

    if (args.hasOptions) {
      const optionsBody = result.slice(args.optionsStart, args.optionsEnd + 1);
      const newOptions = injectIntoAssign(optionsBody);

      if (newOptions !== optionsBody) {
        result =
          result.slice(0, args.optionsStart) +
          newOptions +
          result.slice(args.optionsEnd + 1);
      }
    } else {
      const insertion = ", { assign: { $styles } }";
      result = result.slice(0, args.end) + insertion + result.slice(args.end);
    }
  }

  return result;
}
