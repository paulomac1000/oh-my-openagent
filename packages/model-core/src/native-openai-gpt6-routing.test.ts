import { describe, expect, test } from "bun:test"
import { AGENT_MODEL_REQUIREMENTS, CATEGORY_MODEL_REQUIREMENTS } from "./model-requirements"

/**
 * Native OpenAI GPT-5.x -> GPT-6 routing migration (#203).
 *
 * Qualification evidence (2026-10-02, fresh-process probes through the installed
 * OpenCode native openai provider):
 * - gpt-6-luna: qualified (base/low/high + tool use)
 * - gpt-6-sol: qualified (base/medium/high/xhigh/max + tool use)
 * - gpt-6.1-sol: qualified (base/low/medium/xhigh/max + tool use)
 *
 * Provider isolation is a hard invariant: only `openai` provider rows migrate.
 * github-copilot / opencode / vercel / quotio-openai rows must keep their
 * existing GPT-5.6 routes.
 */

const GPT5_PREFIX = /^gpt-5/

function findOpenAiEntries(chain: ReadonlyArray<{ providers: readonly string[]; model: string; variant?: string }>) {
  return chain.filter((entry) => entry.providers.includes("openai"))
}

function findCopilotGpt56Entries(
  chain: ReadonlyArray<{ providers: readonly string[]; model: string; variant?: string }>,
): Array<{ providers: readonly string[]; model: string; variant?: string }> {
  return chain.filter((entry) => entry.providers.includes("github-copilot") && GPT5_PREFIX.test(entry.model))
}

describe("native OpenAI GPT-6 agent routing", () => {
  test("strong roles resolve the native OpenAI rung to gpt-6.1-sol with preserved variants", () => {
    // given
    const strongRoles: Array<{ role: string; variant: string; position: number }> = [
      { role: "sisyphus", variant: "medium", position: 2 },
      { role: "hephaestus", variant: "medium", position: 0 },
      { role: "oracle", variant: "xhigh", position: 0 },
      { role: "multimodal-looker", variant: "low", position: 0 },
      { role: "atlas", variant: "medium", position: 2 },
      { role: "sisyphus-junior", variant: "medium", position: 2 },
    ]

    // when / then
    for (const { role, variant, position } of strongRoles) {
      const requirement = AGENT_MODEL_REQUIREMENTS[role]
      const openAiRung = requirement.fallbackChain[position]
      expect(openAiRung.providers).toContain("openai")
      expect(openAiRung.model).toBe("gpt-6.1-sol")
      expect(openAiRung.variant).toBe(variant)
    }
  })

  test("fast roles resolve the native OpenAI rung to gpt-6-luna low", () => {
    // given
    for (const role of ["librarian", "explore"] as const) {
      // when
      const requirement = AGENT_MODEL_REQUIREMENTS[role]
      const openAiPrimary = requirement.fallbackChain[0]

      // then
      expect(openAiPrimary.providers).toEqual(["openai"])
      expect(openAiPrimary.model).toBe("gpt-6-luna")
      expect(openAiPrimary.variant).toBe("low")
    }
  })

  test("momus terra rung maps to gpt-6-sol high and strong rung to gpt-6.1-sol xhigh without duplicate native rungs", () => {
    // given
    const momus = AGENT_MODEL_REQUIREMENTS["momus"]

    // when
    const nativeRungs = findOpenAiEntries(momus.fallbackChain)
    const models = nativeRungs.map((entry) => entry.model)

    // then
    expect(nativeRungs[0]).toEqual({ providers: ["openai"], model: "gpt-6-sol", variant: "high" })
    expect(nativeRungs[1]).toEqual({ providers: ["openai"], model: "gpt-6.1-sol", variant: "xhigh" })
    expect(new Set(models).size).toBe(models.length)
  })

  test("old nano fallback rows no longer carry the openai provider", () => {
    // given
    for (const role of ["librarian", "explore", "multimodal-looker"] as const) {
      // when
      const requirement = AGENT_MODEL_REQUIREMENTS[role]
      const openAiEntries = findOpenAiEntries(requirement.fallbackChain)

      // then: every remaining openai entry is a GPT-6 target, none are nano tails
      for (const entry of openAiEntries) {
        expect(entry.model.startsWith("gpt-6")).toBe(true)
      }
    }
  })

  test("no AGENT_MODEL_REQUIREMENTS openai entry actively targets gpt-5", () => {
    // given / when / then
    for (const [role, requirement] of Object.entries(AGENT_MODEL_REQUIREMENTS)) {
      for (const entry of findOpenAiEntries(requirement.fallbackChain)) {
        expect(GPT5_PREFIX.test(entry.model)).toBe(false)
      }
      expect(`${role}: checked`).toBeString()
    }
  })
})

