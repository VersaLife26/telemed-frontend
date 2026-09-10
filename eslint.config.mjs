import js from "@eslint/js";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

/**
 * ESLint flat config.
 *
 * Two things here are deliberate departures from what a Next.js project
 * normally ships, and both are consequences of the version pins in
 * _shared/DECISIONS.md ADR-001:
 *
 * 1. **`next lint` is gone.** Next.js 16 removed it. `npm run lint` invokes
 *    eslint directly.
 *
 * 2. **No `eslint-config-next`, and no typescript-eslint.** The project
 *    compiles with TypeScript 7.0.2. `typescript-eslint` 8.x hard-throws on
 *    any TypeScript >= 7.0 — not a warning, a thrown Error at module load:
 *
 *      Error: typescript-eslint does not support TS 7.0.
 *
 *    and `eslint-config-next` requires it transitively, so the whole config
 *    fails to load. Support is tracked in typescript-eslint#10940. Rather than
 *    downgrade the compiler the brief pins, or silently skip linting, this
 *    config is assembled from the plugins that *do* work and parses TypeScript
 *    with `@babel/eslint-parser`, which has no TypeScript dependency at all.
 *
 *    What is lost: type-aware rules (`no-floating-promises`,
 *    `no-misused-promises`). What is kept: every Next.js rule, every React and
 *    React-Hooks rule, and the full jsx-a11y rule set — which is the one that
 *    matters most here, because WCAG 2.1 AA is a stated requirement rather
 *    than an aspiration. `npx tsc --noEmit` covers the type side.
 *
 *    Revisit when typescript-eslint ships TS 7 support: delete the babel
 *    parser block and restore `eslint-config-next`.
 */

const tsFiles = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];

export default [
  {
    // .open-next and .wrangler are Cloudflare build output: a bundled Next
    // server and a workerd cache, neither of which is source.
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "node_modules/**",
      "out/**",
      "next-env.d.ts",
      "coverage/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        React: "readonly",
      },
    },
  },

  {
    // The TypeScript parser applies to every .ts/.tsx file, whichever rule set
    // judges it. Split out of the rule blocks below so scoping the rules does
    // not silently un-teach ESLint how to read TypeScript -- which shows up as
    // "Parsing error: Unexpected token", not as a missing rule.
    files: tsFiles,
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        sourceType: "module",
        babelOptions: {
          presets: [
            ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
            ["@babel/preset-react", { runtime: "automatic" }],
          ],
        },
      },
    },
    rules: {
      // The base rules cannot read TypeScript through the babel parser: every
      // interface name reads as an undefined identifier and every overload
      // signature as a redeclaration. tsc covers all three properly. Declared
      // here rather than in one rule block so files outside both surfaces --
      // types/next-auth.d.ts, the test harness, the stubs -- are covered too.
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
    },
  },

  {
    // Scoped to the admin console. The consumer surfaces get their own block
    // below: they were written against the Next-recommended rules alone, and
    // judging them by this stricter set turns twenty pre-existing patterns in
    // patient-web and doctor-web into build failures. Consolidation moves code;
    // it does not get to re-open lint decisions those apps already made.
    files: [
      "app/**/*.{ts,tsx}",
      "lib/admin/**/*.{ts,tsx}",
      "components/admin/**/*.{ts,tsx}",
      "test/admin/**/*.ts",
      "auth.ts",
      "auth.config.ts",
      "proxy.ts",
    ],
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooks.configs["recommended-latest"].rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      // --- React 19 / App Router adjustments ------------------------------
      // The automatic JSX runtime means React is never imported for JSX alone.
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      // Types come from TypeScript, not from runtime propTypes.
      "react/prop-types": "off",
      // <img> is used on purpose in the credential document viewer; see the
      // comment in next.config.ts about the image optimiser's on-disk cache.
      "@next/next/no-img-element": "off",

      // --- TypeScript syntax the base ESLint rules mis-read -----------------
      // `no-undef` cannot see type-only identifiers through the babel parser
      // and reports every interface name. tsc covers this properly.
      "no-undef": "off",
      // Overload signatures and ambient declarations trip the base rule.
      "no-unused-vars": "off",
      "no-redeclare": "off",

      // --- house rules -----------------------------------------------------
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",

      // Accessibility rules promoted from warn to error. These three are the
      // ones that decide whether the verification checklist can be operated by
      // keyboard at all, which the V2 docs list as a requirement.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/label-has-associated-control": "error",
      // `onError` and `onLoad` are removed from the handler list. They are the
      // only way to detect that an <img> or <iframe> failed to load, which the
      // credential document viewer depends on to show "this scan could not be
      // displayed" instead of a silent blank pane. They are not interactions —
      // no user performs them — and the rule's own documentation calls this out
      // as the case for narrowing `handlers`.
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        {
          handlers: [
            "onClick",
            "onMouseDown",
            "onMouseUp",
            "onKeyPress",
            "onKeyDown",
            "onKeyUp",
          ],
        },
      ],
    },
  },

  {
    // The patient and doctor surfaces, on the rules they shipped with.
    files: ["lib/consumer/**/*.{ts,tsx}", "components/consumer/**/*.{ts,tsx}", "test/consumer/**/*.ts"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  {
    // Config files run in Node and legitimately use console.
    files: ["*.mjs", "*.config.ts", "*.config.mjs", "scripts/*.mjs"],
    rules: { "no-console": "off" },
  },
];
