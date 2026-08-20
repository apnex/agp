import { AGP_V1_LIMITS } from "./constants.js";

export type RawJsonFailureCode =
  | "INVALID_JSON"
  | "DUPLICATE_MEMBER"
  | "NUMERIC_PROFILE"
  | "DEPTH_LIMIT";

export type JsonValueInspectionFailureCode =
  | "SCHEMA"
  | "NUMERIC_PROFILE"
  | "DEPTH_LIMIT";

class RawJsonError extends Error {
  public constructor(public readonly reasonCode: RawJsonFailureCode) {
    super(reasonCode);
  }
}

/**
 * Performs checks which must happen against the original JSON tokens before
 * JSON.parse can erase duplicate names or round a number.
 */
export function preflightRawJson(text: string): RawJsonFailureCode | undefined {
  try {
    new RawJsonScanner(text).scan();
    return undefined;
  } catch (error: unknown) {
    if (error instanceof RawJsonError) {
      return error.reasonCode;
    }
    return "INVALID_JSON";
  }
}

/**
 * JavaScript strings can contain unpaired UTF-16 surrogates even though no
 * valid UTF-8 text message can contain the corresponding scalar value.
 */
export function hasUnpairedUtf16Surrogate(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }
      index += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/**
 * Rejects runtime values that JSON Schema alone can mistake for JSON (for
 * example Date instances, sparse arrays, accessors, undefined, and cycles).
 * It also gives depth and numeric failures their stable public reason codes.
 */
export function inspectRuntimeJsonValue(
  value: unknown,
): JsonValueInspectionFailureCode | undefined {
  try {
    return inspectValue(value, 0, new WeakSet<object>());
  } catch {
    // Hostile proxies and throwing reflective traps are not JSON values.
    return "SCHEMA";
  }
}

function inspectValue(
  value: unknown,
  containerDepth: number,
  ancestors: WeakSet<object>,
): JsonValueInspectionFailureCode | undefined {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return undefined;
  }

  if (typeof value === "number") {
    if (
      !Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value))
    ) {
      return "NUMERIC_PROFILE";
    }
    return undefined;
  }

  if (typeof value !== "object") {
    return "SCHEMA";
  }

  const nextDepth = containerDepth + 1;
  if (nextDepth > AGP_V1_LIMITS.maxDepth) {
    return "DEPTH_LIMIT";
  }

  if (ancestors.has(value)) {
    return "SCHEMA";
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        return "SCHEMA";
      }

      const keys = Reflect.ownKeys(value);
      // A dense array has one own property for every element plus length.
      if (keys.length !== value.length + 1) {
        return "SCHEMA";
      }

      for (const key of keys) {
        if (key === "length") {
          continue;
        }
        if (typeof key !== "string" || !isCanonicalArrayIndex(key, value.length)) {
          return "SCHEMA";
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !("value" in descriptor)
        ) {
          return "SCHEMA";
        }
        const failure = inspectValue(descriptor.value, nextDepth, ancestors);
        if (failure !== undefined) {
          return failure;
        }
      }
      return undefined;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return "SCHEMA";
    }

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        return "SCHEMA";
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        return "SCHEMA";
      }
      const failure = inspectValue(descriptor.value, nextDepth, ancestors);
      if (failure !== undefined) {
        return failure;
      }
    }
    return undefined;
  } finally {
    ancestors.delete(value);
  }
}

function isCanonicalArrayIndex(key: string, length: number): boolean {
  if (key === "0") {
    return length > 0;
  }
  if (!/^[1-9][0-9]*$/.test(key)) {
    return false;
  }
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
}

class RawJsonScanner {
  private index = 0;

  public constructor(private readonly text: string) {}