describe("native OpenAI GPT-6 category routing", () => {
  test("strong categories resolve the native OpenAI rung to gpt-6.1-sol with preserved variants", () => {
    // given
    const strongCategories: Array<{ category: string; variant: string }> = [
      { category: "visual-engineering", variant: "medium" },
      { category: "ultrabrain", variant: "max" },
      { category: "deep", variant: "medium" },
      { category: "unspecified-high", variant: "high" },
    ]

    // when / then
    for (const { category, variant } of strongCategories) {
      const requirement = CATEGORY_MODEL_REQUIREMENTS[category]
      const openAiRung = findOpenAiEntries(requirement.fallbackChain).find(
        (entry) => entry.model.startsWith("gpt-6"),
      )
      expect(openAiRung).toBeDefined()
      expect(openAiRung?.model).toBe("gpt-6.1-sol")
      expect(openAiRung?.variant).toBe(variant)
    }
  })

  test("unspecified-low maps the native OpenAI rung to gpt-6-sol high", () => {
    // given
    const requirement = CATEGORY_MODEL_REQUIREMENTS["unspecified-low"]

    // when
    const openAiRung = findOpenAiEntries(requirement.fallbackChain)[0]

    // then
    expect(openAiRung).toEqual({ providers: ["openai"], model: "gpt-6-sol", variant: "high" })
  })

  test("ultrabrain keeps a single native gpt-6.1-sol max rung (no duplicate after split)", () => {
    // given
    const requirement = CATEGORY_MODEL_REQUIREMENTS["ultrabrain"]

    // when
    const nativeStrongRungs = findOpenAiEntries(requirement.fallbackChain).filter(
      (entry) => entry.model === "gpt-6.1-sol",
    )

    // then
    expect(nativeStrongRungs).toHaveLength(1)
    expect(nativeStrongRungs[0].variant).toBe("max")
  })

  test("no CATEGORY_MODEL_REQUIREMENTS openai entry actively targets gpt-5", () => {
    // given / when / then
    for (const [category, requirement] of Object.entries(CATEGORY_MODEL_REQUIREMENTS)) {
      for (const entry of findOpenAiEntries(requirement.fallbackChain)) {
        expect(GPT5_PREFIX.test(entry.model)).toBe(false)
      }
      expect(`${category}: checked`).toBeString()
    }
  })
})

