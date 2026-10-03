import { describe, expect, test } from "bun:test"
import { AGENT_MODEL_REQUIREMENTS } from "./model-requirements"

describe("AGENT_MODEL_REQUIREMENTS", () => {
  test("oracle has native gpt-6.1-sol xhigh primary before legacy sol and copilot fallbacks", () => {
    // given
    const oracle = AGENT_MODEL_REQUIREMENTS["oracle"]

    // when
    const primary = oracle.fallbackChain[0]

    // then
    expect(oracle.fallbackChain).toBeArray()
    expect(oracle.fallbackChain.length).toBeGreaterThan(0)
    expect(primary).toEqual({
      providers: ["openai"],
      model: "gpt-6.1-sol",
      variant: "xhigh",
    })
    expect(oracle.fallbackChain[1]).toEqual({
      providers: ["opencode", "vercel"],
      model: "gpt-5.6-sol",
      variant: "xhigh",
    })
    expect(oracle.fallbackChain[2]).toEqual({
      providers: ["github-copilot"],
      model: "gpt-5.6-sol",
      variant: "high",
    })
  })

  test("sisyphus keeps opus primary before Kimi K3, gpt-6.1-sol, legacy sol, GLM 5.2, and big-pickle fallbacks", () => {
    // given
    const sisyphus = AGENT_MODEL_REQUIREMENTS["sisyphus"]

    // when
    const [primary, second, sol61Fallback, legacySolFallback, fourth, last] = sisyphus.fallbackChain

    // then
    expect(sisyphus.fallbackChain).toHaveLength(6)
    expect(sisyphus.requiresAnyModel).toBe(true)
    expect(primary).toEqual({
      providers: ["anthropic", "github-copilot", "opencode", "vercel"],
      model: "claude-opus-5",
      variant: "max",
    })
    expect(second).toEqual({
      providers: [
        "opencode-go",
        "kimi-for-coding",
        "moonshotai",
        "opencode",
        "vercel",
        "bailian-coding-plan",
        "moonshotai-cn",
        "firmware",
        "ollama-cloud",
        "aihubmix",
      ],
      model: "kimi-k3",
    })
    expect(sol61Fallback).toEqual({
      providers: ["openai"],
      model: "gpt-6.1-sol",
      variant: "medium",
    })
    expect(legacySolFallback).toEqual({
      providers: ["github-copilot", "opencode", "vercel"],
      model: "gpt-5.6-sol",
      variant: "medium",
    })
    expect(fourth?.providers[0]).toBe("zai-coding-plan")
    expect(fourth?.model).toBe("glm-5.2")
    expect(last?.providers[0]).toBe("opencode")
    expect(last?.model).toBe("big-pickle")
  })

  test("librarian keeps gpt-6-luna primary before qwen, minimax, haiku, and nano fallbacks", () => {
    // given
    const librarian = AGENT_MODEL_REQUIREMENTS["librarian"]

    // when
    const [primary, , second, third, fourth, fifth, sixth, seventh, eighth] =
      librarian.fallbackChain

    // then
    expect(librarian.fallbackChain).toHaveLength(9)
    expect(primary).toEqual({ providers: ["openai"], model: "gpt-6-luna", variant: "low" })
    expect(second?.providers).toContain("opencode-go")
    expect(second?.providers).toContain("bailian-coding-plan")
    expect(second?.model).toBe("qwen3.7-plus")
    expect(third).toEqual({ providers: ["vercel"], model: "minimax-m2.7-highspeed" })
    expect(fourth?.providers).toContain("opencode-go")
    expect(fourth?.model).toBe("minimax-m3")
    expect(fifth).toEqual({
      providers: ["minimax-coding-plan", "minimax-cn-coding-plan"],
      model: "MiniMax-M3",
    })
    expect(sixth?.providers).toContain("opencode-go")
    expect(sixth?.model).toBe("minimax-m2.7")
    expect(seventh?.providers).toContain("anthropic")
    expect(seventh?.model).toBe("claude-haiku-4-5")
    expect(eighth?.providers).not.toContain("openai")
    expect(eighth?.model).toBe("gpt-5.4-nano")
  })

  test("explore keeps gpt-6-luna primary before qwen, minimax, haiku, and nano fallbacks", () => {
    // given
    const explore = AGENT_MODEL_REQUIREMENTS["explore"]

    // when
    const [primary, , second, third, fourth, fifth, sixth, seventh, eighth] = explore.fallbackChain

    // then
    expect(explore.fallbackChain).toHaveLength(9)
    expect(primary).toEqual({ providers: ["openai"], model: "gpt-6-luna", variant: "low" })
    expect(second?.providers).toContain("opencode-go")
    expect(second?.providers).toContain("bailian-coding-plan")
    expect(second?.model).toBe("qwen3.7-plus")
    expect(third).toEqual({ providers: ["vercel"], model: "minimax-m2.7-highspeed" })
    expect(fourth?.providers).toContain("opencode-go")
    expect(fourth?.model).toBe("minimax-m3")
    expect(fifth).toEqual({
      providers: ["minimax-coding-plan", "minimax-cn-coding-plan"],
      model: "MiniMax-M3",
    })
    expect(sixth?.providers).toContain("opencode-go")
    expect(sixth?.model).toBe("minimax-m2.7")
    expect(seventh?.providers).toContain("anthropic")
    expect(seventh?.model).toBe("claude-haiku-4-5")
    expect(eighth?.providers).not.toContain("openai")
    expect(eighth?.model).toBe("gpt-5.4-nano")
  })

  test("multimodal-looker keeps vision-capable fallback order with gpt-6.1-sol primary", () => {
    // given
    const multimodalLooker = AGENT_MODEL_REQUIREMENTS["multimodal-looker"]

    // when
    const [primary, secondary, tertiary, quaternary, last] = multimodalLooker.fallbackChain

    // then
    expect(multimodalLooker.fallbackChain).toHaveLength(5)
    expect(primary).toEqual({
      providers: ["openai"],
      model: "gpt-6.1-sol",
      variant: "low",
    })
    expect(secondary).toEqual({
      providers: ["opencode", "vercel"],
      model: "gpt-5.6-sol",
      variant: "low",
    })
    expect(tertiary).toEqual({ providers: ["opencode-go", "vercel"], model: "kimi-k3" })
    expect(quaternary?.model).toBe("glm-4.6v")
    expect(last).toEqual({
      providers: ["github-copilot", "opencode", "vercel"],
      model: "gpt-5-nano",
    })
    expect(last?.providers).not.toContain("openai")
  })

  test("prometheus uses Fable 5 xhigh before Kimi K3 max", () => {
    // given
    const prometheus = AGENT_MODEL_REQUIREMENTS["prometheus"]

    // when
    const [primary, kimiFallback] = prometheus.fallbackChain

    // then
    expect(prometheus.fallbackChain).toHaveLength(2)
    expect(primary).toEqual({
      providers: ["anthropic", "github-copilot", "opencode", "vercel"],
      model: "claude-fable-5",
      variant: "xhigh",
    })
    expect(kimiFallback).toEqual({
      providers: ["opencode-go", "kimi-for-coding", "moonshotai", "opencode", "vercel"],
      model: "kimi-k3",
      variant: "max",
    })
  })

  test("metis uses Opus 5 high before Kimi K3 low", () => {
    // given
    const metis = AGENT_MODEL_REQUIREMENTS["metis"]

    // when
    const [primary, kimiFallback] = metis.fallbackChain

    // then
    expect(metis.fallbackChain).toHaveLength(2)
    expect(primary).toEqual({
      providers: ["anthropic", "github-copilot", "opencode", "vercel"],
      model: "claude-opus-5",
      variant: "high",
    })
    expect(kimiFallback).toEqual({
      providers: ["opencode-go", "kimi-for-coding", "moonshotai", "opencode", "vercel"],
      model: "kimi-k3",
      variant: "low",
    })
  })

  test("momus keeps native gpt-6-sol high before gpt-6.1-sol xhigh and legacy/copilot rungs", () => {
    // given
    const momus = AGENT_MODEL_REQUIREMENTS["momus"]

    // when
    const [primary, vercelTerra, copilotTerra, sol61Fallback, legacySolFallback, copilotSolFallback, opusFallback] =
      momus.fallbackChain

    // then
    expect(momus.fallbackChain.length).toBeGreaterThan(1)
    expect(primary).toEqual({
      providers: ["openai"],
      model: "gpt-6-sol",
      variant: "high",
    })
    expect(vercelTerra).toEqual({
      providers: ["vercel"],
      model: "gpt-5.6-terra",
      variant: "high",
    })
    expect(copilotTerra).toEqual({
      providers: ["github-copilot"],
      model: "gpt-5.6-terra",
      variant: "high",
    })
    expect(sol61Fallback).toEqual({
      providers: ["openai"],
      model: "gpt-6.1-sol",
      variant: "xhigh",
    })
    expect(legacySolFallback).toEqual({
      providers: ["opencode", "vercel"],
      model: "gpt-5.6-sol",
      variant: "xhigh",
    })
    expect(copilotSolFallback).toEqual({
      providers: ["github-copilot"],
      model: "gpt-5.6-sol",
      variant: "high",
    })
    expect(opusFallback).toEqual({
      providers: ["anthropic", "github-copilot", "opencode", "vercel"],
      model: "claude-opus-5",
      variant: "max",
    })
  })

  test("atlas keeps sonnet, kimi, gpt-6.1-sol, legacy sol, and minimax fallback order", () => {
    // given
    const atlas = AGENT_MODEL_REQUIREMENTS["atlas"]

    // when
    const [primary, secondary, sol61Fallback, legacySolFallback, fourth, fifth, sixth] = atlas.fallbackChain

    // then
    expect(atlas.fallbackChain).toHaveLength(7)
    expect(primary?.model).toBe("claude-sonnet-5")
    expect(primary?.providers[0]).toBe("anthropic")
    expect(secondary?.model).toBe("kimi-k3")
    expect(secondary?.providers[0]).toBe("opencode-go")
    expect(sol61Fallback).toEqual({
      providers: ["openai"],
      model: "gpt-6.1-sol",
      variant: "medium",
    })
    expect(legacySolFallback).toEqual({
      providers: ["github-copilot", "opencode", "vercel"],
      model: "gpt-5.6-sol",
      variant: "medium",
    })
    expect(fourth?.model).toBe("minimax-m3")
    expect(fourth?.providers[0]).toBe("opencode-go")
    expect(fifth).toEqual({
      providers: ["minimax-coding-plan", "minimax-cn-coding-plan"],
      model: "MiniMax-M3",
    })
    expect(sixth?.model).toBe("minimax-m2.7")
    expect(sixth?.providers[0]).toBe("opencode-go")
  })

  test("sisyphus-junior keeps sonnet, Kimi, gpt-6.1-sol, legacy sol, minimax, and big-pickle fallbacks", () => {
    // given
    const sisyphusJunior = AGENT_MODEL_REQUIREMENTS["sisyphus-junior"]

    // when
    const modelIDs = sisyphusJunior.fallbackChain.map((entry) => entry.model)

    // then
    expect(modelIDs).toEqual([
      "claude-sonnet-5",
      "kimi-k3",
      "gpt-6.1-sol",
      "gpt-5.6-sol",
      "minimax-m3",
      "MiniMax-M3",
      "minimax-m2.7",
      "big-pickle",
    ])
    expect(modelIDs).not.toContain("gpt-5.5")
  })

  test("hephaestus supports openai, github-copilot, opencode, and vercel providers", () => {
    // given
    const hephaestus = AGENT_MODEL_REQUIREMENTS["hephaestus"]

    // when / then
    expect(hephaestus.requiresProvider).toEqual([
      "openai",
      "github-copilot",
      "opencode",
      "vercel",
    ])
    expect(hephaestus.requiresProvider).not.toContain("venice")
    expect(hephaestus.fallbackChain[0]?.providers).not.toContain("venice")
    expect(hephaestus.requiresModel).toBeUndefined()
    expect(hephaestus.requiresAnyModel).toBe(true)
  })

  test("hephaestus has split native gpt-6.1-sol and legacy gpt-5.6-sol medium rungs", () => {
    // given
    const hephaestus = AGENT_MODEL_REQUIREMENTS["hephaestus"]

    // when
    const [primary, legacy] = hephaestus.fallbackChain

    // then
    expect(hephaestus.fallbackChain).toHaveLength(2)
    expect(primary).toEqual({
      providers: ["openai"],
      model: "gpt-6.1-sol",
      variant: "medium",
    })
    expect(legacy).toEqual({
      providers: ["github-copilot", "vercel", "opencode"],
      model: "gpt-5.6-sol",
      variant: "medium",
    })
  })
})
