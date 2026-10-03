import { describe, expect, test } from "bun:test"

import {
  getHephaestusPromptSource,
  isHephaestusSupportedModel,
} from "./agents/hephaestus/agent"
import { getGptPromptIdentity } from "./agents/gpt-prompt-identity"
import { resolveSisyphusPromptFamily } from "./agents/sisyphus-agent-factory"
import { getSisyphusJuniorPromptSource } from "./agents/sisyphus-junior/agent"
import { createMomusAgent, MOMUS_SYSTEM_PROMPT } from "./agents/momus"
import { MOMUS_GPT_5_6_PROMPT } from "./agents/momus-gpt-5-6"
import { getHighVariant } from "./hooks/think-mode/switcher"
import { resolveFallbackAgentName } from "./plugin/event-error-utils"
import {
  DEEP_CATEGORY_PROMPT_APPEND,
  DEEP_CATEGORY_PROMPT_APPEND_GPT_5_5,
  OPENAI_CATEGORIES,
  resolveDeepCategoryPromptAppend,
} from "./tools/delegate-task/openai-categories"

/**
 * GPT-6 structural support for the native OpenAI routing migration (#203).
 * Without these, migrated routes would throw (Hephaestus), lose tuned prompts,
 * or skip think-mode upgrades.
 */

describe("Hephaestus GPT-6 support", () => {
  test("accepts gpt-6 family models as supported", () => {
    // given
    const models = [
      "openai/gpt-6.1-sol",
      "openai/gpt-6-sol",
      "openai/gpt-6-luna",
      "gpt-6.1-sol",
      "amazon-bedrock/openai.gpt-6.1-sol",
    ]

    // when / then
    for (const model of models) {
      expect(isHephaestusSupportedModel(model)).toBe(true)
    }
  })

  test("rejects non-GPT models as before", () => {
    // given / when / then
    expect(isHephaestusSupportedModel("anthropic/claude-opus-5")).toBe(false)
    expect(isHephaestusSupportedModel(undefined)).toBe(false)
  })

  test("selects the gpt-5-6 tuned prompt source for gpt-6 models", () => {
    // given
    const models = ["openai/gpt-6.1-sol", "openai/gpt-6-sol", "openai/gpt-6-luna"]

    // when / then
    for (const model of models) {
      expect(getHephaestusPromptSource(model)).toBe("gpt-5-6")
    }
  })
})

describe("GPT prompt identity for gpt-6", () => {
  test("gpt-6 models resolve to the GPT-6 identity", () => {
    // given / when / then
    expect(getGptPromptIdentity("openai/gpt-6.1-sol")).toBe("GPT-6")
    expect(getGptPromptIdentity("openai/gpt-6-luna")).toBe("GPT-6")
    expect(getGptPromptIdentity("openai/gpt-5.6-sol")).toBe("GPT-5.6 Sol")
    expect(getGptPromptIdentity("openai/gpt-5.5")).toBe("GPT-5.5")
  })
})

describe("Sisyphus prompt family for gpt-6", () => {
  test("gpt-6 models resolve to the gpt-5-5 prompt family", () => {
    // given / when / then
    expect(resolveSisyphusPromptFamily("openai/gpt-6.1-sol")).toBe("gpt-5-5")
    expect(resolveSisyphusPromptFamily("openai/gpt-6-luna")).toBe("gpt-5-5")
  })
})

describe("Sisyphus-Junior prompt source for gpt-6", () => {
  test("gpt-6 models resolve to the gpt-5-5 prompt source", () => {
    // given / when / then
    expect(getSisyphusJuniorPromptSource("openai/gpt-6.1-sol")).toBe("gpt-5-5")
    expect(getSisyphusJuniorPromptSource("openai/gpt-6-luna")).toBe("gpt-5-5")
  })
})

describe("Momus GPT-6 support", () => {
  test("gpt-6 models keep the GPT-5.6 tuned prompt and high effort", () => {
    // given
    const config = createMomusAgent("openai/gpt-6.1-sol")

    // when / then
    expect(config.prompt).toBe(MOMUS_GPT_5_6_PROMPT)
    expect(config.prompt).not.toBe(MOMUS_SYSTEM_PROMPT)
    expect(config.reasoningEffort).toBe("high")
  })
})

describe("Think-mode GPT-6 variants", () => {
  test("gpt-6 models map to their high variants with preserved prefix", () => {
    // given / when / then
    expect(getHighVariant("openai/gpt-6.1-sol")).toBe("openai/gpt-6-1-sol-high")
    expect(getHighVariant("openai/gpt-6-sol")).toBe("openai/gpt-6-sol-high")
    expect(getHighVariant("openai/gpt-6-luna")).toBe("openai/gpt-6-luna-high")
    expect(getHighVariant("openai/gpt-6")).toBe("openai/gpt-6-high")
  })

  test("already-high gpt-6 variants return null", () => {
    // given / when / then
    expect(getHighVariant("openai/gpt-6-1-sol-high")).toBeNull()
  })
})

describe("fallback agent selection recognizes gpt-6", () => {
  test("gpt-6 model errors on the main session route to hephaestus", () => {
    // given
    const params = {
      sessionID: "main",
      mainSessionID: "main",
      message: "model gpt-6.1-sol returned an unexpected error",
    }

    // when / then
    expect(resolveFallbackAgentName(params)).toBe("hephaestus")
  })
})

describe("OpenAI delegate-task categories on GPT-6", () => {
  test("ultrabrain/deep/unspecified-low use gpt-6 targets with preserved variants", () => {
    // given
    const byName = new Map(OPENAI_CATEGORIES.map((category) => [category.name, category]))

    // when / then
    expect(byName.get("ultrabrain")?.config).toEqual({ model: "openai/gpt-6.1-sol", variant: "xhigh" })
    expect(byName.get("deep")?.config).toEqual({ model: "openai/gpt-6.1-sol", variant: "medium" })
    expect(byName.get("deep")?.requiresModel).toBe("gpt-6.1-sol")
    expect(byName.get("unspecified-low")?.config).toEqual({ model: "openai/gpt-6-luna", variant: "xhigh" })
  })

  test("deep prompt append resolver accepts gpt-6 models", () => {
    // given / when / then
    expect(resolveDeepCategoryPromptAppend("openai/gpt-6.1-sol")).toBe(DEEP_CATEGORY_PROMPT_APPEND_GPT_5_5)
    expect(resolveDeepCategoryPromptAppend("deepseek/deepseek-v4-flash")).toBe(DEEP_CATEGORY_PROMPT_APPEND)
  })

  test("caller warnings reference the gpt-6 fast tier", () => {
    // given
    const byName = new Map(OPENAI_CATEGORIES.map((category) => [category.name, category]))

    // when / then
    expect(byName.get("quick")?.promptAppend).not.toContain("gpt-5.6")
    expect(byName.get("unspecified-low")?.promptAppend).toContain("gpt-6-luna")
    expect(byName.get("unspecified-low")?.promptAppend).not.toContain("gpt-5.6")
  })
})