describe("provider isolation invariants", () => {
  test("github-copilot keeps its existing gpt-5.6 routes untouched", () => {
    // given
    const copilotExpectations: Record<string, Array<{ model: string; variant?: string }>> = {
      sisyphus: [{ model: "gpt-5.6-sol", variant: "medium" }],
      hephaestus: [{ model: "gpt-5.6-sol", variant: "medium" }],
      oracle: [
        { model: "gpt-5.6-sol", variant: "high" },
        { model: "gpt-5.6-sol", variant: "high" },
      ],
      momus: [
        { model: "gpt-5.6-terra", variant: "high" },
        { model: "gpt-5.6-sol", variant: "high" },
      ],
      atlas: [{ model: "gpt-5.6-sol", variant: "medium" }],
      "sisyphus-junior": [{ model: "gpt-5.6-sol", variant: "medium" }],
      "multimodal-looker": [{ model: "gpt-5-nano" }],
    }

    // when / then
    for (const [role, expected] of Object.entries(copilotExpectations)) {
      const copilotEntries = findCopilotGpt56Entries(AGENT_MODEL_REQUIREMENTS[role].fallbackChain)
      const models: Array<{ model: string; variant?: string }> = copilotEntries.map((entry) => ({
        model: entry.model,
        variant: entry.variant,
      }))
      for (const expectation of expected) {
        expect(models).toContainEqual(expectation)
      }
    }

    for (const category of ["visual-engineering", "ultrabrain", "deep", "unspecified-low", "unspecified-high"]) {
      const copilotEntries = findCopilotGpt56Entries(CATEGORY_MODEL_REQUIREMENTS[category].fallbackChain)
      expect(copilotEntries.length).toBeGreaterThan(0)
      const expectedCopilotModel = category === "unspecified-low" ? "gpt-5.6-terra" : "gpt-5.6-sol"
      for (const entry of copilotEntries) {
        expect(entry.model).toBe(expectedCopilotModel)
      }
    }
  })

  test("vercel and opencode keep their gpt-5.6 routes on split rows", () => {
    // given
    const oracleRungs = AGENT_MODEL_REQUIREMENTS["oracle"].fallbackChain

    // when
    const vercelSolRung = oracleRungs.find(
      (entry) => entry.providers.includes("vercel") && entry.model === "gpt-5.6-sol",
    )

    // then
    expect(vercelSolRung).toBeDefined()
    expect(vercelSolRung?.providers).not.toContain("openai")
  })

  test("quotio-openai keeps its gpt-5.6 routes on split category rows", () => {
    // given
    const deepChain = CATEGORY_MODEL_REQUIREMENTS["deep"].fallbackChain

    // when
    const quotioRung = deepChain.find(
      (entry) => entry.providers.includes("quotio-openai") && entry.model === "gpt-5.6-sol",
    )

    // then
    expect(quotioRung).toBeDefined()
    expect(quotioRung?.providers).not.toContain("openai")
  })
})

describe("GPT-6.1 reasoning compatibility", () => {
  test("no openai gpt-6.1-sol entry uses unsupported none or minimal variants", () => {
    // given
    const unsupported = new Set(["none", "minimal"])

    // when / then
    for (const requirement of Object.values(AGENT_MODEL_REQUIREMENTS)) {
      for (const entry of findOpenAiEntries(requirement.fallbackChain)) {
        if (entry.model === "gpt-6.1-sol") {
          expect(unsupported.has(entry.variant ?? "")).toBe(false)
        }
      }
    }
    for (const requirement of Object.values(CATEGORY_MODEL_REQUIREMENTS)) {
      for (const entry of findOpenAiEntries(requirement.fallbackChain)) {
        if (entry.model === "gpt-6.1-sol") {
          expect(unsupported.has(entry.variant ?? "")).toBe(false)
        }
      }
    }
  })
})

describe("GPT-6 reasoning-effort heuristics", () => {
  test("model-specific heuristic families exclude unsupported efforts", async () => {
    // given
    const { detectHeuristicModelFamily } = await import("./model-capability-heuristics")

    // when / then: 6.1-sol never exposes none/minimal (dot and hyphen forms)
    for (const model of ["openai/gpt-6.1-sol", "gpt-6-1-sol", "gpt-6-1-sol-fast"]) {
      const family = detectHeuristicModelFamily(model)
      expect(family?.reasoningEfforts).not.toContain("none")
      expect(family?.reasoningEfforts).not.toContain("minimal")
      expect(family?.reasoningEfforts).toContain("xhigh")
    }
    // sol 6.0 and luna support none but not minimal
    for (const model of ["openai/gpt-6-sol", "openai/gpt-6-luna"]) {
      const family = detectHeuristicModelFamily(model)
      expect(family?.reasoningEfforts).toContain("none")
      expect(family?.reasoningEfforts).not.toContain("minimal")
    }
  })
})