  public scan(): void {
    this.skipWhitespace();
    this.scanValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      this.fail("INVALID_JSON");
    }
  }

  private scanValue(containerDepth: number): void {
    const character = this.text[this.index];
    switch (character) {
      case "{":
        this.scanObject(containerDepth + 1);
        return;
      case "[":
        this.scanArray(containerDepth + 1);
        return;
      case "\"":
        this.scanString(false);
        return;
      case "t":
        this.scanLiteral("true");
        return;
      case "f":
        this.scanLiteral("false");
        return;
      case "n":
        this.scanLiteral("null");
        return;
      default:
        if (character === "-" || isDigit(character)) {
          this.scanNumber();
          return;
        }
        this.fail("INVALID_JSON");
    }
  }

  private scanObject(depth: number): void {
    this.assertDepth(depth);
    this.index += 1;
    this.skipWhitespace();

    const members = new Set<string>();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return;
    }

    while (this.index < this.text.length) {
      if (this.text[this.index] !== "\"") {
        this.fail("INVALID_JSON");
      }
      const member = this.scanString(true);
      if (member === undefined) {
        this.fail("INVALID_JSON");
      }
      if (members.has(member)) {
        this.fail("DUPLICATE_MEMBER");
      }
      members.add(member);

      this.skipWhitespace();
      if (this.text[this.index] !== ":") {
        this.fail("INVALID_JSON");
      }
      this.index += 1;
      this.skipWhitespace();
      this.scanValue(depth);
      this.skipWhitespace();

      const delimiter = this.text[this.index];
      if (delimiter === "}") {
        this.index += 1;
        return;
      }
      if (delimiter !== ",") {
        this.fail("INVALID_JSON");
      }
      this.index += 1;
      this.skipWhitespace();
    }

    this.fail("INVALID_JSON");
  }

  private scanArray(depth: number): void {
    this.assertDepth(depth);
    this.index += 1;
    this.skipWhitespace();

    if (this.text[this.index] === "]") {
      this.index += 1;
      return;
    }

    while (this.index < this.text.length) {
      this.scanValue(depth);
      this.skipWhitespace();

      const delimiter = this.text[this.index];
      if (delimiter === "]") {
        this.index += 1;
        return;
      }
      if (delimiter !== ",") {
        this.fail("INVALID_JSON");
      }
      this.index += 1;
      this.skipWhitespace();
    }

    this.fail("INVALID_JSON");
  }

  private scanString(decode: boolean): string | undefined {
    const start = this.index;
    this.index += 1;

    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      if (code === 0x22) {
        this.index += 1;
        if (!decode) {
          return undefined;
        }
        try {
          const parsed: unknown = JSON.parse(this.text.slice(start, this.index));
          if (typeof parsed !== "string") {
            this.fail("INVALID_JSON");
          }
          return parsed;
        } catch {
          this.fail("INVALID_JSON");
        }
      }

      if (code === 0x5c) {
        this.index += 1;
        const escaped = this.text[this.index];
        if (
          escaped === "\"" ||
          escaped === "\\" ||
          escaped === "/" ||
          escaped === "b" ||
          escaped === "f" ||
          escaped === "n" ||
          escaped === "r" ||
          escaped === "t"
        ) {
          this.index += 1;
          continue;
        }
        if (escaped === "u") {
          for (let offset = 1; offset <= 4; offset += 1) {
            if (!isHexDigit(this.text[this.index + offset])) {
              this.fail("INVALID_JSON");
            }
          }
          this.index += 5;
          continue;
        }
        this.fail("INVALID_JSON");
      }

      if (code < 0x20) {
        this.fail("INVALID_JSON");
      }
      this.index += 1;
    }

    this.fail("INVALID_JSON");
  }

  private scanNumber(): void {
    const start = this.index;

    if (this.text[this.index] === "-") {
      this.index += 1;
    }

    if (this.text[this.index] === "0") {
      this.index += 1;
    } else {
      if (!isNonZeroDigit(this.text[this.index])) {
        this.fail("INVALID_JSON");
      }
      this.index += 1;
      while (isDigit(this.text[this.index])) {
        this.index += 1;
      }
    }

    if (this.text[this.index] === ".") {
      this.index += 1;
      if (!isDigit(this.text[this.index])) {
        this.fail("INVALID_JSON");
      }
      while (isDigit(this.text[this.index])) {
        this.index += 1;
      }
    }

    const exponentMarker = this.text[this.index];
    if (exponentMarker === "e" || exponentMarker === "E") {
      this.index += 1;
      const sign = this.text[this.index];
      if (sign === "+" || sign === "-") {
        this.index += 1;
      }
      if (!isDigit(this.text[this.index])) {
        this.fail("INVALID_JSON");
      }
      while (isDigit(this.text[this.index])) {
        this.index += 1;
      }
    }

    const token = this.text.slice(start, this.index);
    if (!numberTokenConforms(token)) {
      this.fail("NUMERIC_PROFILE");
    }
  }

  private scanLiteral(literal: "true" | "false" | "null"): void {
    if (!this.text.startsWith(literal, this.index)) {
      this.fail("INVALID_JSON");
    }
    this.index += literal.length;
  }

  private skipWhitespace(): void {
    while (isJsonWhitespace(this.text.charCodeAt(this.index))) {
      this.index += 1;
    }
  }

  private assertDepth(depth: number): void {
    if (depth > AGP_V1_LIMITS.maxDepth) {
      this.fail("DEPTH_LIMIT");
    }
  }

  private fail(reasonCode: RawJsonFailureCode): never {
    throw new RawJsonError(reasonCode);
  }
}

function numberTokenConforms(token: string): boolean {
  const parsed = Number(token);
  if (!Number.isFinite(parsed)) {
    return false;
  }

  const unsigned = token[0] === "-" ? token.slice(1) : token;
  const exponentIndex = unsigned.search(/[eE]/);
  const mantissa =
    exponentIndex === -1 ? unsigned : unsigned.slice(0, exponentIndex);
  const exponentText =
    exponentIndex === -1 ? undefined : unsigned.slice(exponentIndex + 1);
  const decimalIndex = mantissa.indexOf(".");
  const integerPart =
    decimalIndex === -1 ? mantissa : mantissa.slice(0, decimalIndex);
  const fractionPart =
    decimalIndex === -1 ? "" : mantissa.slice(decimalIndex + 1);
  const rawDigits = integerPart + fractionPart;

  if (/^0+$/.test(rawDigits)) {
    return true;
  }

  const maximumRelevantExponent =
    rawDigits.length + fractionPart.length + AGP_V1_LIMITS.maxDepth;
  const exponent = parseExponentCapped(
    exponentText,
    maximumRelevantExponent,
  );
  const scale = exponent - fractionPart.length;

  if (scale >= 0) {
    return safeIntegerDigitsWithTrailingZeros(rawDigits, scale);
  }

  const requiredTrailingZeros = -scale;
  if (requiredTrailingZeros > countTrailingZeros(rawDigits)) {
    // The exact decimal value has a fractional component.
    return true;
  }

  const integerDigits = rawDigits.slice(
    0,
    rawDigits.length - requiredTrailingZeros,
  );
  return safeIntegerDigitsWithTrailingZeros(integerDigits, 0);
}

function parseExponentCapped(
  exponentText: string | undefined,
  maximumMagnitude: number,
): number {
  if (exponentText === undefined) {
    return 0;
  }

  const negative = exponentText[0] === "-";
  const digits =
    exponentText[0] === "+" || exponentText[0] === "-"
      ? exponentText.slice(1)
      : exponentText;
  const normalized = digits.replace(/^0+/, "") || "0";
  const maximumText = String(maximumMagnitude);
  const aboveMaximum =
    normalized.length > maximumText.length ||
    (normalized.length === maximumText.length && normalized > maximumText);
  const magnitude = aboveMaximum ? maximumMagnitude + 1 : Number(normalized);
  return negative ? -magnitude : magnitude;
}

function countTrailingZeros(digits: string): number {
  let count = 0;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    if (digits[index] !== "0") {
      return count;
    }
    count += 1;
  }
  return count;
}

function safeIntegerDigitsWithTrailingZeros(
  rawDigits: string,
  trailingZeros: number,
): boolean {
  const digits = rawDigits.replace(/^0+/, "") || "0";
  if (digits === "0") {
    return true;
  }

  const maximum = String(AGP_V1_LIMITS.maxSafeIntegerMagnitude);
  const effectiveLength = digits.length + trailingZeros;
  if (effectiveLength < maximum.length) {
    return true;
  }
  if (effectiveLength > maximum.length) {
    return false;
  }

  const candidate = `${digits}${"0".repeat(trailingZeros)}`;
  return candidate <= maximum;
}

function isJsonWhitespace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

function isDigit(character: string | undefined): boolean {
  return character !== undefined && character >= "0" && character <= "9";
}

function isNonZeroDigit(character: string | undefined): boolean {
  return character !== undefined && character >= "1" && character <= "9";
}

function isHexDigit(character: string | undefined): boolean {
  return (
    character !== undefined &&
    ((character >= "0" && character <= "9") ||
      (character >= "a" && character <= "f") ||
      (character >= "A" && character <= "F"))
  );
}
